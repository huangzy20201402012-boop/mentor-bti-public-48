import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@mentor-bti/bti-core": resolve(import.meta.dirname, "packages/bti-core/src/index.ts"),
      "@mentor-bti/bti-content": resolve(import.meta.dirname, "packages/bti-content/src/index.ts"),
      "@mentor-bti/bti-scoring": resolve(import.meta.dirname, "packages/bti-scoring/src/index.ts"),
      "@mentor-bti/ui-tokens": resolve(import.meta.dirname, "packages/ui-tokens/src/index.ts")
    }
  },
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});

