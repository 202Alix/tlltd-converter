import React, { useState, useEffect } from 'react';
import { CANVAS_CATEGORIES, CANVAS_SIZES, CanvasSizeKey, CANVAS_SIZES_WITH_MASKS } from '../lib/palettes';
import * as LucideIcons from 'lucide-react';

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
  backgroundColor: 'white',
  border: 'none',
  borderRadius: '12px',
  boxShadow: '0 6px 0 #eeedef',
  boxSizing: 'border-box' as const,
  width: '100%',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: 'clamp(0.75rem, 2.5vw, 2rem)',
  cursor: 'pointer',
  transition: 'all 0.2s',
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
  const getShapeStyle = (size: CanvasSizeKey) => {
    const canvas = CANVAS_SIZES[size];
    const aspectRatio = canvas.width / canvas.height;
    
    // If wider than tall (landscape or square), constrain width
    // If taller than wide (portrait), constrain height
    if (aspectRatio >= 1) {
      return { width: '60px', height: 'auto' };
    } else {
      return { width: 'auto', height: '60px' };
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
    shapeStyle: Record<string, string>;
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
            width: '60px',
            height: '60px',
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
    <div className="space-y-6">
      {/* Categories Section */}
      <div>
        <h3 className="text-base font-bold" style={{ color: 'black', marginBottom: '12px', fontSize: 'clamp(1rem, 4.8vw, 20px)' }}>
          Categories
        </h3>
        <div className="canvas-selector-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'clamp(1rem, 3vw, 2rem)', maxWidth: '100%' }}>
          {Object.entries(CANVAS_CATEGORIES).map(([key, category]) => (
            <button
              key={key}
              onClick={() => handleCategorySelect(key as CategoryKey)}
              style={{
                ...CARD_STYLE,
                gap: '8px',
                backgroundColor: selectedCategory === key ? '#FFDA85' : 'white',
                boxShadow: selectedCategory === key ? '0 6px 0 #FFC336' : '0 6px 0 #eeedef',
                transform: 'scale(1)',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                if (selectedCategory !== key) {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              }}
              title={`Select ${category.name}`}
            >
              {/* Category icon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {React.createElement((LucideIcons as any)[(category as any).icon], {
                  size: 60,
                  strokeWidth: 2,
                  color: getCategoryGroupColor(key as CategoryKey),
                  style: {
                    width: 'clamp(36px, 10vw, 60px)',
                    height: 'clamp(36px, 10vw, 60px)',
                  },
                })}
              </div>
              <h4 style={{ color: 'black', fontWeight: 'bold', margin: '0', fontSize: 'clamp(12px, 3.6vw, 16px)', textAlign: 'center' }}>
                {category.name}
              </h4>
            </button>
          ))}
        </div>
      </div>

      {/* Base Shapes Section */}
      <div>
        <h3 className="text-base font-bold" style={{ color: 'black', marginBottom: '12px', fontSize: 'clamp(1rem, 4.8vw, 20px)' }}>
          Base shapes
        </h3>
        <div className="canvas-selector-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'clamp(1rem, 3vw, 2rem)', maxWidth: '100%' }}>
          {itemsToDisplay.map((size) => (
            <button
              key={size}
              onClick={() => handleCanvasSelect(size)}
              style={{
                ...CARD_STYLE,
                gap: '8px',
                backgroundColor: selectedCanvasSize === size ? '#FFDA85' : 'white',
                boxShadow: selectedCanvasSize === size ? '0 6px 0 #FFC336' : '0 6px 0 #eeedef',
                border: 'none',
                transform: 'scale(1)',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                if (selectedCanvasSize !== size) {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              }}
              title={`Select ${size}`}
            >
              {/* Fixed-size square container for the shape */}
              <div
                style={{
                  width: 'clamp(52px, 16vw, 80px)',
                  height: 'clamp(52px, 16vw, 80px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {/* Shape with canvas aspect ratio - maintains aspect while fitting in box */}
                <ShapePreview 
                  size={size}
                  isSelected={selectedCanvasSize === size}
                  categoryColor={categoryGroupColor}
                  hasMask={hasMask(size)}
                  aspectRatio={getAspectRatio(size)}
                  shapeStyle={getShapeStyle(size)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', textAlign: 'center', width: '100%' }}>
                <h4 style={{ color: 'black', fontWeight: 'bold', margin: '0', fontSize: 'clamp(11px, 3.2vw, 13px)' }}>
                  {size}
                </h4>
                <p
                  style={{
                    color: '#717182',
                    margin: '0',
                    fontSize: 'clamp(11px, 3.2vw, 14px)',
                  }}
                >
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



