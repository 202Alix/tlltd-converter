import React, { useState, useRef, useEffect } from 'react';
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
  detailLevel: 1 | 2 | 4 | 8 | 16;
  onDetailLevelChange: (level: 1 | 2 | 4 | 8 | 16) => void;
  onPageChange: (page: 'contact') => void;
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
  detailLevel: 1 | 2 | 4 | 8 | 16;
  onDetailLevelChange: (level: 1 | 2 | 4 | 8 | 16) => void;
  onPageChange: (page: 'contact') => void;
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
  detailLevel,
  onDetailLevelChange,
  onPageChange,
}) => {
  const [tempDetailLevel, setTempDetailLevel] = useState<number>([1, 2, 4, 8, 16].indexOf(detailLevel));
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
    updateSliderFill(value, 0, 4, e.currentTarget);
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
      const levels: (1 | 2 | 4 | 8 | 16)[] = [1, 2, 4, 8, 16];
      onDetailLevelChange(levels[tempDetailLevel]);
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

  return (
    <div className="space-y-6">
      {/* Color Reduction and Color Palette */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: 'clamp(1rem, 3vw, 2rem)' }}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-bold" style={{ color: 'black', fontSize: '20px' }}>Color Reduction</h3>
            <Tooltip text="Choose how colors are simplified. Solid uses single colors, Blended mixes nearby colors for smoother transitions." />
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
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-bold" style={{ color: 'black', fontSize: '20px' }}>Color Palette</h3>
            <Tooltip text="In-Game uses the Tomodachi colors. Custom uses any colors from your image." />
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

      {/* Detail Level and Max Colors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: 'clamp(1rem, 3vw, 2rem)' }}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-bold" style={{ color: 'black', fontSize: '20px' }}>
              Block Size: <span style={{ color: 'black' }}>x{[1, 2, 4, 8, 16][tempDetailLevel]}</span>
            </h3>
            <Tooltip text="Larger blocks = simpler image. x1 = tiny detailed blocks, x16 = large simple blocks." />
          </div>
          <input
            type="range"
            min="0"
            max="4"
            step="1"
            value={tempDetailLevel}
            onChange={handleDetailChange}
            onPointerDown={handleDetailPointerDown}
            onPointerUp={handleDetailPointerUp}
            className="w-full h-3 bg-linear-to-r from-secondary to-accent rounded-full appearance-none cursor-pointer accent-primary"
            style={{
              '--range-fill': `${(tempDetailLevel / 4) * 100}%`
            } as React.CSSProperties}
          />
        </div>

        <div>
          {paletteMode === 'colorRange' ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-base font-bold" style={{ color: 'black', fontSize: '20px' }}>
                  Max Colors: <span style={{ color: 'black' }}>{tempMaxColors === 256 ? 'Unlimited' : tempMaxColors}</span>
                </h3>
                <Tooltip text="Fewer colors = simpler results. Slide to the right for unlimited colors." />
              </div>
              <input
                type="range"
                min="1"
                max="256"
                step="1"
                value={tempMaxColors}
                onChange={handleMaxColorsChange}
                onPointerDown={handleMaxColorsPointerDown}
                onPointerUp={handleMaxColorsPointerUp}
                className="w-full h-3 bg-linear-to-r from-secondary to-accent rounded-full appearance-none cursor-pointer accent-primary"
                style={{
                  '--range-fill': `${((tempMaxColors - 1) / (256 - 1)) * 100}%`
                } as React.CSSProperties}
              />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-base font-bold" style={{ color: 'black', fontSize: '20px' }}>
                  Max Colors: <span style={{ color: 'black' }}>{tempMaxColors === 84 ? 'Unlimited' : tempMaxColors}</span>
                </h3>
                <Tooltip text="Fewer colors = simpler results. Slide to the right for unlimited colors." />
              </div>
              <input
                type="range"
                min="1"
                max="84"
                step="1"
                value={tempMaxColors}
                onChange={handleMaxColorsChange}
                onPointerDown={handleMaxColorsPointerDown}
                onPointerUp={handleMaxColorsPointerUp}
                className="w-full h-3 bg-linear-to-r from-secondary to-accent rounded-full appearance-none cursor-pointer accent-primary"
                style={{
                  '--range-fill': `${((tempMaxColors - 1) / (84 - 1)) * 100}%`
                } as React.CSSProperties}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
