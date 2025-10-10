import { ui, defaultLang } from "./ui";
import type { AstroGlobal } from "astro";

export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split("/");
  if (lang in ui) return lang as keyof typeof ui;
  return defaultLang;
}

export function useTranslations(astro: AstroGlobal) {
  const lang = getLangFromUrl(astro.url);
  return function t(key: keyof (typeof ui)[typeof defaultLang]) {
    // Pastikan tidak error jika key tidak ditemukan
    return ui[lang]?.[key] || ui[defaultLang][key];
  };
}
