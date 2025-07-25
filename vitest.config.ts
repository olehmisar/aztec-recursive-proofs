import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    hookTimeout: 200000,
    testTimeout: 200000,
  },
});
