import React, { useState, useRef, useEffect } from 'react';
import { CANVAS_SIZES, CanvasSizeKey } from '../lib/palettes';
import { QuantizationMethod } from '../lib/quantizer';
import { BrushMode, DetailLevel, getDetailLevelsForBrushMode } from '../lib/imageProcessor';
import { Tooltip } from './Tooltip';
import { TYPOGRAPHY } from '../lib/typography';

interface ControlPanelProps {
  selectedCanvasSize: CanvasSizeKey;
  onCanvasSizeChange: (size: CanvasSizeKey) => void;
  paletteMode: 'default' | 'colorRange';
  onPaletteModeChange: (mode: 'default' | 'colorRange') => void;
  maxColors: number;
  onMaxColorsChange: (count: number) => void;
  brushMode: BrushMode;
  onBrushModeChange: (mode: BrushMode) => void;
  quantizationMethod: QuantizationMethod;
  onQuantizationMethodChange: (method: QuantizationMethod) => void;
  detailLevel: DetailLevel;
  onDetailLevelChange: (level: DetailLevel) => void;
  onPresetApply: (mode: BrushMode, detail: DetailLevel, colors: number) => void;
  onPageChange: (page: 'contact') => void;
}

const ValuePill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2px 7px',
      borderRadius: '9999px',
      backgroundColor: 'var(--app-pill-bg)',
      color: 'var(--app-pill-text)',
      fontSize: '12px',
      fontWeight: 600,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}
  >
    {children}
  </span>
);

const SECTION_TITLE_STYLE: React.CSSProperties = {
  color: 'var(--app-text)',
  fontSize: '15px',
  lineHeight: 1.2,
  margin: 0,
};

const TITLE_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  flexWrap: 'wrap',
  marginBottom: '0.375rem',
};

const PRESETS_BY_MODE: Record<BrushMode, { label: string; detail: DetailLevel; colors: number }[]> = {
  smooth: [
    { label: 'Detailed', detail: 1, colors: 24 },
    { label: 'Balanced', detail: 3, colors: 16 },
    { label: 'Chunky', detail: 7, colors: 8 },
  ],
  'pixel-perfect': [
    { label: 'Detailed', detail: 4, colors: 24 },
    { label: 'Balanced', detail: 8, colors: 16 },
    { label: 'Chunky', detail: 16, colors: 8 },
  ],
};

