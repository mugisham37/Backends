import { dirname, extname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { readFile, readdir, stat, writeFile } from "fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");

async function checkPath(basePath, importPath) {
  try {
    const fullPath = resolve(basePath, importPath);
    const jsPath = `${fullPath}.js`;
    const indexPath = join(fullPath, "index.js");

    // Check if .js file exists
    try {
      await stat(jsPath);
      return ".js";
    } catch {}

    // Check if directory with index.js exists
    try {
      await stat(indexPath);
      return "/index.js";
    } catch {}

    return ".js"; // Default fallback
  } catch {
    return ".js"; // Default fallback
  }
}

async function fixImports(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await fixImports(fullPath);
    } else if (entry.isFile() && extname(entry.name) === ".js") {
      const content = await readFile(fullPath, "utf-8");
      let fixedContent = content;

      // Fix relative imports that don't have file extensions or have .ts extensions
      const fromMatches = content.matchAll(
        /from\s+['"](\.\.[^'"]*|\.\/[^'"]*)['"]/g
      );
      for (const match of fromMatches) {
        const [fullMatch, path] = match;
        if (path.endsWith(".ts")) {
          // Convert .ts to .js
          fixedContent = fixedContent.replace(
            fullMatch,
            fullMatch.replace(path, path.replace(/\.ts$/, ".js"))
          );
        } else if (!path.endsWith(".js") && !path.endsWith(".json")) {
          const extension = await checkPath(dirname(fullPath), path);
          fixedContent = fixedContent.replace(
            fullMatch,
            fullMatch.replace(path, path + extension)
          );
        }
      }

      const importMatches = content.matchAll(
        /import\s*\(\s*['"](\.\.[^'"]*|\.\/[^'"]*)['"]\s*\)/g
      );
      for (const match of importMatches) {
        const [fullMatch, path] = match;
        if (path.endsWith(".ts")) {
          // Convert .ts to .js
          fixedContent = fixedContent.replace(
            fullMatch,
            fullMatch.replace(path, path.replace(/\.ts$/, ".js"))
          );
        } else if (!path.endsWith(".js") && !path.endsWith(".json")) {
          const extension = await checkPath(dirname(fullPath), path);
          fixedContent = fixedContent.replace(
            fullMatch,
            fullMatch.replace(path, path + extension)
          );
        }
      }

      if (fixedContent !== content) {
        await writeFile(fullPath, fixedContent, "utf-8");
        console.log(`Fixed imports in: ${fullPath}`);
      }
    }
  }
}

try {
  await fixImports(distDir);
  console.log("Import fixing completed!");
} catch (error) {
  console.error("Error fixing imports:", error);
  process.exit(1);
}
