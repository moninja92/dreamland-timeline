import { defineConfig } from "vite";
import { resolve } from "node:path";

// Relative base so the build works at https://<user>.github.io/<repo>/ without extra config.
// Two pages: the timeline (index.html) and the character creator (character.html).
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        character: resolve(import.meta.dirname, "character.html"),
      },
    },
  },
});
