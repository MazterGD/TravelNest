import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Files share one database and tests/setup.ts cleans shared fixture users
    // after every test, so files must not run concurrently.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/**/*.d.ts"],
      // Floor just under the current numbers so CI fails on a coverage drop.
      thresholds: {
        statements: 92,
        branches: 78,
        functions: 95,
        lines: 92,
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
