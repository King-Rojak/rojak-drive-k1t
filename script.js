const GOOGLE_CLIENT_ID =
  "GANTI_DENGAN_GOOGLE_CLIENT_ID_KAMU.apps.googleusercontent.com";

let currentUser = null;
let files = [];

const STORAGE_FILES = "rojak_drive_files";
const STORAGE_USER = "rojak_drive_user";

document.addEventListener("DOMContentLoaded", () => {
  loadSavedData();

  setupNavigation();
  setupButtons();
  setupSearch();
  setupAI();

  initializeGoogleLogin();

  renderFiles();
  updateProfile();
});

/* =========================================================
   LOCAL STORAGE
========================================================= */

function loadSavedData() {
  try {
    const savedFiles = localStorage.getItem(STORAGE_FILES);
    const savedUser = localStorage.getItem(STORAGE_USER);

    files = savedFiles ? JSON.parse(savedFiles) : [];
    currentUser = savedUser ? JSON.parse(savedUser) : null;
  } catch (error) {
    console.error("Gagal memuat data:", error);

    files = [];
    currentUser = null;
  }

  if (currentUser) {
    showApp();
  } else {
    showLogin();
  }
}

function saveFiles() {
  localStorage.setItem(STORAGE_FILES, JSON.stringify(files));
}

function saveUser() {
  if (currentUser) {
    localStorage.setItem(
      STORAGE_USER,
      JSON.stringify(currentUser)
    );
  }
}

/* =========================================================
   GOOGLE LOGIN
========================================================= */

function initializeGoogleLogin() {
  if (
    typeof google === "undefined" ||
    !google.accounts ||
    !google.accounts.id
  ) {
    console.error("Google Identity Services belum tersedia.");
    return;
  }

  const button = document.getElementById("googleButton");

  if (!button) return;

  if (
    !GOOGLE_CLIENT_ID ||
    GOOGLE_CLIENT_ID.includes("GANTI_DENGAN")
  ) {
    document.getElementById("loginStatus").textContent =
      "Google Client ID belum diatur.";

    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleLogin,
    auto_select: false,
    cancel_on_tap_outside: true
  });

  google.accounts.id.renderButton(button, {
    theme: "filled_black",
    size: "large",
    shape: "pill",
    width: 320
  });
}

function handleGoogleLogin(response) {
  try {
    const payload = parseJwt(response.credential);

    currentUser = {
      id: payload.sub,
      name: payload.name || "Pengguna",
      email: payload.email || "",
      picture: payload.picture || ""
    };

    saveUser();

    showApp();
    updateProfile();

    showToast("Login berhasil!");
  } catch (error) {
    console.error(error);

    const status = document.getElementById("loginStatus");

    if (status) {
      status.textContent =
        "Login Google gagal diproses.";
    }
  }
}

function parseJwt(token) {
  const base64Url = token.split(".")[1];

  const base64 = base64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map(
        (char) =>
          "%" +
          ("00" + char.charCodeAt(0).toString(16)).slice(-2)
      )
      .join("")
  );

  return JSON.parse(jsonPayload);
}

function logout() {
  currentUser = null;

  localStorage.removeItem(STORAGE_USER);

  if (
    typeof google !== "undefined" &&
    google.accounts &&
    google.accounts.id
  ) {
    google.accounts.id.disableAutoSelect();
  }

  showLogin();

  showToast("Berhasil logout.");
}

/* =========================================================
   LOGIN / APP
========================================================= */

function showLogin() {
  const loginScreen = document.getElementById("loginScreen");
  const app = document.getElementById("app");

  if (loginScreen) {
    loginScreen.style.display = "flex";
  }

  if (app) {
    app.style.display = "none";
  }
}

function showApp() {
  const loginScreen = document.getElementById("loginScreen");
  const app = document.getElementById("app");

  if (loginScreen) {
    loginScreen.style.display = "none";
  }

  if (app) {
    app.style.display = "flex";
  }
}

function updateProfile() {
  if (!currentUser) return;

  const nameElements = document.querySelectorAll(
    "[data-user-name]"
  );

  nameElements.forEach((element) => {
    element.textContent = currentUser.name;
  });

  const emailElements = document.querySelectorAll(
    "[data-user-email]"
  );

  emailElements.forEach((element) => {
    element.textContent = currentUser.email;
  });

  const imageElements = document.querySelectorAll(
    "[data-user-picture]"
  );

  imageElements.forEach((element) => {
    if (currentUser.picture) {
      element.src = currentUser.picture;
    }
  });
}

/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {
  const navItems = document.querySelectorAll("[data-page]");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.dataset.page;

      openPage(page);

      navItems.forEach((nav) => {
        nav.classList.remove("active");
      });

      item.classList.add("active");
    });
  });
}

