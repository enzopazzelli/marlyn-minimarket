import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // Sin prefijo (a diferencia del `envPrefix` de Vite para el cliente):
    // los tests de RLS necesitan también SUPABASE_SERVICE_ROLE_KEY, que
    // nunca se expone al navegador.
    env: loadEnv("", process.cwd(), ""),
  },
});
