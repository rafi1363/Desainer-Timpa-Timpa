import type { APIRoute } from "astro";
import { Client } from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

export const POST: APIRoute = async ({ request, cookies }) => {
  const { username, password } = await request.json();
  if (!username || !password) {
    return new Response("Username and password are required.", { status: 400 });
  }

  const client = new Client(clientConfig);
  try {
    await client.connect();
    const result = await client.query(
      "SELECT * FROM members WHERE username = $1",
      [username]
    );
    if (result.rowCount === 0) {
      return new Response("Invalid credentials.", { status: 401 });
    }

    const member = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, member.password_hash);
    if (!passwordMatch) {
      return new Response("Invalid credentials.", { status: 401 });
    }

    const token = jwt.sign(
      { id: member.id, username: member.username, role: "member" },
      import.meta.env.JWT_SECRET,
      { expiresIn: "30d" } // Longer expiry for mobile apps
    );

    return new Response(
      JSON.stringify({
        token,
        user: { id: member.id, username: member.username },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Mobile login error:", error);
    return new Response("Server error.", { status: 500 });
  } finally {
    await client.end();
  }
};
