import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
  },
  resolve: {
    alias: {
      // The default (non-react-server) build of `server-only` throws on import.
      // Module code marks itself server-only for the real build; under test it
      // is a harmless no-op.
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
