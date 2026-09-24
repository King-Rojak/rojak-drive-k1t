import formidable from "formidable";
import fs from "fs/promises";
import path from "path";
import { Octokit } from "@octokit/rest";
import admin from "firebase-admin";

export const config = {
  api: {
    bodyParser: false
  }
};

/* =========================================================
   FIREBASE ADMIN
========================================================= */

function getFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT
  );

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

/* =========================================================
   GITHUB
========================================================= */

function getOctokit() {
  return new Octokit({
    auth: process.env.GITHUB_TOKEN
  });
}

function githubConfig() {
  return {
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH || "main"
  };
}

/* =========================================================
   HELPERS
========================================================= */

function cleanName(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function extensionFromMime(mime, fallback) {
  const map = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
  };

  return map[mime] || fallback;
}

async function getGitHubFileSha(octokit, config, filePath) {
  try {
    const response = await octokit.rest.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: filePath,
      ref: config.branch
    });

    if (Array.isArray(response.data)) {
      return null;
    }

    return response.data.sha || null;
  } catch (error) {
    if (error.status === 404) {
      return null;
    }

    throw error;
  }
}

async function uploadToGitHub(
  octokit,
  config,
  filePath,
  buffer,
  commitMessage
) {
  const sha = await getGitHubFileSha(
    octokit,
    config,
    filePath
  );

  const result = await octokit.rest.repos.createOrUpdateFileContents({
    owner: config.owner,
    repo: config.repo,
    path: filePath,
    message: commitMessage,
    content: buffer.toString("base64"),
    branch: config.branch,
    ...(sha ? { sha } : {})
  });

  return result.data;
}

async function deleteFromGitHub(
  octokit,
  config,
  filePath,
  commitMessage
) {
  const sha = await getGitHubFileSha(
    octokit,
    config,
    filePath
  );

  if (!sha) {
    return false;
  }

  await octokit.rest.repos.deleteFile({
    owner: config.owner,
    repo: config.repo,
    path: filePath,
    message: commitMessage,
    sha,
    branch: config.branch
  });

  return true;
}

/* =========================================================
   ADMIN CHECK
========================================================= */

