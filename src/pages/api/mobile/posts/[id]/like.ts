import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

export const POST: APIRoute = async ({ params, cookies }) => {
  const post_id = parseInt(params.id, 10);
  const token = cookies.get("auth_token")?.value;

  if (!token) {
    return new Response("Akses ditolak.", { status: 401 });
  }
  if (isNaN(post_id)) {
    return new Response("ID Post tidak valid.", { status: 400 });
  }

  const client = new Client(clientConfig);
  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
      role: string;
    };
    if (decoded.role !== "member") {
      return new Response("Hanya member yang bisa menyukai post.", {
        status: 403,
      });
    }
    const sender_id = decoded.id;

    await client.connect();
    await client.query("BEGIN"); // Mulai transaksi untuk memastikan semua proses berhasil

    // 1. Ambil ID pemilik post untuk notifikasi nanti
    const postOwnerResult = await client.query(
      "SELECT member_id FROM posts WHERE id = $1",
      [post_id]
    );
    if (postOwnerResult.rowCount === 0) {
      throw new Error("Post tidak ditemukan.");
    }
    const recipient_id = postOwnerResult.rows[0].member_id;

    // Jangan buat notifikasi jika me-like post sendiri
    const shouldCreateNotification = sender_id !== recipient_id;

    // 2. Catat 'like' di tabel post_likes
    await client.query(
      "INSERT INTO post_likes (post_id, member_id) VALUES ($1, $2)",
      [post_id, sender_id]
    );

    // 3. Tambah jumlah 'likes_count' di tabel posts
    const result = await client.query(
      "UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count",
      [post_id]
    );

    // 4. Buat notifikasi (jika bukan post sendiri)
    if (shouldCreateNotification) {
      await client.query(
        "INSERT INTO notifications (recipient_id, sender_id, post_id, type) VALUES ($1, $2, $3, 'like')",
        [recipient_id, sender_id, post_id]
      );
    }

    await client.query("COMMIT"); // Selesaikan transaksi jika semua berhasil

    return new Response(
      JSON.stringify({ likes_count: result.rows[0].likes_count }),
      { status: 200 }
    );
  } catch (error) {
    await client.query("ROLLBACK"); // Batalkan semua perubahan jika ada error

    // Error code '23505' adalah untuk duplikat (sudah pernah like)
    if (error.code === "23505") {
      return new Response("Anda sudah menyukai post ini.", { status: 409 });
    }
    console.error("Gagal melakukan like:", error);
    return new Response("Terjadi kesalahan di server.", { status: 500 });
  } finally {
    await client.end();
  }
};

// FUNGSI UNTUK "UNLIKE" (Method: DELETE)
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const post_id = parseInt(params.id, 10);
  const token = cookies.get("auth_token")?.value;

  if (!token) {
    return new Response("Akses ditolak.", { status: 401 });
  }
  if (isNaN(post_id)) {
    return new Response("ID Post tidak valid.", { status: 400 });
  }

  const client = new Client(clientConfig);
  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
    };
    const member_id = decoded.id;

    await client.connect();
    await client.query("BEGIN"); // Mulai transaksi

    // 1. Hapus catatan 'like' dari tabel post_likes
    const deleteResult = await client.query(
      "DELETE FROM post_likes WHERE post_id = $1 AND member_id = $2",
      [post_id, member_id]
    );

    // 2. Hanya kurangi hitungan jika ada baris yang benar-benar dihapus
    if (deleteResult.rowCount > 0) {
      const result = await client.query(
        "UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1 RETURNING likes_count",
        [post_id]
      );
      await client.query("COMMIT"); // Selesaikan transaksi
      return new Response(
        JSON.stringify({ likes_count: result.rows[0].likes_count }),
        { status: 200 }
      );
    } else {
      // Jika tidak ada yang dihapus (mungkin karena belum di-like), batalkan.
      await client.query("ROLLBACK");
      return new Response("Anda belum menyukai post ini.", { status: 409 });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Gagal melakukan unlike:", error);
    return new Response("Terjadi kesalahan di server.", { status: 500 });
  } finally {
    await client.end();
  }
};
