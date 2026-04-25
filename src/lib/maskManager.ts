/**
 * Manages loading and caching of canvas masks
 * Masks are black and white JPEGs where white = render, black = skip
 */

import { CANVAS_SIZES, CanvasSizeKey } from './palettes';

const maskCache = new Map<string, ImageData>();
const warnedMissingMasks = new Set<string>();

const warnMissingMaskOnce = (canvasSize: string, reason: string): void => {
  if (!warnedMissingMasks.has(canvasSize)) {
    console.warn(`Mask unavailable for ${canvasSize}: ${reason}`);
    warnedMissingMasks.add(canvasSize);
  }
};

/**
 * Load a mask image for a given canvas size
 * Returns null if mask doesn't exist
 */
export const loadMask = async (canvasSize: string): Promise<ImageData | null> => {
  // Check cache first
  if (maskCache.has(canvasSize)) {
    return maskCache.get(canvasSize)!;
  }

  try {
    const maskPath = `${import.meta.env.BASE_URL}masks/${canvasSize}.jpg`;
    const response = await fetch(maskPath);

    if (!response.ok) {
      warnMissingMaskOnce(canvasSize, `HTTP ${response.status} at ${maskPath}`);
      return null; // Mask doesn't exist
    }

    const blob = await response.blob();
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = () => {
        const targetSize = CANVAS_SIZES[canvasSize as CanvasSizeKey];
        const targetWidth = targetSize?.width ?? img.width;
        const targetHeight = targetSize?.height ?? img.height;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const maskData = ctx.getImageData(0, 0, targetWidth, targetHeight);

        // Cache it
        maskCache.set(canvasSize, maskData);
        resolve(maskData);
      };
      img.onerror = () => {
        warnMissingMaskOnce(canvasSize, `image decode failed at ${maskPath}`);
        resolve(null);
      };
      img.src = URL.createObjectURL(blob);
    });
  } catch (error) {
    warnMissingMaskOnce(canvasSize, String(error));
    return null;
  }
};

/**
 * Check if a pixel is masked (should be rendered)
 * Returns true if white (render), false if black (skip)
 */
export const isPixelMasked = (
  maskData: ImageData,
  pixelIndex: number
): boolean => {
  // Check red channel (should be same for B&W, but using red to be explicit)
  const redValue = maskData.data[pixelIndex];
  return redValue > 127; // White is render, black is skip
};

/**
 * Get the mask pixel index for a given x, y coordinate
 */
export const getMaskPixelIndex = (
  maskData: ImageData,
  x: number,
  y: number
): number => {
  return (Math.floor(y) * maskData.width + Math.floor(x)) * 4;
};

/**
 * Clear the mask cache (useful if masks are updated)
 */
export const clearMaskCache = (): void => {
  maskCache.clear();
};
