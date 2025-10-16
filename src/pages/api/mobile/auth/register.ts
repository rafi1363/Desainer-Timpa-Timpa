import type { APIRoute } from "astro";
import { Client } from "pg";
import bcrypt from "bcrypt";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

export const POST: APIRoute = async ({ request }) => {
  const { username, email, password } = await request.json();
  if (!username || !email || !password || password.length < 6) {
    return new Response("Invalid data provided.", { status: 400 });
  }

  const saltRounds = 10;
  const password_hash = await bcrypt.hash(password, saltRounds);

  const client = new Client(clientConfig);
  try {
    await client.connect();
    const query =
      "INSERT INTO members (username, email, password_hash) VALUES ($1, $2, $3)";
    await client.query(query, [username, email, password_hash]);
    return new Response("Registration successful.", { status: 201 });
  } catch (error) {
    if (error.code === "23505") {
      return new Response("Username or email already exists.", { status: 409 });
    }
    console.error("Mobile registration error:", error);
    return new Response("Server error.", { status: 500 });
  } finally {
    await client.end();
  }
};
