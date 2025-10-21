// src/pages/api/members/[id].ts

import type { APIRoute } from "astro";
import { Client } from "pg";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const GET: APIRoute = async ({ params }) => {
  const memberId = parseInt(params.id, 10);
  if (isNaN(memberId)) {
    return new Response(JSON.stringify({ message: "ID member tidak valid" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const client = new Client(clientConfig);
  try {
    await client.connect();

    // 1. Ambil informasi dasar member
    const memberQuery = "SELECT id, username FROM members WHERE id = $1";
    const memberResult = await client.query(memberQuery, [memberId]);
    if (memberResult.rowCount === 0) {
      return new Response(
        JSON.stringify({ message: "Member tidak ditemukan" }),
        { status: 404, headers: CORS_HEADERS }
      );
    }
    const memberInfo = memberResult.rows[0];

    // 2. Ambil semua postingan yang dibuat oleh member ini
    const postsQuery = `
            SELECT p.id, p.caption, p.created_at, p.likes_count,
                   (SELECT json_agg(json_build_object('image_url', pi.image_url)) FROM post_images pi WHERE pi.post_id = p.id) AS images
            FROM posts p
            WHERE p.member_id = $1
            ORDER BY p.created_at DESC;
        `;
    const postsResult = await client.query(postsQuery, [memberId]);

    // 3. Ambil semua event yang diselenggarakan oleh member ini
    const eventsQuery =
      "SELECT id, title, event_date FROM events WHERE host = $1 ORDER BY event_date DESC";
    const eventsResult = await client.query(eventsQuery, [memberInfo.username]); // Asumsi 'host' adalah username

    // Gabungkan semua data menjadi satu objek respons
    const profileData = {
      user: memberInfo,
      posts: postsResult.rows,
      events: eventsResult.rows,
    };

    return new Response(JSON.stringify(profileData), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error("Get Profile API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};
