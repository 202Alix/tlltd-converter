import { quantize, QuantizationMethod } from './quantizer';
import { colorDistance, hexToRgb } from './colorUtils';

export interface ImageProcessOptions {
  width: number;
  height: number;
  paletteColors: string[];
  quantizationMethod: QuantizationMethod;
  paletteMode: 'default' | 'colorRange';
  maxColors?: number | null;
  sourceX?: number;
  sourceY?: number;
  sourceWidth?: number;
  sourceHeight?: number;
}

// Load an image file and return as ImageData
export async function loadImage(file: File): Promise<{ imageData: ImageData; originalSize: { width: number; height: number } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        resolve({
          imageData,
          originalSize: { width: img.width, height: img.height },
        });
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// Resize image data to target dimensions
export function resizeImage(
  sourceData: ImageData,
  targetWidth: number,
  targetHeight: number,
  sourceX: number = 0,
  sourceY: number = 0,
  sourceWidth?: number,
  sourceHeight?: number
): ImageData {
  const canvas = document.createElement('canvas');
  const tempCanvas = document.createElement('canvas');

  // First, crop the source image if needed
  let croppedData: ImageData;
  if (sourceX !== 0 || sourceY !== 0 || sourceWidth !== undefined || sourceHeight !== undefined) {
    sourceWidth = sourceWidth || sourceData.width;
    sourceHeight = sourceHeight || sourceData.height;

    tempCanvas.width = sourceWidth;
    tempCanvas.height = sourceHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) throw new Error('Could not get canvas context');

    // Put the cropped portion
    tempCtx.putImageData(sourceData, -sourceX, -sourceY);
    croppedData = tempCtx.getImageData(0, 0, sourceWidth, sourceHeight);
  } else {
    croppedData = sourceData;
  }

  // Now resize to target dimensions
  tempCanvas.width = croppedData.width;
  tempCanvas.height = croppedData.height;
  let tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) throw new Error('Could not get canvas context');
  tempCtx.putImageData(croppedData, 0, 0);

  // Draw onto the final canvas with resizing
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.imageSmoothingEnabled = false; // Pixelated look
  ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

  return ctx.getImageData(0, 0, targetWidth, targetHeight);
}

// Extract the most representative AND diverse colors from image data
// Prioritizes frequent colors while ensuring visual diversity
function extractDiverseColors(imageData: ImageData, maxColors: number): string[] {
  const colorFreq = new Map<string, number>();
  const data = imageData.data;

  // Count frequency of each color
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    colorFreq.set(hex, (colorFreq.get(hex) || 0) + 1);
  }

  // Sort by frequency (most common first)
  const sorted = Array.from(colorFreq.entries())
    .sort((a, b) => b[1] - a[1]);

  // Greedily select diverse colors
  const selected: string[] = [];
  const minColorDistance = 40; // minimum RGB distance for diversity

  for (const [hexColor, freq] of sorted) {
    if (selected.length >= maxColors) break;

    // Always take the top 20% most frequent colors to ensure common colors are included
    if (selected.length < Math.ceil(maxColors * 0.2)) {
      selected.push(hexColor);
      continue;
    }

    // For the rest, check if this color is visually different enough from already selected colors
    let isDifferent = true;
    const rgb = hexToRgb(hexColor);

    for (const selectedHex of selected) {
      const selectedRgb = hexToRgb(selectedHex);
      if (colorDistance(rgb, selectedRgb) < minColorDistance) {
        isDifferent = false;
        break;
      }
    }

    if (isDifferent) {
      selected.push(hexColor);
    }
  }

  // If we don't have enough diverse colors, add the next most frequent ones
  if (selected.length < maxColors) {
    for (const [hexColor] of sorted) {
      if (!selected.includes(hexColor) && selected.length < maxColors) {
        selected.push(hexColor);
      }
    }
  }

  return selected;
}

// Process image: resize and optionally quantize based on palette mode
export function processImage(
  sourceData: ImageData,
  options: ImageProcessOptions
): ImageData {
  const resized = resizeImage(
    sourceData,
    options.width,
    options.height,
    options.sourceX,
    options.sourceY,
    options.sourceWidth,
    options.sourceHeight
  );

  // In color range mode
  if (options.paletteMode === 'colorRange') {
    // If maxColors is explicitly set, limit the colors
    if (options.maxColors !== null && options.maxColors !== undefined && options.maxColors > 0) {
      const palette = extractDiverseColors(resized, options.maxColors);
      const quantized = quantize(resized, palette, options.quantizationMethod);
      return quantized;
    }
    // If no maxColors limit, return original colors
    return resized;
  }

  // In default mode, apply quantization to the palette
  const quantized = quantize(resized, options.paletteColors, options.quantizationMethod);
  return quantized;
}

// Convert ImageData to canvas and download as PNG
export function downloadImage(imageData: ImageData, filename: string = 'converted.png'): void {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.putImageData(imageData, 0, 0);
  canvas.toBlob((blob) => {
    if (!blob) throw new Error('Could not create blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}
