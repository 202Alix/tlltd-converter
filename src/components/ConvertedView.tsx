import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, RotateCcw, Grid3x3, Download, Hand, Pipette, Wand2 } from 'lucide-react';
import { findClosestColor } from '../lib/colorUtils';
import { downloadImage } from '../lib/imageProcessor';
import { PALETTES } from '../lib/palettes';
import { CANVAS_SIZES, CanvasSizeKey } from '../lib/palettes';

interface ConvertedViewProps {
  convertedImageData: ImageData;
  showGrid: boolean;
  onToggleGrid: (show: boolean) => void;
  canvasSize: CanvasSizeKey;
  paletteMode: 'default' | 'colorRange';
}

interface Tooltip {
  x: number;
  y: number;
  color: string;
  index: number;
  pixelX: number;
  pixelY: number;
  row: number;
  col: number;
}

type ToolMode = 'pan' | 'eyedropper' | 'colorFilter';

export const ConvertedView: React.FC<ConvertedViewProps> = ({
  convertedImageData,
  showGrid,
  onToggleGrid,
  canvasSize,
  paletteMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>('pan');
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [touchDistance, setTouchDistance] = useState(0);

  const paletteColors = PALETTES.palette1.colors;
  const targetSize = CANVAS_SIZES[canvasSize];
  const targetAspectRatio = targetSize.width / targetSize.height;

  // Fixed canvas size matching target aspect ratio - 2x larger
  const canvasWidth = 600;
  const canvasHeight = canvasWidth / targetAspectRatio;

  // Calculate base scale to fit image in window at 100%
  const baseScaleX = canvasWidth / convertedImageData.width;
  const baseScaleY = canvasHeight / convertedImageData.height;
  const baseScale = Math.min(baseScaleX, baseScaleY);

  // Calculate actual zoom considering base scale
  const zoom = (zoomPercent / 100) * baseScale;

  // Close tooltip when switching away from eyedropper mode
  useEffect(() => {
    if (toolMode !== 'eyedropper') {
      setTooltip(null);
    }
  }, [toolMode]);

  // Initialize slider fill on mount
  useEffect(() => {
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
      if ((slider as HTMLInputElement).min === '10' && (slider as HTMLInputElement).max === '1000') {
        const val = parseInt((slider as HTMLInputElement).value);
        updateSliderFill(val, 10, 1000, slider as HTMLInputElement);
      }
    });
  }, []);

  // Draw converted image with grid - canvas size never changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fixed canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the converted image scaled by zoom
    const scaledWidth = convertedImageData.width * zoom;
    const scaledHeight = convertedImageData.height * zoom;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = convertedImageData.width;
    tempCanvas.height = convertedImageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      // If color filter is active, create a filtered version
      if (toolMode === 'colorFilter' && filterColor) {
        const filteredImageData = new ImageData(convertedImageData.width, convertedImageData.height);
        const srcData = convertedImageData.data;
        const dstData = filteredImageData.data;

        // Parse filter color hex
        const r = parseInt(filterColor.slice(1, 3), 16);
        const g = parseInt(filterColor.slice(3, 5), 16);
        const b = parseInt(filterColor.slice(5, 7), 16);

        // Copy pixels, modifying alpha based on match
        for (let i = 0; i < srcData.length; i += 4) {
          dstData[i] = srcData[i];     // R
          dstData[i + 1] = srcData[i + 1]; // G
          dstData[i + 2] = srcData[i + 2]; // B

          // If color matches, keep full opacity; otherwise reduce to 20%
          if (srcData[i] === r && srcData[i + 1] === g && srcData[i + 2] === b) {
            dstData[i + 3] = 255;
          } else {
            dstData[i + 3] = 51; // 20% of 255
          }
        }

        tempCtx.putImageData(filteredImageData, 0, 0);
      } else {
        // No filter, draw normally
        tempCtx.putImageData(convertedImageData, 0, 0);
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tempCanvas, panX, panY, scaledWidth, scaledHeight);
    }

    // Draw grid if enabled
    if (showGrid) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 1;

      // Vertical lines
      for (let x = 0; x <= convertedImageData.width; x++) {
        const screenX = panX + x * zoom;
        if (screenX >= 0 && screenX <= canvas.width) {
          ctx.beginPath();
          ctx.moveTo(screenX, panY);
          ctx.lineTo(screenX, Math.min(panY + scaledHeight, canvas.height));
          ctx.stroke();
        }
      }

      // Horizontal lines
      for (let y = 0; y <= convertedImageData.height; y++) {
        const screenY = panY + y * zoom;
        if (screenY >= 0 && screenY <= canvas.height) {
          ctx.beginPath();
          ctx.moveTo(panX, screenY);
          ctx.lineTo(Math.min(panX + scaledWidth, canvas.width), screenY);
          ctx.stroke();
        }
      }
    }
  }, [convertedImageData, zoom, panX, panY, showGrid, canvasWidth, canvasHeight, toolMode, filterColor]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (toolMode === 'pan') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || toolMode !== 'pan') return;
    e.preventDefault();

    const scaledWidth = convertedImageData.width * zoom;
    const scaledHeight = convertedImageData.height * zoom;

    // Calculate bounds - image can go negative (off-screen) when zoomed in
    const maxX = 0;
    const maxY = 0;
    const minX = canvasWidth - scaledWidth;
    const minY = canvasHeight - scaledHeight;

    const newX = Math.max(minX, Math.min(maxX, e.clientX - dragStart.x));
    const newY = Math.max(minY, Math.min(maxY, e.clientY - dragStart.y));

    setPanX(newX);
    setPanY(newY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getTouchDistance = (touches: any) => {
    if (touches.length !== 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: any) => {
    const x = (touches[0].clientX + touches[1].clientX) / 2;
    const y = (touches[0].clientY + touches[1].clientY) / 2;
    return { x, y };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && toolMode === 'pan') {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY });
    } else if (e.touches.length === 2) {
      setTouchDistance(getTouchDistance(e.touches));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging && toolMode === 'pan') {
      e.preventDefault();
      const scaledWidth = convertedImageData.width * zoom;
      const scaledHeight = convertedImageData.height * zoom;

      const maxX = 0;
      const maxY = 0;
      const minX = canvasWidth - scaledWidth;
      const minY = canvasHeight - scaledHeight;

      const newX = Math.max(minX, Math.min(maxX, e.touches[0].clientX - dragStart.x));
      const newY = Math.max(minY, Math.min(maxY, e.touches[0].clientY - dragStart.y));

      setPanX(newX);
      setPanY(newY);
    } else if (e.touches.length === 2) {
      const newDistance = getTouchDistance(e.touches);
      if (touchDistance > 0) {
        const scale = newDistance / touchDistance;
        const newZoom = Math.round(Math.max(10, Math.min(1000, zoomPercent * scale)));
        setZoomPercent(newZoom);
        setTouchDistance(newDistance);
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchDistance(0);
  };

  // Keyboard shortcuts for panning and zooming
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const panStep = 20;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (toolMode === 'pan') setPanX((prev) => prev + panStep);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (toolMode === 'pan') setPanX((prev) => prev - panStep);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (toolMode === 'pan') setPanY((prev) => prev + panStep);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (toolMode === 'pan') setPanY((prev) => prev - panStep);
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomChange(zoomPercent + 10);
          break;
        case '-':
          e.preventDefault();
          handleZoomChange(zoomPercent - 10);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toolMode, zoomPercent]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (toolMode === 'eyedropper') {
      // Close tooltip if it exists
      if (tooltip) {
        setTooltip(null);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      // Account for CSS scaling - convert visual coordinates to bitmap coordinates
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;

      const imageX = Math.round((canvasX - panX) / zoom);
      const imageY = Math.round((canvasY - panY) / zoom);

      if (
        imageX >= 0 &&
        imageX < convertedImageData.width &&
        imageY >= 0 &&
        imageY < convertedImageData.height
      ) {
        const pixelIndex = (imageY * convertedImageData.width + imageX) * 4;
        const r = convertedImageData.data[pixelIndex];
        const g = convertedImageData.data[pixelIndex + 1];
        const b = convertedImageData.data[pixelIndex + 2];
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();

        let tooltipData: Tooltip;
        if (paletteMode === 'colorRange') {
          // In color range mode, show hex code
          tooltipData = {
            x: e.clientX,
            y: e.clientY,
            color: hex,
            index: -1,
            pixelX: imageX,
            pixelY: imageY,
            row: -1,
            col: -1,
          };
        } else {
          // In default mode, show row/column from palette
          const closest = findClosestColor([r, g, b], paletteColors);
          const row = Math.floor(closest.index / 12) + 1;
          const col = (closest.index % 12) + 1;

          tooltipData = {
            x: e.clientX,
            y: e.clientY,
            color: closest.hex,
            index: closest.index,
            pixelX: imageX,
            pixelY: imageY,
            row,
            col,
          };
        }

        setTooltip(tooltipData);
      }
    } else if (toolMode === 'colorFilter') {
      // In color filter mode, click to select color
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      // Account for CSS scaling - convert visual coordinates to bitmap coordinates
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;

      const imageX = Math.round((canvasX - panX) / zoom);
      const imageY = Math.round((canvasY - panY) / zoom);

      if (
        imageX >= 0 &&
        imageX < convertedImageData.width &&
        imageY >= 0 &&
        imageY < convertedImageData.height
      ) {
        const pixelIndex = (imageY * convertedImageData.width + imageX) * 4;
        const r = convertedImageData.data[pixelIndex];
        const g = convertedImageData.data[pixelIndex + 1];
        const b = convertedImageData.data[pixelIndex + 2];

        if (paletteMode === 'colorRange') {
          // In color range mode, use the actual pixel color
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
          setFilterColor(hex);
        } else {
          // In default mode, find closest palette color
          const closest = findClosestColor([r, g, b], paletteColors);
          setFilterColor(closest.hex);
        }
      }
    }
  };

  const handleZoomChange = (newPercent: number) => {
    const clampedPercent = Math.max(10, Math.min(1000, newPercent));
    setZoomPercent(clampedPercent);
  };

  const updateSliderFill = (value: number, min: number, max: number, sliderElement?: HTMLInputElement) => {
    const fill = ((value - min) / (max - min)) * 100;
    if (sliderElement) {
      sliderElement.style.setProperty('--range-fill', `${fill}%`);
    }
  };

  const handleDownload = () => {
    downloadImage(convertedImageData, 'tomodachi-converted.png');
  };

  return (
    <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`bg-input w-full ${
          toolMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
        }`}
        style={{ imageRendering: 'pixelated', maxWidth: '512px', height: 'auto', touchAction: 'none' }}
      />

      {/* Bottom section with tools on left and grid/download on right */}
      <div className="flex gap-4 w-full flex-wrap" style={{ justifyContent: 'space-between' }}>
        {/* Tools on the left */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setToolMode('pan')}
            className="px-3 py-2 rounded-lg transition-all font-bold flex items-center gap-2"
            style={{
              backgroundColor: '#FF8000',
              color: 'white',
              border: toolMode === 'pan' ? '3px solid transparent' : '3px solid transparent',
              backgroundImage: toolMode === 'pan' ? 'linear-gradient(#FF8000, #FF8000), linear-gradient(to bottom, #FFE400, #F40436)' : 'none',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box'
            }}
            title="Pan mode (drag to move)"
          >
            <Hand strokeWidth={3} className="w-5 h-5" />
            Pan
          </button>
          <button
            onClick={() => setToolMode(toolMode === 'eyedropper' ? 'pan' : 'eyedropper')}
            className="px-3 py-2 rounded-lg transition-all font-bold flex items-center gap-2"
            style={{
              backgroundColor: '#FF8000',
              color: 'white',
              border: toolMode === 'eyedropper' ? '3px solid transparent' : '3px solid transparent',
              backgroundImage: toolMode === 'eyedropper' ? 'linear-gradient(#FF8000, #FF8000), linear-gradient(to bottom, #FFE400, #F40436)' : 'none',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box'
            }}
            title="Eyedropper mode (click to pick color)"
          >
            <Pipette strokeWidth={3} className="w-5 h-5" />
            Pick Color
          </button>
          <button
            onClick={() => setToolMode(toolMode === 'colorFilter' ? 'pan' : 'colorFilter')}
            className="px-3 py-2 rounded-lg transition-all font-bold flex items-center gap-2"
            style={{
              backgroundColor: '#FF8000',
              color: 'white',
              border: toolMode === 'colorFilter' ? '3px solid transparent' : '3px solid transparent',
              backgroundImage: toolMode === 'colorFilter' ? 'linear-gradient(#FF8000, #FF8000), linear-gradient(to bottom, #FFE400, #F40436)' : 'none',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box'
            }}
            title="Color filter mode (click to select color to highlight)"
          >
            <Wand2 strokeWidth={3} className="w-5 h-5" />
            Filter
          </button>
        </div>

        {/* Grid and Download on the right */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onToggleGrid(!showGrid)}
            title="Toggle grid overlay"
            className="px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold"
            style={{
              backgroundColor: '#FF8000',
              color: 'white',
              border: showGrid ? '3px solid transparent' : '3px solid transparent',
              backgroundImage: showGrid ? 'linear-gradient(#FF8000, #FF8000), linear-gradient(to bottom, #FFE400, #F40436)' : 'none',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box'
            }}
          >
            <Grid3x3 strokeWidth={3} className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (convertedImageData) {
                const canvas = document.createElement('canvas');
                canvas.width = convertedImageData.width;
                canvas.height = convertedImageData.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.putImageData(convertedImageData, 0, 0);
                  const link = document.createElement('a');
                  link.download = `tomodachi-${canvasSize}.png`;
                  link.href = canvas.toDataURL();
                  link.click();
                }
              }
            }}
            title="Download as PNG"
            className="px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold disabled:opacity-50"
            style={{
              backgroundColor: '#FF8000',
              color: 'white'
            }}
            disabled={!convertedImageData}
          >
            <Download strokeWidth={3} className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Zoom controls centered */}
      <div className="flex gap-2 w-full items-center" style={{ justifyContent: 'center' }}>
        <button
          onClick={() => handleZoomChange(zoomPercent - 10)}
          title="Zoom out"
          className="px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 font-bold"
          style={{
            color: '#2b2b2b',
            flexShrink: 0
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#FF8000')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#2b2b2b')}
        >
          <ZoomOut strokeWidth={3} className="w-5 h-5" />
        </button>
        <input
          type="range"
          min="10"
          max="1000"
          step="1"
          value={zoomPercent}
          onChange={(e) => {
            const newValue = parseInt(e.target.value);
            handleZoomChange(newValue);
            updateSliderFill(newValue, 10, 1000, e.currentTarget);
          }}
          style={{
            accentColor: '#FF8000',
            appearance: 'none',
            width: '100%',
            height: '8px',
            borderRadius: '4px',
            outline: 'none',
            WebkitAppearance: 'none',
            '--range-fill': `${((zoomPercent - 10) / (1000 - 10)) * 100}%`,
            flex: 1,
            minWidth: 0
          } as React.CSSProperties}
        />
        <button
          onClick={() => handleZoomChange(zoomPercent + 10)}
          title="Zoom in"
          className="px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 font-bold"
          style={{
            color: '#2b2b2b',
            flexShrink: 0
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#FF8000')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#2b2b2b')}
        >
          <ZoomIn strokeWidth={3} className="w-5 h-5" />
        </button>
        <button
          onClick={() => setZoomPercent(100)}
          title="Reset zoom"
          className="px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold"
          style={{
            color: '#2b2b2b',
            flexShrink: 0
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#FF8000')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#2b2b2b')}
        >
          <RotateCcw strokeWidth={3} className="w-5 h-5" />
        </button>
      </div>

      <div className="text-center text-sm text-muted-foreground font-medium" style={{ marginTop: '-12px' }}>
        Zoom: {zoomPercent}%
      </div>

      {tooltip && createPortal(
        <div
          style={{
            position: 'fixed',
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y + 10}px`,
            backgroundColor: '#2b2b2b',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '14px',
            zIndex: 50,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            pointerEvents: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '2px solid white',
                borderRadius: '8px',
                backgroundColor: tooltip.color
              }}
            />
            <div>
              {paletteMode === 'colorRange' ? (
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{tooltip.color.toUpperCase()}</span>
              ) : (
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Row {tooltip.row}, Col {tooltip.col}</span>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
