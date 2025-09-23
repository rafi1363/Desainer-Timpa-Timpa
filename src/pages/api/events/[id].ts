import type { APIRoute } from "astro";
import { Client } from "pg";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

// Fungsi untuk MENGAMBIL satu event berdasarkan ID
export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  const client = new Client(clientConfig);
  try {
    await client.connect();
    const result = await client.query("SELECT * FROM events WHERE id = $1", [
      id,
    ]);
    if (result.rowCount === 0) {
      return new Response(null, { status: 404, statusText: "Not Found" });
    }
    return new Response(JSON.stringify(result.rows[0]), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Error di server", { status: 500 });
  } finally {
    await client.end();
  }
};

// Fungsi untuk MENGUPDATE satu event berdasarkan ID
export const PUT: APIRoute = async ({ params, request }) => {
  const { id } = params;
  const { title, description, host, event_date, event_type } =
    await request.json();
  const client = new Client(clientConfig);
  try {
    await client.connect();
    const query = `
      UPDATE events 
      SET title = $1, description = $2, host = $3, event_date = $4, event_type = $5 
      WHERE id = $6 
      RETURNING *`;
    const values = [title, description, host, event_date, event_type, id];
    const result = await client.query(query, values);
    return new Response(JSON.stringify(result.rows[0]), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Error di server", { status: 500 });
  } finally {
    await client.end();
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params;
  const client = new Client({ connectionString: import.meta.env.DATABASE_URL });

  try {
    await client.connect();

    const query = `DELETE FROM events WHERE id = $1`;
    const values = [id];

    await client.query(query, values);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ message: "Gagal menghapus event." }), {
      status: 500,
    });
  } finally {
    await client.end();
  }
};
