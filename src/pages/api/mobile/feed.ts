// src/pages/api/mobile/feed.ts

import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const GET: APIRoute = async ({ request }) => {
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

    const query = `
      SELECT
          p.id,
          p.caption,
          p.created_at,
          p.likes_count,
          (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
          (SELECT json_agg(json_build_object('image_url', pi.image_url)) FROM post_images pi WHERE pi.post_id = p.id) AS images,
          json_build_object('id', m.id, 'username', m.username, 'avatar_url', NULL) AS author,
          EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.member_id = $1) AS is_liked_by_user
      FROM posts p
      JOIN members m ON p.member_id = m.id
      ORDER BY p.created_at DESC;
    `;

    const result = await client.query(query, [memberId]);

    return new Response(JSON.stringify(result.rows), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (error) {
    console.error("Feed API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};
