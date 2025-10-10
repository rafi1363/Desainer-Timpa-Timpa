import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  output: "server", // atau 'hybrid'
  adapter: vercel(),

  i18n: {
    // Bahasa default website Anda
    defaultLocale: "id",
    // Bahasa yang didukung
    locales: ["id", "en"],
  },
});
