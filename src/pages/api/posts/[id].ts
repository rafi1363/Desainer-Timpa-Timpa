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

export const GET: APIRoute = async ({ params, request }) => {
  const postId = parseInt(params.id, 10);
  const client = new Client(clientConfig);
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ message: "Akses ditolak" }), {
        status: 401,
        headers: CORS_HEADERS,
      });

    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
    };
    const memberId = decodedToken.id;

    await client.connect();
    const query = `
            SELECT
                p.id, p.caption, p.created_at, p.likes_count,
                (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
                (SELECT json_agg(json_build_object('image_url', pi.image_url)) FROM post_images pi WHERE pi.post_id = p.id) AS images,
                json_build_object('id', m.id, 'username', m.username, 'avatar_url', NULL) AS author,
                EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.member_id = $2) AS is_liked_by_user
            FROM posts p
            JOIN members m ON p.member_id = m.id
            WHERE p.id = $1;
        `;
    const result = await client.query(query, [postId, memberId]);

    if (result.rowCount === 0) {
      return new Response(
        JSON.stringify({ message: "Postingan tidak ditemukan" }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return new Response(JSON.stringify(result.rows[0]), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error("Get Post Detail API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};

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
