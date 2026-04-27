import { hexToRgb, rgbToHex, colorDistance } from './colorUtils';

export type QuantizationMethod = 'nearest-color' | 'dithering' | 'posterize';

// Nearest color quantization - simple and fast
export function quantizeNearest(
  imageData: ImageData,
  paletteHexColors: string[]
): ImageData {
  const data = imageData.data;
  const paletteRgbs = paletteHexColors.map(hexToRgb);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Find closest palette color
    let minDistance = Infinity;
    let closestRgb = paletteRgbs[0];

    for (const paletteRgb of paletteRgbs) {
      const distance = colorDistance([r, g, b], paletteRgb);
      if (distance < minDistance) {
        minDistance = distance;
        closestRgb = paletteRgb;
      }
    }

    data[i] = closestRgb[0];
    data[i + 1] = closestRgb[1];
    data[i + 2] = closestRgb[2];
    // data[i + 3] is alpha, leave it unchanged
  }

  return imageData;
}

// Floyd-Steinberg dithering - better quality color gradients
export function quantizeDithering(
  imageData: ImageData,
  paletteHexColors: string[]
): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8ClampedArray(imageData.data);
  const paletteRgbs = paletteHexColors.map(hexToRgb);

  // Create error buffers for each color channel
  const errorR = Array(width * height).fill(0);
  const errorG = Array(width * height).fill(0);
  const errorB = Array(width * height).fill(0);

  // Process each pixel left to right, top to bottom
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const errIdx = y * width + x;

      // Get pixel value with accumulated error
      let r = Math.max(0, Math.min(255, data[idx] + errorR[errIdx]));
      let g = Math.max(0, Math.min(255, data[idx + 1] + errorG[errIdx]));
      let b = Math.max(0, Math.min(255, data[idx + 2] + errorB[errIdx]));

      // Find closest palette color
      let minDistance = Infinity;
      let closestRgb = paletteRgbs[0];

      for (const paletteRgb of paletteRgbs) {
        const distance = colorDistance([r, g, b], paletteRgb);
        if (distance < minDistance) {
          minDistance = distance;
          closestRgb = paletteRgb;
        }
      }

      // Calculate error
      const errR = r - closestRgb[0];
      const errG = g - closestRgb[1];
      const errB = b - closestRgb[2];

      // Set the quantized color
      data[idx] = closestRgb[0];
      data[idx + 1] = closestRgb[1];
      data[idx + 2] = closestRgb[2];

      // Distribute error to neighboring pixels (Floyd-Steinberg)
      // Right: 7/16
      if (x + 1 < width) {
        const rightIdx = errIdx + 1;
        errorR[rightIdx] += errR * 7 / 16;
        errorG[rightIdx] += errG * 7 / 16;
        errorB[rightIdx] += errB * 7 / 16;
      }

      // Below-left: 3/16
      if (y + 1 < height && x - 1 >= 0) {
        const blIdx = errIdx + width - 1;
        errorR[blIdx] += errR * 3 / 16;
        errorG[blIdx] += errG * 3 / 16;
        errorB[blIdx] += errB * 3 / 16;
      }

      // Below: 5/16
      if (y + 1 < height) {
        const bIdx = errIdx + width;
        errorR[bIdx] += errR * 5 / 16;
        errorG[bIdx] += errG * 5 / 16;
        errorB[bIdx] += errB * 5 / 16;
      }

      // Below-right: 1/16
      if (y + 1 < height && x + 1 < width) {
        const brIdx = errIdx + width + 1;
        errorR[brIdx] += errR * 1 / 16;
        errorG[brIdx] += errG * 1 / 16;
        errorB[brIdx] += errB * 1 / 16;
      }
    }
  }

  return new ImageData(data, width, height);
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function posterizeChannel(value: number, levels: number): number {
  if (levels <= 1) return value;
  const scaled = value / 255;
  const step = levels - 1;
  return Math.round(scaled * step) * (255 / step);
}

function posterizePreprocess(
  imageData: ImageData,
  options?: {
    levels?: number;
    smoothColorThreshold?: number;
    edgeThreshold?: number;
    contrastBoost?: number;
  }
): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);

  const levels = options?.levels ?? 6;
  const smoothColorThreshold = options?.smoothColorThreshold ?? 38;
  const edgeThreshold = options?.edgeThreshold ?? 95;
  const contrastBoost = options?.contrastBoost ?? 1.12;

  const luma = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      luma[y * width + x] = src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114;
    }
  }

  const edgeMask = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p00 = luma[(y - 1) * width + (x - 1)];
      const p01 = luma[(y - 1) * width + x];
      const p02 = luma[(y - 1) * width + (x + 1)];
      const p10 = luma[y * width + (x - 1)];
      const p12 = luma[y * width + (x + 1)];
      const p20 = luma[(y + 1) * width + (x - 1)];
      const p21 = luma[(y + 1) * width + x];
      const p22 = luma[(y + 1) * width + (x + 1)];

      const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
      const gy = p00 + 2 * p01 + p02 - p20 - 2 * p21 - p22;
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      if (magnitude >= edgeThreshold) edgeMask[y * width + x] = 1;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const centerR = src[idx];
      const centerG = src[idx + 1];
      const centerB = src[idx + 2];

      let r = centerR;
      let g = centerG;
      let b = centerB;

      if (!edgeMask[y * width + x]) {
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;

        for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
          for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
            const nIdx = (ny * width + nx) * 4;
            const nr = src[nIdx];
            const ng = src[nIdx + 1];
            const nb = src[nIdx + 2];
            const d = colorDistance([centerR, centerG, centerB], [nr, ng, nb]);
            if (d <= smoothColorThreshold) {
              sumR += nr;
              sumG += ng;
              sumB += nb;
              count++;
            }
          }
        }

        if (count > 0) {
          r = sumR / count;
          g = sumG / count;
          b = sumB / count;
        }
      }

      r = clampByte((r - 128) * contrastBoost + 128);
      g = clampByte((g - 128) * contrastBoost + 128);
      b = clampByte((b - 128) * contrastBoost + 128);

      out[idx] = posterizeChannel(r, levels);
      out[idx + 1] = posterizeChannel(g, levels);
      out[idx + 2] = posterizeChannel(b, levels);
      out[idx + 3] = src[idx + 3];
    }
  }

  return new ImageData(out, width, height);
}

export function quantizePosterize(
  imageData: ImageData,
  paletteHexColors: string[]
): ImageData {
  const preprocessed = posterizePreprocess(imageData);
  return quantizeNearest(preprocessed, paletteHexColors);
}

export function quantize(
  imageData: ImageData,
  paletteHexColors: string[],
  method: QuantizationMethod
): ImageData {
  if (method === 'nearest-color') {
    return quantizeNearest(imageData, paletteHexColors);
  } else if (method === 'dithering') {
    return quantizeDithering(imageData, paletteHexColors);
  } else if (method === 'posterize') {
    return quantizePosterize(imageData, paletteHexColors);
  }
  throw new Error(`Unknown quantization method: ${method}`);
}
