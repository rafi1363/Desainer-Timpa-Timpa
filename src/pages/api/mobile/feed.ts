import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

// Endpoint untuk mengambil 'feed' postingan
export const GET: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get("auth_token")?.value;
  if (!token) {
    return new Response("Akses ditolak.", { status: 401 });
  }

  // Mengambil parameter untuk paginasi dari URL, misal: /api/mobile/feed?page=1&limit=10
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);
  const offset = (page - 1) * limit;

  const client = new Client(clientConfig);
  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
    };
    const currentUserId = decoded.id;

    await client.connect();

    // Ini adalah query SQL yang kompleks untuk mengambil semua data dalam satu panggilan
    const query = `
      SELECT
        p.id,
        p.caption,
        p.created_at,
        p.likes_count,
        m.username AS "authorUsername",
        -- Cek apakah pengguna saat ini sudah menyukai post ini
        EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.member_id = $1) AS "isLikedByMe",
        -- Gabungkan semua gambar post menjadi satu array JSON
        (
          SELECT json_agg(json_build_object('id', pi.id, 'imageUrl', pi.image_url) ORDER BY pi.sort_order)
          FROM post_images pi
          WHERE pi.post_id = p.id
        ) AS images,
        -- Ambil 2 komentar terbaru untuk preview
        (
          SELECT json_agg(json_build_object('id', pc.id, 'text', pc.comment_text, 'username', c_m.username) ORDER BY pc.created_at ASC)
          FROM (
            SELECT * FROM post_comments WHERE post_id = p.id ORDER BY created_at DESC LIMIT 2
          ) pc
          JOIN members c_m ON pc.member_id = c_m.id
        ) AS "recentComments"
      FROM
        posts p
      JOIN
        members m ON p.member_id = m.id
      ORDER BY
        p.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await client.query(query, [currentUserId, limit, offset]);

    // Membersihkan data null dari recentComments jika tidak ada komentar
    const feedData = result.rows.map((post) => ({
      ...post,
      recentComments: post.recentComments || [],
    }));

    return new Response(JSON.stringify(feedData), { status: 200 });
  } catch (error) {
    console.error("Gagal mengambil feed:", error);
    return new Response("Terjadi kesalahan di server.", { status: 500 });
  } finally {
    await client.end();
  }
};