function openPage(page) {
  document
    .querySelectorAll(".page")
    .forEach((element) => {
      element.classList.remove("active");
    });

  const target = document.getElementById(
    `page-${page}`
  );

  if (target) {
    target.classList.add("active");
  }

  if (page === "drive") {
    renderFiles();
  }

  if (page === "recent") {
    renderRecent();
  }

  if (page === "starred") {
    renderStarred();
  }
}

/* =========================================================
   BUTTONS
========================================================= */

function setupButtons() {
  const uploadButton =
    document.getElementById("uploadButton");

  const fileInput =
    document.getElementById("fileInput");

  const folderButton =
    document.getElementById("folderButton");

  const logoutButton =
    document.getElementById("logoutButton");

  const clearChat =
    document.getElementById("clearChat");

  if (uploadButton) {
    uploadButton.addEventListener(
      "click",
      openFilePicker
    );
  }

  if (fileInput) {
    fileInput.addEventListener(
      "change",
      handleFiles
    );
  }

  if (folderButton) {
    folderButton.addEventListener(
      "click",
      createFolder
    );
  }

  if (logoutButton) {
    logoutButton.addEventListener(
      "click",
      logout
    );
  }

  if (clearChat) {
    clearChat.addEventListener(
      "click",
      clearAIChat
    );
  }

  document
    .querySelectorAll("[data-action='upload']")
    .forEach((button) => {
      button.addEventListener(
        "click",
        openFilePicker
      );
    });

  document
    .querySelectorAll("[data-action='folder']")
    .forEach((button) => {
      button.addEventListener(
        "click",
        createFolder
      );
    });

  document
    .querySelectorAll("[data-action='ai']")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => openPage("ai")
      );
    });
}

/* =========================================================
   FILE
========================================================= */

function openFilePicker() {
  const input = document.getElementById("fileInput");

  if (input) {
    input.click();
  }
}

async function handleFiles(event) {
  const selectedFiles = Array.from(
    event.target.files || []
  );

  if (!selectedFiles.length) return;

  for (const file of selectedFiles) {
    let preview = "";

    if (file.type.startsWith("image/")) {
      preview = await readFileAsDataURL(file);
    }

    files.push({
      id:
        Date.now() +
        "_" +
        Math.random()
          .toString(36)
          .slice(2),

      name: file.name,

      type: file.type.startsWith("image/")
        ? "image"
        : "file",

      mimeType: file.type,

      size: file.size,

      preview,

      starred: false,

      createdAt: Date.now()
    });
  }

  saveFiles();
  renderFiles();

  event.target.value = "";

  showToast(
    `${selectedFiles.length} file berhasil ditambahkan.`
  );
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

function createFolder() {
  const name = prompt("Masukkan nama folder:");

  if (!name || !name.trim()) return;

  files.push({
    id:
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .slice(2),

    name: name.trim(),

    type: "folder",

    mimeType: "folder",

    size: 0,

    preview: "",

    starred: false,

    createdAt: Date.now()
  });

  saveFiles();
  renderFiles();

  showToast("Folder berhasil dibuat.");
}

/* =========================================================
   RENDER FILES
========================================================= */

function renderFiles() {
  renderGrid(
    document.getElementById("fileGrid"),
    files
  );

  const empty =
    document.getElementById("emptyState");

  if (empty) {
    empty.style.display =
      files.length === 0
        ? "flex"
        : "none";
  }
}

function renderRecent() {
  const recent = [...files]
    .sort(
      (a, b) =>
        (b.createdAt || 0) -
        (a.createdAt || 0)
    )
    .slice(0, 20);

  renderGrid(
    document.getElementById("recentGrid"),
    recent
  );
}

function renderStarred() {
  const starred = files.filter(
    (file) => file.starred
  );

  renderGrid(
    document.getElementById("starredGrid"),
    starred
  );
}

function renderGrid(container, items) {
  if (!container) return;

  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-grid">
        Belum ada file.
      </div>
    `;

    return;
  }

  items.forEach((file) => {
    const card = document.createElement("div");

    card.className = "file-card";

    card.innerHTML = `
      <div class="file-preview">
        ${
          file.type === "image" && file.preview
            ? `<img src="${file.preview}" alt="">`
            : file.type === "folder"
            ? "📁"
            : "📄"
        }
      </div>

      <div class="file-info">
        <div class="file-name">
          ${escapeHtml(file.name)}
        </div>

        <div class="file-meta">
          ${formatSize(file.size)}
        </div>
      </div>

      <button
        class="star-button ${
          file.starred ? "active" : ""
        }"
        data-star="${file.id}"
        title="Bintangi"
      >
        ★
      </button>
    `;

    card.addEventListener("click", (event) => {
      if (
        event.target.closest(
          "[data-star]"
        )
      ) {
        return;
      }

      openFile(file);
    });

    const starButton =
      card.querySelector("[data-star]");

    if (starButton) {
      starButton.addEventListener(
        "click",
        () => toggleStar(file.id)
      );
    }

    container.appendChild(card);
  });
}

function toggleStar(id) {
  const file = files.find(
    (item) => item.id === id
  );

  if (!file) return;

  file.starred = !file.starred;

  saveFiles();

  renderFiles();
  renderStarred();
  renderRecent();
}

function openFile(file) {
  if (file.type === "folder") {
    showToast(
      `Folder "${file.name}" dipilih.`
    );

    return;
  }

  if (
    file.type === "image" &&
    file.preview
  ) {
    const newWindow = window.open();

    if (newWindow) {
      newWindow.document.write(`
        <title>${escapeHtml(
          file.name
        )}</title>

        <style>
          body {
            margin: 0;
            background: #111;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }

          img {
            max-width: 95vw;
            max-height: 95vh;
            object-fit: contain;
          }
        </style>

        <img
          src="${file.preview}"
          alt=""
        >
      `);
    }

    return;
  }

  showToast(
    `File "${file.name}" tersimpan di Rojak Drive.`
  );
}

/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {
  const searchInput =
    document.getElementById("searchInput");

  if (!searchInput) return;

  searchInput.addEventListener(
    "input",
    () => {
      const keyword =
        searchInput.value
          .toLowerCase()
          .trim();

      const result = files.filter(
        (file) =>
          file.name
            .toLowerCase()
            .includes(keyword)
      );

      renderGrid(
        document.getElementById("fileGrid"),
        result
      );
    }
  );
}

/* =========================================================
   ROJAK AI
========================================================= */

function setupAI() {
  const input =
    document.getElementById("aiInput");

  const button =
    document.getElementById(
      "aiSendButton"
    );

  if (!input || !button) return;

  button.addEventListener(
    "click",
    sendAIMessage
  );

  input.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        sendAIMessage();
      }
    }
  );
}

async function askRojakAI(prompt) {
  const response = await fetch(
    "/api/gemini",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        prompt
      })
    }
  );

  const rawText =
    await response.text();

  let data = null;

  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      `Server mengirim response tidak valid. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      `Gemini API gagal. HTTP ${response.status}`
    );
  }

  if (!data?.text) {
    throw new Error(
      "Gemini tidak memberikan jawaban."
    );
  }

  return data.text;
}

