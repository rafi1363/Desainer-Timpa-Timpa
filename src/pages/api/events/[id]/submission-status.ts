// src/pages/api/events/[id]/submission-status.ts

import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const GET: APIRoute = async ({ params, request }) => {
  const eventId = parseInt(params.id, 10);
  const client = new Client(clientConfig);

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ message: "Akses ditolak" }), {
        status: 401,
        headers: CORS_HEADERS,
      });

    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
    };
    const memberId = decodedToken.id;

    await client.connect();
    const query =
      "SELECT EXISTS (SELECT 1 FROM event_submissions WHERE event_id = $1 AND member_id = $2)";
    const result = await client.query(query, [eventId, memberId]);

    return new Response(
      JSON.stringify({ hasSubmitted: result.rows[0].exists }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("Submission Status API Error:", error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server" }),
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await client.end();
  }
};
