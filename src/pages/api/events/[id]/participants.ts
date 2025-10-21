// src/pages/api/events/[id]/participants.ts

import type { APIRoute } from "astro";
import { Client } from "pg";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const GET: APIRoute = async ({ params }) => {
  if (!params.id) {
    return new Response(
      JSON.stringify({ message: "Event ID harus disertakan" }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const eventId = parseInt(params.id, 10);
  const client = new Client(clientConfig);

  try {
    await client.connect();
    const query = `
            SELECT m.id, m.username 
            FROM event_submissions es
            JOIN members m ON es.member_id = m.id
            WHERE es.event_id = $1
            ORDER BY es.submitted_at ASC;
        `;
    const result = await client.query(query, [eventId]);

    return new Response(JSON.stringify(result.rows), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error("Get Participants API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};
