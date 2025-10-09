import type { APIRoute } from "astro";
import { Client } from "pg";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

// Konfigurasi Cloudinary di luar handler agar tidak berulang
cloudinary.config({
  cloud_name: import.meta.env.CLOUDINARY_CLOUD_NAME,
  api_key: import.meta.env.CLOUDINARY_API_KEY,
  api_secret: import.meta.env.CLOUDINARY_API_SECRET,
});

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const { id } = params;
  const token = cookies.get("auth_token")?.value;

  if (!id) return new Response("ID karya tidak ditemukan.", { status: 400 });
  if (!token) return new Response("Akses ditolak.", { status: 401 });

  const client = new Client(clientConfig);
  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
      role: string;
    };
    await client.connect();

    // Ambil data karya, terutama siapa pemiliknya (member_id)
    const workResult = await client.query(
      "SELECT image_url, member_id FROM gallery WHERE id = $1",
      [id]
    );
    if (workResult.rowCount === 0) {
      return new Response("Karya tidak ditemukan.", { status: 404 });
    }
    const work = workResult.rows[0];

    // --- LOGIKA KEAMANAN ---
    // Cek apakah pengguna adalah admin ATAU pemilik sah karya ini
    if (decoded.role !== "admin" && work.member_id !== decoded.id) {
      return new Response(
        "Anda tidak memiliki izin untuk menghapus karya ini.",
        { status: 403 }
      );
    }

    // --- PROSES HAPUS (Jika Pengecekan Keamanan Lolos) ---
    await client.query("DELETE FROM gallery WHERE id = $1", [id]);

    if (work.image_url) {
      const publicId = work.image_url.split("/").pop()?.split(".")[0];
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Gagal menghapus:", error);
    if (error instanceof jwt.JsonWebTokenError) {
      return new Response("Token tidak valid", { status: 401 });
    }
    return new Response("Terjadi kesalahan pada server.", { status: 500 });
  } finally {
    await client.end();
  }
};
