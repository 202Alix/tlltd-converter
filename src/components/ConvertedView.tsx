import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, RotateCcw, Grid3x3, Download, Hand, Pipette, Wand2, Maximize2, X } from 'lucide-react';
import { findClosestColor } from '../lib/colorUtils';
import { PALETTES } from '../lib/palettes';
import { CANVAS_SIZES, CanvasSizeKey } from '../lib/palettes';
import { TYPOGRAPHY } from '../lib/typography';

const hexToIngameHSB = (hex: string): { h: number; s: number; b: number } => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // Brightness: gamma-2.0 on max sRGB component
  const B = Math.round(max * max * 110);

  // Saturation: sRGB delta/max raised to 1/2.2 (gamma-encoded saturation)
  const S = max === 0 ? 0 : Math.round(Math.pow(delta / max, 1 / 2.2) * 211);

  // Hue: HSV hue computed in gamma-1.8 linearized RGB, then inverted
  // H=201 is the sentinel for achromatic colors (confirmed: red, gray, black all give H=201)
  let hDeg = 0;
  if (delta > 0) {
    const rl = Math.pow(r, 1.8);
    const gl = Math.pow(g, 1.8);
    const bl = Math.pow(b, 1.8);
    const maxL = Math.max(rl, gl, bl);
    const dL = maxL - Math.min(rl, gl, bl);
    if (dL > 0) {
      let raw: number;
      if (maxL === rl)      raw = ((gl - bl) / dL + 6) % 6;
      else if (maxL === gl) raw = (bl - rl) / dL + 2;
      else                  raw = (rl - gl) / dL + 4;
      hDeg = raw * 60;
    }
  }
  const H = delta === 0 ? 201 : Math.round(((360 - hDeg) / 360) * 201);

  return { h: H, s: S, b: B };
};

// Color constants
const COLOR_PRIMARY = '#FF8000';
const COLOR_OVERLAY = 'rgba(0, 0, 0, 0.7)';
const COLOR_SHADOW = 'var(--app-accent)';

interface ConvertedViewProps {
  convertedImageData: ImageData;
  showGrid: boolean;
  onToggleGrid: (show: boolean) => void;
  canvasSize: CanvasSizeKey;
  paletteMode: 'default' | 'colorRange';
  isProcessing?: boolean;
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
  isProcessing = false,
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
  const [exportScale, setExportScale] = useState(1);
  const [copiedTooltip, setCopiedTooltip] = useState(false);

  const paletteColors = PALETTES.palette1.colors;

