import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { CANVAS_SIZES, CanvasSizeKey } from '../lib/palettes';
import { QuantizationMethod } from '../lib/quantizer';

interface ControlPanelProps {
  selectedCanvasSize: CanvasSizeKey;
  onCanvasSizeChange: (size: CanvasSizeKey) => void;
  paletteMode: 'default' | 'colorRange';
  onPaletteModeChange: (mode: 'default' | 'colorRange') => void;
  maxColors: number | null;
  onMaxColorsChange: (count: number | null) => void;
  quantizationMethod: QuantizationMethod;
  onQuantizationMethodChange: (method: QuantizationMethod) => void;
}

interface TooltipProps {
  text: string;
}

const Tooltip: React.FC<TooltipProps> = ({ text }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', cursor: 'help' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <HelpCircle size={16} style={{ color: '#a6a6a6' }} />
      {isVisible && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#2b2b2b',
            color: 'white',
            padding: '6px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            marginBottom: '4px',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};

interface ControlPanelProps {
  selectedCanvasSize: CanvasSizeKey;
  onCanvasSizeChange: (size: CanvasSizeKey) => void;
  paletteMode: 'default' | 'colorRange';
  onPaletteModeChange: (mode: 'default' | 'colorRange') => void;
  maxColors: number | null;
  onMaxColorsChange: (count: number | null) => void;
  quantizationMethod: QuantizationMethod;
  onQuantizationMethodChange: (method: QuantizationMethod) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  selectedCanvasSize,
  onCanvasSizeChange,
  paletteMode,
  onPaletteModeChange,
  maxColors,
  onMaxColorsChange,
  quantizationMethod,
  onQuantizationMethodChange,
}) => {
  const updateSliderFill = (value: number, min: number, max: number, sliderElement?: HTMLInputElement) => {
    const fill = ((value - min) / (max - min)) * 100;
    if (sliderElement) {
      sliderElement.style.setProperty('--range-fill', `${fill}%`);
    }
  };
  return (
    <div className="space-y-6">
      {/* Canvas Size */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-base font-bold" style={{ color: 'black' }}>Canvas Size</h3>
          <Tooltip text="Choose the canvas corresponding to the one in game." />
        </div>
        <select
          value={selectedCanvasSize}
          onChange={(e) => onCanvasSizeChange(e.target.value as CanvasSizeKey)}
          className="w-full px-4 py-2 rounded-2xl bg-input text-foreground hover:opacity-90 transition-colors font-medium"
          style={{ boxShadow: '0 6px 0 #eeedef' }}
        >
          {Object.entries(CANVAS_SIZES).map(([key]) => (
            <option key={key} value={key}>
              {key} - {CANVAS_SIZES[key as CanvasSizeKey].width}x{CANVAS_SIZES[key as CanvasSizeKey].height}
            </option>
          ))}
        </select>
      </div>

      {/* Quantization Method, Palette Mode, and Max Colors - always 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-bold" style={{ color: 'black' }}>Quantization Method</h3>
            <Tooltip text="Choose color reduction method. Nearest color being the default and dithering for smoother images." />
          </div>
          <select
            value={quantizationMethod}
            onChange={(e) => onQuantizationMethodChange(e.target.value as QuantizationMethod)}
            className="w-full px-4 py-2 rounded-2xl bg-input text-foreground hover:opacity-90 transition-colors font-medium"
            style={{ boxShadow: '0 6px 0 #eeedef' }}
          >
            <option value="nearest-color">Nearest Color</option>
            <option value="dithering">Dithering</option>
          </select>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-bold" style={{ color: 'black' }}>Palette Mode</h3>
            <Tooltip text="Uses the in-game palette by default. Alternatively choose color range to use all rgb values." />
          </div>
          <select
            value={paletteMode}
            onChange={(e) => onPaletteModeChange(e.target.value as 'default' | 'colorRange')}
            className="w-full px-4 py-2 rounded-2xl bg-input text-foreground hover:opacity-90 transition-colors font-medium"
            style={{ boxShadow: '0 6px 0 #eeedef' }}
          >
            <option value="default">Default Palette</option>
            <option value="colorRange">Color Range</option>
          </select>
        </div>

        <div>
          {paletteMode === 'colorRange' ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-base font-bold" style={{ color: 'black' }}>
                  Max Colors: <span style={{ color: 'black' }}>{maxColors === null ? 'Unlimited' : maxColors}</span>
                </h3>
                <Tooltip text="Limit colors for simpler results. Put the slider at the end for unlimited colors." />
              </div>
              <input
                type="range"
                min="8"
                max="256"
                step="8"
                value={maxColors === null ? 256 : maxColors}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  onMaxColorsChange(val === 256 ? null : val);
                  updateSliderFill(val, 8, 256, e.currentTarget);
                }}
                className="w-full h-3 bg-linear-to-r from-secondary to-accent rounded-full appearance-none cursor-pointer accent-primary"
                style={{
                  '--range-fill': `${((maxColors === null ? 256 : maxColors) - 8) / (256 - 8) * 100}%`
                } as React.CSSProperties}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
