/* =========================================================
   ROJAK DRIVE
   Google Login + Drive + Upload + Folder + Rojak AI
   ========================================================= */


/* =========================
   GOOGLE CONFIG
   ========================= */

const GOOGLE_CLIENT_ID =
  "222625790422-7j7nhagd4d7gdpaqhq257deucjjfanva.apps.googleusercontent.com";


/* =========================
   STATE
   ========================= */

let currentUser = null;
let files = [];

const STORAGE_KEY = "rojak_drive_files";
const USER_KEY = "rojak_drive_user";


/* =========================
   DOM
   ========================= */

const $ = (id) => document.getElementById(id);


/* =========================
   INIT
   ========================= */

document.addEventListener("DOMContentLoaded", () => {

  loadSavedData();

  setupNavigation();
  setupButtons();
  setupSearch();
  setupAI();

  initializeGoogleLogin();

  renderFiles();

});


/* =========================
   GOOGLE LOGIN
   ========================= */

function initializeGoogleLogin() {

  if (
    typeof google === "undefined" ||
    !google.accounts ||
    !google.accounts.id
  ) {

    setTimeout(initializeGoogleLogin, 500);

    return;
  }

  if (
    GOOGLE_CLIENT_ID.includes("GANTI_DENGAN")
  ) {

    $("loginStatus").textContent =
      "Masukkan Google Client ID di script.js terlebih dahulu.";

    return;
  }


  google.accounts.id.initialize({

    client_id: GOOGLE_CLIENT_ID,

    callback: handleGoogleLogin,

    auto_select: false,

    cancel_on_tap_outside: true

  });


  google.accounts.id.renderButton(

    $("googleButton"),

    {
      theme: "filled_black",
      size: "large",
      width: 360,
      text: "signin_with",
      shape: "rectangular"
    }

  );
}


/* =========================
   GOOGLE CALLBACK
   ========================= */

function handleGoogleLogin(response) {

  try {

    if (!response || !response.credential) {

      throw new Error("Credential Google tidak ditemukan.");

    }


    const user = parseJwt(response.credential);

    currentUser = {

      id: user.sub,

      name:
        user.name ||
        user.given_name ||
        "User",

      email:
        user.email ||
        "-",

      picture:
        user.picture ||
        createAvatar(user.name || "User")

    };


    localStorage.setItem(
      USER_KEY,
      JSON.stringify(currentUser)
    );


    showApp();

    showToast("Login berhasil.");

  } catch (error) {

    console.error(error);

    $("loginStatus").textContent =
      "Login berhasil, tetapi data Google gagal dimuat.";

  }

}


/* =========================
   JWT PARSER
   ========================= */

function parseJwt(token) {

  const parts = token.split(".");

  if (parts.length !== 3) {

    throw new Error("Token Google tidak valid.");

  }

  const base64 = parts[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const jsonPayload =
    decodeURIComponent(
      atob(base64)
        .split("")
        .map(
          c =>
            "%" +
            ("00" + c.charCodeAt(0).toString(16)).slice(-2)
        )
        .join("")
    );

  return JSON.parse(jsonPayload);

}


/* =========================
   AVATAR
   ========================= */

function createAvatar(name) {

  const letter =
    encodeURIComponent(
      (name || "U").charAt(0).toUpperCase()
    );

  return `https://ui-avatars.com/api/?name=${letter}&background=ef4444&color=fff`;

}


/* =========================
   SHOW APP
   ========================= */

function showApp() {

  $("loginScreen").classList.add("hidden");

  $("app").classList.remove("hidden");

  updateUserUI();

}


/* =========================
   USER UI
   ========================= */

function updateUserUI() {

  if (!currentUser) return;


  $("profileName").textContent =
    currentUser.name;

  $("profileEmail").textContent =
    currentUser.email;

  $("profilePhoto").src =
    currentUser.picture;


  $("settingsName").textContent =
    currentUser.name;

  $("settingsEmail").textContent =
    currentUser.email;

  $("settingsPhoto").src =
    currentUser.picture;


  $("menuProfileName").textContent =
    currentUser.name;

  $("menuProfileEmail").textContent =
    currentUser.email;

  $("menuProfilePhoto").src =
    currentUser.picture;

}


/* =========================
   LOGOUT
   ========================= */

function logout() {

  currentUser = null;

  localStorage.removeItem(USER_KEY);

  if (
    window.google &&
    google.accounts &&
    google.accounts.id
  ) {

    google.accounts.id.disableAutoSelect();

  }

  $("app").classList.add("hidden");

  $("loginScreen").classList.remove("hidden");

  $("profileMenu").classList.add("hidden");

  showToast("Kamu telah keluar.");

}


/* =========================
   LOAD SAVED DATA
   ========================= */

function loadSavedData() {

  try {

    const savedUser =
      localStorage.getItem(USER_KEY);

    const savedFiles =
      localStorage.getItem(STORAGE_KEY);


    if (savedUser) {

      currentUser =
        JSON.parse(savedUser);

      showApp();

    }


    if (savedFiles) {

      files =
        JSON.parse(savedFiles);

    }

  } catch (error) {

    console.error(
      "Gagal membaca data:",
      error
    );

    files = [];

  }

}


/* =========================
   SAVE FILES
   ========================= */

function saveFiles() {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(files)
  );

}


