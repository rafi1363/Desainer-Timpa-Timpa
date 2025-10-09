import type { APIRoute } from "astro";
import { Client } from "pg";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

// Fungsi untuk menambah 'like' (POST)
export const POST: APIRoute = async ({ params, cookies }) => {
  const gallery_id = parseInt(params.id, 10);
  const token = cookies.get("auth_token")?.value;

  if (!token)
    return new Response(
      JSON.stringify({ message: "Akses ditolak. Silakan login." }),
      { status: 401 }
    );

  const client = new Client(clientConfig);
  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
      role: string;
    };
    if (decoded.role !== "member")
      return new Response(
        JSON.stringify({ message: "Hanya member yang bisa memberi like." }),
        { status: 403 }
      );

    await client.connect();
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO likes (member_id, gallery_id) VALUES ($1, $2)",
      [decoded.id, gallery_id]
    );
    const result = await client.query(
      "UPDATE gallery SET likes = likes + 1 WHERE id = $1 RETURNING likes",
      [gallery_id]
    );
    await client.query("COMMIT");

    return new Response(JSON.stringify(result.rows[0]), { status: 200 });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505")
      return new Response(
        JSON.stringify({ message: "Anda sudah menyukai ini." }),
        { status: 409 }
      );
    return new Response(JSON.stringify({ message: "Error di server" }), {
      status: 500,
    });
  } finally {
    await client.end();
  }
};

// Fungsi untuk menghapus 'like' (DELETE)
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const gallery_id = parseInt(params.id, 10);
  const token = cookies.get("auth_token")?.value;

  if (!token)
    return new Response(JSON.stringify({ message: "Akses ditolak." }), {
      status: 401,
    });

  const client = new Client(clientConfig);
  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET) as {
      id: number;
    };

    await client.connect();
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM likes WHERE member_id = $1 AND gallery_id = $2",
      [decoded.id, gallery_id]
    );
    const result = await client.query(
      "UPDATE gallery SET likes = GREATEST(0, likes - 1) WHERE id = $1 RETURNING likes",
      [gallery_id]
    );
    await client.query("COMMIT");

    return new Response(JSON.stringify(result.rows[0]), { status: 200 });
  } catch (error) {
    await client.query("ROLLBACK");
    return new Response(JSON.stringify({ message: "Error di server" }), {
      status: 500,
    });
  } finally {
    await client.end();
  }
};
