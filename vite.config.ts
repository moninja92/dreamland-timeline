import { defineConfig } from "vite";

// Relative base so the build works at https://<user>.github.io/<repo>/ without extra config.
export default defineConfig({
  base: "./",
});
