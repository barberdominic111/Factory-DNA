import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  test: { include: ["tests/**/*.test.{js,jsx}"], environment: "node" },
  plugins: [react(), VitePWA({ registerType: "autoUpdate", includeAssets: ["icon-192.png", "icon-512.png"],
    manifest: { name: "Factory DNA", short_name: "FactoryDNA", description: "A cozy factory management game", theme_color: "#fb923c", background_color: "#fffbeb", display: "standalone",
      icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }, { src: "icon-512.png", sizes: "512x512", type: "image/png" }] } })],
});
