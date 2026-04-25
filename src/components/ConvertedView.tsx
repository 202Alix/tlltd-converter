import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, RotateCcw, Grid3x3, Download, Hand, Pipette, Wand2, Maximize2, X } from 'lucide-react';
import { findClosestColor } from '../lib/colorUtils';
import { PALETTES } from '../lib/palettes';
import { CANVAS_SIZES, CanvasSizeKey } from '../lib/palettes';

// Color constants
const COLOR_PRIMARY = '#FF8000';
const COLOR_SECONDARY = '#FFDA85';
const COLOR_TEXT = '#2b2b2b';
const COLOR_OVERLAY = 'rgba(0, 0, 0, 0.7)';
const COLOR_SHADOW = '#FFC336';

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
  const [viewportCenterX, setViewportCenterX] = useState<number | null>(null);
  const [viewportCenterY, setViewportCenterY] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const paletteColors = PALETTES.palette1.colors;
  const targetSize = CANVAS_SIZES[canvasSize];
  const targetAspectRatio = targetSize.width / targetSize.height;

  const filterRgb = filterColor
    ? {
        r: parseInt(filterColor.slice(1, 3), 16),
        g: parseInt(filterColor.slice(3, 5), 16),
        b: parseInt(filterColor.slice(5, 7), 16),
      }
    : null;

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

  // Handle zoom centering - keep the same point in view when zooming
  useEffect(() => {
    if (viewportCenterX !== null && viewportCenterY !== null) {
      const newPanX = (canvasWidth / 2) - (viewportCenterX * zoom);
      const newPanY = (canvasHeight / 2) - (viewportCenterY * zoom);
      setPanX(newPanX);
      setPanY(newPanY);
    }
  }, [zoom, viewportCenterX, viewportCenterY, canvasWidth, canvasHeight]);

  const handleGestureChange = useCallback((e: any) => {
    // Safari/iOS gesture events for pinch zoom
    e.preventDefault();
    e.stopPropagation();
    const scaleFactor = e.scale;
    if (scaleFactor !== 1) {
      const zoomDelta = scaleFactor > 1 ? 20 : -20;
      handleZoomChange(zoomPercent + zoomDelta);
    }
  }, [zoomPercent]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      // Pinch zoom (trackpad pinch or wheel with ctrl/cmd)
      const zoomDelta = e.deltaY > 0 ? -10 : 10;
      handleZoomChange(zoomPercent + zoomDelta);
    } else {
      // Trackpad two-finger scroll for panning
      const scaledWidth = convertedImageData.width * zoom;
      const scaledHeight = convertedImageData.height * zoom;

      const maxX = 0;
      const maxY = 0;
      const minX = canvasWidth - scaledWidth;
      const minY = canvasHeight - scaledHeight;

      const newX = Math.max(minX, Math.min(maxX, panX - e.deltaX));
      const newY = Math.max(minY, Math.min(maxY, panY - e.deltaY));

      setPanX(newX);
      setPanY(newY);
    }
  }, [zoomPercent, convertedImageData.width, convertedImageData.height, zoom, canvasWidth, canvasHeight, panX, panY]);

  // Attach gesture listener for Safari
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleWheel(e as any);
    };

    canvas.addEventListener('gesturechange', handleGestureChange as any);
    canvas.addEventListener('wheel', wheelHandler, { passive: false });

    return () => {
      canvas.removeEventListener('gesturechange', handleGestureChange as any);
      canvas.removeEventListener('wheel', wheelHandler);
    };
  }, [handleGestureChange, handleWheel]);

  // Draw converted image with grid - canvas size never changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fixed canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Draw checkered background pattern
    const checkSize = 10;
    const lightColor = '#e8e8e8';
    const darkColor = '#ffffff';
    for (let y = 0; y < canvas.height; y += checkSize) {
      for (let x = 0; x < canvas.width; x += checkSize) {
        ctx.fillStyle = ((x / checkSize + y / checkSize) % 2 === 0) ? lightColor : darkColor;
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

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

        // Copy pixels, modifying alpha based on match
        for (let i = 0; i < srcData.length; i += 4) {
          dstData[i] = srcData[i];     // R
          dstData[i + 1] = srcData[i + 1]; // G
          dstData[i + 2] = srcData[i + 2]; // B

          if (srcData[i + 3] === 0) {
            dstData[i + 3] = 0;
          } else if (filterRgb && srcData[i] === filterRgb.r && srcData[i + 1] === filterRgb.g && srcData[i + 2] === filterRgb.b) {
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
      ctx.strokeStyle = 'rgba(255, 128, 0, 0.3)';
      ctx.lineWidth = 1;

      // Base grid, always visible when enabled.
      for (let x = 0; x <= convertedImageData.width; x++) {
        const screenX = panX + x * zoom;
        if (screenX >= 0 && screenX <= canvas.width) {
          ctx.beginPath();
          ctx.moveTo(screenX, panY);
          ctx.lineTo(screenX, Math.min(panY + scaledHeight, canvas.height));
          ctx.stroke();
        }
      }

      for (let y = 0; y <= convertedImageData.height; y++) {
        const screenY = panY + y * zoom;
        if (screenY >= 0 && screenY <= canvas.height) {
          ctx.beginPath();
          ctx.moveTo(panX, screenY);
          ctx.lineTo(Math.min(panX + scaledWidth, canvas.width), screenY);
          ctx.stroke();
        }
      }

      // Extra edge emphasis only while filtering a color.
      if (toolMode === 'colorFilter' && filterRgb) {
        const data = convertedImageData.data;
        const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < convertedImageData.width && y < convertedImageData.height;
        const pixelIndex = (x: number, y: number) => (y * convertedImageData.width + x) * 4;
        const isVisible = (x: number, y: number) => inBounds(x, y) && data[pixelIndex(x, y) + 3] > 0;
        const isHighlighted = (x: number, y: number) => {
          if (!isVisible(x, y)) return false;
          const index = pixelIndex(x, y);
          return data[index] === filterRgb.r && data[index + 1] === filterRgb.g && data[index + 2] === filterRgb.b;
        };
        const samePixel = (ax: number, ay: number, bx: number, by: number) => {
          if (!inBounds(ax, ay) || !inBounds(bx, by)) return false;
          const aIndex = pixelIndex(ax, ay);
          const bIndex = pixelIndex(bx, by);
          return data[aIndex] === data[bIndex]
            && data[aIndex + 1] === data[bIndex + 1]
            && data[aIndex + 2] === data[bIndex + 2]
            && data[aIndex + 3] === data[bIndex + 3];
        };
        const edgeAlpha = (ax: number, ay: number, bx: number, by: number) => {
          const aVisible = isVisible(ax, ay);
          const bVisible = isVisible(bx, by);

          if (!aVisible && !bVisible) {
            return 0;
          }

          if (aVisible && bVisible && samePixel(ax, ay, bx, by)) {
            return 0;
          }

          const aHighlighted = isHighlighted(ax, ay);
          const bHighlighted = isHighlighted(bx, by);

          if (aHighlighted !== bHighlighted) {
            return 1;
          }

          if (aHighlighted || bHighlighted) {
            return 1;
          }

          return 0;
        };

        ctx.fillStyle = 'rgba(255, 128, 0, 1)';

        for (let x = 0; x <= convertedImageData.width; x++) {
          const screenX = panX + x * zoom;
          if (screenX < 0 || screenX > canvas.width) continue;

          for (let y = 0; y < convertedImageData.height; y++) {
            const alpha = x === 0
              ? edgeAlpha(0, y, -1, y)
              : x === convertedImageData.width
                ? edgeAlpha(convertedImageData.width - 1, y, -1, y)
                : edgeAlpha(x - 1, y, x, y);

            if (alpha <= 0) continue;

            ctx.fillStyle = `rgba(255, 128, 0, ${alpha})`;
            ctx.fillRect(screenX - 0.5, panY + y * zoom, 1, Math.max(1, zoom));
          }
        }

        for (let y = 0; y <= convertedImageData.height; y++) {
          const screenY = panY + y * zoom;
          if (screenY < 0 || screenY > canvas.height) continue;

          for (let x = 0; x < convertedImageData.width; x++) {
            const alpha = y === 0
              ? edgeAlpha(x, 0, x, -1)
              : y === convertedImageData.height
                ? edgeAlpha(x, convertedImageData.height - 1, x, -1)
                : edgeAlpha(x, y - 1, x, y);

            if (alpha <= 0) continue;

            ctx.fillStyle = `rgba(255, 128, 0, ${alpha})`;
            ctx.fillRect(panX + x * zoom, screenY - 0.5, Math.max(1, zoom), 1);
          }
        }
      }
    }
  }, [convertedImageData, zoom, panX, panY, showGrid, canvasWidth, canvasHeight, toolMode, filterColor, isFullscreen]);

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

    // Store the current center point in image coordinates before zooming
    const imageCenterX = (canvasWidth / 2 - panX) / zoom;
    const imageCenterY = (canvasHeight / 2 - panY) / zoom;

    setViewportCenterX(imageCenterX);
    setViewportCenterY(imageCenterY);
    setZoomPercent(clampedPercent);
  };

  const updateSliderFill = (value: number, min: number, max: number, sliderElement?: HTMLInputElement) => {
    const fill = ((value - min) / (max - min)) * 100;
    if (sliderElement) {
      sliderElement.style.setProperty('--range-fill', `${fill}%`);
    }
  };

  const handleDownload = useCallback(() => {
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
  }, [convertedImageData, canvasSize]);

  // Force canvas redraw when entering/exiting fullscreen
  useEffect(() => {
    if (isFullscreen && canvasRef.current) {
      // Trigger immediate redraw
      setZoomPercent(prev => prev);
    }
  }, [isFullscreen]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '2rem' }}>
      {!isFullscreen && (
        <>
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
            onWheel={handleWheel}
            className={`bg-input w-full ${
              toolMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
            }`}
            style={{ imageRendering: 'pixelated', maxWidth: 'min(512px, 100%)', height: 'auto', touchAction: 'none' }}
          />

      {/* Bottom section with tools on left and grid/download on right */}
      <div className="flex w-full flex-wrap" style={{ justifyContent: 'space-between', gap: 'clamp(1rem, 3vw, 2rem)' }}>
        {/* Tools on the left */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setToolMode('pan')}
            className="px-3 py-2 rounded-lg transition-all font-bold flex items-center gap-2"
            style={{
              backgroundColor: toolMode === 'pan' ? '#FF8000' : '#FFDA85',
              color: toolMode === 'pan' ? 'white' : 'black',
              border: 'none',
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
              backgroundColor: toolMode === 'eyedropper' ? '#FF8000' : '#FFDA85',
              color: toolMode === 'eyedropper' ? 'white' : 'black',
              border: 'none',
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
              backgroundColor: toolMode === 'colorFilter' ? '#FF8000' : '#FFDA85',
              color: toolMode === 'colorFilter' ? 'white' : 'black',
              border: 'none',
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
            aria-label="Toggle pixel grid overlay"
            className="px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold"
            style={{
              backgroundColor: showGrid ? '#FF8000' : '#FFDA85',
              color: showGrid ? 'white' : 'black',
              border: 'none',
            }}
          >
            <Grid3x3 strokeWidth={3} className="w-5 h-5" />
          </button>
          <button
            onClick={handleDownload}
            title="Download as PNG"
            aria-label="Download converted image as PNG"
            className="px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold disabled:opacity-50"
            style={{
              backgroundColor: COLOR_PRIMARY,
              color: 'white',
            }}
            disabled={!convertedImageData}
          >
            <Download strokeWidth={3} className="w-5 h-5" />
            <span>Download PNG</span>
          </button>
          <button
            onClick={() => setIsFullscreen(true)}
            title="Fullscreen"
            aria-label="Open fullscreen view"
            className="px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold"
            style={{
              backgroundColor: COLOR_SECONDARY,
              color: 'black',
              border: 'none',
            }}
          >
            <Maximize2 strokeWidth={3} className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.25rem' }}>
        {/* Zoom controls centered */}
        <div className="flex w-full items-center gap-2" style={{ justifyContent: 'center' }}>
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
              margin: 0,
              marginBlock: 0,
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
            onClick={() => {
              setZoomPercent(100);
              setViewportCenterX(null);
              setViewportCenterY(null);
              setPanX(0);
              setPanY(0);
            }}
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

        <div className="text-center text-sm font-medium" style={{ marginTop: 0, color: '#000000' }}>
          Zoom: {zoomPercent}%
        </div>
      </div>
        </>
      )}

      {isFullscreen && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: COLOR_OVERLAY,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'clamp(1rem, 5vw, 2rem)',
          }}
          onClick={() => setIsFullscreen(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              boxShadow: `0 6px 0 ${COLOR_SHADOW}`,
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              width: '100%',
              height: 'calc(100vh - clamp(2rem, 10vw, 4rem))',
              gap: '0',
              position: 'relative',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Canvas - reaches edges */}
            <div style={{ flex: '1 1 0', minHeight: 0, padding: 'clamp(1rem, 3vw, 1.5rem)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                onWheel={handleWheel}
                className={`bg-input ${
                  toolMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
                }`}
                style={{ imageRendering: 'pixelated', width: '100%', height: '100%', touchAction: 'none', display: 'block', objectFit: 'contain' }}
              />
            </div>

                        {/* Bottom section: Tools on left | Zoom Controls in middle | Grid/Download/Close on right */}
             <div className="flex w-full items-center gap-2" style={{ marginTop: 'auto', flexWrap: 'wrap', justifyContent: 'center', gap: 'clamp(0.5rem, 2vw, 1rem)', padding: 'clamp(1rem, 3vw, 1.5rem)', paddingTop: 'clamp(0.75rem, 2vw, 1rem)', backgroundColor: 'white', flexShrink: 0 }}>
               {/* Tools on the left */}
               <div className="flex gap-2 flex-wrap">
                 <button
                   onClick={() => setToolMode('pan')}
                   className="px-3 py-2 rounded-lg transition-all font-bold flex items-center gap-2"
                   style={{
                     backgroundColor: toolMode === 'pan' ? COLOR_PRIMARY : COLOR_SECONDARY,
                     color: toolMode === 'pan' ? 'white' : 'black',
                     border: 'none',
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
                     backgroundColor: toolMode === 'eyedropper' ? COLOR_PRIMARY : COLOR_SECONDARY,
                     color: toolMode === 'eyedropper' ? 'white' : 'black',
                     border: 'none',
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
                     backgroundColor: toolMode === 'colorFilter' ? COLOR_PRIMARY : COLOR_SECONDARY,
                     color: toolMode === 'colorFilter' ? 'white' : 'black',
                     border: 'none',
                   }}
                   title="Color filter mode (click to select color to highlight)"
                 >
                   <Wand2 strokeWidth={3} className="w-5 h-5" />
                   Filter
                 </button>
               </div>

               {/* Zoom controls in the middle */}
               <div className="flex gap-2 items-center" style={{ flexShrink: 1, justifyContent: 'center', minWidth: 0, maxWidth: '400px' }}>
                 <button
                   onClick={() => handleZoomChange(zoomPercent - 10)}
                   title="Zoom out"
                   className="px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 font-bold"
                   style={{
                     color: COLOR_TEXT,
                     flexShrink: 0
                   }}
                   onMouseEnter={(e) => (e.currentTarget.style.color = COLOR_PRIMARY)}
                   onMouseLeave={(e) => (e.currentTarget.style.color = COLOR_TEXT)}
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
                     accentColor: COLOR_PRIMARY,
                     appearance: 'none',
                     flex: 1,
                     height: '8px',
                     margin: 0,
                     marginBlock: 0,
                     borderRadius: '4px',
                     outline: 'none',
                     WebkitAppearance: 'none',
                     '--range-fill': `${((zoomPercent - 10) / (1000 - 10)) * 100}%`,
                     minWidth: 'clamp(80px, 20vw, 200px)'
                   } as React.CSSProperties}
                 />
                 <button
                   onClick={() => handleZoomChange(zoomPercent + 10)}
                   title="Zoom in"
                   className="px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 font-bold"
                   style={{
                     color: COLOR_TEXT,
                     flexShrink: 0
                   }}
                   onMouseEnter={(e) => (e.currentTarget.style.color = COLOR_PRIMARY)}
                   onMouseLeave={(e) => (e.currentTarget.style.color = COLOR_TEXT)}
                 >
                   <ZoomIn strokeWidth={3} className="w-5 h-5" />
                 </button>
                 <button
                   onClick={() => {
                     setZoomPercent(100);
                     setViewportCenterX(null);
                     setViewportCenterY(null);
                     setPanX(0);
                     setPanY(0);
                   }}
                   title="Reset zoom"
                   className="px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold"
                   style={{
                     color: COLOR_TEXT,
                     flexShrink: 0
                   }}
                   onMouseEnter={(e) => (e.currentTarget.style.color = COLOR_PRIMARY)}
                   onMouseLeave={(e) => (e.currentTarget.style.color = COLOR_TEXT)}
                 >
                   <RotateCcw strokeWidth={3} className="w-5 h-5" />
                 </button>
                 <span className="text-sm text-muted-foreground font-medium" style={{ flexShrink: 0, minWidth: '60px', textAlign: 'center' }}>
                   {zoomPercent}%
                 </span>
               </div>

               {/* Grid, Download, and Close on the right */}
               <div className="flex gap-2 flex-wrap" style={{ flexShrink: 0 }}>
                 <button
                   onClick={() => onToggleGrid(!showGrid)}
                   title="Toggle grid overlay"
                   aria-label="Toggle pixel grid overlay"
                   className="px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold"
                   style={{
                     backgroundColor: showGrid ? COLOR_PRIMARY : COLOR_SECONDARY,
                     color: showGrid ? 'white' : 'black',
                     border: 'none',
                   }}
                 >
                   <Grid3x3 strokeWidth={3} className="w-5 h-5" />
                 </button>
                 <button
                   onClick={handleDownload}
                   title="Download as PNG"
                   aria-label="Download converted image as PNG"
                   className="px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold disabled:opacity-50"
                   style={{
                     backgroundColor: COLOR_PRIMARY,
                     color: 'white',
                   }}
                   disabled={!convertedImageData}
                 >
                   <Download strokeWidth={3} className="w-5 h-5" />
                   <span>Download PNG</span>
                 </button>
                 <button
                   onClick={() => setIsFullscreen(false)}
                   title="Close fullscreen"
                   aria-label="Close fullscreen view"
                   className="px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold"
                   style={{
                     backgroundColor: '#FFDA85',
                     color: 'black',
                     border: 'none',
                   }}
                 >
                   <X strokeWidth={3} className="w-5 h-5" />
                 </button>
               </div>
             </div>

          </div>
        </div>,
        document.body
      )}

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