  const colorSummary = useMemo(() => {
    const counts = new Map<string, number>();
    const data = convertedImageData.data;
    let totalVisible = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      totalVisible++;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
    if (totalVisible === 0) return [];
    return Array.from(counts.entries())
      .map(([hex, count]) => {
        const pct = count / totalVisible;
        if (paletteMode === 'default') {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          const closest = findClosestColor([r, g, b], paletteColors);
          return { hex, pct, row: Math.floor(closest.index / 12) + 1, col: (closest.index % 12) + 1 };
        }
        return { hex, pct, row: -1, col: -1 };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [convertedImageData, paletteMode]);

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
  const canvasWidth = 400;
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
        case 'p':
        case 'P':
          e.preventDefault();
          setToolMode('pan');
          break;
        case 'e':
        case 'E':
          e.preventDefault();
          setToolMode(toolMode === 'eyedropper' ? 'pan' : 'eyedropper');
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          setToolMode(toolMode === 'colorFilter' ? 'pan' : 'colorFilter');
          break;
        case 'g':
        case 'G':
          e.preventDefault();
          onToggleGrid(!showGrid);
          break;
        case 'Escape':
          setTooltip(null);
          setToolMode('pan');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toolMode, zoomPercent, showGrid, onToggleGrid]);

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
    if (!convertedImageData) return;
    const src = document.createElement('canvas');
    src.width = convertedImageData.width;
    src.height = convertedImageData.height;
    const srcCtx = src.getContext('2d');
    if (!srcCtx) return;
    srcCtx.putImageData(convertedImageData, 0, 0);

    const out = document.createElement('canvas');
    out.width = convertedImageData.width * exportScale;
    out.height = convertedImageData.height * exportScale;
    const outCtx = out.getContext('2d');
    if (!outCtx) return;
    outCtx.imageSmoothingEnabled = false;
    outCtx.drawImage(src, 0, 0, out.width, out.height);

    const link = document.createElement('a');
    link.download = `tomodachi-${canvasSize}${exportScale > 1 ? `@${exportScale}x` : ''}.png`;
    link.href = out.toDataURL();
    link.click();
  }, [convertedImageData, canvasSize, exportScale]);

  const handleCopyTooltip = useCallback(() => {
    if (!tooltip) return;
    const text = paletteMode === 'default'
      ? `Row ${tooltip.row}, Col ${tooltip.col}`
      : tooltip.color.toUpperCase();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTooltip(true);
      setTimeout(() => setCopiedTooltip(false), 1500);
    });
  }, [tooltip, paletteMode]);

  // Force canvas redraw when entering/exiting fullscreen
  useEffect(() => {
    if (isFullscreen && canvasRef.current) {
      // Trigger immediate redraw
      setZoomPercent(prev => prev);
    }
  }, [isFullscreen]);

  return (
    <div className="flex w-full flex-col items-stretch gap-8">
      {!isFullscreen && (
        <>
          <div className="flex w-full flex-col gap-8 rounded-2xl bg-(--app-panel-bg) p-4 shadow-[0_8px_0_var(--app-divider)]">
          <div className="relative flex w-full justify-center">
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
              style={{ imageRendering: 'pixelated', width: '100%', maxWidth: `${canvasWidth}px`, height: 'auto', touchAction: 'none', display: 'block' }}
            />
            {isProcessing && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--app-processing-overlay)', borderRadius: '4px' }}>
                <div className="animate-spin" style={{ width: '28px', height: '28px', borderRadius: '50%', border: '3px solid var(--app-accent)', borderTopColor: '#FF8000' }} />
              </div>
            )}
          </div>

      {/* Bottom section with tools on left and grid/download on right */}
      <div className="flex w-full flex-wrap justify-between gap-3">
        {/* Tools on the left */}
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <button
            onClick={() => setToolMode('pan')}
            className={`px-3 py-2 rounded-lg font-bold flex items-center gap-2 btn-tool${toolMode === 'pan' ? ' btn-tool--active' : ''}`}
            style={{ border: 'none' }}
            title="Pan mode — P"
          >
            <Hand strokeWidth={3} className="w-5 h-5" />
            Pan
            <kbd style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(0,0,0,0.15)', fontFamily: 'monospace', fontWeight: 400 }}>P</kbd>
          </button>
          <button
            onClick={() => setToolMode(toolMode === 'eyedropper' ? 'pan' : 'eyedropper')}
            className={`px-3 py-2 rounded-lg font-bold flex items-center gap-2 btn-tool${toolMode === 'eyedropper' ? ' btn-tool--active' : ''}`}
            style={{ border: 'none' }}
            title="Pick color — E"
          >
            <Pipette strokeWidth={3} className="w-5 h-5" />
            Pick Color
            <kbd style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(0,0,0,0.15)', fontFamily: 'monospace', fontWeight: 400 }}>E</kbd>
          </button>
          <button
            onClick={() => setToolMode(toolMode === 'colorFilter' ? 'pan' : 'colorFilter')}
            className={`px-3 py-2 rounded-lg font-bold flex items-center gap-2 btn-tool${toolMode === 'colorFilter' ? ' btn-tool--active' : ''}`}
            style={{ border: 'none' }}
            title="Color filter — F"
          >
            <Wand2 strokeWidth={3} className="w-5 h-5" />
            Filter
            <kbd style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(0,0,0,0.15)', fontFamily: 'monospace', fontWeight: 400 }}>F</kbd>
          </button>
        </div>

        {/* Grid, scale, download, fullscreen on the right */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => onToggleGrid(!showGrid)}
            title="Toggle grid — G"
            aria-label="Toggle pixel grid overlay"
            className={`px-3 py-2 rounded-lg flex items-center gap-2 font-bold btn-tool${showGrid ? ' btn-tool--active' : ''}`}
            style={{ border: 'none' }}
          >
            <Grid3x3 strokeWidth={3} className="w-5 h-5" />
          </button>
          {/* Export scale segmented control */}
          <div className="btn-segment-track flex gap-1 rounded-lg p-1">
            {[1, 2, 4].map(s => (
              <button
                key={s}
                onClick={() => setExportScale(s)}
                className={`btn-segment${exportScale === s ? ' btn-segment--active' : ''}`}
                style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {s}×
              </button>
            ))}
          </div>
          <button
            onClick={handleDownload}
            title="Download as PNG"
            aria-label="Download converted image as PNG"
            className="px-4 py-2 rounded-lg flex items-center gap-2 font-bold disabled:opacity-50 btn-action"
            style={{ border: 'none' }}
            disabled={!convertedImageData}
          >
            <Download strokeWidth={3} className="w-5 h-5" />
            <span>Download PNG</span>
          </button>
          <button
            onClick={() => setIsFullscreen(true)}
            title="Fullscreen"
            aria-label="Open fullscreen view"
            className="px-3 py-2 rounded-lg flex items-center gap-2 font-bold btn-action"
            style={{ border: 'none' }}
          >
            <Maximize2 strokeWidth={3} className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex w-full flex-col gap-1">
        {/* Zoom controls centered */}
        <div className="flex w-full items-center gap-2">
          <button
            onClick={() => handleZoomChange(zoomPercent - 10)}
            title="Zoom out"
            className="px-3 py-2 rounded-lg flex items-center justify-center gap-2 font-bold btn-icon"
            style={{ flexShrink: 0 }}
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
            className="px-3 py-2 rounded-lg flex items-center justify-center gap-2 font-bold btn-icon"
            style={{ flexShrink: 0 }}
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
            className="px-3 py-2 rounded-lg flex items-center gap-2 font-bold btn-icon"
            style={{ flexShrink: 0 }}
          >
            <RotateCcw strokeWidth={3} className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center text-sm font-medium text-(--app-text)">
          Zoom: {zoomPercent}%
        </div>
      </div>

          </div>

          {colorSummary.length > 0 && (
            <div style={{ backgroundColor: 'var(--app-panel-bg)', borderRadius: '16px', boxShadow: '0 8px 0 var(--app-divider)', padding: '1rem', width: '100%' }}>
              <h3 className={TYPOGRAPHY.h3} style={{ color: 'var(--app-text)', marginBottom: '8px' }}>
                {colorSummary.length} color{colorSummary.length !== 1 ? 's' : ''} used
              </h3>
              {paletteMode === 'default' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                  {colorSummary.map(({ hex, pct, row, col }) => {
                    const isActive = toolMode === 'colorFilter' && filterColor === hex;
                    return (
                      <div
                        key={hex}
                        role="button"
                        tabIndex={0}
                        aria-label={`Filter by Row ${row}, Col ${col}`}
                        onClick={() => {
                          if (isActive) { setFilterColor(null); setToolMode('pan'); }
                          else { setFilterColor(hex); setToolMode('colorFilter'); }
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--app-btn-inactive-bg)',
                          border: `2px solid ${isActive ? '#FF8000' : 'transparent'}`,
                          cursor: 'pointer',
                          transition: 'border-color 0.15s',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: hex, border: '2px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--app-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Row {row}, Col {col}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--app-text-sub)' }}>
                            {Math.round(pct * 100)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                  {colorSummary.map(({ hex, pct }) => {
                    const isActive = toolMode === 'colorFilter' && filterColor === hex;
                    const hsb = hexToIngameHSB(hex);
                    return (
                      <div
                        key={hex}
                        role="button"
                        tabIndex={0}
                        aria-label={`Filter by ${hex}`}
                        onClick={() => {
                          if (isActive) { setFilterColor(null); setToolMode('pan'); }
                          else { setFilterColor(hex); setToolMode('colorFilter'); }
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
                        style={{
                          padding: '10px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--app-btn-inactive-bg)',
                          border: `2px solid ${isActive ? '#FF8000' : 'transparent'}`,
                          cursor: 'pointer',
                          transition: 'border-color 0.15s',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: hex, border: '2px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--app-text)' }}>{hex}</div>
                            <div style={{ fontSize: '11px', color: 'var(--app-text-sub)' }}>{Math.round(pct * 100)}%</div>
                          </div>
                        </div>
                        {([
                          { label: 'H', value: hsb.h, max: 201 },
                          { label: 'S', value: hsb.s, max: 211 },
                          { label: 'B', value: hsb.b, max: 110 },
                        ] as const).map(({ label, value, max }) => (
                          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--app-text-sub)', width: '12px', flexShrink: 0 }}>{label}</span>
                            <div style={{ flex: 1, height: '4px', backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(value / max) * 100}%`, backgroundColor: hex }} />
                            </div>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--app-text)', width: '28px', textAlign: 'right', flexShrink: 0 }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
              backgroundColor: 'var(--app-panel-bg)',
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
             <div className="flex w-full items-center gap-2" style={{ marginTop: 'auto', flexWrap: 'wrap', justifyContent: 'center', gap: 'clamp(0.5rem, 2vw, 1rem)', padding: 'clamp(1rem, 3vw, 1.5rem)', paddingTop: 'clamp(0.75rem, 2vw, 1rem)', backgroundColor: 'var(--app-panel-bg)', flexShrink: 0 }}>
               {/* Tools on the left */}
               <div className="flex gap-2 flex-wrap">
                 <button
                   onClick={() => setToolMode('pan')}
                   className={`px-3 py-2 rounded-lg font-bold flex items-center gap-2 btn-tool${toolMode === 'pan' ? ' btn-tool--active' : ''}`}
                   style={{ border: 'none' }}
                   title="Pan mode — P"
                 >
                   <Hand strokeWidth={3} className="w-5 h-5" />
                   Pan
                   <kbd style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(0,0,0,0.15)', fontFamily: 'monospace', fontWeight: 400 }}>P</kbd>
                 </button>
                 <button
                   onClick={() => setToolMode(toolMode === 'eyedropper' ? 'pan' : 'eyedropper')}
                   className={`px-3 py-2 rounded-lg font-bold flex items-center gap-2 btn-tool${toolMode === 'eyedropper' ? ' btn-tool--active' : ''}`}
                   style={{ border: 'none' }}
                   title="Pick color — E"
                 >
                   <Pipette strokeWidth={3} className="w-5 h-5" />
                   Pick Color
                   <kbd style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(0,0,0,0.15)', fontFamily: 'monospace', fontWeight: 400 }}>E</kbd>
                 </button>
                 <button
                   onClick={() => setToolMode(toolMode === 'colorFilter' ? 'pan' : 'colorFilter')}
                   className={`px-3 py-2 rounded-lg font-bold flex items-center gap-2 btn-tool${toolMode === 'colorFilter' ? ' btn-tool--active' : ''}`}
                   style={{ border: 'none' }}
                   title="Color filter — F"
                 >
                   <Wand2 strokeWidth={3} className="w-5 h-5" />
                   Filter
                   <kbd style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(0,0,0,0.15)', fontFamily: 'monospace', fontWeight: 400 }}>F</kbd>
                 </button>
               </div>

               {/* Zoom controls in the middle */}
               <div className="flex gap-2 items-center" style={{ flexShrink: 1, justifyContent: 'center', minWidth: 0, maxWidth: '400px' }}>
                 <button
                   onClick={() => handleZoomChange(zoomPercent - 10)}
                   title="Zoom out"
                   className="px-3 py-2 rounded-lg flex items-center justify-center gap-2 font-bold btn-icon"
                   style={{ flexShrink: 0 }}
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
                   className="px-3 py-2 rounded-lg flex items-center justify-center gap-2 font-bold btn-icon"
                   style={{ flexShrink: 0 }}
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
                   className="px-3 py-2 rounded-lg flex items-center gap-2 font-bold btn-icon"
                   style={{ flexShrink: 0 }}
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
                   className={`px-3 py-2 rounded-lg flex items-center gap-2 font-bold btn-tool${showGrid ? ' btn-tool--active' : ''}`}
                   style={{ border: 'none' }}
                 >
                   <Grid3x3 strokeWidth={3} className="w-5 h-5" />
                 </button>
                 <button
                   onClick={handleDownload}
                   title="Download as PNG"
                   aria-label="Download converted image as PNG"
                   className="px-4 py-2 rounded-lg flex items-center gap-2 font-bold disabled:opacity-50 btn-action"
                   style={{ border: 'none' }}
                   disabled={!convertedImageData}
                 >
                   <Download strokeWidth={3} className="w-5 h-5" />
                   <span>Download PNG</span>
                 </button>
                 <button
                   onClick={() => setIsFullscreen(false)}
                   title="Close fullscreen"
                   aria-label="Close fullscreen view"
                   className="px-3 py-2 rounded-lg flex items-center gap-2 font-bold btn-action"
                   style={{ border: 'none' }}
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
          onClick={handleCopyTooltip}
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
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', border: '2px solid white', borderRadius: '8px', backgroundColor: tooltip.color }} />
            <div>
              {paletteMode === 'colorRange' ? (
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{tooltip.color.toUpperCase()}</div>
              ) : (
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>Row {tooltip.row}, Col {tooltip.col}</div>
              )}
              <div style={{ fontSize: '11px', color: copiedTooltip ? '#8ffe3c' : '#aaa', marginTop: '3px' }}>
                {copiedTooltip ? 'Copied!' : 'Click to copy'}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
