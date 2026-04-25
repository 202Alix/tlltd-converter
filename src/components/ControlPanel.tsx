import React, { useState, useRef, useEffect } from 'react';
import { CANVAS_SIZES, CanvasSizeKey } from '../lib/palettes';
import { QuantizationMethod } from '../lib/quantizer';
import { DETAIL_LEVELS, DetailLevel } from '../lib/imageProcessor';
import { Tooltip } from './Tooltip';

interface ControlPanelProps {
  selectedCanvasSize: CanvasSizeKey;
  onCanvasSizeChange: (size: CanvasSizeKey) => void;
  paletteMode: 'default' | 'colorRange';
  onPaletteModeChange: (mode: 'default' | 'colorRange') => void;
  maxColors: number | null;
  onMaxColorsChange: (count: number | null) => void;
  quantizationMethod: QuantizationMethod;
  onQuantizationMethodChange: (method: QuantizationMethod) => void;
  detailLevel: DetailLevel;
  onDetailLevelChange: (level: DetailLevel) => void;
  onPageChange: (page: 'contact') => void;
}

const ValuePill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2px 8px',
      borderRadius: '9999px',
      backgroundColor: '#FFF3CC',
      color: '#2b2b2b',
      fontSize: 'inherit',
      fontWeight: 700,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}
  >
    {children}
  </span>
);

const SECTION_TITLE_STYLE: React.CSSProperties = {
  color: 'black',
  fontSize: 'clamp(1rem, 4.6vw, 20px)',
};

const TITLE_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
  marginBottom: '0.5rem',
};

