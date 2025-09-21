import { build } from 'esbuild';
import { readdir, stat } from 'fs/promises';
import { join, relative } from 'path';

const sourceDir = 'src';
const outDir = 'dist';

// Function to find all TypeScript files
async function findTsFiles(dir) {
  const files = [];
  
  async function traverse(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  await traverse(dir);
  return files;
}

async function buildProject() {
  try {
    console.log('🔨 Building project with esbuild...');
    
    const tsFiles = await findTsFiles(sourceDir);
    const entryPoints = tsFiles.map(file => relative(process.cwd(), file));
    
    await build({
      entryPoints,
      outdir: outDir,
      outbase: sourceDir,
      platform: 'node',
      format: 'esm',
      target: 'es2022',
      sourcemap: true,
      minify: false,
      keepNames: true,
      tsconfig: './tsconfig.build.json',
      bundle: false,
      allowOverwrite: true,
      logLevel: 'info',
      // Handle .ts extensions in imports
      loader: {
        '.ts': 'ts'
      }
    });
    
    console.log('✅ Build completed successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildProject();