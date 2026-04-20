import React, { useRef, useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { CANVAS_SIZES, CanvasSizeKey } from '../lib/palettes';

interface CanvasPreviewProps {
  sourceImageData: ImageData;
  canvasSize: CanvasSizeKey;
  onCropChange: (x: number, y: number, width: number, height: number) => void;
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  sourceImageData,
  canvasSize,
  onCropChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [touchDistance, setTouchDistance] = useState(0);

  const targetSize = CANVAS_SIZES[canvasSize];
  const targetAspectRatio = targetSize.width / targetSize.height;

  // Viewport size matches target canvas aspect ratio - 2x larger
  const viewportWidth = 600;
  const viewportHeight = viewportWidth / targetAspectRatio;

  // Calculate base scale using largest dimension (Math.max) so image fills viewport
  const baseScaleX = viewportWidth / sourceImageData.width;
  const baseScaleY = viewportHeight / sourceImageData.height;
  const baseScale = Math.max(baseScaleX, baseScaleY);

  // Initialize pan to center the image
  useEffect(() => {
    const zoom = (zoomPercent / 100) * baseScale;
    const scaledWidth = sourceImageData.width * zoom;
    const scaledHeight = sourceImageData.height * zoom;

    // Center the image in the viewport
    const centerX = (viewportWidth - scaledWidth) / 2;
    const centerY = (viewportHeight - scaledHeight) / 2;

    setPanX(centerX);
    setPanY(centerY);

    // Initialize slider fill
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
      if ((slider as HTMLInputElement).min === '10' && (slider as HTMLInputElement).max === '1000') {
        const val = parseInt((slider as HTMLInputElement).value);
        updateSliderFill(val, 10, 1000, slider as HTMLInputElement);
      }
    });
  }, [sourceImageData, zoomPercent, baseScale]);

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

    // Clear canvas to gray background
    ctx.fillStyle = '#ddd';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the source image at current zoom and pan
    const zoom = (zoomPercent / 100) * baseScale;
    const scaledWidth = sourceImageData.width * zoom;
    const scaledHeight = sourceImageData.height * zoom;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sourceImageData.width;
    tempCanvas.height = sourceImageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(sourceImageData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tempCanvas, panX, panY, scaledWidth, scaledHeight);
    }

    // Calculate what portion will actually be captured
    const captureX = Math.max(0, -panX / zoom);
    const captureY = Math.max(0, -panY / zoom);
    const captureWidth = viewportWidth / zoom;
    const captureHeight = viewportHeight / zoom;

    setCaptureValues({ x: captureX, y: captureY, width: captureWidth, height: captureHeight });
  }, [sourceImageData, zoomPercent, panX, panY, viewportWidth, viewportHeight, baseScale]);

  // Notify parent only when capture values actually change
  useEffect(() => {
    onCropChange(captureValues.x, captureValues.y, captureValues.width, captureValues.height);
  }, [captureValues, onCropChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const zoom = (zoomPercent / 100) * baseScale;
    const scaledWidth = sourceImageData.width * zoom;
    const scaledHeight = sourceImageData.height * zoom;

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
      const scaledWidth = sourceImageData.width * zoom;
      const scaledHeight = sourceImageData.height * zoom;

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
    const clampedPercent = Math.max(10, Math.min(1000, Math.round(newPercent)));
    setZoomPercent(clampedPercent);
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
        className="w-full cursor-move bg-input"
        style={{ maxWidth: '512px', height: 'auto', touchAction: 'none' }}
      />
      <div className="flex gap-2 items-center" style={{ justifyContent: 'center', marginTop: '16px', width: '100%' }}>
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
          onClick={() => {
            setZoomPercent(100);
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
      <div className="text-center text-sm text-muted-foreground font-medium" style={{ marginTop: '8px' }}>
        Zoom: {zoomPercent}%
      </div>
    </div>
  );
};
