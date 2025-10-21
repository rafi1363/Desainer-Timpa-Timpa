// src/pages/api/posts/[id].ts

import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const DELETE: APIRoute = async ({ params, request }) => {
  const postId = parseInt(params.id, 10);
  if (isNaN(postId)) {
    return new Response(JSON.stringify({ message: "ID post tidak valid" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const client = new Client(clientConfig);
  try {
    // 1. Verifikasi token untuk mengetahui siapa yang membuat request
    const authHeader = request.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ message: "Akses ditolak" }), {
        status: 401,
        headers: CORS_HEADERS,
      });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
      role: string;
    };
    const requesterId = decoded.id;
    const requesterRole = decoded.role;

    await client.connect();

    // 2. Ambil detail postingan untuk mengetahui siapa pemiliknya
    const postResult = await client.query(
      "SELECT member_id FROM posts WHERE id = $1",
      [postId]
    );
    if (postResult.rowCount === 0) {
      return new Response(
        JSON.stringify({ message: "Postingan tidak ditemukan" }),
        { status: 404, headers: CORS_HEADERS }
      );
    }
    const postOwnerId = postResult.rows[0].member_id;

    // 3. Lakukan pengecekan otorisasi
    // Izinkan jika requester adalah pemilik ATAU jika requester adalah admin
    if (requesterId !== postOwnerId && requesterRole !== "admin") {
      return new Response(
        JSON.stringify({
          message: "Anda tidak punya izin untuk menghapus postingan ini.",
        }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // 4. Jika lolos, hapus postingan
    // Karena ada ON DELETE CASCADE di database, semua likes, comments, dan images terkait akan ikut terhapus
    await client.query("DELETE FROM posts WHERE id = $1", [postId]);

    return new Response(
      JSON.stringify({ message: "Postingan berhasil dihapus" }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("Delete Post API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};
