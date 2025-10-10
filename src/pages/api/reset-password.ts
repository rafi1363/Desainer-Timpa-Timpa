import type { APIRoute } from "astro";
import { Client } from "pg";
import crypto from "crypto";
import bcrypt from "bcrypt";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;

  if (!token || !password) {
    return new Response(
      JSON.stringify({ message: "Token dan password baru wajib diisi." }),
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return new Response(
      JSON.stringify({ message: "Password minimal harus 6 karakter." }),
      { status: 400 }
    );
  }

  // Hash token yang diterima dari pengguna agar cocok dengan yang di database
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const client = new Client(clientConfig);
  try {
    await client.connect();

    // Cari pengguna dengan token yang cocok DAN belum kedaluwarsa
    const userResult = await client.query(
      "SELECT * FROM members WHERE password_reset_token = $1 AND password_reset_expires > NOW()",
      [hashedToken]
    );

    if (userResult.rowCount === 0) {
      return new Response(
        JSON.stringify({
          message: "Token reset tidak valid atau sudah kedaluwarsa.",
        }),
        { status: 400 }
      );
    }
    const user = userResult.rows[0];

    // Enkripsi password baru
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Update password dan hapus token reset agar tidak bisa digunakan lagi
    await client.query(
      "UPDATE members SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2",
      [password_hash, user.id]
    );

    return new Response(
      JSON.stringify({
        message:
          "Password berhasil direset! Anda akan dialihkan ke halaman login...",
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server." }),
      { status: 500 }
    );
  } finally {
    await client.end();
  }
};
