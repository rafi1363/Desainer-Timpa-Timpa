import { defineMiddleware } from "astro:middleware";
import jwt from "jsonwebtoken";

export const onRequest = defineMiddleware(
  async ({ cookies, url, redirect }, next) => {
    // Hanya jalankan satpam untuk halaman di bawah /admin
    if (url.pathname.startsWith("/admin")) {
      const token = cookies.get("auth_token")?.value;

      if (!token) {
        return redirect("/login"); // Alihkan ke halaman login jika tidak ada tiket
      }

      try {
        // Periksa apakah tiketnya valid
        jwt.verify(token, import.meta.env.JWT_SECRET);
      } catch (error) {
        return redirect("/login"); // Alihkan jika tiket tidak valid
      }
    }

    // Jika semua aman, izinkan masuk
    return next();
  }
);