/* =========================
   NAVIGATION
   ========================= */

function setupNavigation() {

  document
    .querySelectorAll(".nav-item[data-page]")
    .forEach(button => {

      button.addEventListener("click", () => {

        openPage(
          button.dataset.page
        );

      });

    });

}


function openPage(page) {

  document
    .querySelectorAll(".page")
    .forEach(item => {

      item.classList.remove("active");

    });


  const target =
    $(`page-${page}`);

  if (target) {

    target.classList.add("active");

  }


  document
    .querySelectorAll(".nav-item[data-page]")
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.page === page
      );

    });


  if (page === "recent") {

    renderRecent();

  }

  if (page === "starred") {

    renderStarred();

  }

}


/* =========================
   BUTTONS
   ========================= */

function setupButtons() {


  /* NEW */

  $("newButton").addEventListener(
    "click",
    () => {

      $("newMenu")
        .classList.toggle("hidden");

    }
  );


  $("menuUpload").addEventListener(
    "click",
    () => {

      $("newMenu").classList.add("hidden");

      openFilePicker();

    }
  );


  $("menuFolder").addEventListener(
    "click",
    () => {

      $("newMenu").classList.add("hidden");

      openFolderModal();

    }
  );


  /* UPLOAD */

  $("uploadButton").addEventListener(
    "click",
    openFilePicker
  );


  $("quickUpload").addEventListener(
    "click",
    openFilePicker
  );


  $("emptyUpload").addEventListener(
    "click",
    openFilePicker
  );


  $("fileInput").addEventListener(
    "change",
    handleFiles
  );


  /* FOLDER */

  $("folderButton").addEventListener(
    "click",
    openFolderModal
  );


  $("quickFolder").addEventListener(
    "click",
    openFolderModal
  );


  $("closeFolderModal").addEventListener(
    "click",
    closeFolderModal
  );


  $("cancelFolder").addEventListener(
    "click",
    closeFolderModal
  );


  $("createFolder").addEventListener(
    "click",
    createFolder
  );


  $("folderName").addEventListener(
    "keydown",
    event => {

      if (event.key === "Enter") {

        createFolder();

      }

    }
  );


  /* AI */

  $("quickAI").addEventListener(
    "click",
    () => openPage("ai")
  );


  /* PROFILE */

  $("profileButton").addEventListener(
    "click",
    event => {

      event.stopPropagation();

      $("profileMenu")
        .classList.toggle("hidden");

    }
  );


  $("menuSettings").addEventListener(
    "click",
    () => {

      $("profileMenu").classList.add("hidden");

      openPage("settings");

    }
  );


  $("menuLogout").addEventListener(
    "click",
    logout
  );


  $("logoutButton").addEventListener(
    "click",
    logout
  );


  /* CLEAR CHAT */

  $("clearChat").addEventListener(
    "click",
    clearChat
  );


  /* SORT */

  $("sortSelect").addEventListener(
    "change",
    renderFiles
  );


  /* HELP */

  $("helpButton").addEventListener(
    "click",
    () => {

      showToast(
        "Upload file, buat folder, atau gunakan Rojak AI."
      );

    }
  );


  $("notificationButton").addEventListener(
    "click",
    () => {

      showToast("Tidak ada notifikasi baru.");

    }
  );


  document.addEventListener(
    "click",
    () => {

      $("profileMenu").classList.add("hidden");

    }
  );


  $("profileMenu").addEventListener(
    "click",
    event => {

      event.stopPropagation();

    }
  );

}


