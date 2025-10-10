import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";
import translate from "@iamtraction/google-translate";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get("auth_token")?.value;
  if (!token) return new Response("Akses ditolak", { status: 401 });

  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
    };
    const formData = await request.formData();
    const quote_id = formData.get("quote_id") as string;
    if (!quote_id)
      return new Response("Testimoni tidak boleh kosong", { status: 400 });

    // 1. Terjemahkan teks secara otomatis
    let quote_en = "";
    try {
      const translationResult = await translate(quote_id, {
        from: "id",
        to: "en",
      });
      quote_en = translationResult.text;
    } catch (e) {
      console.error("Gagal menerjemahkan teks:", e);
      quote_en = quote_id; // Fallback: simpan teks asli jika terjemahan gagal
    }

    // 2. Simpan kedua versi ke database
    const client = new Client(clientConfig);
    await client.connect();
    const query =
      "INSERT INTO testimonials (member_id, quote_id, quote_en) VALUES ($1, $2, $3)";
    await client.query(query, [decoded.id, quote_id, quote_en]);
    await client.end();

    return new Response(
      JSON.stringify({ message: "Testimoni berhasil dikirim!" }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Gagal menyimpan testimoni:", error);
    return new Response("Terjadi kesalahan di server.", { status: 500 });
  }
};
