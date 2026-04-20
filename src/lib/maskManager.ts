/**
 * Manages loading and caching of canvas masks
 * Masks are black and white JPEGs where white = render, black = skip
 */

const maskCache = new Map<string, ImageData>();

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
      return null; // Mask doesn't exist
    }

    const blob = await response.blob();
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const maskData = ctx.getImageData(0, 0, img.width, img.height);

        // Cache it
        maskCache.set(canvasSize, maskData);
        resolve(maskData);
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch (error) {
    console.warn(`Failed to load mask for ${canvasSize}:`, error);
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
