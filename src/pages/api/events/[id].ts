import { v2 as cloudinary } from "cloudinary";
import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

// Fungsi untuk MENGAMBIL satu event berdasarkan ID
export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  const client = new Client(clientConfig);
  try {
    await client.connect();
    const result = await client.query("SELECT * FROM events WHERE id = $1", [
      id,
    ]);
    if (result.rowCount === 0) {
      return new Response(null, { status: 404, statusText: "Not Found" });
    }
    return new Response(JSON.stringify(result.rows[0]), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Error di server", { status: 500 });
  } finally {
    await client.end();
  }
};

// Fungsi untuk MENGUPDATE satu event berdasarkan ID
export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const { id } = params;
  const client = new Client(clientConfig);

  try {
    // 1. Verifikasi token untuk mengetahui siapa yang membuat request
    const token =
      request.headers.get("Authorization")?.split(" ")[1] ||
      cookies.get("auth_token")?.value;
    if (!token) {
      return new Response(JSON.stringify({ message: "Akses ditolak" }), {
        status: 401,
      });
    }

    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      username: string;
      role: string;
    };
    const requesterUsername = decoded.username;
    const requesterRole = decoded.role;

    await client.connect();

    // 2. Ambil detail event untuk mengetahui siapa pemiliknya
    const eventResult = await client.query(
      "SELECT host FROM events WHERE id = $1",
      [id]
    );
    if (eventResult.rowCount === 0) {
      return new Response("Data event tidak ditemukan.", { status: 404 });
    }
    const eventHost = eventResult.rows[0].host;

    // 3. LAKUKAN PENGECEKAN OTORISASI (PALING PENTING)
    // Izinkan jika requester adalah pemilik ATAU jika requester adalah admin
    if (requesterUsername !== eventHost && requesterRole !== "admin") {
      return new Response(
        JSON.stringify({
          message: "Anda tidak punya izin untuk mengubah event ini.",
        }),
        { status: 403 }
      );
    }

    // 4. Jika lolos pengecekan, baru lanjutkan proses update
    const { title, description, host, event_date, event_type } =
      await request.json();
    const query = `
      UPDATE events 
      SET title = $1, description = $2, host = $3, event_date = $4, event_type = $5 
      WHERE id = $6 
      RETURNING *`;
    const values = [title, description, host, event_date, event_type, id];
    const result = await client.query(query, values);

    return new Response(JSON.stringify(result.rows[0]), { status: 200 });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return new Response(JSON.stringify({ message: "Token tidak valid." }), {
        status: 401,
      });
    }
    console.error("Gagal mengupdate event:", error);
    return new Response(
      JSON.stringify({ message: "Gagal mengupdate event di server." }),
      { status: 500 }
    );
  } finally {
    await client.end();
  }
};

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  const { id } = params;
  const client = new Client({ connectionString: import.meta.env.DATABASE_URL });

  try {
    // 1. Verifikasi token untuk mengetahui siapa yang request
    const token =
      request.headers.get("Authorization")?.split(" ")[1] ||
      cookies.get("auth_token")?.value;
    if (!token) {
      return new Response(JSON.stringify({ message: "Akses ditolak" }), {
        status: 401,
      });
    }

    // Ambil username dan role dari token
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      username: string;
      role: string;
    };
    const requesterUsername = decoded.username;
    const requesterRole = decoded.role;

    await client.connect();

    // 2. Ambil detail event untuk mengetahui siapa pemiliknya
    const eventResult = await client.query(
      "SELECT host FROM events WHERE id = $1",
      [id]
    );
    if (eventResult.rowCount === 0) {
      return new Response("Data event tidak ditemukan.", { status: 404 });
    }
    const eventHost = eventResult.rows[0].host;

    // 3. PENGECEKAN OTORISASI GANDA (PALING PENTING)
    // Izinkan jika requester adalah pemilik ATAU jika requester adalah admin
    if (requesterUsername !== eventHost && requesterRole !== "admin") {
      return new Response(
        JSON.stringify({
          message: "Anda tidak punya izin untuk menghapus event ini.",
        }),
        { status: 403 }
      ); // 403 Forbidden
    }

    // 4. Jika lolos pengecekan, baru hapus event
    await client.query("DELETE FROM events WHERE id = $1", [id]);

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return new Response(JSON.stringify({ message: "Token tidak valid." }), {
        status: 401,
      });
    }
    console.error("Gagal menghapus event:", error);
    return new Response(
      JSON.stringify({ message: "Gagal menghapus event di server." }),
      { status: 500 }
    );
  } finally {
    await client.end();
  }
};
