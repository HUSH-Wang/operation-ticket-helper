import { access, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const packageJsonPath = path.join(projectRoot, 'package.json');
const distDir = path.join(projectRoot, 'dist');
const sourcePath = path.join(distDir, 'index.html');

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const appTitle = process.env.VITE_APP_TITLE || '操作票助手';
const version = String(packageJson.version || '').trim();

const sanitizeFileName = (value) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').trim();
const fileName = `${sanitizeFileName(appTitle)}v${version}.html`;
const targetPath = path.join(distDir, fileName);

await access(sourcePath);

try {
  await unlink(targetPath);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

await rename(sourcePath, targetPath);
console.log(`singlefile output renamed to dist/${fileName}`);
