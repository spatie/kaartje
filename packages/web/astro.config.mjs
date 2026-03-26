// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "three"],
      exclude: ["expo-gl", "expo-asset", "expo", "react-native"],
    },
    ssr: {
      noExternal: ["@react-three/fiber", "@kaartje/shared"],
    },
    resolve: {
      alias: {
        "react-native": false,
      },
    },
  },
});
