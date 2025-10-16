// src/pages/api/mobile/posts/[id]/comments.ts

import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";
import { Expo } from "expo-server-sdk";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

// --- Inisialisasi Expo SDK ---
const credentialsJson = import.meta.env.GOOGLE_APPLICATION_CREDENTIALS;
let expo;

if (credentialsJson) {
  try {
    const serviceAccountCredentials = JSON.parse(credentialsJson);
    expo = new Expo({
      useFcmV1: true,
      serviceAccountCredentials,
    });
    console.log("[NOTIF LOG]: SDK Expo berhasil diinisialisasi dengan kredensial FCM V1.");
  } catch (e) {
    console.error("[NOTIF ERROR]: Gagal mem-parsing GOOGLE_APPLICATION_CREDENTIALS JSON.", e);
    expo = new Expo();
  }
} else {
  console.error("[NOTIF ERROR]: Environment variable GOOGLE_APPLICATION_CREDENTIALS tidak ditemukan.");
  expo = new Expo();
}
// --- Akhir Inisialisasi ---

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// Mengambil semua komentar
export const GET: APIRoute = async ({ params }) => {
    const postId = parseInt(params.id, 10);
    const client = new Client(clientConfig);
    try {
        await client.connect();
        const query = `
            SELECT c.id, c.comment_text, c.created_at, json_build_object('id', m.id, 'username', m.username) as author
            FROM post_comments c
            JOIN members m ON c.member_id = m.id
            WHERE c.post_id = $1
            ORDER BY c.created_at ASC;
        `;
        const result = await client.query(query, [postId]);
        return new Response(JSON.stringify(result.rows), { status: 200, headers: CORS_HEADERS });
    } catch (error) {
        console.error("Get Comments API Error:", error);
        return new Response(JSON.stringify({ message: "Terjadi kesalahan pada server" }), { status: 500, headers: CORS_HEADERS });
    } finally {
        await client.end();
    }
};

// Menambahkan komentar baru DAN mengirim notifikasi
export const POST: APIRoute = async ({ params, request }) => {
    const postId = parseInt(params.id, 10);
    const client = new Client(clientConfig);

    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ message: "Akses ditolak" }), { status: 401, headers: CORS_HEADERS });
        }

        const token = authHeader.split(' ')[1];
        const decodedToken = jwt.verify(token, import.meta.env.JWT_SECRET) as { id: number, username: string };
        const commenterId = decodedToken.id;
        const commenterUsername = decodedToken.username;

        const { comment_text } = await request.json();
        if (!comment_text || comment_text.trim() === '') {
            return new Response(JSON.stringify({ message: "Komentar tidak boleh kosong" }), { status: 400, headers: CORS_HEADERS });
        }

        await client.connect();

        // 1. Simpan komentar baru dan dapatkan ID-nya
        const insertQuery = "INSERT INTO post_comments (post_id, member_id, comment_text) VALUES ($1, $2, $3) RETURNING id";
        const insertResult = await client.query(insertQuery, [postId, commenterId, comment_text]);
        const newCommentId = insertResult.rows[0].id;
        
        // 2. Kir