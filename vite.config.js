import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://suvabbaral.github.io/pocono-estimator/
export default defineConfig({
  base: "/pocono-estimator/",
  plugins: [react()],
  server: { port: 5173 },
});
