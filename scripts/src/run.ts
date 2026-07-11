import { glob } from "node:fs/promises";

const files = glob("render-*", { cwd: import.meta.dirname });

for await (const file of files) {
  console.log(`Rendering ${file}...`);
  await import(`./${file}`);
  console.log(`Rendered ${file}`);
}

console.log("All renders completed");
