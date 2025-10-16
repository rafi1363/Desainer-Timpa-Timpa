import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get("auth_token")?.value;
  if (!token) return new Response("Unauthorized.", { status: 401 });

  const client = new Client(clientConfig);
  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
    };

    await client.connect();
    const query = `
            SELECT n.id, n.type, n.created_at, n.is_read, m.username AS "senderUsername"
            FROM notifications n
            JOIN members m ON n.sender_id = m.id
            WHERE n.recipient_id = $1
            ORDER BY n.created_at DESC
            LIMIT 50
        `;
    const result = await client.query(query, [decoded.id]);
    return new Response(JSON.stringify(result.rows), { status: 200 });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return new Response("Server error.", { status: 500 });
  } finally {
    await client.end();
  }
};
