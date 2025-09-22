import type { APIRoute } from "astro";
import jwt from "jsonwebtoken";

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get("auth_token")?.value;

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET);
    // Kirim kembali data pengguna dari token
    return new Response(JSON.stringify(decoded), { status: 200 });
  } catch (error) {
    return new Response("Invalid token", { status: 401 });
  }
};
