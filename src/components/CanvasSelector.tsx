import React, { useState, useEffect } from 'react';
import { CANVAS_CATEGORIES, CANVAS_SIZES, CanvasSizeKey, CANVAS_SIZES_WITH_MASKS } from '../lib/palettes';
import * as LucideIcons from 'lucide-react';
import { TYPOGRAPHY } from '../lib/typography';

interface CanvasSelectorProps {
  selectedCanvasSize: CanvasSizeKey;
  onCanvasSizeChange: (size: CanvasSizeKey) => void;
}

type CategoryKey = keyof typeof CANVAS_CATEGORIES;

// Cache for rendered mask canvases
const maskCanvasCache = new Map<string, string>();
const missingMaskWarnings = new Set<string>();

// Render a mask with a specific color
const renderMaskWithColor = async (maskPath: string, color: string): Promise<string> => {
  const cacheKey = `${maskPath}-${color}`;
  if (maskCanvasCache.has(cacheKey)) {
    return maskCanvasCache.get(cacheKey)!;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve('');
        return;
      }

      // Draw the mask image first
      ctx.drawImage(img, 0, 0);
      
      // Get image data to work with pixels
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Parse color to RGB
      const rgbMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      if (!rgbMatch) {
        resolve('');
        return;
      }
      
      const r = parseInt(rgbMatch[1], 16);
      const g = parseInt(rgbMatch[2], 16);
      const b = parseInt(rgbMatch[3], 16);
      
      // Replace white pixels with color, make black pixels transparent
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        
        // If brightness > 128, it's mostly white - keep it as color
        if (brightness > 128) {
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        } else {
          // Black/dark - make transparent
          data[i + 3] = 0;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      const dataUrl = canvas.toDataURL();
      maskCanvasCache.set(cacheKey, dataUrl);
      resolve(dataUrl);
    };
    img.onerror = () => {
      if (!missingMaskWarnings.has(maskPath)) {
        console.warn(`Missing or unreadable selector mask: ${maskPath}`);
        missingMaskWarnings.add(maskPath);
      }
      resolve('');
    };
    img.src = maskPath;
  });
};

// Shared card styling
const CARD_STYLE = {
  border: 'none',
  borderRadius: '12px',
  boxSizing: 'border-box' as const,
  width: '100%',
  minWidth: 0,
  minHeight: '144px',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'stretch',
  padding: '8px',
  cursor: 'pointer',
};