export const ControlPanel: React.FC<ControlPanelProps> = ({
  selectedCanvasSize,
  onCanvasSizeChange,
  paletteMode,
  onPaletteModeChange,
  maxColors,
  onMaxColorsChange,
  quantizationMethod,
  onQuantizationMethodChange,
  detailLevel,
  onDetailLevelChange,
  onPageChange,
}) => {
  const [tempDetailLevel, setTempDetailLevel] = useState<number>(DETAIL_LEVELS.indexOf(detailLevel));
  const [tempMaxColors, setTempMaxColors] = useState<number>(maxColors === null ? 256 : maxColors);
  const isDraggingRef = useRef(false);

  // Adjust tempMaxColors when palette mode changes
  useEffect(() => {
    if (paletteMode === 'default' && tempMaxColors > 84) {
      setTempMaxColors(84);
    } else if (paletteMode === 'colorRange' && tempMaxColors > 256) {
      setTempMaxColors(256);
    }
  }, [paletteMode]);

  const updateSliderFill = (value: number, min: number, max: number, sliderElement?: HTMLInputElement) => {
    const fill = ((value - min) / (max - min)) * 100;
    if (sliderElement) {
      sliderElement.style.setProperty('--range-fill', `${fill}%`);
    }
  };

  const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setTempDetailLevel(value);
    updateSliderFill(value, 0, 5, e.currentTarget);
  };

  const handleMaxColorsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setTempMaxColors(value);
    const min = 1;
    const max = paletteMode === 'colorRange' ? 256 : 84;
    updateSliderFill(value, min, max, e.currentTarget);
  };

  const handleDetailPointerDown = () => {
    isDraggingRef.current = true;
  };

  const handleDetailPointerUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      onDetailLevelChange(DETAIL_LEVELS[tempDetailLevel]);
    }
  };

  const handleMaxColorsPointerDown = () => {
    isDraggingRef.current = true;
  };

  const handleMaxColorsPointerUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      // Send null (unlimited) when at max value for the current palette mode
      const isUnlimited = paletteMode === 'colorRange' ? tempMaxColors === 256 : tempMaxColors === 84;
      onMaxColorsChange(isUnlimited ? null : tempMaxColors);
    }
  };

  const maxColorsLimit = paletteMode === 'colorRange' ? 256 : 84;
  const isUnlimited = tempMaxColors >= maxColorsLimit;

  return (
    <div className="space-y-6">
      {/* Style and Palette */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 'clamp(1rem, 3vw, 1.5rem)' }}>
        <div>
          <div style={TITLE_ROW_STYLE}>
            <h3 className="text-base font-bold" style={SECTION_TITLE_STYLE}>Style</h3>
            <Tooltip text="Solid maps each pixel to the nearest color. Blended dithers nearby colors for smoother gradients." />
          </div>
          <select
            value={quantizationMethod}
            onChange={(e) => onQuantizationMethodChange(e.target.value as QuantizationMethod)}
            className="w-full px-4 py-2 rounded-2xl bg-input text-foreground hover:opacity-90 transition-colors font-medium"
            style={{ boxShadow: '0 6px 0 #eeedef' }}
          >
            <option value="nearest-color">Solid</option>
            <option value="dithering">Blended</option>
          </select>
        </div>

        <div>
          <div style={TITLE_ROW_STYLE}>
            <h3 className="text-base font-bold" style={SECTION_TITLE_STYLE}>Palette</h3>
            <Tooltip text="In-Game uses the official Tomodachi Life face-paint colors. Custom extracts colors directly from your image." />
          </div>
          <select
            value={paletteMode}
            onChange={(e) => onPaletteModeChange(e.target.value as 'default' | 'colorRange')}
            className="w-full px-4 py-2 rounded-2xl bg-input text-foreground hover:opacity-90 transition-colors font-medium"
            style={{ boxShadow: '0 6px 0 #eeedef' }}
          >
            <option value="default">In-Game</option>
            <option value="colorRange">Custom</option>
          </select>
        </div>
      </div>

      {/* Detail and Colors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 'clamp(1rem, 3vw, 1.5rem)' }}>
        <div>
          <div style={TITLE_ROW_STYLE}>
            <h3 className="text-base font-bold" style={SECTION_TITLE_STYLE}>Detail</h3>
            <ValuePill>x{DETAIL_LEVELS[tempDetailLevel]}</ValuePill>
            <Tooltip text="Fine keeps small sharp pixels. Chunky gives a bolder block look." />
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="1"
            value={tempDetailLevel}
            onChange={handleDetailChange}
            onPointerDown={handleDetailPointerDown}
            onPointerUp={handleDetailPointerUp}
            className="w-full h-3 bg-linear-to-r from-secondary to-accent rounded-full appearance-none cursor-pointer accent-primary"
            style={{ '--range-fill': `${(tempDetailLevel / 5) * 100}%` } as React.CSSProperties}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '11px', color: '#a6a6a6' }}>Fine</span>
            <span style={{ fontSize: '11px', color: '#a6a6a6' }}>Chunky</span>
          </div>
        </div>

        <div>
          <div style={TITLE_ROW_STYLE}>
            <h3 className="text-base font-bold" style={SECTION_TITLE_STYLE}>Colors</h3>
            <ValuePill>{isUnlimited ? 'Unlimited' : tempMaxColors}</ValuePill>
            <Tooltip text="Limit the number of colors used. Fewer colors gives a flatter look. All the way right = unlimited." />
          </div>
          <input
            type="range"
            min="1"
            max={maxColorsLimit}
            step="1"
            value={tempMaxColors}
            onChange={handleMaxColorsChange}
            onPointerDown={handleMaxColorsPointerDown}
            onPointerUp={handleMaxColorsPointerUp}
            className="w-full h-3 bg-linear-to-r from-secondary to-accent rounded-full appearance-none cursor-pointer accent-primary"
            style={{ '--range-fill': `${((tempMaxColors - 1) / (maxColorsLimit - 1)) * 100}%` } as React.CSSProperties}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '11px', color: '#a6a6a6' }}>1</span>
            <span style={{ fontSize: '11px', color: '#a6a6a6' }}>Unlimited</span>
          </div>
        </div>
      </div>
    </div>
  );
};
