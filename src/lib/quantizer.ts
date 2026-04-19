import { hexToRgb, rgbToHex, colorDistance } from './colorUtils';

export type QuantizationMethod = 'nearest-color' | 'dithering';

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

export function quantize(
  imageData: ImageData,
  paletteHexColors: string[],
  method: QuantizationMethod
): ImageData {
  if (method === 'nearest-color') {
    return quantizeNearest(imageData, paletteHexColors);
  } else if (method === 'dithering') {
    return quantizeDithering(imageData, paletteHexColors);
  }
  throw new Error(`Unknown quantization method: ${method}`);
}
