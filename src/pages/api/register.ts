import type { APIRoute } from "astro";
import { Client } from "pg";
import bcrypt from "bcrypt"; // [PERUBAHAN] Menggunakan bcrypt, bukan argon2

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const username = formData.get("username") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!username || !email || !password) {
    return new Response(
      JSON.stringify({ message: "Semua kolom wajib diisi." }),
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return new Response(
      JSON.stringify({ message: "Password minimal harus 6 karakter." }),
      { status: 400 }
    );
  }

  // [PERUBAHAN] Enkripsi password menggunakan bcrypt
  const saltRounds = 10;
  const password_hash = await bcrypt.hash(password, saltRounds);

  const client = new Client(clientConfig);
  try {
    await client.connect();
    const query =
      "INSERT INTO members (username, email, password_hash) VALUES ($1, $2, $3)";
    await client.query(query, [username, email, password_hash]);

    return new Response(
      JSON.stringify({
        message: "Registrasi berhasil! Anda akan dialihkan...",
      }),
      { status: 201 }
    );
  } catch (error) {
    if (error.code === "23505") {
      return new Response(
        JSON.stringify({ message: "Username atau email ini sudah terdaftar." }),
        { status: 409 }
      );
    }
    console.error(error);
    return new Response(
      JSON.stringify({ message: "Registrasi gagal karena kesalahan server." }),
      { status: 500 }
    );
  } finally {
    await client.end();
  }
};
