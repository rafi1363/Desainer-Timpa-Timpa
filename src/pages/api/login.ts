import type { APIRoute } from "astro";
import { Client } from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

export const POST: APIRoute = async ({ request, cookies }) => {
  const formData = await request.formData();
  const username = formData.get("username")?.toString();
  const password = formData.get("password")?.toString();

  if (!username || !password) {
    return new Response("Username dan password harus diisi", { status: 400 });
  }

  const client = new Client(clientConfig);
  try {
    await client.connect();

    // --- Langkah 1: Cek apakah pengguna adalah ADMIN ---
    let result = await client.query(
      "SELECT * FROM admins WHERE username = $1",
      [username]
    );
    if (result.rowCount > 0) {
      const admin = result.rows[0];
      const passwordMatch = await bcrypt.compare(password, admin.password_hash);
      if (passwordMatch) {
        const token = jwt.sign(
          {
            id: admin.id,
            username: admin.username,
            real_name: admin.real_name,
            role: "admin",
          },
          import.meta.env.JWT_SECRET,
          { expiresIn: "8h" }
        );
        cookies.set("auth_token", token, {
          httpOnly: true,
          secure: import.meta.env.PROD,
          path: "/",
          maxAge: 60 * 60 * 8,
        });
        // Kirim respons untuk redirect ke /admin
        return new Response(JSON.stringify({ redirectTo: "/admin" }), {
          status: 200,
        });
      }
    }

    // --- Langkah 2: Jika bukan admin, cek apakah pengguna adalah MEMBER ---
    result = await client.query("SELECT * FROM members WHERE username = $1", [
      username,
    ]);
    if (result.rowCount > 0) {
      const member = result.rows[0];
      const passwordMatch = await bcrypt.compare(
        password,
        member.password_hash
      );
      if (passwordMatch) {
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
        // Kirim respons untuk redirect ke /member/profile
        return new Response(JSON.stringify({ redirectTo: "/member/profile" }), {
          status: 200,
        });
      }
    }

    // --- Langkah 3: Jika tidak ditemukan di keduanya, maka login gagal ---
    return new Response("Username atau password salah", { status: 401 });
  } catch (error) {
    console.error(error);
    return new Response("Terjadi kesalahan pada server", { status: 500 });
  } finally {
    await client.end();
  }
};
