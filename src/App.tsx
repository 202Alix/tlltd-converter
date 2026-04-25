import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, ChevronLeft } from 'lucide-react';
import LogoUrl from './assets/Logo_ResizeMee.svg';
import { ImageUpload } from './components/ImageUpload';
import { ControlPanel } from './components/ControlPanel';
import { CanvasPreview } from './components/CanvasPreview';
import { ConvertedView } from './components/ConvertedView';
import { CanvasSelector } from './components/CanvasSelector';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { License } from './pages/License';
import { Contact } from './pages/Contact';
import { processImage } from './lib/imageProcessor';
import { CANVAS_SIZES, PALETTES, CanvasSizeKey } from './lib/palettes';
import { QuantizationMethod } from './lib/quantizer';
import { DetailLevel } from './lib/imageProcessor';
import { Tooltip } from './components/Tooltip';

type PageType = 'app' | 'privacy' | 'terms' | 'license' | 'contact';

const SECTION_DIVIDER = '1px solid #eeedef';
const PANEL_PADDING = '1.25rem 1.5rem';

const PanelSection: React.FC<{
  title: string;
  titleExtra?: React.ReactNode;
  children: React.ReactNode;
  noDivider?: boolean;
}> = ({ title, titleExtra, children, noDivider }) => (
  <div style={{ borderBottom: noDivider ? 'none' : SECTION_DIVIDER }}>
    <div style={{ padding: PANEL_PADDING, paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'black', letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      {titleExtra}
    </div>
    <div style={{ padding: PANEL_PADDING, paddingTop: '0.75rem' }}>
      {children}
    </div>
  </div>
);

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('app');
  const [sourceImageData, setSourceImageData] = useState<ImageData | null>(null);
  const [originalImageSize, setOriginalImageSize] = useState<{ width: number; height: number } | null>(null);
  const [selectedCanvasSize, setSelectedCanvasSize] = useState<CanvasSizeKey>('Anything');
  const [quantizationMethod, setQuantizationMethod] = useState<QuantizationMethod>('nearest-color');
  const [convertedImageData, setConvertedImageData] = useState<ImageData | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [cropParams, setCropParams] = useState({ x: 0, y: 0, width: 306, height: 306 });
  const [paletteMode, setPaletteMode] = useState<'default' | 'colorRange'>('default');
  const [maxColors, setMaxColors] = useState<number | null>(null);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(1);

  const detailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDetailLevelChange = useCallback((level: DetailLevel) => {
    setDetailLevel(level);
    if (detailDebounceRef.current) clearTimeout(detailDebounceRef.current);
    detailDebounceRef.current = setTimeout(() => {
      if (sourceImageData) {
        processConversion(sourceImageData, selectedCanvasSize, quantizationMethod, cropParams.x, cropParams.y, cropParams.width, cropParams.height, level);
      }
    }, 800);
  }, [sourceImageData, selectedCanvasSize, quantizationMethod, cropParams, paletteMode, maxColors]);

  const handleImageLoaded = (imageData: ImageData, originalSize: { width: number; height: number }) => {
    setSourceImageData(imageData);
    setOriginalImageSize(originalSize);
    processConversion(imageData, selectedCanvasSize, quantizationMethod, 0, 0, originalSize.width, originalSize.height, detailLevel);
  };

  const processConversion = async (
    source: ImageData,
    canvasSize: CanvasSizeKey,
    method: QuantizationMethod,
    cropX: number,
    cropY: number,
    cropWidth: number,
    cropHeight: number,
    detail: DetailLevel
  ) => {
    const canvasSpec = CANVAS_SIZES[canvasSize];
    try {
      const result = await processImage(source, {
        width: canvasSpec.width,
        height: canvasSpec.height,
        paletteColors: PALETTES.palette1.colors,
        quantizationMethod: method,
        paletteMode: paletteMode,
        maxColors: maxColors,
        sourceX: Math.round(cropX),
        sourceY: Math.round(cropY),
        sourceWidth: Math.round(cropWidth),
        sourceHeight: Math.round(cropHeight),
        detailLevel: detail,
        canvasSize: canvasSize,
      });
      setConvertedImageData(result);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image');
    }
  };

  const handleCanvasSizeChange = (size: CanvasSizeKey) => {
    setSelectedCanvasSize(size);
    if (sourceImageData) {
      processConversion(sourceImageData, size, quantizationMethod, cropParams.x, cropParams.y, cropParams.width, cropParams.height, detailLevel);
    }
  };

  const handleQuantizationMethodChange = (method: QuantizationMethod) => {
    setQuantizationMethod(method);
    if (sourceImageData) {
      processConversion(sourceImageData, selectedCanvasSize, method, cropParams.x, cropParams.y, cropParams.width, cropParams.height, detailLevel);
    }
  };

  const handlePaletteModeChange = (mode: 'default' | 'colorRange') => {
    setPaletteMode(mode);
    if (sourceImageData) {
      processConversionWithPaletteMode(sourceImageData, selectedCanvasSize, quantizationMethod, cropParams.x, cropParams.y, cropParams.width, cropParams.height, detailLevel, mode, maxColors);
    }
  };

  const handleMaxColorsChange = (count: number | null) => {
    setMaxColors(count);
    if (sourceImageData) {
      processConversionWithPaletteMode(sourceImageData, selectedCanvasSize, quantizationMethod, cropParams.x, cropParams.y, cropParams.width, cropParams.height, detailLevel, paletteMode, count);
    }
  };

  // Variant that accepts paletteMode + maxColors explicitly to avoid stale closure
  const processConversionWithPaletteMode = async (
    source: ImageData,
    canvasSize: CanvasSizeKey,
    method: QuantizationMethod,
    cropX: number,
    cropY: number,
    cropWidth: number,
    cropHeight: number,
    detail: DetailLevel,
    palMode: 'default' | 'colorRange',
    colors: number | null
  ) => {
    const canvasSpec = CANVAS_SIZES[canvasSize];
    try {
      const result = await processImage(source, {
        width: canvasSpec.width,
        height: canvasSpec.height,
        paletteColors: PALETTES.palette1.colors,
        quantizationMethod: method,
        paletteMode: palMode,
        maxColors: colors,
        sourceX: Math.round(cropX),
        sourceY: Math.round(cropY),
        sourceWidth: Math.round(cropWidth),
        sourceHeight: Math.round(cropHeight),
        detailLevel: detail,
        canvasSize: canvasSize,
      });
      setConvertedImageData(result);
    } catch (error) {
      console.error('Error processing image:', error);
    }
  };

  const handleCropChange = useCallback((x: number, y: number, width: number, height: number) => {
    setCropParams({ x, y, width, height });
    if (sourceImageData) {
      processConversion(sourceImageData, selectedCanvasSize, quantizationMethod, x, y, width, height, detailLevel);
    }
  }, [sourceImageData, selectedCanvasSize, quantizationMethod, paletteMode, maxColors, detailLevel]);

  // Helper: Convert ImageData to base64
  const imageDataToBase64 = (imageData: ImageData): string => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  };

  // Helper: Convert base64 to ImageData
  const base64ToImageData = (base64: string): Promise<ImageData | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, img.width, img.height));
      };
      img.onerror = () => resolve(null);
      img.src = base64;
    });
  };

  // Save to localStorage whenever key state changes
  useEffect(() => {
    if (sourceImageData) {
      try {
        const base64 = imageDataToBase64(sourceImageData);
        const state = {
          imageBase64: base64,
          selectedCanvasSize,
          quantizationMethod,
          paletteMode,
          maxColors,
          cropParams,
          originalImageSize,
          detailLevel,
        };
        localStorage.setItem('tomodachi-state', JSON.stringify(state));
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    }
  }, [sourceImageData, selectedCanvasSize, quantizationMethod, paletteMode, maxColors, cropParams, originalImageSize, detailLevel]);

  // Load from localStorage on mount
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const saved = localStorage.getItem('tomodachi-state');
        if (saved) {
          const state = JSON.parse(saved);
          if (state.imageBase64) {
            const imageData = await base64ToImageData(state.imageBase64);
            if (imageData) {
              const canvasSizeMigration: Record<string, CanvasSizeKey> = {
                'Object': 'Anything',
                'TV Screen': 'Videos',
                'Book': 'Books',
                'Vinyl': 'Music',
                'Switch': 'Video games',
                'Pet': 'Pets',
              };

              let migratedCanvasSize = state.selectedCanvasSize || 'Anything';
              if (migratedCanvasSize in canvasSizeMigration) {
                migratedCanvasSize = canvasSizeMigration[migratedCanvasSize as keyof typeof canvasSizeMigration];
              }

              setSourceImageData(imageData);
              setOriginalImageSize(state.originalImageSize);
              setSelectedCanvasSize(migratedCanvasSize as CanvasSizeKey);
              setQuantizationMethod(state.quantizationMethod || 'nearest-color');
              setPaletteMode(state.paletteMode || 'default');
              setMaxColors(state.maxColors || null);
              setCropParams(state.cropParams || { x: 0, y: 0, width: 306, height: 306 });
              setDetailLevel(state.detailLevel || 1);

              const canvasSize = migratedCanvasSize as CanvasSizeKey;
              const method = (state.quantizationMethod || 'nearest-color') as QuantizationMethod;
              const crop = state.cropParams || { x: 0, y: 0, width: 306, height: 306 };
              const canvasSpec = CANVAS_SIZES[canvasSize];
              if (canvasSpec) {
                try {
                  const result = await processImage(imageData, {
                    width: canvasSpec.width,
                    height: canvasSpec.height,
                    paletteColors: PALETTES.palette1.colors,
                    quantizationMethod: method,
                    paletteMode: state.paletteMode || 'default',
                    maxColors: state.maxColors || null,
                    sourceX: Math.round(crop.x),
                    sourceY: Math.round(crop.y),
                    sourceWidth: Math.round(crop.width),
                    sourceHeight: Math.round(crop.height),
                    detailLevel: state.detailLevel || 1,
                    canvasSize: canvasSize,
                  });
                  setConvertedImageData(result);
                } catch (error) {
                  console.error('Error processing loaded image:', error);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load from localStorage:', error);
      }
    };

    loadSavedState();
  }, []);

  const resetApp = () => {
    setSourceImageData(null);
    setConvertedImageData(null);
    setOriginalImageSize(null);
    setShowGrid(false);
    localStorage.removeItem('tomodachi-state');
  };

  // ── Legal pages ──────────────────────────────────────────────────────────────
  const legalPageContent: Record<string, React.ReactNode> = {
    privacy: <PrivacyPolicy />,
    terms: <TermsOfService />,
    license: <License />,
    contact: <Contact />,
  };

  if (currentPage !== 'app') {
    return (
      <div
        className="min-h-screen text-foreground"
        style={{ paddingLeft: 'clamp(16px, 5vw, 32px)', paddingRight: 'clamp(16px, 5vw, 32px)', paddingBottom: 'clamp(24px, 6vw, 48px)' }}
      >
        <div style={{ paddingTop: '16px' }}>
          <button
            onClick={() => setCurrentPage('app')}
            className="px-6 py-3 text-white rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold"
            style={{ backgroundColor: '#FF8000', marginBottom: '24px' }}
          >
            <ChevronLeft strokeWidth={3} size={20} />
            Back to App
          </button>
        </div>
        {legalPageContent[currentPage]}
      </div>
    );
  }

  // ── Main app ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', backgroundColor: 'white' }}>

      {/* Header */}
      <header
        className="w-full bg-white shrink-0"
        style={{ boxShadow: '0 3px 0 #FFC336', zIndex: 10 }}
      >
        <div style={{
          paddingLeft: 'clamp(12px, 3vw, 24px)',
          paddingRight: 'clamp(12px, 3vw, 24px)',
          paddingTop: '0.625rem',
          paddingBottom: '0.625rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
            <img src={LogoUrl} alt="Logo" style={{ height: '36px', width: 'auto', borderRadius: '6px', flexShrink: 0 }} />
            <h1 className="text-xl font-black" style={{ color: 'black', lineHeight: '1.2', whiteSpace: 'nowrap' }}>
              ResizeMee
            </h1>
          </div>

          {sourceImageData && (
            <button
              onClick={resetApp}
              className="px-4 py-2 rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold text-sm whitespace-nowrap"
              style={{ border: '2px solid #FF8000', backgroundColor: 'transparent', color: '#FF8000', flexShrink: 0 }}
            >
              <Upload strokeWidth={3} className="w-4 h-4" />
              <span className="hidden sm:inline">Upload new image</span>
              <span className="sm:hidden">New image</span>
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      {!sourceImageData ? (
        // ── Upload state ───────────────────────────────────────────────────────
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(1.5rem, 5vw, 3rem)' }}>
          <div style={{ maxWidth: '560px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', textAlign: 'center' }}>
            <div>
              <h2 className="font-black" style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', color: 'black', marginBottom: '0.5rem', lineHeight: 1.2 }}>
                Convert any image into a Tomodachi Life asset
              </h2>
              <p style={{ fontSize: '15px', color: '#717182', lineHeight: 1.6 }}>
                Pick the exact in-game shape, tune the palette and detail level, then download a PNG ready to paint.
              </p>
            </div>
            <div style={{ width: '100%', backgroundColor: 'white', boxShadow: '0 6px 0 #FFC336', borderRadius: '24px', padding: '1.5rem' }}>
              <ImageUpload onImageLoaded={handleImageLoaded} />
            </div>
          </div>
        </div>

      ) : (
        // ── Editor layout ──────────────────────────────────────────────────────
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* LEFT PANEL — settings, scrollable */}
          <aside style={{
            width: 'clamp(300px, 38%, 460px)',
            flexShrink: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRight: '3px solid #FFC336',
            backgroundColor: 'white',
            display: 'flex',
            flexDirection: 'column',
          }}>

            {/* Target Shape */}
            <PanelSection title="Target Shape">
              <CanvasSelector
                selectedCanvasSize={selectedCanvasSize}
                onCanvasSizeChange={handleCanvasSizeChange}
              />
            </PanelSection>

            {/* Position / Frame source */}
            <PanelSection
              title="Position"
              titleExtra={<Tooltip text="Pan and zoom to frame exactly what gets converted." />}
            >
              <CanvasPreview
                sourceImageData={sourceImageData}
                canvasSize={selectedCanvasSize}
                positionX={cropParams.x}
                positionY={cropParams.y}
                onCropChange={handleCropChange}
              />
            </PanelSection>

            {/* Image Settings */}
            <PanelSection title="Image Settings">
              <ControlPanel
                selectedCanvasSize={selectedCanvasSize}
                onCanvasSizeChange={handleCanvasSizeChange}
                paletteMode={paletteMode}
                onPaletteModeChange={handlePaletteModeChange}
                maxColors={maxColors}
                onMaxColorsChange={handleMaxColorsChange}
                quantizationMethod={quantizationMethod}
                onQuantizationMethodChange={handleQuantizationMethodChange}
                detailLevel={detailLevel}
                onDetailLevelChange={handleDetailLevelChange}
                onPageChange={setCurrentPage}
              />
            </PanelSection>

            {/* Compact footer */}
            <div style={{ marginTop: 'auto', padding: '1.25rem 1.5rem', borderTop: SECTION_DIVIDER }}>
              <p style={{ fontSize: '11px', color: '#a6a6a6', marginBottom: '8px' }}>
                Fan-made · Not affiliated with Nintendo
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
                {([
                  ['Privacy', 'privacy'],
                  ['Terms', 'terms'],
                  ['License', 'license'],
                  ['Contact', 'contact'],
                ] as const).map(([label, page]) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#FF8000', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {label}
                  </button>
                ))}
                <a
                  href="https://github.com/202alix/tlltd-converter"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#FF8000', fontSize: '11px', textDecoration: 'underline' }}
                >
                  GitHub
                </a>
                <a
                  href="https://ko-fi.com/L4L51YB9IR"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#FF8000', fontSize: '11px', textDecoration: 'underline' }}
                >
                  Ko-fi
                </a>
              </div>
            </div>
          </aside>

          {/* RIGHT PANEL — result, sticky */}
          <main style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f7f7f8',
            padding: 'clamp(1rem, 2.5vw, 1.75rem)',
          }}>
            {convertedImageData ? (
              <ConvertedView
                convertedImageData={convertedImageData}
                showGrid={showGrid}
                onToggleGrid={setShowGrid}
                canvasSize={selectedCanvasSize}
                paletteMode={paletteMode}
              />
            ) : (
              <p style={{ color: '#a6a6a6', fontSize: '14px' }}>Processing…</p>
            )}
          </main>

        </div>
      )}
    </div>
  );
}
