import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { CANVAS_SIZES, CanvasSizeKey } from '../lib/palettes';
import { Tooltip } from './Tooltip';

interface CanvasPreviewProps {
  sourceImageData: ImageData;
  canvasSize: CanvasSizeKey;
  positionX: number;
  positionY: number;
  onCropChange: (x: number, y: number, width: number, height: number) => void;
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  sourceImageData,
  canvasSize,
  positionX,
  positionY,
  onCropChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [touchDistance, setTouchDistance] = useState(0);

  const contentBounds = useMemo(() => {
    const { data, width, height } = sourceImageData;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        if (data[index + 3] === 0) {
          continue;
        }

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX < minX || maxY < minY) {
      return { x: 0, y: 0, width, height };
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }, [sourceImageData]);

  const targetSize = CANVAS_SIZES[canvasSize];
  const targetAspectRatio = targetSize.width / targetSize.height;

  // Viewport size matches target canvas aspect ratio - 2x larger
  const viewportWidth = 600;
  const viewportHeight = viewportWidth / targetAspectRatio;

  // Calculate base scale using largest dimension (Math.max) so image fills viewport
  const baseScaleX = viewportWidth / contentBounds.width;
  const baseScaleY = viewportHeight / contentBounds.height;
  const baseScale = Math.max(baseScaleX, baseScaleY);

  // Store the center point of what's visible in the image (in image coordinates)
  const [viewportCenterX, setViewportCenterX] = useState<number | null>(null);
  const [viewportCenterY, setViewportCenterY] = useState<number | null>(null);

