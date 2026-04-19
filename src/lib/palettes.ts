// Palette 1 from the CSV - 7 rows x 12 colors
const PALETTE_1_DATA = [
  ['#fefefe', '#f3f1fa', '#f2f2fa', '#f5f9fd', '#f5fbf7', '#f3f4f2', '#f7fbf2', '#fdfdf3', '#fbf4f2', '#f9f1f2', '#f9eee2', '#da0102'],
  ['#eeedef', '#d2cdea', '#ced1e8', '#d6ebfd', '#daf2de', '#d3dece', '#e3efd0', '#fcf9d1', '#f4dace', '#e7cecd', '#e2d4ba', '#fefe3c'],
  ['#dad9d9', '#a89bd8', '#9ea5d8', '#b1dafc', '#b5e8c2', '#a8c3a0', '#cce3a1', '#f9f4a1', '#ebba9e', '#d49e9c', '#c8b085', '#8ffe3c'],
  ['#c3c1c4', '#6100c5', '#3156c2', '#72c7fc', '#7ddd9d', '#5a9e2e', '#aed739', '#f8f239', '#e18d22', '#bc2f06', '#906d1f', '#8ffefd'],
  ['#a5a5a5', '#5300ad', '#2a4baa', '#63addb', '#6ec289', '#4e8924', '#98bb2f', '#d8d232', '#c47c1e', '#a32a05', '#764d0d', '#0100f9'],
  ['#7e7c7d', '#42008b', '#223c88', '#508cb2', '#599c6f', '#3f6f1f', '#7b9627', '#afaa28', '#9e6317', '#841c03', '#604116', '#7d00f9'],
  ['#010002', '#250055', '#0a1c53', '#2f536d', '#365f42', '#264309', '#495c14', '#6b6818', '#603807', '#500d02', '#3c2b11', '#da00c6'],
];

// Flatten palette for easier color lookup
export const PALETTE_1_FLAT = PALETTE_1_DATA.flat();

export const PALETTES = {
  palette1: {
    name: 'Face Paint Palette',
    colors: PALETTE_1_FLAT,
    colorGrid: PALETTE_1_DATA,
  },
} as const;

export const CANVAS_SIZES = {
  'TV Screen': { width: 255, height: 131 },
  '128x128': { width: 128, height: 128 },
  '256x256': { width: 256, height: 256 },
} as const;

export type CanvasSizeKey = keyof typeof CANVAS_SIZES;
export type PaletteKey = keyof typeof PALETTES;
