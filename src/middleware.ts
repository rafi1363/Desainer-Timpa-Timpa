import { defineMiddleware } from "astro:middleware";
import jwt from "jsonwebtoken";

export const onRequest = defineMiddleware(
  async ({ cookies, url, redirect }, next) => {
    // 1. Satpam hanya berjaga di gerbang '/admin'
    if (url.pathname.startsWith("/admin")) {
      // 2. Periksa apakah pengunjung punya 'tiket masuk' (cookie)
      const token = cookies.get("auth_token")?.value;

      // 3. Jika tidak punya tiket, usir ke halaman login
      if (!token) {
        return redirect("/login", 307);
      }

      try {
        // 4. Jika punya tiket, periksa apakah tiketnya asli dan tidak kedaluwarsa
        jwt.verify(token, import.meta.env.JWT_SECRET);
      } catch (error) {
        // Jika tiket palsu/kedaluwarsa, hapus tiketnya dan usir ke halaman login
        cookies.delete("auth_token", { path: "/" });
        return redirect("/login", 307);
      }
    }

    // 5. Jika semua aman, izinkan pengunjung masuk
    return next();
  }
);
