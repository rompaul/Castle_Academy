import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
const failures = [];
const files = [];
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {})
]);

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) files.push(full);
  }
}

walk(root);
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const importPattern = /(?:from\s*|import\s*(?:\(\s*)?)(['"])([^'"]+)\1/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[2];
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const base = path.resolve(path.dirname(file), specifier);
      const candidates = [base, ...sourceExtensions.map((extension) => base + extension), ...sourceExtensions.map((extension) => path.join(base, 'index' + extension))];
      if (!candidates.some((candidate) => fs.existsSync(candidate))) {
        failures.push(`${path.relative(root, file)}: unresolved relative import ${specifier}`);
      }
      continue;
    }
    if (specifier.startsWith('node:') || specifier.startsWith('#')) continue;
    const segments = specifier.split('/');
    const packageName = specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
    if (!declared.has(packageName)) {
      failures.push(`${path.relative(root, file)}: external import is not declared in package.json: ${specifier}`);
    }
  }
}

for (const name of ['react', 'react-dom', 'three', 'vite', 'typescript', 'vitest', '@playwright/test', '@types/node']) {
  if (!declared.has(name)) failures.push(`package.json: required package not declared: ${name}`);
}
for (const script of ['dev', 'build', 'typecheck', 'test', 'test:e2e', 'verify:source']) {
  if (!pkg.scripts?.[script]) failures.push(`package.json: missing script ${script}`);
}

if (failures.length) {
  console.error(`Source verification failed (${failures.length} issue(s)):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Source verification passed: ${files.length} source/config files scanned; relative imports, external package declarations, and required scripts resolved.`);
}