/* =========================
   FILE PICKER
   ========================= */

function openFilePicker() {

  $("fileInput").click();

}


/* =========================
   HANDLE UPLOAD
   ========================= */

function handleFiles(event) {

  const selected =
    Array.from(event.target.files || []);


  if (!selected.length) return;


  selected.forEach(file => {

    const id =
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2);


    const reader =
      new FileReader();


    reader.onload = () => {

      const item = {

        id,

        name: file.name,

        type: "file",

        mime: file.type,

        size: file.size,

        data:
          file.type.startsWith("image/")
            ? reader.result
            : null,

        createdAt:
          Date.now(),

        starred: false

      };


      files.unshift(item);

      saveFiles();

      renderFiles();

      updateStorage();

    };


    if (file.type.startsWith("image/")) {

      reader.readAsDataURL(file);

    } else {

      reader.onload();

    }

  });


  event.target.value = "";

  showToast(
    `${selected.length} file berhasil ditambahkan.`
  );

}


/* =========================
   FOLDER
   ========================= */

function openFolderModal() {

  $("folderModal")
    .classList.remove("hidden");

  $("folderName").value = "";

  setTimeout(
    () => $("folderName").focus(),
    50
  );

}


function closeFolderModal() {

  $("folderModal")
    .classList.add("hidden");

}


function createFolder() {

  const name =
    $("folderName").value.trim();


  if (!name) {

    showToast("Masukkan nama folder.");

    return;

  }


  files.unshift({

    id:
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2),

    name,

    type: "folder",

    mime: "folder",

    size: 0,

    data: null,

    createdAt:
      Date.now(),

    starred: false

  });


  saveFiles();

  renderFiles();

  updateStorage();

  closeFolderModal();

  showToast("Folder berhasil dibuat.");

}


/* =========================
   RENDER FILES
   ========================= */

function renderFiles() {

  let result =
    [...files];


  const search =
    $("searchInput").value
      .trim()
      .toLowerCase();


  if (search) {

    result =
      result.filter(item =>
        item.name
          .toLowerCase()
          .includes(search)
      );

  }


  const sort =
    $("sortSelect").value;


  if (sort === "newest") {

    result.sort(
      (a,b) =>
        b.createdAt -
        a.createdAt
    );

  }


  if (sort === "oldest") {

    result.sort(
      (a,b) =>
        a.createdAt -
        b.createdAt
    );

  }


  if (sort === "name") {

    result.sort(
      (a,b) =>
        a.name.localeCompare(
          b.name
        )
    );

  }


  renderGrid(
    $("fileGrid"),
    result
  );


  $("emptyState")
    .classList.toggle(
      "hidden",
      result.length > 0
    );


  updateStorage();

}


/* =========================
   RECENT
   ========================= */

function renderRecent() {

  const result =
    [...files]
      .sort(
        (a,b) =>
          b.createdAt -
          a.createdAt
      )
      .slice(0, 30);


  renderGrid(
    $("recentGrid"),
    result
  );


  $("recentEmpty")
    .classList.toggle(
      "hidden",
      result.length > 0
    );

}


/* =========================
   STARRED
   ========================= */

