import { quantize, QuantizationMethod } from './quantizer';
import { colorDistance, hexToRgb } from './colorUtils';
import { loadMask, isPixelMasked, getMaskPixelIndex } from './maskManager';
import { CANVAS_SIZES_WITH_MASKS } from './palettes';

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
  detailLevel?: 1 | 2 | 4 | 8 | 16;
  canvasSize?: string; // Canvas size for mask lookup
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
export async function processImage(
  sourceData: ImageData,
  options: ImageProcessOptions
): Promise<ImageData> {
  const detailLevel = options.detailLevel || 1;

  // Resize to target dimensions first
  const resized = resizeImage(
    sourceData,
    options.width,
    options.height,
    options.sourceX,
    options.sourceY,
    options.sourceWidth,
    options.sourceHeight
  );

  // Apply quantization based on palette mode
  let quantized: ImageData;
  if (options.paletteMode === 'colorRange') {
    if (options.maxColors !== null && options.maxColors !== undefined && options.maxColors > 0) {
      const palette = extractDiverseColors(resized, options.maxColors);
      quantized = quantize(resized, palette, options.quantizationMethod);
    } else {
      quantized = resized;
    }
  } else {
    // Default palette mode
    let paletteToUse = options.paletteColors;
    if (options.maxColors !== null && options.maxColors !== undefined && options.maxColors > 0 && options.maxColors < options.paletteColors.length) {
      // Use first N colors from the default palette
      paletteToUse = options.paletteColors.slice(0, options.maxColors);
    }
    quantized = quantize(resized, paletteToUse, options.quantizationMethod);
  }

  // If detail level > 1, downsample using most common color, then upscale
  let result: ImageData;
  if (detailLevel > 1) {
    result = downsampleAndUpscale(quantized, options.width, options.height, detailLevel);
  } else {
    result = quantized;
  }

  // Apply mask if this canvas type needs one
  if (options.canvasSize && CANVAS_SIZES_WITH_MASKS.has(options.canvasSize as any)) {
    const mask = await loadMask(options.canvasSize);
    if (mask) {
      result = applyMask(result, mask);
    }
  }

  return result;
}

// Apply mask to image: set masked-out pixels (black in mask) to fully transparent
function applyMask(imageData: ImageData, maskData: ImageData): ImageData {
  const resultData = new ImageData(imageData.data.slice(), imageData.width, imageData.height);
  const imgData = resultData.data;

  // Ensure mask is same size as image
  if (maskData.width !== imageData.width || maskData.height !== imageData.height) {
    console.warn('Mask size does not match image size, skipping mask application');
    return resultData;
  }

  // Iterate through each pixel
  for (let i = 0; i < imgData.length; i += 4) {
    const pixelIndex = i;

    // Check if this pixel should be masked (white in mask = show, black = hide)
    if (!isPixelMasked(maskData, pixelIndex)) {
      // Black in mask = make pixel transparent
      imgData[pixelIndex + 3] = 0; // Set alpha to 0
    }
  }

  return resultData;
}

// Downsample by finding most common color in each block, then upscale
function downsampleAndUpscale(
  imageData: ImageData,
  targetWidth: number,
  targetHeight: number,
  scale: number
): ImageData {
  // Calculate downsampled dimensions
  const downsampledWidth = Math.ceil(targetWidth / scale);
  const downsampledHeight = Math.ceil(targetHeight / scale);

  // Create downsampled image using most common color in each block
  const canvas = document.createElement('canvas');
  canvas.width = downsampledWidth;
  canvas.height = downsampledHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const downsampled = ctx.createImageData(downsampledWidth, downsampledHeight);
  const srcData = imageData.data;
  const dstData = downsampled.data;

  for (let blockY = 0; blockY < downsampledHeight; blockY++) {
    for (let blockX = 0; blockX < downsampledWidth; blockX++) {
      // Find most common color in this block
      const colorCount = new Map<string, { r: number; g: number; b: number; a: number; count: number }>();

      const startX = blockX * scale;
      const startY = blockY * scale;
      const endX = Math.min(startX + scale, imageData.width);
      const endY = Math.min(startY + scale, imageData.height);

      let mostCommon = { r: 0, g: 0, b: 0, a: 255, count: 0 };

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const srcIndex = (y * imageData.width + x) * 4;
          const r = srcData[srcIndex];
          const g = srcData[srcIndex + 1];
          const b = srcData[srcIndex + 2];
          const a = srcData[srcIndex + 3];
          const colorKey = `${r},${g},${b},${a}`;

          if (!colorCount.has(colorKey)) {
            colorCount.set(colorKey, { r, g, b, a, count: 0 });
          }
          const color = colorCount.get(colorKey)!;
          color.count++;

          if (color.count > mostCommon.count) {
            mostCommon = color;
          }
        }
      }

      // Write most common color to downsampled image
      const dstIndex = (blockY * downsampledWidth + blockX) * 4;
      dstData[dstIndex] = mostCommon.r;
      dstData[dstIndex + 1] = mostCommon.g;
      dstData[dstIndex + 2] = mostCommon.b;
      dstData[dstIndex + 3] = mostCommon.a;
    }
  }

  // Now upsample back to target size by repeating pixels
  const upscaled = ctx.createImageData(targetWidth, targetHeight);
  const upData = upscaled.data;

  for (let y = 0; y < downsampledHeight; y++) {
    for (let x = 0; x < downsampledWidth; x++) {
      const srcIndex = (y * downsampledWidth + x) * 4;
      const r = dstData[srcIndex];
      const g = dstData[srcIndex + 1];
      const b = dstData[srcIndex + 2];
      const a = dstData[srcIndex + 3];

      // Fill the scale x scale block in the upscaled image
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const upY = Math.min(y * scale + dy, targetHeight - 1);
          const upX = Math.min(x * scale + dx, targetWidth - 1);
          const upIndex = (upY * targetWidth + upX) * 4;
          upData[upIndex] = r;
          upData[upIndex + 1] = g;
          upData[upIndex + 2] = b;
          upData[upIndex + 3] = a;
        }
      }
    }
  }

  return upscaled;
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
