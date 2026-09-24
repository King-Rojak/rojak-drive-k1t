import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import formidable from "formidable";
import admin from "firebase-admin";

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "4.5mb"
  }
};

const GITHUB_API = "https://api.github.com";
const MAX_MP3 = 3.5 * 1024 * 1024;
const MAX_COVER = 600 * 1024;

function json(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function fail(message, status = 500, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw fail("FIREBASE_SERVICE_ACCOUNT belum diatur di Vercel.", 500);

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw fail("FIREBASE_SERVICE_ACCOUNT bukan JSON yang valid.", 500);
  }

  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

function githubConfig() {
  const token = String(process.env.GITHUB_TOKEN || "").trim();
  const owner = String(process.env.GITHUB_OWNER || "").trim();
  const repo = String(process.env.GITHUB_REPO || "").trim().replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
  const branch = String(process.env.GITHUB_BRANCH || "main").trim();

  if (!token) throw fail("GITHUB_TOKEN belum diatur di Vercel.", 500);
  if (!owner) throw fail("GITHUB_OWNER belum diatur di Vercel.", 500);
  if (!repo) throw fail("GITHUB_REPO belum diatur di Vercel.", 500);
  if (!branch) throw fail("GITHUB_BRANCH belum diatur di Vercel.", 500);

  return { token, owner, repo, branch };
}

async function githubFetch(cfg, url, options = {}) {
  const response = await fetch(GITHUB_API + url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${cfg.token}`,
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "Rojak-DriveK1t",
      ...(options.headers || {})
    }
  });

  let data = null;
  const text = await response.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text || response.statusText };
  }

  return { response, data };
}

async function diagnoseGitHub(cfg) {
  const result = {
    owner: cfg.owner,
    repo: cfg.repo,
    branch: cfg.branch,
    tokenConfigured: Boolean(cfg.token),
    tokenPrefix: cfg.token ? cfg.token.slice(0, 10) + "..." : null
  };

  const me = await githubFetch(cfg, "/user");
  result.tokenStatus = me.response.status;
  result.tokenUser = me.data?.login || null;
  result.tokenMessage = me.data?.message || null;

  if (!me.response.ok) {
    if (me.response.status === 401) {
      throw fail("GITHUB_TOKEN ditolak GitHub. Token salah, dicabut, atau sudah tidak valid.", 502, {
        githubStatus: 401,
        diagnostic: result
      });
    }

    throw fail(`GitHub gagal memvalidasi token (HTTP ${me.response.status}).`, 502, {
      githubStatus: me.response.status,
      diagnostic: result
    });
  }

  const repoResult = await githubFetch(
    cfg,
    `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`
  );

  result.repoStatus = repoResult.response.status;
  result.repoExists = repoResult.response.ok;
  result.repoMessage = repoResult.data?.message || null;
  result.repoPrivate = repoResult.data?.private ?? null;
  result.defaultBranch = repoResult.data?.default_branch || null;
  result.permissions = repoResult.data?.permissions || null;

  if (!repoResult.response.ok) {
    if (repoResult.response.status === 404) {
      throw fail(
        `GitHub 404: token "${result.tokenUser}" tidak dapat mengakses ${cfg.owner}/${cfg.repo}. Pastikan Fine-grained token Resource owner = ${cfg.owner}, repository = ${cfg.owner}/${cfg.repo}, dan Contents = Read and write.`,
        502,
        { githubStatus: 404, diagnostic: result }
      );
    }

    throw fail(
      `GitHub gagal membuka repository ${cfg.owner}/${cfg.repo} (HTTP ${repoResult.response.status}).`,
      502,
      { githubStatus: repoResult.response.status, diagnostic: result }
    );
  }

  const branchResult = await githubFetch(
    cfg,
    `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/branches/${encodeURIComponent(cfg.branch)}`
  );

  result.branchStatus = branchResult.response.status;
  result.branchExists = branchResult.response.ok;
  result.branchMessage = branchResult.data?.message || null;

  if (!branchResult.response.ok) {
    throw fail(
      `Branch "${cfg.branch}" tidak ditemukan di ${cfg.owner}/${cfg.repo}. Branch default repository adalah "${result.defaultBranch}".`,
      502,
      { githubStatus: branchResult.response.status, diagnostic: result }
    );
  }

  return result;
}

async function verifyAdmin(req) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) throw fail("Authorization Firebase token tidak ada.", 401);

  const app = getAdminApp();
  const decoded = await admin.auth(app).verifyIdToken(token);
  const snap = await admin.firestore(app).collection("users").doc(decoded.uid).get();

  if (!snap.exists || snap.data()?.role !== "admin") {
    throw fail("Akses Admin diperlukan.", 403);
  }

  return { app, uid: decoded.uid };
}

function cleanName(value, fallback = "music") {
  return String(value || fallback)
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 70) || fallback;
}

function pickFile(value) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

function field(fields, name) {
  const value = fields[name];
  return Array.isArray(value) ? value[0] : value;
}

async function parseMultipart(req) {
  const form = formidable({
    multiples: false,
    maxFileSize: MAX_MP3,
    maxTotalFileSize: 4.3 * 1024 * 1024,
    keepExtensions: true,
    allowEmptyFiles: false
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

async function createOrUpdateFile(cfg, filePath, buffer, message) {
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const content = buffer.toString("base64");

  const result = await githubFetch(
    cfg,
    `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodedPath}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message,
        content,
        branch: cfg.branch
      }),
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  if (!result.response.ok) {
    const ghMessage = result.data?.message || "Unknown GitHub error";

    if (result.response.status === 404) {
      throw fail(
        `GitHub menolak upload (404). Token terdeteksi valid, tetapi tidak punya akses write ke ${cfg.owner}/${cfg.repo}. Cek Fine-grained token: Resource owner = ${cfg.owner}, repository = ${cfg.owner}/${cfg.repo}, Contents = Read and write.`,
        502,
        { githubStatus: 404, githubMessage: ghMessage }
      );
    }

    if (result.response.status === 403) {
      throw fail(
        `GitHub menolak upload (403): ${ghMessage}. Pastikan Contents = Read and write.`,
        502,
        { githubStatus: 403, githubMessage: ghMessage }
      );
    }

    throw fail(
      `GitHub upload gagal (HTTP ${result.response.status}): ${ghMessage}`,
      502,
      { githubStatus: result.response.status, githubMessage: ghMessage }
    );
  }

  return {
    sha: result.data?.content?.sha || null,
    url: `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${filePath}`
  };
}

