// src/pages/api/login.ts (REVISI)

import type { APIRoute } from "astro";
import { Client } from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// WAJIB: Tangani permintaan pre-flight OPTIONS
export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const client = new Client(clientConfig);

  try {
    const body = await request.json();
    // 1. UBAH DARI USERNAME KE EMAIL
    const { email, password } = body;

    // 2. PERBAIKI SYNTAX ERROR VALIDASI
    if (!email || !password) {
      return new Response(
        JSON.stringify({ message: "Email dan password harus diisi" }),
        {
          status: 400,
          headers: CORS_HEADERS,
        }
      );
    }

    await client.connect();

    // Untuk aplikasi mobile, kita fokus ke login member
    const result = await client.query(
      "SELECT * FROM members WHERE email = $1",
      [email]
    );

    if (result.rowCount === 0) {
      return new Response(
        JSON.stringify({ message: "Email atau password salah" }),
        {
          status: 401, // Unauthorized
          headers: CORS_HEADERS,
        }
      );
    }

    const member = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, member.password_hash);

    if (!passwordMatch) {
      return new Response(
        JSON.stringify({ message: "Email atau password salah" }),
        {
          status: 401, // Unauthorized
          headers: CORS_HEADERS,
        }
      );
    }

    // Buat token
    const token = jwt.sign(
      {
        id: member.id,
        username: member.username,
        email: member.email,
        role: "member",
      },
      import.meta.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Untuk website, tetap set cookie
    cookies.set("auth_token", token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      path: "/",
      maxAge: 60 * 60 * 8, // 8 jam
    });

    // Hapus password hash dari objek sebelum dikirim ke client
    delete member.password_hash;

    // 3. KIRIM RESPON YANG SESUAI UNTUK APLIKASI MOBILE
    return new Response(
      JSON.stringify({
        message: "Login berhasil",
        token: token,
        user: member,
      }),
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error) {
    console.error("Login API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  } finally {
    await client.end();
  }
};
