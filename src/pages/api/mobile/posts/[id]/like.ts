// src/pages/api/mobile/posts/[id]/like.ts

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

export const POST: APIRoute = async ({ params, request }) => {
  const postId = parseInt(params.id, 10);
  const client = new Client(clientConfig);

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ message: "Akses ditolak" }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
    };
    const memberId = decodedToken.id;

    await client.connect();

    // Cek apakah user sudah like post ini sebelumnya
    const likeCheck = await client.query(
      "SELECT * FROM post_likes WHERE post_id = $1 AND member_id = $2",
      [postId, memberId]
    );

    let liked = false;
    if (likeCheck.rowCount > 0) {
      // Jika sudah ada, hapus like (unlike)
      await client.query(
        "DELETE FROM post_likes WHERE post_id = $1 AND member_id = $2",
        [postId, memberId]
      );
      await client.query(
        "UPDATE posts SET likes_count = likes_count - 1 WHERE id = $1",
        [postId]
      );
      liked = false;
    } else {
      // Jika belum ada, tambahkan like
      await client.query(
        "INSERT INTO post_likes (post_id, member_id) VALUES ($1, $2)",
        [postId, memberId]
      );
      await client.query(
        "UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1",
        [postId]
      );
      liked = true;
    }

    const result = await client.query(
      "SELECT likes_count FROM posts WHERE id = $1",
      [postId]
    );

    return new Response(
      JSON.stringify({
        message: liked ? "Post liked" : "Post unliked",
        liked: liked,
        likes_count: result.rows[0].likes_count,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
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
