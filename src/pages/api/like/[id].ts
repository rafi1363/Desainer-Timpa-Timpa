import type { APIRoute } from "astro";
import { Client } from "pg";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

// POST: Menambah jumlah 'likes' (saat user me-like)
export const POST: APIRoute = async ({ params }) => {
  const { id } = params;
  const client = new Client(clientConfig);
  try {
    await client.connect();
    const query =
      "UPDATE gallery SET likes = likes + 1 WHERE id = $1 RETURNING likes";
    const result = await client.query(query, [id]);
    if (result.rowCount === 0) {
      return new Response("Gambar tidak ditemukan", { status: 404 });
    }
    return new Response(JSON.stringify(result.rows[0]), { status: 200 });
  } catch (error) {
    return new Response("Error di server", { status: 500 });
  } finally {
    await client.end();
  }
};

// DELETE: Mengurangi jumlah 'likes' (saat user meng-unlike)
export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params;
  const client = new Client(clientConfig);
  try {
    await client.connect();
    // Pastikan likes tidak menjadi negatif
    const query =
      "UPDATE gallery SET likes = GREATEST(0, likes - 1) WHERE id = $1 RETURNING likes";
    const result = await client.query(query, [id]);
    if (result.rowCount === 0) {
      return new Response("Gambar tidak ditemukan", { status: 404 });
    }
    return new Response(JSON.stringify(result.rows[0]), { status: 200 });
  } catch (error) {
    return new Response("Error di server", { status: 500 });
  } finally {
    await client.end();
  }
};
