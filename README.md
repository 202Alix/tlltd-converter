# Tomodachi Dream Image Converter

A web application for converting images to the Tomodachi Life: Living the Dream game format.

**Live demo:** https://202alix.github.io/tlltd-converter

## Features

- Image upload by click or drag-and-drop
- Source image zoom and move controls to choose the converted area
- **Canvas organization**: 6 categories with intelligent grouping
  - Food (256×256)
  - Clothing (Tops, Dresses, Bottoms, Headwear) - 256×256, with masks for 3D shapes
  - Treasures (Anything, Books, Music, Videos, Video games, Pets) - 256×256 to 256×144
  - Interior/Exterior (Interior and Exterior shapes) - 256×256, with masks for 3D shapes
  - Objects (3D shapes with masks) - 256×256
  - Landscaping (256×256)
- Category cards with icon-based browsing
- **Mask support**: Automatically applies black & white masks to properly render 3D objects and complex shapes
- Color reduction modes: Solid and Blended
- Color palette modes: In-Game (84 colors) and Custom (full RGB)
- Block size slider (×1 to ×16)
- Max colors control for simplified results
- Interactive converted preview with pan, pick-color, color filter, grid overlay, and centered zoom/pan
- Fullscreen converted preview mode
- Checkered background pattern for accurate color preview
- Responsive design for desktop and mobile
- PNG download and localStorage persistence
- Auto-select first item in categories for streamlined workflow

## How to Use

1. Upload an image
2. Position and zoom the image using the preview controls
3. Select a category, then choose a base shape/canvas size
4. Choose Color Reduction and Color Palette modes
5. Adjust Block Size and Max Colors as desired
6. Download the converted PNG

## Supported Canvas Sizes

- **Food**: 256×256
- **Clothing** (16 items): 256×256, includes Basic Tee, Tank Top, Dresses, Skirts, Pants, Headwear, etc.
- **Treasures**: Anything (256×256), Books (180×256), Music (256×256), Videos (256×131), Video games (256×144), Pets (256×256)
- **Interior/Exterior** (15 items): Interior, and 14 3D shapes (Cone, Sphere, Pyramid, Box, Cylinder, etc.) at 256×256
- **Objects** (14 items): 3D shapes at 256×256
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
