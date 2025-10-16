import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get("auth_token")?.value;
  if (!token) return new Response("Unauthorized.", { status: 401 });

  const client = new Client(clientConfig);
  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
    };
    await client.connect();
    const query =
      "UPDATE notifications SET is_read = true WHERE recipient_id = $1";
    await client.query(query, [decoded.id]);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to mark notifications as read:", error);
    return new Response("Server error.", { status: 500 });
  } finally {
    await client.end();
  }
};
