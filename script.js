const state = {
  files: JSON.parse(
    localStorage.getItem("rojakFiles") || "[]"
  )
};


/* =========================
   NAVIGATION
========================= */

const navItems =
  document.querySelectorAll(".nav-item");

const pages =
  document.querySelectorAll(".page");


navItems.forEach(item => {

  item.addEventListener("click", () => {

    const page =
      item.dataset.page;

    navItems.forEach(nav => {
      nav.classList.remove("active");
    });

    item.classList.add("active");

    pages.forEach(section => {
      section.classList.remove("active-page");
    });

    const target =
      document.getElementById(
        `page-${page}`
      );

    if (target) {
      target.classList.add("active-page");
    }

  });

});


/* =========================
   FILE STORAGE
========================= */

function saveFiles() {

  localStorage.setItem(
    "rojakFiles",
    JSON.stringify(state.files)
  );

}


function getFileIcon(type) {

  if (type.includes("image")) return "▧";

  if (type.includes("pdf")) return "PDF";

  if (type.includes("video")) return "▶";

  if (type.includes("audio")) return "♫";

  if (
    type.includes("word") ||
    type.includes("document")
  ) return "W";

  if (
    type.includes("sheet") ||
    type.includes("excel")
  ) return "X";

  return "▣";

}


function renderFiles(
  container,
  files = state.files
) {

  container.innerHTML = "";

  if (!files.length) {

    container.innerHTML = `
      <div style="
        grid-column:1/-1;
        padding:50px 20px;
        text-align:center;
        color:#665d5d;
        font-size:11px;
      ">
        Belum ada file.
      </div>
    `;

    return;
  }


  files.forEach(file => {

    const card =
      document.createElement("div");

    card.className = "file-card";

    card.innerHTML = `

      <div class="file-icon">
        ${getFileIcon(file.type || "")}
      </div>

      <div class="file-name">
        ${escapeHTML(file.name)}
      </div>

      <div class="file-info">
        ${file.size || "Unknown size"}
      </div>

    `;

    container.appendChild(card);

  });

}


function escapeHTML(text) {

  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function updateCounters() {

  const files =
    state.files.filter(
      file => file.kind !== "folder"
    );

  const folders =
    state.files.filter(
      file => file.kind === "folder"
    );

  document.getElementById(
    "fileCount"
  ).textContent = files.length;

  document.getElementById(
    "folderCount"
  ).textContent = folders.length;

}


/* =========================
   INITIAL FILES
========================= */

function renderAll() {

  renderFiles(
    document.getElementById("fileGrid")
  );

  renderFiles(
    document.getElementById("recentGrid"),
    [...state.files].reverse()
  );

  renderFiles(
    document.getElementById("starredGrid"),
    state.files.filter(
      file => file.starred
    )
  );

  updateCounters();

}


renderAll();


/* =========================
   NEW FILE MODAL
========================= */

const newModal =
  document.getElementById("newModal");

const newFileButton =
  document.getElementById("newFileButton");

const closeModal =
  document.getElementById("closeModal");

newFileButton.addEventListener(
  "click",
  () => {
    newModal.classList.remove("hidden");
  }
);

closeModal.addEventListener(
  "click",
  () => {
    newModal.classList.add("hidden");
  }
);


newModal.addEventListener(
  "click",
  event => {

    if (
      event.target === newModal
    ) {
      newModal.classList.add("hidden");
    }

  }
);


/* =========================
   CREATE FOLDER
========================= */

document
  .getElementById("createFolder")
  .addEventListener(
    "click",
    () => {

      const name =
        prompt(
          "Masukkan nama folder:"
        );

      if (!name) return;

      state.files.push({

        name: name,

        type: "folder",

        kind: "folder",

        size: "Folder",

        starred: false,

        createdAt:
          new Date().toISOString()

      });

      saveFiles();

      renderAll();

      newModal.classList.add(
        "hidden"
      );

    }
  );


/* =========================
   UPLOAD FILE
========================= */

document
  .getElementById("fileUpload")
  .addEventListener(
    "change",
    event => {

      const files =
        Array.from(
          event.target.files
        );

      files.forEach(file => {

        state.files.push({

          name: file.name,

          type: file.type,

          kind: "file",

          size:
            formatBytes(
              file.size
            ),

          starred: false,

          createdAt:
            new Date().toISOString()

        });

      });

      saveFiles();

      renderAll();

      newModal.classList.add(
        "hidden"
      );

      event.target.value = "";

    }
  );


function formatBytes(bytes) {

  if (!bytes) return "0 B";

  const units = [
    "B",
    "KB",
    "MB",
    "GB"
  ];

  const index =
    Math.floor(
      Math.log(bytes) /
      Math.log(1024)
    );

  return (
    Math.round(
      bytes /
      Math.pow(
        1024,
        index
      ) *
      100
    ) / 100
  ) + " " +
  units[index];

}


/* =========================
   SEARCH
========================= */

document
  .getElementById("searchInput")
  .addEventListener(
    "input",
    event => {

      const query =
        event.target.value
          .toLowerCase()
          .trim();

      const filtered =
        state.files.filter(
          file =>
            file.name
              .toLowerCase()
              .includes(query)
        );

      renderFiles(
        document.getElementById("fileGrid"),
        filtered
      );

    }
  );


/* =========================
   SORT
========================= */

document
  .getElementById("sortSelect")
  .addEventListener(
    "change",
    event => {

      let files =
        [...state.files];

      if (
        event.target.value ===
        "name"
      ) {

        files.sort(
          (a, b) =>
            a.name.localeCompare(
              b.name
            )
        );

      }

      if (
        event.target.value ===
        "newest"
      ) {

        files.sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        );

      }

      if (
        event.target.value ===
        "type"
      ) {

        files.sort(
          (a, b) =>
            (a.type || "")
              .localeCompare(
                b.type || ""
              )
        );

      }

      renderFiles(
        document.getElementById(
          "fileGrid"
        ),
        files
      );

    }
  );


