import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "屋企資訊板 Home Dashboard",
        short_name: "Home Board",
        description: "Bilingual Hong Kong home information dashboard",
        theme_color: "#07111f",
        background_color: "#07111f",
        display: "fullscreen",
        orientation: "landscape",
        start_url: "./",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"],
        runtimeCaching: [
          {
            // Weather owns its timeout/retry/IndexedDB fallback in src/api.ts.
            // Intercepting HKO here previously imposed a hidden 5-second cutoff
            // before the application's longer timeout could take effect.
            urlPattern: /^https:\/\/(data\.etabus\.gov\.hk|rt\.data\.gov\.hk)\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "dashboard-transit-api-v2",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 80, maxAgeSeconds: 86400 }
            }
          },
          {
            urlPattern: /^https:\/\/www\.hko\.gov\.hk\/wxinfo\/radars\/rad_128_png\/.*\.jpg$/,
            handler: "CacheFirst",
            options: {
              cacheName: "hko-radar-v1",
              expiration: { maxEntries: 30, maxAgeSeconds: 86400 }
            }
          }
        ]
      }
    })
  ],
  build: { target: "safari15", sourcemap: true }
});