async function getFileSha(cfg, filePath) {
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const result = await githubFetch(
    cfg,
    `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(cfg.branch)}`
  );

  if (!result.response.ok || Array.isArray(result.data)) return null;
  return result.data?.sha || null;
}

async function deleteFile(cfg, filePath, sha, message) {
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  return githubFetch(
    cfg,
    `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodedPath}`,
    {
      method: "DELETE",
      body: JSON.stringify({
        message,
        sha,
        branch: cfg.branch
      }),
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

function publicDiagnostic(diagnostic) {
  if (!diagnostic) return null;
  return {
    owner: diagnostic.owner,
    repo: diagnostic.repo,
    branch: diagnostic.branch,
    tokenConfigured: diagnostic.tokenConfigured,
    tokenPrefix: diagnostic.tokenPrefix,
    tokenStatus: diagnostic.tokenStatus,
    tokenUser: diagnostic.tokenUser,
    repoStatus: diagnostic.repoStatus,
    repoExists: diagnostic.repoExists,
    repoPrivate: diagnostic.repoPrivate,
    defaultBranch: diagnostic.defaultBranch,
    permissions: diagnostic.permissions,
    branchStatus: diagnostic.branchStatus,
    branchExists: diagnostic.branchExists,
    message: diagnostic.repoMessage || diagnostic.tokenMessage || diagnostic.branchMessage || null
  };
}

export default async function handler(req, res) {
  try {
    const { app, uid } = await verifyAdmin(req);
    const cfg = githubConfig();
    const db = admin.firestore(app);

    if (req.method === "GET") {
      if (String(req.query?.diagnose || "") === "1") {
        const diagnostic = await diagnoseGitHub(cfg);
        return json(res, 200, { ok: true, diagnostic: publicDiagnostic(diagnostic) });
      }

      const snap = await db.collection("music").orderBy("createdAt", "desc").get();
      return json(res, 200, {
        ok: true,
        music: snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      });
    }

    if (req.method === "POST") {
      // Run the GitHub check BEFORE reading/uploading the large multipart body.
      const diagnostic = await diagnoseGitHub(cfg);

      const { fields, files } = await parseMultipart(req);
      const title = String(field(fields, "title") || "").trim();
      const artist = String(field(fields, "artist") || "").trim();
      const mp3 = pickFile(files.mp3);
      const cover = pickFile(files.cover);

      if (!title || !artist || !mp3 || !cover) {
        return json(res, 400, {
          ok: false,
          error: "Title, artist, MP3, dan cover wajib diisi.",
          diagnostic: publicDiagnostic(diagnostic)
        });
      }

      const mp3Mime = String(mp3.mimetype || "").toLowerCase();
      const coverMime = String(cover.mimetype || "").toLowerCase();

      if (
        mp3Mime !== "audio/mpeg" &&
        path.extname(mp3.originalFilename || "").toLowerCase() !== ".mp3"
      ) {
        return json(res, 400, { ok: false, error: "File audio harus MP3." });
      }

      if (!["image/jpeg", "image/png", "image/webp"].includes(coverMime)) {
        return json(res, 400, { ok: false, error: "Cover harus JPG, PNG, atau WEBP." });
      }

      const mp3Buffer = await fs.readFile(mp3.filepath);
      const coverBuffer = await fs.readFile(cover.filepath);

      if (mp3Buffer.length > MAX_MP3) {
        return json(res, 400, { ok: false, error: "MP3 maksimal 3.5 MB pada versi Vercel ini." });
      }

      if (coverBuffer.length > MAX_COVER) {
        return json(res, 400, { ok: false, error: "Cover maksimal 600 KB pada versi Vercel ini." });
      }

      const id = crypto.randomUUID();
      const base = `${cleanName(title, "music")}-${id.slice(0, 8)}`;
      const ext = coverMime === "image/png" ? "png" : coverMime === "image/webp" ? "webp" : "jpg";
      const audioPath = `music/${base}.mp3`;
      const coverPath = `covers/${base}.${ext}`;

      let audioGithub = null;
      let coverGithub = null;

      try {
        audioGithub = await createOrUpdateFile(cfg, audioPath, mp3Buffer, `Add music: ${title}`);
        coverGithub = await createOrUpdateFile(cfg, coverPath, coverBuffer, `Add cover: ${title}`);
      } catch (error) {
        if (audioGithub) {
          try {
            const sha = await getFileSha(cfg, audioPath);
            if (sha) await deleteFile(cfg, audioPath, sha, `Rollback music: ${title}`);
          } catch {}
        }
        throw error;
      }

      await db.collection("music").doc(id).set({
        title,
        artist,
        audioUrl: audioGithub.url,
        coverUrl: coverGithub.url,
        audioPath,
        coverPath,
        createdBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return json(res, 200, {
        ok: true,
        id,
        title,
        artist,
        audioUrl: audioGithub.url,
        coverUrl: coverGithub.url,
        github: publicDiagnostic(diagnostic)
      });
    }

    if (req.method === "DELETE") {
      let body = "";
      for await (const chunk of req) body += chunk;

      let parsed;
      try {
        parsed = JSON.parse(body || "{}");
      } catch {
        return json(res, 400, { ok: false, error: "Body JSON tidak valid." });
      }

      const musicId = String(parsed.id || "").trim();
      if (!musicId) return json(res, 400, { ok: false, error: "Music ID wajib." });

      const ref = db.collection("music").doc(musicId);
      const snap = await ref.get();
      if (!snap.exists) return json(res, 404, { ok: false, error: "Music tidak ditemukan." });

      const song = snap.data();

      for (const filePath of [song.audioPath, song.coverPath]) {
        if (!filePath) continue;
        const sha = await getFileSha(cfg, filePath);
        if (!sha) continue;

        const result = await deleteFile(
          cfg,
          filePath,
          sha,
          `Delete music: ${song.title || musicId}`
        );

        if (!result.response.ok) {
          throw fail(
            `Gagal menghapus ${filePath} dari GitHub: ${result.data?.message || result.response.statusText}`,
            502,
            { githubStatus: result.response.status }
          );
        }
      }

      await ref.delete();
      return json(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return json(res, 405, { ok: false, error: "Method tidak didukung." });
  } catch (error) {
    console.error("Rojak DriveK1t API error:", error);

    return json(res, error.status || 500, {
      ok: false,
      error: error.message || "Server error.",
      githubStatus: error.githubStatus || null,
      githubMessage: error.githubMessage || null,
      diagnostic: publicDiagnostic(error.diagnostic)
    });
  }
}
