import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vite"

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/admin/static/" : "/",
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "../static/admin",
    emptyOutDir: true,
  },
}))
