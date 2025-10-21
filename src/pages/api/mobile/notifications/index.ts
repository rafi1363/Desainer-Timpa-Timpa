// src/pages/api/mobile/notifications/index.ts

import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const GET: APIRoute = async ({ request }) => {
  const client = new Client(clientConfig);
  try {
    // 1. Ambil token dari 'Authorization' header, bukan cookies
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
    const recipientId = decodedToken.id;

    await client.connect();

    // 2. Perbarui Query SQL
    const query = `
            SELECT 
                n.id, n.type, n.is_read, n.created_at,
                -- Buat objek 'sender' yang cocok dengan UI
                json_build_object('username', s.username) as sender,
                -- Buat objek 'post' yang berisi ID postingan
                json_build_object('id', p.id) as post
            FROM notifications n
            JOIN members s ON n.sender_id = s.id
            -- Gunakan LEFT JOIN agar notifikasi tanpa post_id (jika ada) tetap muncul
            LEFT JOIN posts p ON n.post_id = p.id
            WHERE n.recipient_id = $1
            ORDER BY n.created_at DESC;
        `;
    const result = await client.query(query, [recipientId]);

    return new Response(JSON.stringify(result.rows), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error("Get Notifications API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};
