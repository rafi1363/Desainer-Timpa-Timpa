// src/pages/api/posts/index.ts

import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const POST: APIRoute = async ({ request }) => {
  const client = new Client(clientConfig);
  try {
    // 1. Verifikasi pengguna
    const authHeader = request.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ message: "Akses ditolak" }), {
        status: 401,
        headers: CORS_HEADERS,
      });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
    };
    const memberId = decoded.id;

    // 2. Ambil data dari body (caption dan URLs gambar)
    const { caption, imageUrls } = await request.json();
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ message: "Setidaknya satu gambar diperlukan" }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    await client.connect();

    // --- Gunakan Transaksi Database untuk Keamanan Data ---
    await client.query("BEGIN");

    // 3. Masukkan data ke tabel 'posts' dan dapatkan ID postingan baru
    const postQuery =
      "INSERT INTO posts (member_id, caption) VALUES ($1, $2) RETURNING id";
    const postResult = await client.query(postQuery, [memberId, caption]);
    const newPostId = postResult.rows[0].id;

    // 4. Masukkan setiap URL gambar ke tabel 'post_images'
    const imageQuery =
      "INSERT INTO post_images (post_id, image_url) VALUES ($1, $2)";
    for (const url of imageUrls) {
      await client.query(imageQuery, [newPostId, url]);
    }

    // 5. Jika semua berhasil, simpan perubahan
    await client.query("COMMIT");
    // ----------------------------------------------------

    return new Response(
      JSON.stringify({
        message: "Postingan berhasil dibuat",
        postId: newPostId,
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error) {
    await client.query("ROLLBACK"); // Jika terjadi error, batalkan semua perubahan
    console.error("Create Post API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};