async function verifyAdmin(req) {
  const authorization =
    req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const idToken = authorization.substring(7);

  const firebase = getFirebaseAdmin();

  const decoded =
    await firebase
      .auth()
      .verifyIdToken(idToken);

  const userDoc =
    await firebase
      .firestore()
      .collection("users")
      .doc(decoded.uid)
      .get();

  if (!userDoc.exists) {
    throw new Error("FORBIDDEN");
  }

  const userData = userDoc.data();

  if (userData.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return {
    uid: decoded.uid,
    email: decoded.email || "",
    name: userData.name || ""
  };
}

/* =========================================================
   RESPONSE
========================================================= */

function sendJson(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

/* =========================================================
   HANDLER
========================================================= */

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, {
        ok: true,
        message: "Rojak DriveK1t Music API aktif."
      });
    }

    if (req.method !== "POST") {
      return sendJson(res, 405, {
        ok: false,
        message: "Method tidak diizinkan."
      });
    }

    /* ---------------------------------------------
       ADMIN AUTH
    --------------------------------------------- */

    const adminUser = await verifyAdmin(req);

    /* ---------------------------------------------
       FORM
    --------------------------------------------- */

    const form = formidable({
      multiples: false,
      maxFileSize: 20 * 1024 * 1024,
      keepExtensions: true
    });

    const [fields, files] =
      await form.parse(req);

    const title =
      Array.isArray(fields.title)
        ? fields.title[0]
        : fields.title;

    const artist =
      Array.isArray(fields.artist)
        ? fields.artist[0]
        : fields.artist;

    const action =
      Array.isArray(fields.action)
        ? fields.action[0]
        : fields.action;

    /* =====================================================
       DELETE
    ===================================================== */

    if (action === "delete") {
      const musicId =
        Array.isArray(fields.musicId)
          ? fields.musicId[0]
          : fields.musicId;

      const musicPath =
        Array.isArray(fields.musicPath)
          ? fields.musicPath[0]
          : fields.musicPath;

      const coverPath =
        Array.isArray(fields.coverPath)
          ? fields.coverPath[0]
          : fields.coverPath;

      if (!musicId) {
        return sendJson(res, 400, {
          ok: false,
          message: "musicId tidak ditemukan."
        });
      }

      const firebase = getFirebaseAdmin();

      const musicRef =
        firebase
          .firestore()
          .collection("music")
          .doc(musicId);

      const musicSnapshot =
        await musicRef.get();

      if (!musicSnapshot.exists) {
        return sendJson(res, 404, {
          ok: false,
          message: "Data lagu tidak ditemukan."
        });
      }

      const data = musicSnapshot.data();

      const config = githubConfig();
      const octokit = getOctokit();

      const finalMusicPath =
        musicPath || data.musicPath;

      const finalCoverPath =
        coverPath || data.coverPath;

      if (finalMusicPath) {
        await deleteFromGitHub(
          octokit,
          config,
          finalMusicPath,
          `Delete music: ${data.title || musicId}`
        );
      }

      if (finalCoverPath) {
        await deleteFromGitHub(
          octokit,
          config,
          finalCoverPath,
          `Delete cover: ${data.title || musicId}`
        );
      }

      await musicRef.delete();

      return sendJson(res, 200, {
        ok: true,
        message: "Lagu berhasil dihapus."
      });
    }

    /* =====================================================
       UPLOAD
    ===================================================== */

    if (action !== "upload") {
      return sendJson(res, 400, {
        ok: false,
        message: "Action tidak valid."
      });
    }

    if (!title || !artist) {
      return sendJson(res, 400, {
        ok: false,
        message: "Judul dan artist wajib diisi."
      });
    }

    const musicFile =
      Array.isArray(files.music)
        ? files.music[0]
        : files.music;

    const coverFile =
      Array.isArray(files.cover)
        ? files.cover[0]
        : files.cover;

    if (!musicFile) {
      return sendJson(res, 400, {
        ok: false,
        message: "File MP3 belum dipilih."
      });
    }

    if (!coverFile) {
      return sendJson(res, 400, {
        ok: false,
        message: "Cover belum dipilih."
      });
    }

    /* ---------------------------------------------
       VALIDATE MP3
    --------------------------------------------- */

    const musicMime =
      musicFile.mimetype || "";

    const musicExt =
      path.extname(musicFile.originalFilename || "")
        .toLowerCase();

    if (
      musicMime !== "audio/mpeg" &&
      musicMime !== "audio/mp3" &&
      musicExt !== ".mp3"
    ) {
      return sendJson(res, 400, {
        ok: false,
        message: "File musik harus MP3."
      });
    }

    /* ---------------------------------------------
       VALIDATE COVER
    --------------------------------------------- */

    const coverMime =
      coverFile.mimetype || "";

    const coverExt =
      path.extname(coverFile.originalFilename || "")
        .toLowerCase();

    const allowedCoverMime = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    const allowedCoverExt = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp"
    ];

    if (
      !allowedCoverMime.includes(coverMime) &&
      !allowedCoverExt.includes(coverExt)
    ) {
      return sendJson(res, 400, {
        ok: false,
        message:
          "Cover harus JPG, PNG, atau WEBP."
      });
    }

    /* ---------------------------------------------
       READ FILES
    --------------------------------------------- */

    const musicBuffer =
      await fs.readFile(musicFile.filepath);

    const coverBuffer =
      await fs.readFile(coverFile.filepath);

    /* ---------------------------------------------
       FILE NAME
    --------------------------------------------- */

    const safeTitle = cleanName(title);

    const timestamp =
      Date.now();

    const musicFileName =
      `${safeTitle}-${timestamp}.mp3`;

    const coverExtension =
      extensionFromMime(
        coverMime,
        coverExt || ".jpg"
      );

    const coverFileName =
      `${safeTitle}-${timestamp}${coverExtension}`;

    const musicPath =
      `music/${musicFileName}`;

    const coverPath =
      `covers/${coverFileName}`;

    /* ---------------------------------------------
       GITHUB UPLOAD
    --------------------------------------------- */

    const config = githubConfig();

    const octokit =
      getOctokit();

    await uploadToGitHub(
      octokit,
      config,
      musicPath,
      musicBuffer,
      `Add music: ${title}`
    );

    await uploadToGitHub(
      octokit,
      config,
      coverPath,
      coverBuffer,
      `Add cover: ${title}`
    );

    /* ---------------------------------------------
       RAW URL
    --------------------------------------------- */

    const encodedMusicPath =
      musicPath
        .split("/")
        .map(encodeURIComponent)
        .join("/");

    const encodedCoverPath =
      coverPath
        .split("/")
        .map(encodeURIComponent)
        .join("/");

    const musicUrl =
      `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${encodedMusicPath}`;

    const coverUrl =
      `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${encodedCoverPath}`;

    /* ---------------------------------------------
       FIRESTORE
    --------------------------------------------- */

    const firebase =
      getFirebaseAdmin();

    const musicRef =
      firebase
        .firestore()
        .collection("music")
        .doc();

    await musicRef.set({
      title: String(title).trim(),
      artist: String(artist).trim(),

      musicUrl,
      coverUrl,

      musicPath,
      coverPath,

      musicFileName,
      coverFileName,

      createdAt:
        admin.firestore.FieldValue.serverTimestamp(),

      updatedAt:
        admin.firestore.FieldValue.serverTimestamp(),

      createdBy:
        adminUser.uid,

      createdByEmail:
        adminUser.email
    });

    /* ---------------------------------------------
       CLEAN TEMP FILES
    --------------------------------------------- */

    try {
      await fs.unlink(musicFile.filepath);
    } catch {}

    try {
      await fs.unlink(coverFile.filepath);
    } catch {}

    return sendJson(res, 200, {
      ok: true,
      message: "Musik berhasil ditambahkan.",

      music: {
        title,
        artist,
        musicUrl,
        coverUrl,
        musicPath,
        coverPath
      }
    });

  } catch (error) {
    console.error(
      "MUSIC API ERROR:",
      error
    );

    if (error.message === "UNAUTHORIZED") {
      return sendJson(res, 401, {
        ok: false,
        message: "Belum login."
      });
    }

    if (error.message === "FORBIDDEN") {
      return sendJson(res, 403, {
        ok: false,
        message:
          "Akses hanya untuk admin."
      });
    }

    return sendJson(res, 500, {
      ok: false,
      message:
        error.message ||
        "Terjadi kesalahan server."
    });
  }
}
