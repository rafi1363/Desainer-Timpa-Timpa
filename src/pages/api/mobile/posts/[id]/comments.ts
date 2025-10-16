// src/pages/api/mobile/posts/[id]/comments.ts

import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// Mengambil semua komentar untuk sebuah post
export const GET: APIRoute = async ({ params }) => {
  const postId = parseInt(params.id, 10);
  const client = new Client(clientConfig);
  try {
    await client.connect();
    const query = `
            SELECT c.id, c.comment_text, c.created_at, json_build_object('id', m.id, 'username', m.username) as author
            FROM post_comments c
            JOIN members m ON c.member_id = m.id
            WHERE c.post_id = $1
            ORDER BY c.created_at ASC;
        `;
    const result = await client.query(query, [postId]);
    return new Response(JSON.stringify(result.rows), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error("Like API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};

// Menambahkan komentar baru
export const POST: APIRoute = async ({ params, request }) => {
  const postId = parseInt(params.id, 10);
  const client = new Client(clientConfig);
  try {
    const authHeader = request.headers.get("Authorization");
    // ... verifikasi token seperti di atas ...
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
    };
    const memberId = decodedToken.id;

    const { comment_text } = await request.json();
    if (!comment_text) {
      return new Response(
        JSON.stringify({ message: "Komentar tidak boleh kosong" }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    await client.connect();
    // --- PERUBAHAN DIMULAI DI SINI ---

    // 1. Masukkan komentar baru dan dapatkan ID-nya
    const insertQuery =
      "INSERT INTO post_comments (post_id, member_id, comment_text) VALUES ($1, $2, $3) RETURNING id";
    const insertResult = await client.query(insertQuery, [
      postId,
      memberId,
      comment_text,
    ]);
    const newCommentId = insertResult.rows[0].id;

    // 2. Lakukan query kedua untuk mengambil komentar baru dengan format yang benar (termasuk data author)
    const selectQuery = `
            SELECT c.id, c.comment_text, c.created_at, json_build_object('id', m.id, 'username', m.username) as author
            FROM post_comments c
            JOIN members m ON c.member_id = m.id
            WHERE c.id = $1;
        `;
    const finalResult = await client.query(selectQuery, [newCommentId]);

    // 3. Kirim kembali hasil query kedua
    return new Response(JSON.stringify(finalResult.rows[0]), {
      status: 201,
      headers: CORS_HEADERS,
    });

    // --- AKHIR PERUBAHAN ---
  } catch (error) {
    console.error("Like API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};
