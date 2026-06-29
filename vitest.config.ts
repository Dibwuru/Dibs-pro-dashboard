import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    // Regression suite is pure math + import-time constants; no browser shim.
    globals: false,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      // Must mirror tsconfig.json paths: { "@/*": ["./src/*"] }
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
