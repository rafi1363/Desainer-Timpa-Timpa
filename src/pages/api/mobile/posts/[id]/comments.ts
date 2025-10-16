// src/pages/api/mobile/posts/[id]/comments.ts

import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";
import { Expo } from "expo-server-sdk"; // <-- 1. Import Expo SDK

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };
// const expo = new Expo({ useFcmV1: true }); // Buat instance baru dari Expo

// 1. Baca kredensial dari environment variable
const credentialsJson = import.meta.env.GOOGLE_APPLICATION_CREDENTIALS;
let expo;

// 2. Cek apakah kredensial ada dan valid
if (credentialsJson) {
  try {
    const serviceAccountCredentials = JSON.parse(credentialsJson);
    // 3. Inisialisasi Expo dengan kredensial yang sudah diparsing
    expo = new Expo({
      useFcmV1: true,
      serviceAccountCredentials,
    });
    console.log("[NOTIF LOG]: SDK Expo berhasil diinisialisasi dengan kredensial FCM V1.");
  } catch (e) {
    console.error("[NOTIF ERROR]: Gagal mem-parsing GOOGLE_APPLICATION_CREDENTIALS JSON.", e);
    // Fallback ke metode lama jika parsing gagal, meskipun kemungkinan akan error
    expo = new Expo();
  }
} else {
  console.error("[NOTIF ERROR]: Environment variable GOOGLE_APPLICATION_CREDENTIALS tidak ditemukan.");
  expo = new Expo();
// }

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// Mengambil semua komentar untuk sebuah post
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
    return new Response(JSON.stringify(result.rows), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error("Like API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};

// Menambahkan komentar baru
export const POST: APIRoute = async ({ params, request }) => {
  const postId = parseInt(params.id, 10);
  const client = new Client(clientConfig);
  try {
    const authHeader = request.headers.get("Authorization");
    // ... verifikasi token seperti di atas ...
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
      username: string;
    };
    const commenterId = decodedToken.id;
    const commenterUsername = decodedToken.username;

    const { comment_text } = await request.json();
    if (!comment_text) {
      return new Response(
        JSON.stringify({ message: "Komentar tidak boleh kosong" }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    await client.connect();
    // --- PERUBAHAN DIMULAI DI SINI ---

    // 1. Masukkan komentar baru dan dapatkan ID-nya
    // --- Perubahan untuk Notifikasi Dimulai Di Sini ---

    // 2. Dapatkan ID pemilik postingan
    const postOwnerQuery = await client.query(
      "SELECT member_id FROM posts WHERE id = $1",
      [postId]
    );
    if (postOwnerQuery.rowCount === 0) {
      return new Response(
        JSON.stringify({ message: "Postingan tidak ditemukan" }),
        { status: 404 }
      );
    }
    const postOwnerId = postOwnerQuery.rows[0].member_id;

    // --- Perubahan Logging Dimulai Di Sini ---
    if (postOwnerId !== commenterId) {
      console.log(
        `[NOTIF LOG]: Mencoba mengirim notifikasi. Pengomentar: ${commenterId}, Pemilik Post: ${postOwnerId}`
      );

      const recipientQuery = await client.query(
        "SELECT push_token FROM members WHERE id = $1",
        [postOwnerId]
      );
      const pushToken = recipientQuery.rows[0]?.push_token;

      console.log(
        `[NOTIF LOG]: Push token yang ditemukan untuk pemilik: ${pushToken}`
      );

      if (pushToken && Expo.isExpoPushToken(pushToken)) {
        const message = {
          to: pushToken,
          sound: "default" as const,
          title: "Komentar Baru 📬",
          body: `${commenterUsername} mengomentari postingan Anda.`,
          data: { postId: postId },
        };

        try {
          console.log("[NOTIF LOG]: Mengirim pesan ke server Expo...");
          const tickets = await expo.sendPushNotificationsAsync([message]);
          console.log("[NOTIF LOG]: Respons dari Expo:", tickets);

          // Cek jika ada error dari Expo
          const receipt = tickets[0];
          if (receipt.status === "error") {
            console.error(
              `[NOTIF ERROR]: Gagal mengirim notifikasi: ${receipt.message}`
            );
            if (receipt.details && receipt.details.error) {
              console.error(`[NOTIF ERROR]: Detail: ${receipt.details.error}`);
            }
          }
        } catch (error) {
          console.error(
            "[NOTIF ERROR]: Terjadi error saat memanggil sendPushNotificationsAsync:",
            error
          );
        }
      } else {
        console.log(
          "[NOTIF LOG]: Token tidak valid atau tidak ditemukan. Notifikasi dilewati."
        );
      }
    } else {
      console.log(
        "[NOTIF LOG]: Pengguna mengomentari postingannya sendiri. Notifikasi tidak dikirim."
      );
    }

    const insertQuery =
      "INSERT INTO post_comments (post_id, member_id, comment_text) VALUES ($1, $2, $3) RETURNING id";
    const insertResult = await client.query(insertQuery, [
      postId,
      commenterId,
      comment_text,
    ]);
    const newCommentId = insertResult.rows[0].id;

    // 4. Kirim notifikasi JIKA yang berkomentar bukan pemilik post
    if (postOwnerId !== commenterId) {
      const recipientQuery = await client.query(
        "SELECT push_token FROM members WHERE id = $1",
        [postOwnerId]
      );
      const pushToken = recipientQuery.rows[0]?.push_token;

      if (pushToken && Expo.isExpoPushToken(pushToken)) {
        const message = {
          to: pushToken,
          sound: "default" as const,
          title: "Komentar Baru 📬",
          body: `${commenterUsername} mengomentari postingan Anda.`,
          data: { postId: postId }, // Data tambahan untuk navigasi
        };
        await expo.sendPushNotificationsAsync([message]);
        console.log(`Notifikasi terkirim ke member ID: ${postOwnerId}`);
      }
    }

    // 2. Lakukan query kedua untuk mengambil komentar baru dengan format yang benar (termasuk data author)
    const selectQuery = `
            SELECT c.id, c.comment_text, c.created_at, json_build_object('id', m.id, 'username', m.username) as author
            FROM post_comments c
            JOIN members m ON c.member_id = m.id
            WHERE c.id = $1;
        `;
    const finalResult = await client.query(selectQuery, [newCommentId]);

    // 3. Kirim kembali hasil query kedua
    return new Response(JSON.stringify(finalResult.rows[0]), {
      status: 201,
      headers: CORS_HEADERS,
    });

    // --- AKHIR PERUBAHAN ---
  } catch (error) {
    console.error("Like API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};