export const CanvasSelector: React.FC<CanvasSelectorProps> = ({
  selectedCanvasSize,
  onCanvasSizeChange,
}) => {
  // Find which category the selected size belongs to, default to Treasures
  const currentCategory = (Object.entries(CANVAS_CATEGORIES).find(([_, category]) => {
    return category.items.includes(selectedCanvasSize);
  })?.[0] || 'Treasures') as CategoryKey;

  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>(currentCategory);

  const currentCategoryData = CANVAS_CATEGORIES[selectedCategory];

  const handleCategorySelect = (category: CategoryKey) => {
    setSelectedCategory(category);

    const categoryData = CANVAS_CATEGORIES[category];
    if (categoryData.items.length > 0) {
      onCanvasSizeChange(categoryData.items[0]);
    }
  };

  const handleCanvasSelect = (size: CanvasSizeKey) => {
    onCanvasSizeChange(size);
  };

  const getItemsToDisplay = (): CanvasSizeKey[] => {
    return currentCategoryData.items;
  };

  const itemsToDisplay = getItemsToDisplay();

  // Get group color based on category
  const getCategoryGroupColor = (category: CategoryKey): string => {
    if (category === 'Food' || category === 'Treasures') {
      return '#FE7A53'; // Red
    } else if (category === 'Clothing' || category === 'Objects') {
      return '#0072AE'; // Blue
    } else if (category === 'Interior/Exterior' || category === 'Landscaping') {
      return '#66B120'; // Green
    }
    return '#FFD700'; // Fallback
  };

  const categoryGroupColor = getCategoryGroupColor(selectedCategory);

  // Calculate aspect ratio for a canvas size, normalized to fit within a square
  const getAspectRatio = (size: CanvasSizeKey): string => {
    const canvas = CANVAS_SIZES[size];
    const maxDimension = Math.max(canvas.width, canvas.height);
    const normalizedWidth = canvas.width / maxDimension;
    const normalizedHeight = canvas.height / maxDimension;
    return `${normalizedWidth} / ${normalizedHeight}`;
  };

  // Determine which dimension should be constrained to fit in 60x60 box
  const getShapeStyle = (size: CanvasSizeKey): React.CSSProperties => {
    const canvas = CANVAS_SIZES[size];
    const aspectRatio = canvas.width / canvas.height;
    if (aspectRatio >= 1) {
      return { width: '100%', height: 'auto', maxWidth: '72px' };
    } else {
      return { width: 'auto', height: '100%', maxHeight: '72px' };
    }
  };

  // Check if a size has a mask (non-rectangular shape)
  const hasMask = (size: CanvasSizeKey): boolean => {
    return CANVAS_SIZES_WITH_MASKS.has(size);
  };

  // Shape Preview Component
  const ShapePreview: React.FC<{
    size: CanvasSizeKey;
    isSelected: boolean;
    categoryColor: string;
    hasMask: boolean;
    aspectRatio: string;
    shapeStyle: React.CSSProperties;
  }> = ({ size, isSelected, categoryColor, hasMask: isMasked, aspectRatio, shapeStyle }) => {
    const [maskImage, setMaskImage] = useState<string>('');

    useEffect(() => {
      if (isMasked) {
        renderMaskWithColor(
          `${import.meta.env.BASE_URL}masks/${size}.jpg`,
          categoryColor
        ).then((result) => {
          setMaskImage(result);
        });
      }
    }, [size, categoryColor, isMasked]);

    if (isMasked && maskImage) {
      return (
        <img
          src={maskImage}
          alt={size}
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '72px',
            maxHeight: '72px',
            objectFit: 'contain',
            opacity: isSelected ? 1 : 0.3,
          }}
        />
      );
    }

    return (
      <div
        style={{
          aspectRatio,
          backgroundColor: categoryColor,
          borderRadius: '8px',
          opacity: isSelected ? 1 : 0.3,
          ...shapeStyle,
        }}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Categories Section */}
      <div>
        <h3 className={TYPOGRAPHY.h3} style={{ color: 'var(--app-text)', marginBottom: '8px' }}>
          Categories
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(CANVAS_CATEGORIES).map(([key, category]) => (
            <button
              key={key}
              onClick={() => handleCategorySelect(key as CategoryKey)}
              className={`btn-card${selectedCategory === key ? ' btn-card--selected' : ''}`}
              style={{ ...CARD_STYLE, gap: '8px' } as React.CSSProperties}
              title={`Select ${category.name}`}
            >
              <div className="flex h-full w-full flex-1 items-center justify-center">
                {React.createElement((LucideIcons as any)[(category as any).icon], {
                  size: 38,
                  strokeWidth: 2,
                  color: getCategoryGroupColor(key as CategoryKey),
                })}
              </div>
              <h3 className={TYPOGRAPHY.h3} style={{ color: 'var(--app-text)', margin: 0, textAlign: 'center' }}>
                {category.name}
              </h3>
              <p className={TYPOGRAPHY.caption} style={{ color: 'var(--app-text-sub)', margin: 0, textAlign: 'center' }}>
                {category.items.length} items
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Base Shapes Section */}
      <div>
        <h3 className={TYPOGRAPHY.h3} style={{ color: 'var(--app-text)', marginBottom: '8px' }}>
          Shapes
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {itemsToDisplay.map((size) => (
            <button
              key={size}
              onClick={() => handleCanvasSelect(size)}
              className={`btn-card${selectedCanvasSize === size ? ' btn-card--selected' : ''}`}
              style={{ ...CARD_STYLE, gap: '8px' } as React.CSSProperties}
              title={`Select ${size}`}
            >
              <div className="flex w-full flex-1 items-center justify-center min-h-0">
                <ShapePreview 
                  size={size}
                  isSelected={selectedCanvasSize === size}
                  categoryColor={categoryGroupColor}
                  hasMask={hasMask(size)}
                  aspectRatio={getAspectRatio(size)}
                  shapeStyle={getShapeStyle(size)}
                />
              </div>
              <div className="flex w-full flex-col items-center gap-1 text-center">
                <h3 className={TYPOGRAPHY.h3} style={{ color: 'var(--app-text)', margin: 0 }}>
                  {size}
                </h3>
                <p className={TYPOGRAPHY.caption} style={{ color: 'var(--app-text-sub)', margin: 0 }}>
                  {CANVAS_SIZES[size].width}×{CANVAS_SIZES[size].height}px
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};



