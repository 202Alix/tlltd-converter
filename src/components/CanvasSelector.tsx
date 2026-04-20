import React, { useState } from 'react';
import { CANVAS_CATEGORIES, CANVAS_SIZES, CanvasSizeKey } from '../lib/palettes';

interface CanvasSelectorProps {
  selectedCanvasSize: CanvasSizeKey;
  onCanvasSizeChange: (size: CanvasSizeKey) => void;
}

type CategoryKey = keyof typeof CANVAS_CATEGORIES;
type SubcategoryKey = string;

// Shared card styling
const CARD_STYLE = {
  backgroundColor: 'white',
  border: 'none',
  borderRadius: '12px',
  boxShadow: '0 6px 0 #eeedef',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px',
  cursor: 'pointer',
  transition: 'all 0.2s',
  aspectRatio: '1 / 1',
};

export const CanvasSelector: React.FC<CanvasSelectorProps> = ({
  selectedCanvasSize,
  onCanvasSizeChange,
}) => {
  // Find which category the selected size belongs to, default to Treasures
  const currentCategory = (Object.entries(CANVAS_CATEGORIES).find(([_, category]) => {
    if ('items' in category) {
      return category.items.includes(selectedCanvasSize);
    } else if ('subcategories' in category) {
      return Object.values(category.subcategories).some(sub => sub.items.includes(selectedCanvasSize));
    }
    return false;
  })?.[0] || 'Treasures') as CategoryKey;

  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>(currentCategory);

  // Get first subcategory key if category has subcategories
  const getFirstSubcategoryKey = (category: CategoryKey): SubcategoryKey | null => {
    const categoryData = CANVAS_CATEGORIES[category];
    if ('subcategories' in categoryData) {
      return Object.keys(categoryData.subcategories)[0] || null;
    }
    return null;
  };

  const [selectedSubcategory, setSelectedSubcategory] = useState<SubcategoryKey | null>(
    getFirstSubcategoryKey(currentCategory)
  );

  const currentCategoryData = CANVAS_CATEGORIES[selectedCategory];
  const hasSubcategories = 'subcategories' in currentCategoryData;

  const handleCategorySelect = (category: CategoryKey) => {
    setSelectedCategory(category);

    const categoryData = CANVAS_CATEGORIES[category];
    if ('items' in categoryData && categoryData.items.length > 0) {
      // Auto-select first item if no subcategories
      onCanvasSizeChange(categoryData.items[0]);
      setSelectedSubcategory(null);
    } else if ('subcategories' in categoryData) {
      // Auto-select first sub-category and its first item
      const firstSubcategoryKey = Object.keys(categoryData.subcategories)[0];
      if (firstSubcategoryKey) {
        setSelectedSubcategory(firstSubcategoryKey);
        const firstItem = (categoryData as any).subcategories[firstSubcategoryKey].items[0];
        if (firstItem) {
          onCanvasSizeChange(firstItem);
        }
      }
    }
  };

  const handleSubcategorySelect = (subcategory: SubcategoryKey) => {
    setSelectedSubcategory(subcategory);
    const subcategoryData = (currentCategoryData as any).subcategories[subcategory];
    if (subcategoryData.items.length > 0) {
      onCanvasSizeChange(subcategoryData.items[0]);
    }
  };

  const handleCanvasSelect = (size: CanvasSizeKey) => {
    onCanvasSizeChange(size);
  };

  const getItemsToDisplay = (): CanvasSizeKey[] => {
    if ('items' in currentCategoryData) {
      return currentCategoryData.items;
    } else if (selectedSubcategory && 'subcategories' in currentCategoryData) {
      return (currentCategoryData as any).subcategories[selectedSubcategory].items;
    }
    return [];
  };

  const itemsToDisplay = getItemsToDisplay();

  return (
    <div className="space-y-6">
      {/* Categories Section */}
      <div>
        <h3 className="text-base font-bold" style={{ color: 'black', marginBottom: '12px' }}>
          Categories
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
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
              {/* Category color square */}
              <div
                style={{
                  flex: 1,
                  aspectRatio: '1 / 1',
                  backgroundColor: category.color,
                  borderRadius: '8px',
                  flexShrink: 0,
                  minWidth: '60px',
                  minHeight: '60px',
                }}
              />
              <h4 style={{ color: 'black', fontWeight: 'bold', margin: '0', fontSize: '13px', textAlign: 'center' }}>
                {category.name}
              </h4>
            </button>
          ))}
        </div>
      </div>

      {/* Sub-categories Section - shown only if current category has subcategories */}
      {hasSubcategories && (
        <div>
          <h3 className="text-base font-bold" style={{ color: 'black', marginBottom: '12px' }}>
            Types
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
            {Object.entries((currentCategoryData as any).subcategories).map(([key, subcategory]) => (
              <button
                key={key}
                onClick={() => handleSubcategorySelect(key)}
                style={{
                  ...CARD_STYLE,
                  gap: '8px',
                  backgroundColor: selectedSubcategory === key ? '#FFDA85' : 'white',
                  boxShadow: selectedSubcategory === key ? '0 6px 0 #FFC336' : '0 6px 0 #eeedef',
                  transform: 'scale(1)',
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  if (selectedSubcategory !== key) {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
                title={`Select ${(subcategory as any).name}`}
              >
                {/* Subcategory color square */}
                <div
                  style={{
                    flex: 1,
                    aspectRatio: '1 / 1',
                    backgroundColor: currentCategoryData.color,
                    borderRadius: '8px',
                    opacity: selectedSubcategory === key ? 1 : 0.3,
                    flexShrink: 0,
                    minWidth: '60px',
                    minHeight: '60px',
                  }}
                />
                <h4 style={{ color: 'black', fontWeight: 'bold', margin: '0', fontSize: '13px', textAlign: 'center' }}>
                  {(subcategory as any).name}
                </h4>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Base Shapes Section */}
      <div>
        <h3 className="text-base font-bold" style={{ color: 'black', marginBottom: '12px' }}>
          Base shapes
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
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
              {/* Square image placeholder */}
              <div
                style={{
                  flex: 1,
                  aspectRatio: '1 / 1',
                  backgroundColor: currentCategoryData.color,
                  borderRadius: '8px',
                  opacity: selectedCanvasSize === size ? 1 : 0.3,
                  flexShrink: 0,
                  minWidth: '60px',
                  minHeight: '60px',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', textAlign: 'center', width: '100%' }}>
                <h4 style={{ color: 'black', fontWeight: 'bold', margin: '0', fontSize: '13px' }}>
                  {size}
                </h4>
                <p
                  style={{
                    color: '#717182',
                    margin: '0',
                    fontSize: '11px',
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



