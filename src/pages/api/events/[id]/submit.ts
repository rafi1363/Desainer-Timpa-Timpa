// src/pages/api/events/[id]/submit.ts

import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";
import { google } from "googleapis";
import { Readable } from "stream";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const POST: APIRoute = async ({ params, request }) => {
  const eventId = parseInt(params.id, 10);
  const client = new Client(clientConfig);

  try {
    // 1. Verifikasi Pengguna
    const authHeader = request.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ message: "Akses ditolak" }), {
        status: 401,
        headers: CORS_HEADERS,
      });

    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
    };
    const memberId = decodedToken.id;

    // 2. Baca Data Form (termasuk file)
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return new Response(
        JSON.stringify({ message: "File submission tidak ditemukan" }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Otentikasi ke Google Drive
    const credentials = JSON.parse(
      import.meta.env.GOOGLE_APPLICATION_CREDENTIALS
    );
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    const drive = google.drive({ version: "v3", auth });

    // 4. Unggah File ke Google Drive
    const fileMetadata = {
      name: file.name,
      parents: [import.meta.env.GOOGLE_DRIVE_PARENT_FOLDER_ID], // Taruh di folder utama
    };
    const media = {
      mimeType: file.type,
      body: Readable.from(Buffer.from(await file.arrayBuffer())),
    };

    const driveResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id, webViewLink", // Minta link untuk melihat file
    });

    const fileUrl = driveResponse.data.webViewLink;
    if (!fileUrl) {
      throw new Error("Gagal mendapatkan URL file dari Google Drive");
    }

    // 5. Simpan Catatan ke Database
    await client.connect();
    const query =
      "INSERT INTO event_submissions (event_id, member_id, file_url) VALUES ($1, $2, $3)";
    await client.query(query, [eventId, memberId, fileUrl]);

    return new Response(
      JSON.stringify({ message: "Submission berhasil!", fileUrl }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("Event Submission API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};
