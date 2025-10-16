import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

// DELETE a post
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const post_id = parseInt(params.id, 10);
  const token = cookies.get("auth_token")?.value;
  if (!token) return new Response("Unauthorized.", { status: 401 });
  if (isNaN(post_id)) return new Response("Invalid Post ID.", { status: 400 });

  const client = new Client(clientConfig);
  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
    };

    await client.connect();
    // Verify ownership before deleting
    const deleteQuery = "DELETE FROM posts WHERE id = $1 AND member_id = $2";
    const result = await client.query(deleteQuery, [post_id, decoded.id]);

    if (result.rowCount === 0) {
      return new Response(
        "Post not found or you don't have permission to delete it.",
        { status: 404 }
      );
    }
    return new Response(null, { status: 204 }); // Success, no content
  } catch (error) {
    console.error("Failed to delete post:", error);
    return new Response("Server error.", { status: 500 });
  } finally {
    await client.end();
  }
};
