import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Résout les alias "@/..." définis dans tsconfig.json
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
