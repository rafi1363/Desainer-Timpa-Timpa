import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

// GET: Mengambil semua data galeri
export const GET: APIRoute = async () => {
  const client = new Client(clientConfig);
  try {
    await client.connect();
    const result = await client.query(
      "SELECT * FROM gallery ORDER BY created_at DESC"
    );
    return new Response(JSON.stringify(result.rows), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Error di server", { status: 500 });
  } finally {
    await client.end();
  }
};

// --- GANTI FUNGSI POST ANDA DENGAN INI ---
export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get("auth_token")?.value;
  if (!token) {
    return new Response(
      JSON.stringify({ message: "Akses ditolak. Silakan login." }),
      { status: 401 }
    );
  }

  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
      username: string;
      role: string;
    };

    const formData = await request.formData();
    const image_url = formData.get("image_url") as string;
    const design_type = formData.get("design_type") as string;

    let artis: string;
    let member_id: number | null = null;

    // --- INI LOGIKA KUNCINYA ---
    if (decoded.role === "member") {
      // Jika yang mengunggah adalah MEMBER, 'artis' adalah username dari sesi login
      artis = decoded.username;
      member_id = decoded.id;
    } else if (decoded.role === "admin") {
      // Jika yang mengunggah adalah ADMIN, 'artis' diambil dari input form
      artis = formData.get("artis") as string;
    } else {
      return new Response(
        JSON.stringify({ message: "Peran pengguna tidak valid." }),
        { status: 403 }
      );
    }

    if (!image_url || !artis) {
      return new Response(
        JSON.stringify({
          message: "Data tidak lengkap. URL gambar atau nama artis kosong.",
        }),
        { status: 400 }
      );
    }

    const client = new Client(clientConfig);
    await client.connect();

    const query =
      "INSERT INTO gallery (image_url, artis, design_type, member_id) VALUES ($1, $2, $3, $4) RETURNING *";
    const values = [image_url, artis, design_type, member_id];

    const result = await client.query(query, values);

    await client.end();
    return new Response(JSON.stringify(result.rows[0]), { status: 201 });
  } catch (error) {
    console.error("Error di API /api/gallery [POST]:", error);
    return new Response(
      JSON.stringify({
        message: "Gagal menyimpan ke database karena kesalahan server.",
      }),
      { status: 500 }
    );
  }
};
