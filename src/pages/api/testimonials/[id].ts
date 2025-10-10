import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const { id } = params;
  const token = cookies.get("auth_token")?.value;

  if (!token) return new Response("Akses ditolak", { status: 401 });

  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      role: string;
    };
    if (decoded.role !== "admin")
      return new Response("Hanya admin yang bisa melakukan aksi ini.", {
        status: 403,
      });

    const { is_featured } = await request.json();

    const client = new Client(clientConfig);
    await client.connect();
    await client.query(
      "UPDATE testimonials SET is_featured = $1 WHERE id = $2",
      [is_featured, id]
    );
    await client.end();

    return new Response(
      JSON.stringify({ message: "Status berhasil diperbarui" }),
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return new Response("Terjadi kesalahan di server", { status: 500 });
  }
};
