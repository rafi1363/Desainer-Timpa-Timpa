// src/pages/api/mobile/register-push-token.ts

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

export const POST: APIRoute = async ({ request }) => {
  const client = new Client(clientConfig);

  try {
    // 1. Verifikasi pengguna dari token JWT
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

    // 2. Ambil push_token dari body request
    const { push_token } = await request.json();
    if (!push_token) {
      return new Response(
        JSON.stringify({ message: "Push token tidak boleh kosong" }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Simpan token ke database
    await client.connect();
    const query = "UPDATE members SET push_token = $1 WHERE id = $2";
    await client.query(query, [push_token, memberId]);

    return new Response(
      JSON.stringify({ message: "Token berhasil disimpan" }),
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error) {
    console.error("Register Push Token API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};