function renderStarred() {

  const result =
    files.filter(
      item => item.starred
    );


  renderGrid(
    $("starredGrid"),
    result
  );


  $("starredEmpty")
    .classList.toggle(
      "hidden",
      result.length > 0
    );

}


/* =========================
   GRID
   ========================= */

function renderGrid(
  container,
  list
) {

  container.innerHTML = "";


  list.forEach(item => {

    const card =
      document.createElement("div");


    card.className =
      "file-card";


    const preview =
      document.createElement("div");


    preview.className =
      "file-preview";


    if (
      item.type === "file" &&
      item.mime &&
      item.mime.startsWith("image/") &&
      item.data
    ) {

      const img =
        document.createElement("img");

      img.src =
        item.data;

      img.alt =
        item.name;

      preview.appendChild(img);

    } else {

      const icon =
        document.createElement("div");

      icon.className =
        "file-icon";

      icon.textContent =
        item.type === "folder"
          ? "▰"
          : getFileIcon(item.name);

      preview.appendChild(icon);

    }


    const info =
      document.createElement("div");

    info.className =
      "file-info";


    const name =
      document.createElement("div");

    name.className =
      "file-name";

    name.textContent =
      item.name;


    const meta =
      document.createElement("div");

    meta.className =
      "file-meta";

    meta.textContent =
      item.type === "folder"
        ? "Folder"
        : formatSize(item.size);


    info.appendChild(name);

    info.appendChild(meta);


    const star =
      document.createElement("button");

    star.className =
      "file-star" +
      (item.starred ? " active" : "");

    star.textContent =
      item.starred
        ? "★"
        : "☆";


    star.addEventListener(
      "click",
      event => {

        event.stopPropagation();

        toggleStar(item.id);

      }
    );


    card.appendChild(preview);

    card.appendChild(info);

    card.appendChild(star);


    card.addEventListener(
      "click",
      () => {

        if (item.type === "file") {

          openFile(item);

        }

      }
    );


    container.appendChild(card);

  });

}


/* =========================
   FILE ICON
   ========================= */

function getFileIcon(name) {

  const ext =
    name
      .split(".")
      .pop()
      .toLowerCase();


  const icons = {

    pdf: "PDF",

    doc:
      "DOC",

    docx:
      "DOC",

    xls:
      "XLS",

    xlsx:
      "XLS",

    ppt:
      "PPT",

    pptx:
      "PPT",

    zip:
      "ZIP",

    rar:
      "RAR",

    mp4:
      "▶",

    mp3:
      "♫"

  };


  return icons[ext] || "▤";

}


/* =========================
   STAR
   ========================= */

function toggleStar(id) {

  const item =
    files.find(
      file => file.id === id
    );


  if (!item) return;


  item.starred =
    !item.starred;


  saveFiles();

  renderFiles();

  renderStarred();

}


/* =========================
   OPEN FILE
   ========================= */

function openFile(item) {

  if (
    item.mime &&
    item.mime.startsWith("image/") &&
    item.data
  ) {

    const win =
      window.open();

    if (win) {

      win.document.write(`
        <html>
        <head>
          <title>${escapeHtml(item.name)}</title>
          <style>
            body{
              margin:0;
              background:#09090b;
              display:flex;
              align-items:center;
              justify-content:center;
              min-height:100vh;
            }
            img{
              max-width:95%;
              max-height:95vh;
              object-fit:contain;
            }
          </style>
        </head>
        <body>
          <img src="${item.data}">
        </body>
        </html>
      `);

      win.document.close();

    }

    return;

  }


  showToast(
    `${item.name} • ${formatSize(item.size)}`
  );

}


/* =========================
   SEARCH
   ========================= */

function setupSearch() {

  $("searchInput")
    .addEventListener(
      "input",
      renderFiles
    );

}


/* =========================
   STORAGE
   ========================= */

function updateStorage() {

  const total =
    files.reduce(
      (sum, item) =>
        sum +
        (Number(item.size) || 0),
      0
    );


  $("storageText").textContent =
    formatSize(total);


  const max =
    1024 * 1024 * 1024;


  const percent =
    Math.min(
      (total / max) * 100,
      100
    );


  $("storageProgress")
    .style.width =
    `${percent}%`;

}


