import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize } from 'image-size';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const palettesPath = path.join(projectRoot, 'src/lib/palettes.ts');
const masksDir = path.join(projectRoot, 'public/masks');

const source = fs.readFileSync(palettesPath, 'utf8');

const sizeByName = new Map();
const sizeRegex = /'([^']+)'\s*:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/g;
for (const match of source.matchAll(sizeRegex)) {
  const name = match[1];
  const width = Number.parseInt(match[2], 10);
  const height = Number.parseInt(match[3], 10);
  sizeByName.set(name, { width, height });
}

const maskSetMatch = source.match(/export const CANVAS_SIZES_WITH_MASKS[\s\S]*?\[([\s\S]*?)\]\);/);
if (!maskSetMatch) {
  console.error('Could not parse CANVAS_SIZES_WITH_MASKS from src/lib/palettes.ts');
  process.exit(1);
}

const maskedNames = [];
const maskSetBodyWithoutComments = maskSetMatch[1].replace(/^\s*\/\/.*$/gm, '');
const nameRegex = /'([^']+)'/g;
for (const match of maskSetBodyWithoutComments.matchAll(nameRegex)) {
  maskedNames.push(match[1]);
}

const errors = [];
const warnings = [];

for (const name of maskedNames) {
  const expected = sizeByName.get(name);
  if (!expected) {
    errors.push(`Missing CANVAS_SIZES entry for masked canvas \"${name}\".`);
    continue;
  }

  const maskFile = path.join(masksDir, `${name}.jpg`);
  if (!fs.existsSync(maskFile)) {
    errors.push(`Missing mask file: public/masks/${name}.jpg`);
    continue;
  }

  try {
    const fileBuffer = fs.readFileSync(maskFile);
    const { width, height } = imageSize(fileBuffer);
    if (!width || !height) {
      warnings.push(`Could not determine dimensions for public/masks/${name}.jpg`);
      continue;
    }

    if (width !== expected.width || height !== expected.height) {
      warnings.push(
        `Dimension mismatch for public/masks/${name}.jpg: found ${width}x${height}, expected ${expected.width}x${expected.height}`
      );
    }
  } catch (error) {
    errors.push(`Failed reading public/masks/${name}.jpg: ${String(error)}`);
  }
}

const knownMasks = new Set(maskedNames);
if (fs.existsSync(masksDir)) {
  for (const fileName of fs.readdirSync(masksDir)) {
    if (!fileName.toLowerCase().endsWith('.jpg')) continue;
    const base = fileName.replace(/\.jpg$/i, '');
    if (!knownMasks.has(base)) {
      warnings.push(`Extra mask file not referenced by CANVAS_SIZES_WITH_MASKS: public/masks/${fileName}`);
    }
  }
}

if (errors.length > 0) {
  console.error('Mask validation failed with errors:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
}

if (warnings.length > 0) {
  console.warn('Mask validation warnings:');
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

if (errors.length === 0 && warnings.length === 0) {
  console.log(`Mask validation passed. Checked ${maskedNames.length} masked canvas types.`);
  process.exit(0);
}

if (errors.length === 0) {
  console.log(`Mask validation completed with ${warnings.length} warning(s) and no errors.`);
  process.exit(0);
}

process.exit(1);
