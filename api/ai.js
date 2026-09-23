export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method tidak diizinkan."
    });
  }

  try {
    const { image } = req.body || {};

    if (!image) {
      return res.status(400).json({
        error: "Foto tidak ditemukan."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "OPENAI_API_KEY belum dipasang di Vercel Environment Variables."
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model: "gpt-4.1-mini",

          input: [
            {
              role: "user",

              content: [
                {
                  type: "input_text",

                  text:
                    `Kamu membantu siswa SMA mengerjakan tugas TIK/Excel.

Baca foto soal dengan teliti.

Berikan jawaban yang:
- sesuai isi soal
- mudah dipahami siswa
- langsung bisa disalin
- jika ada rumus Excel, tuliskan rumus lengkap
- gunakan koma sebagai pemisah argumen rumus Excel
- jika soal meminta tabel, buat tabel sederhana
- jangan mengarang data yang tidak terlihat
- jika ada bagian foto yang tidak terbaca, beri tahu bagian tersebut

Jangan terlalu panjang.

Jawab dalam Bahasa Indonesia.`
                },

                {
                  type: "input_image",

                  image_url: image
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenAI gagal memproses gambar."
      });
    }

    let answer = "";

    if (typeof data.output_text === "string") {
      answer = data.output_text;
    }

    if (!answer && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (!Array.isArray(item.content)) continue;

        for (const content of item.content) {
          if (
            content.type === "output_text" &&
            typeof content.text === "string"
          ) {
            answer += content.text;
          }
        }
      }
    }

    if (!answer.trim()) {
      return res.status(500).json({
        error: "AI tidak menghasilkan jawaban."
      });
    }

    return res.status(200).json({
      answer
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error:
        error?.message ||
        "Terjadi kesalahan pada server."
    });
  }
}
