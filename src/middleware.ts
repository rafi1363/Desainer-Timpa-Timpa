import { defineMiddleware } from "astro:middleware";
import jwt from "jsonwebtoken";
import { languages, defaultLang } from "./i18n/ui";

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect, request } = context;

  const isAdminRoute = url.pathname.startsWith("/admin");
  const isMemberRoute = url.pathname.startsWith("/member");
  const isSubmitRoute = url.pathname.startsWith("/gallery/submit");

  // --- Logika Deteksi Bahasa untuk Pengunjung Baru ---
  const langCookie = cookies.get("language")?.value;
  if (!langCookie && url.pathname === "/") {
    const acceptLanguage = request.headers.get("accept-language");
    if (acceptLanguage && acceptLanguage.startsWith("en")) {
      // Jika browser pengguna berbahasa Inggris, arahkan ke /en
      cookies.set("language", "en", { path: "/" });
      return redirect("/en");
    }
  }

  if (!isAdminRoute && !isMemberRoute && !isSubmitRoute) {
    return next();
  }

  const token = cookies.get("auth_token")?.value;

  if (!token) {
    console.log("Hasil: Akses ditolak (tidak ada token). Redirect ke /login.");
    return redirect("/login");
  }

  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET);
    context.locals.user = decoded; // Titipkan data user jika berhasil

    // Cek peran (role)
    if (isAdminRoute && decoded.role !== "admin") {
      console.log(
        "Hasil: Akses ditolak (role bukan admin). Redirect ke /login."
      );
      return redirect("/login");
    }
    if ((isMemberRoute || isSubmitRoute) && decoded.role !== "member") {
      console.log(
        "Hasil: Akses ditolak (role bukan member). Redirect ke /login."
      );
      return redirect("/login");
    }
  } catch (err) {
    // [LOG 2] Kita akan cetak error spesifik dari proses verifikasi
    console.error("!!! JWT VERIFICATION ERROR !!!:", err.name, err.message);
    cookies.delete("auth_token", { path: "/" });
    console.log(
      "Hasil: Akses ditolak (token tidak valid). Redirect ke /login."
    );
    return redirect("/login");
  }

  // console.log("Hasil: Akses diizinkan.");
  return next();
});
