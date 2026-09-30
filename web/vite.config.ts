import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Em desenvolvimento (npm run dev:web) a tela roda no Vite e pede a API ao
// servidor do agente (npm run dev), na 8123.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    // a tela é servida pelo próprio computador, não pela internet: 700 KB
    // carregam na hora, e dividir em pedaços só complicaria o build
    chunkSizeWarningLimit: 900,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8123",
      "/marca": "http://127.0.0.1:8123",
    },
  },
})
