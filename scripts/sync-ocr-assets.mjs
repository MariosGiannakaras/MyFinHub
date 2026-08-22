import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ocr');
const coreOut = join(out, 'core');
const langOut = join(out, 'lang');

const fromNodeModules = (...parts) => join(root, 'node_modules', ...parts);

await rm(out, { recursive: true, force: true });
await mkdir(coreOut, { recursive: true });
await mkdir(langOut, { recursive: true });

await copyFile(
  fromNodeModules('tesseract.js', 'dist', 'worker.min.js'),
  join(out, 'worker.min.js'),
);

const coreDir = fromNodeModules('tesseract.js-core');
const coreFiles = (await readdir(coreDir)).filter((name) =>
  name.startsWith('tesseract-core') && (name.endsWith('.wasm') || name.endsWith('.wasm.js')),
);
if (!coreFiles.length) throw new Error('No Tesseract.js core WebAssembly assets were found.');
for (const name of coreFiles) await copyFile(join(coreDir, name), join(coreOut, name));

const languageAssets = [
  ['@tesseract.js-data', 'ell', '4.0.0_best_int', 'ell.traineddata.gz'],
  ['@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'],
];
for (const parts of languageAssets) {
  const name = parts.at(-1);
  if (!name) throw new Error('Invalid OCR language asset path.');
  await copyFile(fromNodeModules(...parts), join(langOut, name));
}

await writeFile(join(out, 'asset-manifest.json'), `${JSON.stringify({
  tesseractJs: '7.0.0',
  languages: ['ell', 'eng'],
  dataTier: '4.0.0_best_int',
  runtime: 'self-hosted',
  receiptContentNetworkUse: false,
  coreFiles,
}, null, 2)}\n`);

console.log(`Local OCR assets synchronized to ${out}`);
