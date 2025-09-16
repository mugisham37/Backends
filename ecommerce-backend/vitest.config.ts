import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/shared/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "coverage/",
        "**/*.d.ts",
        "**/*.config.ts",
        "**/*.config.js",
        "**/migrations/**",
        "scripts/",
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@/core": resolve(__dirname, "./src/core"),
      "@/api": resolve(__dirname, "./src/api"),
      "@/modules": resolve(__dirname, "./src/modules"),
      "@/shared": resolve(__dirname, "./src/shared"),
    },
  },
});
