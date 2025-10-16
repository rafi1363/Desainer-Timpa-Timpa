import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

// Endpoint untuk membuat postingan baru
export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get("auth_token")?.value;

  if (!token) {
    return new Response("Akses ditolak. Token tidak ditemukan.", {
      status: 401,
    });
  }

  const client = new Client(clientConfig);
  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
      role: string;
    };
    if (decoded.role !== "member") {
      return new Response("Hanya member yang bisa membuat post.", {
        status: 403,
      });
    }
    const member_id = decoded.id;

    // Ambil data 'caption' dan 'image_urls' dari aplikasi mobile
    const { caption, image_urls } = await request.json();

    if (!image_urls || !Array.isArray(image_urls) || image_urls.length === 0) {
      return new Response("Minimal harus ada satu gambar.", { status: 400 });
    }

    await client.connect();
    await client.query("BEGIN"); // Mulai transaksi

    // 1. Simpan data utama postingan ke tabel 'posts'
    const postQuery =
      "INSERT INTO posts (member_id, caption) VALUES ($1, $2) RETURNING id";
    const postResult = await client.query(postQuery, [member_id, caption]);
    const newPostId = postResult.rows[0].id;

    // 2. Simpan setiap URL gambar ke tabel 'post_images'
    for (let i = 0; i < image_urls.length; i++) {
      const imageQuery =
        "INSERT INTO post_images (post_id, image_url, sort_order) VALUES ($1, $2, $3)";
      await client.query(imageQuery, [newPostId, image_urls[i], i]);
    }

    await client.query("COMMIT"); // Selesaikan transaksi jika semua berhasil

    // Mengembalikan data post yang baru dibuat (opsional tapi bagus untuk konfirmasi)
    const finalPost = {
      id: newPostId,
      member_id,
      caption,
      image_urls,
    };

    return new Response(JSON.stringify(finalPost), { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK"); // Batalkan semua jika ada error
    console.error("Gagal membuat post baru:", error);
    return new Response("Terjadi kesalahan di server.", { status: 500 });
  } finally {
    await client.end();
  }
};
