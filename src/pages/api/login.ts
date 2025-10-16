// src/pages/api/login.ts (REVISI FINAL)

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

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const client = new Client(clientConfig);
  let username, password;

  try {
    // --- MEMBUAT API FLEKSIBEL ---
    // Cek format data yang masuk
    const contentType = request.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      // Jika dari mobile app (JSON)
      const body = await request.json();
      username = body.username;
      password = body.password;
    } else {
      // Jika dari website (Form Data)
      const formData = await request.formData();
      username = formData.get("username")?.toString();
      password = formData.get("password")?.toString();
    }
    // ----------------------------

    if (!username || !password) {
      return new Response(
        JSON.stringify({ message: "Username dan password harus diisi" }),
        {
          status: 400,
          headers: CORS_HEADERS,
        }
      );
    }

    await client.connect();

    // Menggunakan USERNAME untuk query, bukan email
    const result = await client.query(
      "SELECT * FROM members WHERE username = $1",
      [username]
    );

    if (result.rowCount === 0) {
      return new Response(
        JSON.stringify({ message: "Username atau password salah" }),
        {
          status: 401,
          headers: CORS_HEADERS,
        }
      );
    }

    const member = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, member.password_hash);

    if (!passwordMatch) {
      return new Response(
        JSON.stringify({ message: "Username atau password salah" }),
        {
          status: 401,
          headers: CORS_HEADERS,
        }
      );
    }

    const token = jwt.sign(
      { id: member.id, username: member.username, role: "member" },
      import.meta.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    cookies.set("auth_token", token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    delete member.password_hash;

    return new Response(
      JSON.stringify({
        message: "Login berhasil",
        token: token,
        user: member,
        redirectTo: "/member/profile", // Opsional untuk website
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
