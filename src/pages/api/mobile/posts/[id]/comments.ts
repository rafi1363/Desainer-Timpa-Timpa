import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

// GET all comments for a post
export const GET: APIRoute = async ({ params }) => {
  const post_id = parseInt(params.id, 10);
  if (isNaN(post_id)) return new Response("Invalid Post ID.", { status: 400 });

  const client = new Client(clientConfig);
  try {
    await client.connect();
    const query = `
            SELECT c.id, c.comment_text, c.created_at, m.username
            FROM post_comments c
            JOIN members m ON c.member_id = m.id
            WHERE c.post_id = $1
            ORDER BY c.created_at ASC
        `;
    const result = await client.query(query, [post_id]);
    return new Response(JSON.stringify(result.rows), { status: 200 });
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    return new Response("Server error.", { status: 500 });
  } finally {
    await client.end();
  }
};

// POST a new comment
export const POST: APIRoute = async ({ params, request, cookies }) => {
  const post_id = parseInt(params.id, 10);
  const token = cookies.get("auth_token")?.value;
  if (!token) return new Response("Unauthorized.", { status: 401 });
  if (isNaN(post_id)) return new Response("Invalid Post ID.", { status: 400 });

  const { comment_text } = await request.json();
  if (!comment_text)
    return new Response("Comment text cannot be empty.", { status: 400 });

  const client = new Client(clientConfig);
  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
      role: string;
    };
    if (decoded.role !== "member")
      return new Response("Only members can comment.", { status: 403 });

    await client.connect();
    // ... (Add notification logic here later) ...
    const query =
      "INSERT INTO post_comments (post_id, member_id, comment_text) VALUES ($1, $2, $3) RETURNING *";
    const result = await client.query(query, [
      post_id,
      decoded.id,
      comment_text,
    ]);
    return new Response(JSON.stringify(result.rows[0]), { status: 201 });
  } catch (error) {
    console.error("Failed to post comment:", error);
    return new Response("Server error.", { status: 500 });
  } finally {
    await client.end();
  }
};
