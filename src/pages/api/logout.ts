import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  // Perintahkan browser untuk menghapus cookie otentikasi
  cookies.delete("auth_token", {
    path: "/",
  });

  // Alihkan pengguna kembali ke halaman login
  return redirect("/login");
};
