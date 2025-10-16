// src/pages/api/login.ts (REVISI FINAL V2 - Dengan Admin Login)

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
    const contentType = request.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const body = await request.json();
      username = body.username;
      password = body.password;
    } else {
      const formData = await request.formData();
      username = formData.get("username")?.toString();
      password = formData.get("password")?.toString();
    }

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

    // --- LOGIKA LOGIN GABUNGAN ---

    let user = null;
    let userType = null;

    // 1. Coba login sebagai MEMBER terlebih dahulu
    const memberResult = await client.query(
      "SELECT * FROM members WHERE username = $1",
      [username]
    );
    if (memberResult.rowCount > 0) {
      const member = memberResult.rows[0];
      const passwordMatch = await bcrypt.compare(
        password,
        member.password_hash
      );
      if (passwordMatch) {
        user = member;
        userType = "member";
      }
    }

    // 2. Jika tidak berhasil sebagai member, coba sebagai ADMIN
    if (!user) {
      const adminResult = await client.query(
        "SELECT * FROM admins WHERE username = $1",
        [username]
      );
      if (adminResult.rowCount > 0) {
        const admin = adminResult.rows[0];
        const passwordMatch = await bcrypt.compare(
          password,
          admin.password_hash
        );
        if (passwordMatch) {
          user = admin;
          userType = "admin";
        }
      }
    }
    // ----------------------------

    // Jika setelah dicek keduanya tetap tidak ada yang cocok
    if (!user) {
      return new Response(
        JSON.stringify({ message: "Username atau password salah" }),
        {
          status: 401,
          headers: CORS_HEADERS,
        }
      );
    }

    // Buat token berdasarkan tipe user
    const token = jwt.sign(
      { id: user.id, username: user.username, role: userType },
      import.meta.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    cookies.set("auth_token", token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    delete user.password_hash;

    // Tentukan halaman redirect berdasarkan role
    const redirectTo = userType === "admin" ? "/admin" : "/member/profile";

    return new Response(
      JSON.stringify({
        message: "Login berhasil",
        token: token,
        user: user,
        redirectTo: redirectTo,
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
