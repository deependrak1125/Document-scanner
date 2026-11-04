import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  noExternal: ["@folio/validation", "@folio/shared-types"],
  clean: true,
});
