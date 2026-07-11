import { defineConfig } from "oxfmt";

export default defineConfig({
  useTabs: false,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 120,
  sortTailwindcss: true,
  sortImports: true,
  sortPackageJson: true,
  ignorePatterns: ["src/routeTree.gen.ts"],
});