  // Initialize pan to center the image
  useEffect(() => {
    const zoom = (zoomPercent / 100) * baseScale;

    let newPanX: number;
    let newPanY: number;

    // If we have a stored center point, keep it in view; otherwise center the image
    if (viewportCenterX !== null && viewportCenterY !== null) {
      newPanX = (viewportWidth / 2) - (viewportCenterX * zoom);
      newPanY = (viewportHeight / 2) - (viewportCenterY * zoom);
    } else {
      // Initial centering
      const scaledWidth = contentBounds.width * zoom;
      const scaledHeight = contentBounds.height * zoom;
      newPanX = (viewportWidth - scaledWidth) / 2;
      newPanY = (viewportHeight - scaledHeight) / 2;
    }

    setPanX(newPanX);
    setPanY(newPanY);

    // Initialize slider fill
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
      if ((slider as HTMLInputElement).min === '10' && (slider as HTMLInputElement).max === '1000') {
        const val = parseInt((slider as HTMLInputElement).value);
        updateSliderFill(val, 10, 1000, slider as HTMLInputElement);
      }
    });
  }, [sourceImageData, zoomPercent, baseScale, viewportWidth, viewportHeight, viewportCenterX, viewportCenterY, contentBounds.width, contentBounds.height]);

  // Store the capture values in state
  const [captureValues, setCaptureValues] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Draw the preview - this is exactly what will be converted
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = viewportWidth;
    canvas.height = viewportHeight;

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

    // Draw the source image at current zoom and pan
    const zoom = (zoomPercent / 100) * baseScale;
    const scaledWidth = contentBounds.width * zoom;
    const scaledHeight = contentBounds.height * zoom;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sourceImageData.width;
    tempCanvas.height = sourceImageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(sourceImageData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tempCanvas, panX - (contentBounds.x * zoom), panY - (contentBounds.y * zoom), sourceImageData.width * zoom, sourceImageData.height * zoom);
    }

    // Convert the current placement into target-canvas coordinates.
    const scaleX = targetSize.width / viewportWidth;
    const scaleY = targetSize.height / viewportHeight;
    const captureX = (panX - (contentBounds.x * zoom)) * scaleX;
    const captureY = (panY - (contentBounds.y * zoom)) * scaleY;
    const captureWidth = sourceImageData.width * zoom * scaleX;
    const captureHeight = sourceImageData.height * zoom * scaleY;

    setCaptureValues({ x: captureX, y: captureY, width: captureWidth, height: captureHeight });
  }, [sourceImageData, zoomPercent, panX, panY, viewportWidth, viewportHeight, baseScale, contentBounds.x, contentBounds.y, contentBounds.width, contentBounds.height]);

  // Notify parent only when capture values actually change - with debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      onCropChange(captureValues.x, captureValues.y, captureValues.width, captureValues.height);
    }, 300);

    return () => clearTimeout(timeout);
  }, [captureValues, onCropChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const zoom = (zoomPercent / 100) * baseScale;
    const scaledWidth = contentBounds.width * zoom;
    const scaledHeight = contentBounds.height * zoom;

    // Allow panning even when image is smaller than viewport
    const maxX = Math.max(viewportWidth - scaledWidth, 0);
    const maxY = Math.max(viewportHeight - scaledHeight, 0);
    const minX = Math.min(0, viewportWidth - scaledWidth);
    const minY = Math.min(0, viewportHeight - scaledHeight);

    const newX = Math.max(minX, Math.min(maxX, e.clientX - dragOffset.x));
    const newY = Math.max(minY, Math.min(maxY, e.clientY - dragOffset.y));

    setPanX(newX);
    setPanY(newY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      // Pinch zoom (trackpad pinch or wheel with ctrl/cmd)
      const zoomDelta = e.deltaY > 0 ? -10 : 10;
      handleZoomChange(zoomPercent + zoomDelta);
    } else {
      // Trackpad two-finger scroll for panning
      const zoom = (zoomPercent / 100) * baseScale;
      const scaledWidth = contentBounds.width * zoom;
      const scaledHeight = contentBounds.height * zoom;

      const maxX = Math.max(viewportWidth - scaledWidth, 0);
      const maxY = Math.max(viewportHeight - scaledHeight, 0);
      const minX = Math.min(0, viewportWidth - scaledWidth);
      const minY = Math.min(0, viewportHeight - scaledHeight);

      const newX = Math.max(minX, Math.min(maxX, panX - e.deltaX));
      const newY = Math.max(minY, Math.min(maxY, panY - e.deltaY));

      setPanX(newX);
      setPanY(newY);
    }
  };

  const handleGestureChange = (e: any) => {
    // Safari/iOS gesture events for pinch zoom
    e.preventDefault();
    e.stopPropagation();
    const scaleFactor = e.scale;
    if (scaleFactor !== 1) {
      const zoomDelta = scaleFactor > 1 ? 20 : -20;
      handleZoomChange(zoomPercent + zoomDelta);
    }
  };

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

  const getTouchDistance = (touches: any) => {
    if (touches.length !== 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragOffset({ x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY });
    } else if (e.touches.length === 2) {
      setTouchDistance(getTouchDistance(e.touches));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      const zoom = (zoomPercent / 100) * baseScale;
      const scaledWidth = contentBounds.width * zoom;
      const scaledHeight = contentBounds.height * zoom;

      const maxX = Math.max(viewportWidth - scaledWidth, 0);
      const maxY = Math.max(viewportHeight - scaledHeight, 0);
      const minX = Math.min(0, viewportWidth - scaledWidth);
      const minY = Math.min(0, viewportHeight - scaledHeight);

      const newX = Math.max(minX, Math.min(maxX, e.touches[0].clientX - dragOffset.x));
      const newY = Math.max(minY, Math.min(maxY, e.touches[0].clientY - dragOffset.y));

      setPanX(newX);
      setPanY(newY);
    } else if (e.touches.length === 2) {
      const newDistance = getTouchDistance(e.touches);
      if (touchDistance > 0) {
        const scale = newDistance / touchDistance;
        const newZoom = Math.round(Math.max(10, Math.min(1000, zoomPercent * scale)));
        handleZoomChange(newZoom);
        setTouchDistance(newDistance);
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchDistance(0);
  };

  const handleZoomChange = (newPercent: number) => {
    // Store the current center point in image coordinates before zooming
    const currentZoom = (zoomPercent / 100) * baseScale;
    const imageCenterX = (viewportWidth / 2 - panX) / currentZoom;
    const imageCenterY = (viewportHeight / 2 - panY) / currentZoom;

    setViewportCenterX(imageCenterX);
    setViewportCenterY(imageCenterY);
    setZoomPercent(Math.max(10, Math.min(1000, Math.round(newPercent))));
  };

  const updateSliderFill = (value: number, min: number, max: number, sliderElement?: HTMLInputElement) => {
    const fill = ((value - min) / (max - min)) * 100;
    if (sliderElement) {
      sliderElement.style.setProperty('--range-fill', `${fill}%`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className="w-full cursor-move bg-input"
        style={{ maxWidth: '512px', height: 'auto', touchAction: 'none' }}
      />
      <div className="text-center text-sm font-medium" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3.25rem', flexWrap: 'nowrap', justifyContent: 'center', color: '#000000', whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 400, color: '#000000' }}>Position:</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 400, color: '#000000' }}>
          <span style={{ fontWeight: 400, color: '#000000' }}>x:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#FFF3CC', color: '#000000', fontSize: 'inherit', fontWeight: 400, lineHeight: 1, whiteSpace: 'nowrap' }}>
            {Math.round(positionX)}
          </span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 400, color: '#000000' }}>
          <span style={{ fontWeight: 400, color: '#000000' }}>y:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#FFF3CC', color: '#000000', fontSize: 'inherit', fontWeight: 400, lineHeight: 1, whiteSpace: 'nowrap' }}>
            {Math.round(positionY)}
          </span>
        </span>
        <Tooltip text="These values show where the image is positioned on the converted canvas. Use them to place the image in the same spot again." />
      </div>
      <div className="flex gap-2 items-center" style={{ justifyContent: 'center', marginTop: '2rem', width: '100%' }}>
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
          title="Reset zoom and position"
          className="px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold"
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
      <div className="text-center text-sm font-medium" style={{ marginTop: '1rem', color: '#000000' }}>
        Zoom: {zoomPercent}%
      </div>
    </div>
  );
};