export const ControlPanel: React.FC<ControlPanelProps> = ({
  selectedCanvasSize,
  onCanvasSizeChange,
  paletteMode,
  onPaletteModeChange,
  maxColors,
  onMaxColorsChange,
  brushMode,
  onBrushModeChange,
  quantizationMethod,
  onQuantizationMethodChange,
  detailLevel,
  onDetailLevelChange,
  onPresetApply,
  onPageChange,
}) => {
  const detailLevels = getDetailLevelsForBrushMode(brushMode);
  const [tempDetailLevel, setTempDetailLevel] = useState<number>(() => {
    const initialIndex = detailLevels.indexOf(detailLevel);
    return initialIndex >= 0 ? initialIndex : 0;
  });
  const [tempMaxColors, setTempMaxColors] = useState<number>(maxColors);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const nextIndex = detailLevels.indexOf(detailLevel);
    setTempDetailLevel(nextIndex >= 0 ? nextIndex : 0);
  }, [detailLevel, brushMode]);

  // Adjust tempMaxColors when palette mode changes
  useEffect(() => {
    if (paletteMode === 'default' && tempMaxColors > 84) {
      setTempMaxColors(84);
    } else if (paletteMode === 'colorRange' && tempMaxColors > 128) {
      setTempMaxColors(128);
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
    updateSliderFill(value, 0, detailLevels.length - 1, e.currentTarget);
  };

  const handleMaxColorsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setTempMaxColors(value);
    const min = 1;
    const max = paletteMode === 'colorRange' ? 128 : 84;
    updateSliderFill(value, min, max, e.currentTarget);
  };

  const handleDetailPointerDown = () => {
    isDraggingRef.current = true;
  };

  const handleDetailPointerUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      onDetailLevelChange(detailLevels[tempDetailLevel]);
    }
  };

  const handleMaxColorsPointerDown = () => {
    isDraggingRef.current = true;
  };

  const handleMaxColorsPointerUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      onMaxColorsChange(tempMaxColors);
    }
  };

  const modePresets = PRESETS_BY_MODE[brushMode];
  const maxColorsLimit = paletteMode === 'colorRange' ? 128 : 84;

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div>
        <div style={TITLE_ROW_STYLE}>
          <h3 className={TYPOGRAPHY.h3} style={SECTION_TITLE_STYLE}>Quick Preset</h3>
          <Tooltip text="Snap Detail and Colors to a preset combination." />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {modePresets.map(({ label, detail, colors }) => (
            <button
              key={label}
              aria-pressed={detailLevels[tempDetailLevel] === detail && tempMaxColors === colors}
              onClick={() => {
                const idx = detailLevels.indexOf(detail);
                setTempDetailLevel(idx);
                setTempMaxColors(colors);
                onPresetApply(brushMode, detail, colors);
              }}
              className={`flex-1 px-3 py-1.5 rounded-xl font-medium text-[14px] btn-tool${detailLevels[tempDetailLevel] === detail && tempMaxColors === colors ? ' btn-tool--active' : ''}`}
              style={{ border: 'none', cursor: 'pointer' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Brush mode */}
      <div>
        <div style={TITLE_ROW_STYLE}>
          <h3 className={TYPOGRAPHY.h3} style={SECTION_TITLE_STYLE}>Brush Mode</h3>
          <Tooltip text="Smooth offers 1, 3, 7, 13, 19, 27 for softer strokes. Pixel Perfect offers 4, 8, 16, 32 and aligns cleanly to the grid." />
        </div>
        <fieldset className="radio-pill-group" aria-label="Brush mode">
          <label className={`radio-pill${brushMode === 'smooth' ? ' radio-pill--selected' : ''}`}>
            <input
              type="radio"
              name="brush-mode"
              value="smooth"
              checked={brushMode === 'smooth'}
              onChange={() => onBrushModeChange('smooth')}
              className="radio-pill__input"
            />
            <span>Smooth Mode</span>
          </label>
          <label className={`radio-pill${brushMode === 'pixel-perfect' ? ' radio-pill--selected' : ''}`}>
            <input
              type="radio"
              name="brush-mode"
              value="pixel-perfect"
              checked={brushMode === 'pixel-perfect'}
              onChange={() => onBrushModeChange('pixel-perfect')}
              className="radio-pill__input"
            />
            <span>Pixel Perfect</span>
          </label>
        </fieldset>
      </div>

      {/* Style and Palette */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.875rem' }}>
        <div>
          <div style={TITLE_ROW_STYLE}>
            <h3 className={TYPOGRAPHY.h3} style={SECTION_TITLE_STYLE}>Style</h3>
            <Tooltip text="Solid maps each pixel to the nearest color. Blended dithers nearby colors for smoother gradients. Flat posterizes tones first for bolder, cleaner shape separation." />
          </div>
          <fieldset className="radio-pill-group" aria-label="Style">
            <label className={`radio-pill${quantizationMethod === 'nearest-color' ? ' radio-pill--selected' : ''}`}>
              <input
                type="radio"
                name="style-mode"
                value="nearest-color"
                checked={quantizationMethod === 'nearest-color'}
                onChange={() => onQuantizationMethodChange('nearest-color')}
                className="radio-pill__input"
              />
              <span>Solid</span>
            </label>
            <label className={`radio-pill${quantizationMethod === 'dithering' ? ' radio-pill--selected' : ''}`}>
              <input
                type="radio"
                name="style-mode"
                value="dithering"
                checked={quantizationMethod === 'dithering'}
                onChange={() => onQuantizationMethodChange('dithering')}
                className="radio-pill__input"
              />
              <span>Blended</span>
            </label>
            <label className={`radio-pill${quantizationMethod === 'posterize' ? ' radio-pill--selected' : ''}`}>
              <input
                type="radio"
                name="style-mode"
                value="posterize"
                checked={quantizationMethod === 'posterize'}
                onChange={() => onQuantizationMethodChange('posterize')}
                className="radio-pill__input"
              />
              <span>Flat</span>
            </label>
          </fieldset>
        </div>

        <div>
          <div style={TITLE_ROW_STYLE}>
            <h3 className={TYPOGRAPHY.h3} style={SECTION_TITLE_STYLE}>Palette</h3>
            <Tooltip text="Default Palette uses the official Tomodachi Life face-paint colors. Gradient mode extracts colors directly from your image." />
          </div>
          <fieldset className="radio-pill-group" aria-label="Palette">
            <label className={`radio-pill${paletteMode === 'default' ? ' radio-pill--selected' : ''}`}>
              <input
                type="radio"
                name="palette-mode"
                value="default"
                checked={paletteMode === 'default'}
                onChange={() => onPaletteModeChange('default')}
                className="radio-pill__input"
              />
              <span>Default Palette</span>
            </label>
            <label className={`radio-pill${paletteMode === 'colorRange' ? ' radio-pill--selected' : ''}`}>
              <input
                type="radio"
                name="palette-mode"
                value="colorRange"
                checked={paletteMode === 'colorRange'}
                onChange={() => onPaletteModeChange('colorRange')}
                className="radio-pill__input"
              />
              <span>Gradient Mode</span>
            </label>
          </fieldset>
        </div>
      </div>

      {/* Detail and Colors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.875rem' }}>
        <div>
          <div style={TITLE_ROW_STYLE}>
            <h3 className={TYPOGRAPHY.h3} style={SECTION_TITLE_STYLE}>Detail</h3>
            <ValuePill>x{detailLevels[tempDetailLevel]}</ValuePill>
            <Tooltip text={brushMode === 'pixel-perfect' ? 'Grid-snapped detail for crisp pixel-art alignment.' : 'Fine keeps small sharp pixels. Chunky gives a bolder block look.'} />
          </div>
          <input
            type="range"
            min="0"
            max={detailLevels.length - 1}
            step="1"
            value={tempDetailLevel}
            onChange={handleDetailChange}
            onPointerDown={handleDetailPointerDown}
            onPointerUp={handleDetailPointerUp}
            className="w-full h-3 bg-linear-to-r from-secondary to-accent rounded-full appearance-none cursor-pointer accent-primary"
            style={{ '--range-fill': `${(tempDetailLevel / (detailLevels.length - 1)) * 100}%` } as React.CSSProperties}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
            <span className={TYPOGRAPHY.caption} style={{ color: 'var(--app-text-muted)' }}>{brushMode === 'pixel-perfect' ? 'x4' : 'Detailed'}</span>
            <span className={TYPOGRAPHY.caption} style={{ color: 'var(--app-text-muted)' }}>{brushMode === 'pixel-perfect' ? 'x32' : 'Chunky'}</span>
          </div>
        </div>

        <div>
          <div style={TITLE_ROW_STYLE}>
            <h3 className={TYPOGRAPHY.h3} style={SECTION_TITLE_STYLE}>Colors</h3>
            <ValuePill>{tempMaxColors}</ValuePill>
            <Tooltip text="Limit the number of colors used. Fewer colors gives a flatter look." />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
            <span className={TYPOGRAPHY.caption} style={{ color: 'var(--app-text-muted)' }}>1</span>
            <span className={TYPOGRAPHY.caption} style={{ color: 'var(--app-text-muted)' }}>{maxColorsLimit}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
