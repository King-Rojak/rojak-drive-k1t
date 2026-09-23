const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const status = document.getElementById("status");
const result = document.getElementById("result");

sendBtn.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();

  if (!prompt) {
    result.textContent = "Silakan masukkan pertanyaan.";
    return;
  }

  sendBtn.disabled = true;
  status.textContent = "Gemini sedang berpikir...";
  result.textContent = "";

  try {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Terjadi kesalahan.");
    }

    result.textContent = data.text || "Tidak ada jawaban.";
    status.textContent = "Selesai.";
  } catch (error) {
    console.error(error);

    status.textContent = "Gagal.";
    result.textContent = error.message;
  } finally {
    sendBtn.disabled = false;
  }
});