/* =========================
   FORMAT SIZE
   ========================= */

function formatSize(bytes) {

  if (!bytes) return "0 B";


  const units =
    ["B", "KB", "MB", "GB"];


  const index =
    Math.floor(
      Math.log(bytes) /
      Math.log(1024)
    );


  const size =
    bytes /
    Math.pow(1024, index);


  return (
    size.toFixed(
      index === 0 ? 0 : 1
    ) +
    " " +
    units[index]
  );

}


/* =========================
   AI
   ========================= */

function setupAI() {

  $("aiSendButton")
    .addEventListener(
      "click",
      sendAIMessage
    );


  $("aiInput")
    .addEventListener(
      "keydown",
      event => {

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


async function sendAIMessage() {

  const input =
    $("aiInput");

  const prompt =
    input.value.trim();


  if (!prompt) return;


  addAIMessage(
    "user",
    prompt
  );


  input.value = "";

  $("aiSendButton").disabled = true;

  $("aiStatus").textContent =
    "Rojak AI sedang berpikir...";


  try {

    const answer =
      await askRojakAI(prompt);


    addAIMessage(
      "bot",
      answer
    );


    $("aiStatus").textContent = "";


  } catch (error) {

    console.error(error);

    addAIMessage(
      "bot",
      "Maaf, Rojak AI sedang mengalami masalah.\n\n" +
      error.message
    );


    $("aiStatus").textContent =
      "Gagal menghubungi Rojak AI.";

  }


  $("aiSendButton").disabled = false;

  scrollAI();

}


/* =========================
   GEMINI REQUEST
   ========================= */

async function askRojakAI(prompt) {

  const response =
    await fetch(
      "/api/gemini",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            prompt
          })
      }
    );


  const rawText =
    await response.text();


  let data;


  try {

    data =
      JSON.parse(rawText);

  } catch {

    throw new Error(
      `Server mengirim response tidak valid. HTTP ${response.status}`
    );

  }


  if (!response.ok) {

    throw new Error(
      data.error ||
      "Gemini API gagal."
    );

  }


  if (!data.text) {

    throw new Error(
      "Gemini tidak memberikan jawaban."
    );

  }


  return data.text;

}


/* =========================
   AI MESSAGE
   ========================= */

function addAIMessage(
  type,
  text
) {

  const message =
    document.createElement("div");


  message.className =
    `ai-message ${type}`;


  const avatar =
    document.createElement("div");


  avatar.className =
    "message-avatar";


  avatar.textContent =
    type === "user"
      ? "U"
      : "R";


  const content =
    document.createElement("div");


  content.className =
    "message-content";


  const title =
    document.createElement("strong");


  title.textContent =
    type === "user"
      ? "Kamu"
      : "Rojak AI";


  const paragraph =
    document.createElement("p");


  paragraph.textContent =
    text;


  content.appendChild(title);

  content.appendChild(paragraph);


  message.appendChild(avatar);

  message.appendChild(content);


  $("aiChat")
    .appendChild(message);


  scrollAI();

}


function scrollAI() {

  const chat =
    $("aiChat");

  chat.scrollTop =
    chat.scrollHeight;

}


function clearChat() {

  $("aiChat").innerHTML = `

    <div class="ai-message bot">

      <div class="message-avatar">
        R
      </div>

      <div class="message-content">

        <strong>Rojak AI</strong>

        <p>
          Chat dibersihkan. Ada yang ingin kamu tanyakan?
        </p>

      </div>

    </div>

  `;

}


/* =========================
   TOAST
   ========================= */

let toastTimer;


function showToast(message) {

  const toast =
    $("toast");


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      2500
    );

}


/* =========================
   ESCAPE HTML
   ========================= */

function escapeHtml(text) {

  const div =
    document.createElement("div");

  div.textContent =
    text;

  return div.innerHTML;

        }