/* =========================
   AI
========================= */

const aiPrompt =
  document.getElementById(
    "aiPrompt"
  );

const aiSend =
  document.getElementById(
    "aiSend"
  );

const aiResult =
  document.getElementById(
    "aiResult"
  );

const aiStatus =
  document.getElementById(
    "aiStatus"
  );


async function sendToAI() {

  const prompt =
    aiPrompt.value.trim();

  if (!prompt) {

    aiPrompt.focus();

    return;

  }


  /*
   * User message
   */

  const empty =
    aiResult.querySelector(
      ".empty-ai"
    );

  if (empty) {
    empty.remove();
  }


  const userMessage =
    document.createElement(
      "div"
    );

  userMessage.className =
    "message user";

  userMessage.textContent =
    prompt;

  aiResult.appendChild(
    userMessage
  );


  aiPrompt.value = "";

  aiSend.disabled = true;

  aiStatus.textContent =
    "Gemini sedang berpikir...";


  try {

    const response =
      await fetch(
        "/api/gemini",
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            prompt: prompt
          })

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Gemini API error"
      );

    }


    const aiMessage =
      document.createElement(
        "div"
      );

    aiMessage.className =
      "message ai";

    aiMessage.textContent =
      data.text ||
      "Tidak ada jawaban.";

    aiResult.appendChild(
      aiMessage
    );


    aiStatus.textContent =
      "Gemini siap digunakan";


    aiResult.scrollTop =
      aiResult.scrollHeight;


  } catch (error) {

    const errorMessage =
      document.createElement(
        "div"
      );

    errorMessage.className =
      "message ai";

    errorMessage.textContent =
      "Gagal menghubungi Gemini.\n\n" +
      error.message;

    aiResult.appendChild(
      errorMessage
    );


    aiStatus.textContent =
      "Terjadi kesalahan";

  } finally {

    aiSend.disabled = false;

  }

}


aiSend.addEventListener(
  "click",
  sendToAI
);


aiPrompt.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter" &&
      event.ctrlKey
    ) {

      event.preventDefault();

      sendToAI();

    }

  }
);


/* =========================
   API STATUS
========================= */

document
  .getElementById("apiStatus")
  .textContent =
  "Configured through Vercel";


/* =========================
   AI CARD QUICK ACCESS
========================= */

document
  .querySelector(".ai-card")
  ?.addEventListener(
    "click",
    () => {

      document
        .querySelector(
          '[data-page="ai"]'
        )
        ?.click();

    }
  );
