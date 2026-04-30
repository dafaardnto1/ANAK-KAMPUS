import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

type AIMode = 'SUMMARIZE' | 'PARAPHRASE' | 'TITLE_GEN';

const SYSTEM_PROMPTS: Record<AIMode, string> = {
  SUMMARIZE: `Kamu adalah asisten akademik mahasiswa Indonesia yang ahli merangkum jurnal dan artikel ilmiah.
Tugas kamu: baca teks dari jurnal/PDF yang diberikan, lalu buat ringkasan terstruktur dalam Bahasa Indonesia yang jelas dan mudah dipahami mahasiswa.

Format output WAJIB menggunakan struktur berikut:
## 📌 Judul / Topik
## 🎯 Tujuan Penelitian
## 🔬 Metode
## 📊 Hasil Utama
## 💡 Kesimpulan
## 🔑 Kata Kunci

Gunakan bahasa yang ringkas, padat, dan akademis. Maksimal 600 kata.`,

  PARAPHRASE: `Kamu adalah asisten akademik ahli parafrase dan perbaikan tata bahasa untuk mahasiswa Indonesia.
Tugas kamu: susun ulang teks yang diberikan dengan kalimat dan struktur yang berbeda, namun makna tetap sama.

Aturan WAJIB:
- Ubah struktur kalimat secara signifikan (bukan sekadar ganti sinonim)
- Pertahankan istilah teknis/ilmiah yang tidak bisa diganti
- Tingkatkan kualitas bahasa agar lebih akademis dan formal
- Jika teks berbahasa Indonesia, parafrase dalam Bahasa Indonesia
- Jika teks berbahasa Inggris, parafrase dalam Bahasa Inggris
- Berikan juga skor estimasi keunikan teks (0-100%) di akhir

Format output:
## ✏️ Teks Terparafrase
[isi parafrase]

## 📈 Estimasi Keunikan
[persentase] — [penjelasan singkat kenapa]

## 💡 Tips Tambahan
[1-2 saran untuk meningkatkan orisinalitas]`,

  TITLE_GEN: `Kamu adalah konsultan akademik yang membantu mahasiswa Indonesia menemukan judul skripsi/penelitian yang menarik, relevan, dan metodologis.
Tugas kamu: generate 10 judul penelitian berdasarkan jurusan dan minat yang diberikan.

Aturan WAJIB:
- Judul harus spesifik, bukan terlalu umum
- Sertakan variabel penelitian, objek, dan metode jika relevan
- Campurkan berbagai pendekatan: kuantitatif, kualitatif, R&D, studi kasus
- Gunakan bahasa Indonesia formal akademis
- Jika jurusan IT/teknik, sertakan judul berbahasa Inggris juga

Format output WAJIB:
## 🎓 Judul Skripsi / Penelitian

Untuk setiap judul, format:
**[Nomor]. [Judul]**
📝 *[Pendekatan: Kuantitatif/Kualitatif/R&D/dll] — [1 kalimat alasan kenapa judul ini menarik]*

---
## 💡 Tips Memilih Judul
[3 tips praktis untuk mahasiswa]`,
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key tidak dikonfigurasi' }, { status: 500 });
    }

    const body = await req.json();
    const { mode, text } = body as { mode: AIMode; text: string };

    if (!mode || !text?.trim()) {
      return NextResponse.json({ error: 'Mode dan teks wajib diisi' }, { status: 400 });
    }

    if (!['SUMMARIZE', 'PARAPHRASE', 'TITLE_GEN'].includes(mode)) {
      return NextResponse.json({ error: 'Mode tidak valid' }, { status: 400 });
    }

    const maxInputLength = 15000;
    const trimmedText = text.slice(0, maxInputLength);

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS[mode] },
          { role: 'user', content: trimmedText },
        ],
        temperature: mode === 'TITLE_GEN' ? 0.9 : 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Groq API error:', errData);
      return NextResponse.json(
        { error: `Groq API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content ?? '';

    return NextResponse.json({ result });
  } catch (err) {
    console.error('AI route error:', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
