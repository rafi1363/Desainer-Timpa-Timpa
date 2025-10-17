// src/pages/api/events.ts

import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";
import { google } from "googleapis";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

// FUNGSI GET (Tidak perlu diubah, tapi kita tambahkan CORS)
export const GET: APIRoute = async () => {
  const client = new Client(clientConfig);
  try {
    await client.connect();
    const result = await client.query(
      "SELECT * FROM events ORDER BY event_date DESC"
    );
    return new Response(JSON.stringify(result.rows), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error(error);
    return new Response("Error di server", {
      status: 500,
      headers: CORS_HEADERS,
    });
  } finally {
    await client.end();
  }
};

// --- GANTI FUNGSI POST LAMA ANDA DENGAN INI ---
export const POST: APIRoute = async ({ request }) => {
  const client = new Client(clientConfig);

  try {
    // 1. Verifikasi Pengguna (Hanya yang login bisa buat event)
    const authHeader = request.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ message: "Akses ditolak" }), {
        status: 401,
        headers: CORS_HEADERS,
      });

    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
      username: string;
    };
    const hostUsername = decodedToken.username; // Host event adalah user yang login

    // 2. Ambil data event dari aplikasi mobile
    const { title, description, event_date, event_type } = await request.json();
    if (!title || !description || !event_date) {
      return new Response(
        JSON.stringify({
          message: "Judul, deskripsi, dan tanggal wajib diisi",
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Otentikasi & Buat Folder di Google Drive
    const credentials = JSON.parse(import.meta.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    const drive = google.drive({ version: "v3", auth });

    const folderMetadata = {
      name: `Event - ${title}`, // Nama folder di Google Drive
      mimeType: "application/vnd.google-apps.folder",
      parents: [import.meta.env.GOOGLE_DRIVE_PARENT_FOLDER_ID],
    };

    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: "id, webViewLink",
    });

    const driveFolderUrl = folder.data.webViewLink;
    if (!driveFolderUrl) {
      throw new Error(
        "Gagal membuat folder atau mendapatkan URL dari Google Drive"
      );
    }

    // 4. Simpan semua data ke Database
    await client.connect();
    const query = `
      INSERT INTO events (title, description, host, event_date, event_type, drive_folder_url) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`;
    const values = [
      title,
      description,
      hostUsername,
      event_date,
      event_type,
      driveFolderUrl,
    ];
    const result = await client.query(query, values);

    return new Response(JSON.stringify(result.rows[0]), {
      status: 201,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error("Create Event API Error:", error);
    return new Response(
      JSON.stringify({
        message: "Gagal membuat event karena kesalahan server",
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};
