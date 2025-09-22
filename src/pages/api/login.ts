import type { APIRoute } from "astro";
import { Client } from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const POST: APIRoute = async ({ request, cookies }) => {
  const formData = await request.formData();
  const username = formData.get("username")?.toString();
  const password = formData.get("password")?.toString();

  if (!username || !password) {
    return new Response("Username dan password harus diisi", { status: 400 });
  }

  const client = new Client({ connectionString: import.meta.env.DATABASE_URL });

  try {
    await client.connect();
    const result = await client.query(
      "SELECT * FROM admins WHERE username = $1",
      [username]
    );

    if (result.rowCount === 0) {
      return new Response("Username atau password salah", { status: 401 });
    }

    const admin = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatch) {
      return new Response("Username atau password salah", { status: 401 });
    }

    // Jika berhasil, buat token (tiket masuk)
    const token = jwt.sign(
      { id: admin.id, username: admin.username, real_name: admin.real_name },
      import.meta.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Kirim token sebagai httpOnly cookie
    cookies.set("auth_token", token, {
      httpOnly: true,
      secure: import.meta.env.PROD, // true di Vercel, false di lokal
      path: "/",
      maxAge: 60 * 60 * 8, // 8 jam
    });

    return new Response(JSON.stringify({ message: "Login berhasil" }), {
      status: 200,
    });
  } catch (error) {
    console.error(error);
    return new Response("Terjadi kesalahan pada server", { status: 500 });
  } finally {
    await client.end();
  }
};
