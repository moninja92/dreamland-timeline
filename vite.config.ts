import { defineConfig } from "vite";
import { resolve } from "node:path";

// Relative base so the build works at https://<user>.github.io/<repo>/ without extra config.
// Two pages: the timeline (index.html) and the character creator (character.html).
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        character: resolve(__dirname, "character.html"),
      },
    },
  },
});
