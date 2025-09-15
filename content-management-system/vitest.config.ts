import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["src/tests/setup.ts"],
    include: ["src/**/*.{test,spec}.{js,ts}"],
    exclude: ["node_modules", "dist", "coverage"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "coverage/",
        "**/*.d.ts",
        "**/*.config.{js,ts}",
        "**/types/",
        "**/*.test.{js,ts}",
        "**/*.spec.{js,ts}",
      ],
      thresholds: {
        global: {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
      },
    },
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    isolate: true,
    watch: false,
    reporter: ["verbose"],
    outputFile: {
      json: "./coverage/test-results.json",
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
