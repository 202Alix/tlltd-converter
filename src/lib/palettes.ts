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
  // Food
  'Food': { width: 256, height: 256 },

  // Clothing - Tops
  'Basic tee': { width: 256, height: 256 },
  'Tank top': { width: 256, height: 256 },
  'Short-sleeve tee': { width: 256, height: 256 },
  'Long-sleeve tee': { width: 256, height: 256 },

  // Clothing - Dresses
  'Sleeveless dress': { width: 256, height: 256 },
  'Short-sleeve dress': { width: 256, height: 256 },
  'Long-sleeve dress': { width: 256, height: 256 },
  'Robe': { width: 256, height: 256 },
  'Dress': { width: 256, height: 256 },

  // Clothing - Bottoms
  'Skirt': { width: 256, height: 256 },
  'Long Skirt': { width: 256, height: 256 },
  'Shorts': { width: 256, height: 256 },
  'Pants': { width: 256, height: 256 },

  // Clothing - Headwear
  'Cap': { width: 256, height: 256 },
  'Headwear': { width: 256, height: 256 },
  'Top hat': { width: 256, height: 256 },

  // Treasures
  'Anything': { width: 256, height: 256 },
  'Books': { width: 180, height: 256 },
  'Music': { width: 256, height: 256 },
  'Videos': { width: 256, height: 131 },
  'Video games': { width: 256, height: 144 },
  'Pets': { width: 256, height: 256 },

  // Interior/Exterior - Interior
  'Interior': { width: 256, height: 256 },

  // Interior/Exterior - Exterior & Objects
  'Triangular roof': { width: 256, height: 256 },
  'Pyramid roof': { width: 256, height: 256 },
  'Conical roof': { width: 256, height: 256 },
  'Domed roof': { width: 256, height: 256 },
  'Box': { width: 256, height: 130 },
  'Cylinder': { width: 256, height: 256 },
  'Cone': { width: 256, height: 256 },
  'Pyramid': { width: 256, height: 256 },
  'Octahedron': { width: 256, height: 256 },
  'Upright board': { width: 256, height: 256 },
  'Flat board': { width: 256, height: 256 },
  'Dome': { width: 256, height: 256 },
  'Egg': { width: 256, height: 256 },
  'Sphere': { width: 256, height: 256 },

  // Landscaping
  'Landscaping': { width: 256, height: 256 },
} as const;

export type CanvasSizeKey = keyof typeof CANVAS_SIZES;

export const CANVAS_CATEGORIES = {
  Food: {
    name: 'Food',
    color: '#FFD700',
    items: ['Food'] as CanvasSizeKey[],
  },
  Clothing: {
    name: 'Clothing',
    color: '#FF69B4',
    subcategories: {
      Tops: {
        name: 'Tops',
        items: ['Basic tee', 'Tank top', 'Short-sleeve tee', 'Long-sleeve tee'] as CanvasSizeKey[],
      },
      Dresses: {
        name: 'Dresses',
        items: ['Sleeveless dress', 'Short-sleeve dress', 'Long-sleeve dress', 'Robe', 'Dress'] as CanvasSizeKey[],
      },
      Bottoms: {
        name: 'Bottoms',
        items: ['Skirt', 'Long Skirt', 'Shorts', 'Pants'] as CanvasSizeKey[],
      },
      Headwear: {
        name: 'Headwear',
        items: ['Cap', 'Headwear', 'Top hat'] as CanvasSizeKey[],
      },
    },
  },
  Treasures: {
    name: 'Treasures',
    color: '#9370DB',
    items: ['Anything', 'Books', 'Music', 'Videos', 'Video games', 'Pets'] as CanvasSizeKey[],
  },
  'Interior/Exterior': {
    name: 'Interior/Exterior',
    color: '#87CEEB',
    items: ['Interior', 'Triangular roof', 'Pyramid roof', 'Conical roof', 'Domed roof', 'Box', 'Cylinder', 'Cone', 'Pyramid', 'Octahedron', 'Upright board', 'Flat board', 'Dome', 'Egg', 'Sphere'] as CanvasSizeKey[],
  },
  Objects: {
    name: 'Objects',
    color: '#90EE90',
    items: ['Box', 'Cylinder', 'Cone', 'Pyramid', 'Octahedron', 'Upright board', 'Flat board', 'Dome', 'Egg', 'Sphere', 'Triangular roof', 'Pyramid roof', 'Conical roof', 'Domed roof'] as CanvasSizeKey[],
  },
  Landscaping: {
    name: 'Landscaping',
    color: '#8B4513',
    items: ['Landscaping'] as CanvasSizeKey[],
  },
} as const;

// Canvas sizes that require masks (non-rectangular shapes)
export const CANVAS_SIZES_WITH_MASKS = new Set<CanvasSizeKey>([
  // Clothing - excluding Basic tee (it's a square)
  'Tank top',
  'Short-sleeve tee',
  'Long-sleeve tee',
  'Sleeveless dress',
  'Short-sleeve dress',
  'Long-sleeve dress',
  'Robe',
  'Dress',
  'Skirt',
  'Long Skirt',
  'Shorts',
  'Pants',
  'Cap',
  'Headwear',
  'Top hat',

  // Interior/Exterior - most except Interior, Upright board, Flat board
  'Triangular roof',
  'Pyramid roof',
  'Conical roof',
  'Domed roof',
  'Box',
  'Cylinder',
  'Cone',
  'Pyramid',
  'Octahedron',
  'Dome',
  'Egg',
  'Sphere',

  // Objects - excluding Upright board, Flat board (they're squares)
  // (same as Interior/Exterior Exterior items)
  // Already listed above, so no duplicates needed
]);
