# Tomodachi Dream Image Converter

A web application for converting images to the Tomodachi Life: Living the Dream game format.

**Live demo:** https://202alix.github.io/tlltd-converter

## Features

- Image upload with zoom, pan, and position controls
- **Canvas organization**: 6 categories with intelligent grouping
  - Food (256×256)
  - Clothing (Tops, Dresses, Bottoms, Headwear) - 300×300, with masks for 3D shapes
  - Treasures (Anything, Books, Music, Videos, Video games, Pets) - 256×256 to 256×144
  - Interior/Exterior (Interior and Exterior shapes) - 300×300, with masks for 3D shapes
  - Objects (3D shapes with masks) - 300×300
  - Landscaping (256×256)
- **Mask support**: Automatically applies black & white masks to properly render 3D objects and complex shapes
- Color quantization methods: Nearest Color and Floyd-Steinberg dithering
- Palette modes: Default (84 colors) and Color Range (full RGB)
- Detail/pixelation slider (×1 to ×16)
- Max colors control for simplified results
- Interactive preview with grid overlay and color picker
- Responsive design for desktop and mobile
- PNG download and localStorage persistence
- Auto-select first item in categories/sub-categories for streamlined workflow

## How to Use

1. Upload an image
2. Position and zoom the image using the preview controls
3. Select a category, then a canvas size (sub-category first for Clothing/Interior-Exterior)
4. Choose quantization method and palette mode
5. Adjust detail level and max colors as desired
6. Download the converted PNG

## Supported Canvas Sizes

- **Food**: 256×256
- **Clothing** (16 items): 256×256 to 300×300, includes Basic Tee, Tank Top, Dresses, Skirts, Pants, Headwear, etc.
- **Treasures**: Anything (256×256), Books (180×256), Music (256×256), Videos (256×131), Video games (256×144), Pets (256×256)
- **Interior/Exterior** (15 items): Interior, and 14 3D shapes (Cone, Sphere, Pyramid, Box, Cylinder, etc.) at 300×300
- **Objects** (14 items): 3D shapes at 300×300
- **Landscaping**: 256×256

## Technologies

- React 19
- TypeScript
- Tailwind CSS 4
- Vite
- Canvas API for image processing
- Lucide React icons
- Mask-based shape rendering for 3D objects

## License

MIT License

## Support

Contact: 202alix@pm.me

## Disclaimer

This is an unofficial fan-made tool. Nintendo and Tomodachi Life are trademarks of Nintendo Co., Ltd. This project is not affiliated with, endorsed by, or created by Nintendo.
