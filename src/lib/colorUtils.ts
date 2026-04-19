// Convert hex color to RGB
export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error(`Invalid hex color: ${hex}`);
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

// Convert RGB to hex
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}

// Calculate Euclidean distance between two RGB colors
export function colorDistance(
  [r1, g1, b1]: [number, number, number],
  [r2, g2, b2]: [number, number, number]
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Find the closest color in a palette to a given RGB color
export function findClosestColor(
  rgb: [number, number, number],
  paletteHexColors: string[]
): { hex: string; index: number } {
  let minDistance = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < paletteHexColors.length; i++) {
    const paletteRgb = hexToRgb(paletteHexColors[i]);
    const distance = colorDistance(rgb, paletteRgb);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }

  return {
    hex: paletteHexColors[closestIndex],
    index: closestIndex,
  };
}