async function sendAIMessage() {
  const input =
    document.getElementById("aiInput");

  const button =
    document.getElementById(
      "aiSendButton"
    );

  const chat =
    document.getElementById("aiChat");

  if (!input || !button || !chat) return;

  const prompt =
    input.value.trim();

  if (!prompt) return;

  addAIMessage(
    prompt,
    "user"
  );

  input.value = "";

  button.disabled = true;

  const status =
    document.getElementById(
      "aiStatus"
    );

  if (status) {
    status.textContent =
      "Rojak AI sedang berpikir...";
  }

  try {
    const answer =
      await askRojakAI(prompt);

    addAIMessage(
      answer,
      "assistant"
    );

  } catch (error) {
    console.error(
      "Rojak AI error:",
      error
    );

    addAIMessage(
      `Maaf, Rojak AI sedang mengalami masalah.\n\n${error.message}`,
      "assistant error"
    );

  } finally {
    button.disabled = false;

    if (status) {
      status.textContent =
        "Online";
    }
  }
}

function addAIMessage(
  text,
  type
) {
  const chat =
    document.getElementById("aiChat");

  if (!chat) return;

  const message =
    document.createElement("div");

  message.className =
    `ai-message ${type}`;

  message.textContent = text;

  chat.appendChild(message);

  chat.scrollTop =
    chat.scrollHeight;
}

function clearAIChat() {
  const chat =
    document.getElementById("aiChat");

  if (!chat) return;

  chat.innerHTML = `
    <div class="ai-message assistant">
      Halo! Saya Rojak AI. Ada yang bisa saya bantu?
    </div>
  `;
}

/* =========================================================
   UTILITY
========================================================= */

function formatSize(bytes) {
  if (!bytes) return "0 KB";

  const units = [
    "B",
    "KB",
    "MB",
    "GB"
  ];

  const index = Math.floor(
    Math.log(bytes) /
      Math.log(1024)
  );

  const size =
    bytes /
    Math.pow(1024, index);

  return `${size.toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}

function escapeHtml(text) {
  const div =
    document.createElement("div");

  div.textContent = text;

  return div.innerHTML;
}

function showToast(message) {
  let toast =
    document.getElementById(
      "toast"
    );

  if (!toast) {
    toast =
      document.createElement("div");

    toast.id = "toast";

    toast.className = "toast";

    document.body.appendChild(toast);
  }

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(
    showToast.timeout
  );

  showToast.timeout =
    setTimeout(() => {
      toast.classList.remove(
        "show"
      );
    }, 2500);
                         }
