async function askRojakAI(prompt) {
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

    const rawText = await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch (error) {
      console.error("Response dari server:", rawText);

      throw new Error(
        "Server mengirim response yang bukan JSON. Status: " +
        response.status
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error || "Gagal menghubungi Gemini."
      );
    }

    return data.text;

  } catch (error) {
    console.error("Rojak AI Error:", error);

    throw error;
  }
}
