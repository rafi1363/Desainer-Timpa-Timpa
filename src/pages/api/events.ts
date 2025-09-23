import type { APIRoute } from "astro";
import { Client } from "pg";

export const GET: APIRoute = async () => {
  const client = new Client({
    connectionString: import.meta.env.DATABASE_URL,
  });

  try {
    await client.connect();

    // Mengambil semua event, diurutkan berdasarkan tanggal acara terdekat
    const query = `
      SELECT id, title, description, host, event_date, event_type 
      FROM events 
      ORDER BY event_date ASC
    `;

    const result = await client.query(query);

    return new Response(JSON.stringify(result.rows), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ message: "Gagal mengambil data event." }),
      { status: 500 }
    );
  } finally {
    await client.end();
  }
};

export const POST: APIRoute = async ({ request }) => {
  const { title, description, host, event_date, event_type } =
    await request.json();
  const client = new Client({ connectionString: import.meta.env.DATABASE_URL });
  try {
    await client.connect();
    const query = `
      INSERT INTO events (title, description, host, event_date, event_type) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *`;
    const values = [title, description, host, event_date, event_type];
    const result = await client.query(query, values);
    return new Response(JSON.stringify(result.rows[0]), { status: 201 });
  } catch (error) {
    console.error(error);
    return new Response("Error di server", { status: 500 });
  } finally {
    await client.end();
  }
};
