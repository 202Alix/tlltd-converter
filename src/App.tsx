import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, ChevronLeft, ChevronDown, Moon, Sun } from 'lucide-react';
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
import { BrushMode, DetailLevel, getDetailLevelsForBrushMode } from './lib/imageProcessor';
import { TYPOGRAPHY } from './lib/typography';

type PageType = 'app' | 'privacy' | 'terms' | 'license' | 'contact';

const computeFramingCrop = (
  mode: 'fit' | 'fill',
  srcWidth: number,
  srcHeight: number,
  canvasSize: CanvasSizeKey
): { x: number; y: number; width: number; height: number } => {
  const target = CANVAS_SIZES[canvasSize];
  const scale = mode === 'fill'
    ? Math.max(target.width / srcWidth, target.height / srcHeight)
    : Math.min(target.width / srcWidth, target.height / srcHeight);
  const sw = target.width / scale;
  const sh = target.height / scale;
  return { x: (srcWidth - sw) / 2, y: (srcHeight - sh) / 2, width: sw, height: sh };
};

const PANEL_PADDING = '0.875rem 1rem';

const CardSection: React.FC<{
  title: string;
  titleExtra?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}> = ({ title, titleExtra, children, collapsible = true, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{ backgroundColor: 'var(--app-panel-bg)', borderRadius: '14px', boxShadow: '0 var(--app-shadow-offset) 0 var(--app-divider)' }}>
      <div
        style={{
          padding: PANEL_PADDING,
          paddingBottom: isOpen ? '0.5rem' : PANEL_PADDING.split(' ')[0],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          {collapsible && (
            <button
              onClick={() => setIsOpen(prev => !prev)}
              aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
              aria-expanded={isOpen}
              className="p-1 rounded-md transition-colors"
              style={{
                backgroundColor: 'var(--app-panel-alt)',
                border: 'none',
                color: 'var(--app-text-sub)',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              <ChevronDown
                size={16}
                strokeWidth={3}
                style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s ease' }}
              />
            </button>
          )}
          <h2 className={TYPOGRAPHY.h2} style={{ margin: 0, color: 'var(--app-text)', letterSpacing: '-0.01em', fontSize: '1.05rem', lineHeight: 1.2 }}>
            {title}
          </h2>
          {titleExtra}
        </div>
      </div>
      <div
        aria-hidden={collapsible && !isOpen}
        style={{
          display: collapsible && !isOpen ? 'none' : 'block',
          padding: PANEL_PADDING,
          paddingTop: '0.5rem',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('app');
  const [sourceImageData, setSourceImageData] = useState<ImageData | null>(null);
  const [originalImageSize, setOriginalImageSize] = useState<{ width: number; height: number } | null>(null);
  const [selectedCanvasSize, setSelectedCanvasSize] = useState<CanvasSizeKey>('Anything');
  const [quantizationMethod, setQuantizationMethod] = useState<QuantizationMethod>('nearest-color');
  const [convertedImageData, setConvertedImageData] = useState<ImageData | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [cropParams, setCropParams] = useState({ x: 0, y: 0, width: 306, height: 306 });
  const [framingMode, setFramingMode] = useState<'fit' | 'fill'>('fit');
  const [paletteMode, setPaletteMode] = useState<'default' | 'colorRange'>('default');
  const [maxColors, setMaxColors] = useState<number>(84);
  const [brushMode, setBrushMode] = useState<BrushMode>('smooth');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('tomodachi-dark-mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('tomodachi-dark-mode', String(isDarkMode));
  }, [isDarkMode]);

  const detailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizeQuantizationMethod = useCallback((value: unknown): QuantizationMethod => {
    if (value === 'nearest-color' || value === 'dithering' || value === 'posterize') {
      return value;
    }
    if (value === 'text-friendly') {
      return 'posterize';
    }
    return 'nearest-color';
  }, []);

  const resolveDetailForMode = useCallback((mode: BrushMode, detail: DetailLevel): DetailLevel => {
    const allowed = getDetailLevelsForBrushMode(mode);
    if (allowed.includes(detail)) return detail;
    return allowed[0];
  }, []);

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
    setFramingMode('fit');
    const crop = computeFramingCrop('fit', imageData.width, imageData.height, selectedCanvasSize);
    setCropParams(crop);
    processConversion(imageData, selectedCanvasSize, quantizationMethod, crop.x, crop.y, crop.width, crop.height, detailLevel);
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
    setIsProcessing(true);
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
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCanvasSizeChange = (size: CanvasSizeKey) => {
    setSelectedCanvasSize(size);
    if (sourceImageData) {
      const crop = computeFramingCrop(framingMode, sourceImageData.width, sourceImageData.height, size);
      setCropParams(crop);
      processConversion(sourceImageData, size, quantizationMethod, crop.x, crop.y, crop.width, crop.height, detailLevel);
    }
  };

  const handleFraming = (mode: 'fit' | 'fill') => {
    setFramingMode(mode);
    if (!sourceImageData) return;
    const crop = computeFramingCrop(mode, sourceImageData.width, sourceImageData.height, selectedCanvasSize);
    setCropParams(crop);
    processConversion(sourceImageData, selectedCanvasSize, quantizationMethod, crop.x, crop.y, crop.width, crop.height, detailLevel);
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

  const handleMaxColorsChange = (count: number) => {
    setMaxColors(count);
    if (sourceImageData) {
      processConversionWithPaletteMode(sourceImageData, selectedCanvasSize, quantizationMethod, cropParams.x, cropParams.y, cropParams.width, cropParams.height, detailLevel, paletteMode, count);
    }
  };

  const handleBrushModeChange = (mode: BrushMode) => {
    setBrushMode(mode);
    const nextDetail = resolveDetailForMode(mode, detailLevel);
    if (nextDetail !== detailLevel) {
      setDetailLevel(nextDetail);
    }
    if (sourceImageData) {
      processConversion(
        sourceImageData,
        selectedCanvasSize,
        quantizationMethod,
        cropParams.x,
        cropParams.y,
        cropParams.width,
        cropParams.height,
        nextDetail
      );
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
    colors: number
  ) => {
    const canvasSpec = CANVAS_SIZES[canvasSize];
    setIsProcessing(true);
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
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePresetApply = (mode: BrushMode, detail: DetailLevel, colors: number) => {
    setBrushMode(mode);
    setDetailLevel(detail);
    setMaxColors(colors);
    if (sourceImageData) {
      processConversionWithPaletteMode(
        sourceImageData, selectedCanvasSize, quantizationMethod,
        cropParams.x, cropParams.y, cropParams.width, cropParams.height,
        detail, paletteMode, colors
      );
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
          brushMode,
          framingMode,
          originalImageSize,
          detailLevel,
        };
        localStorage.setItem('tomodachi-state', JSON.stringify(state));
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    }
  }, [sourceImageData, selectedCanvasSize, quantizationMethod, paletteMode, maxColors, brushMode, framingMode, originalImageSize, detailLevel]);

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
              const normalizedMethod = normalizeQuantizationMethod(state.quantizationMethod);
              setQuantizationMethod(normalizedMethod);
              setPaletteMode(state.paletteMode || 'default');
              const loadedBrushMode = (state.brushMode === 'pixel-perfect' ? 'pixel-perfect' : 'smooth') as BrushMode;
              setBrushMode(loadedBrushMode);
              const loadedPaletteMode = (state.paletteMode || 'default') as 'default' | 'colorRange';
              const loadedMaxLimit = loadedPaletteMode === 'colorRange' ? 128 : 84;
              const loadedMaxColors =
                typeof state.maxColors === 'number' && state.maxColors > 0
                  ? Math.min(state.maxColors, loadedMaxLimit)
                  : loadedMaxLimit;

              setMaxColors(loadedMaxColors);
              const loadedFramingMode = (state.framingMode === 'fill' ? 'fill' : 'fit') as 'fit' | 'fill';
              setFramingMode(loadedFramingMode);
              const loadedDetail = (state.detailLevel || 1) as DetailLevel;
              const migratedDetail = resolveDetailForMode(loadedBrushMode, loadedDetail);
              setDetailLevel(migratedDetail);

              const canvasSize = migratedCanvasSize as CanvasSizeKey;
              const method = normalizeQuantizationMethod(state.quantizationMethod);
              const crop = computeFramingCrop(loadedFramingMode, imageData.width, imageData.height, canvasSize);
              setCropParams(crop);
              const canvasSpec = CANVAS_SIZES[canvasSize];
              if (canvasSpec) {
                try {
                  const result = await processImage(imageData, {
                    width: canvasSpec.width,
                    height: canvasSpec.height,
                    paletteColors: PALETTES.palette1.colors,
                    quantizationMethod: method,
                    paletteMode: state.paletteMode || 'default',
                    maxColors: loadedMaxColors,
                    sourceX: Math.round(crop.x),
                    sourceY: Math.round(crop.y),
                    sourceWidth: Math.round(crop.width),
                    sourceHeight: Math.round(crop.height),
                    detailLevel: migratedDetail,
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
  }, [resolveDetailForMode, normalizeQuantizationMethod]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', gap: '1rem' }}>

      {/* Header */}
      <header
        className="w-full shrink-0"
        style={{ backgroundColor: 'var(--app-panel-bg)', boxShadow: '0 2px 0 var(--app-accent)', zIndex: 10 }}
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
            <h1 className={TYPOGRAPHY.h1} style={{ color: 'var(--app-text)', whiteSpace: 'nowrap' }}>
              ResizeMee
            </h1>
          </div>

          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-full btn-lift"
              style={{ backgroundColor: 'transparent', border: 'none', color: '#FF8000', cursor: 'pointer' }}
            >
              {isDarkMode ? <Sun size={20} strokeWidth={3} /> : <Moon size={20} strokeWidth={3} />}
            </button>
            {sourceImageData && (
              <button
                onClick={resetApp}
                className="px-4 py-2 rounded-full flex items-center gap-2 font-bold text-sm whitespace-nowrap btn-lift"
                style={{ border: '2px solid #FF8000', backgroundColor: 'transparent', color: '#FF8000', cursor: 'pointer' }}
              >
                <Upload strokeWidth={3} className="w-4 h-4" />
                <span className="hidden sm:inline">Upload new image</span>
                <span className="sm:hidden">New image</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      {!sourceImageData ? (
        // ── Upload state ───────────────────────────────────────────────────────
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(1.5rem, 5vw, 3rem)' }}>
          <div style={{ maxWidth: '560px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', textAlign: 'center' }}>
            <div>
              <h2 className={TYPOGRAPHY.h2} style={{ color: 'var(--app-text)', marginBottom: '0.5rem' }}>
                Convert any image into a Tomodachi Life asset
              </h2>
              <p className={TYPOGRAPHY.body} style={{ color: 'var(--app-text-sub)' }}>
                Pick the exact in-game shape, tune the palette and detail level, then download a PNG ready to paint.
              </p>
            </div>
            <div style={{ width: '100%', backgroundColor: 'var(--app-panel-bg)', boxShadow: '0 var(--app-shadow-offset) 0 var(--app-accent)', borderRadius: '24px', padding: '1.5rem' }}>
              <ImageUpload onImageLoaded={handleImageLoaded} />
            </div>
          </div>
        </div>

      ) : (
        // ── Editor layout ──────────────────────────────────────────────────────
        <div className="app-editor-layout" style={{ flex: 1, minHeight: 0 }}>

          {/* LEFT PANEL — settings, scrollable */}
          <aside className="app-editor-aside" style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '1rem',
            gap: '1rem',
          }}>

            <CardSection title="Canvas">
              <CanvasSelector
                selectedCanvasSize={selectedCanvasSize}
                onCanvasSizeChange={handleCanvasSizeChange}
              />
            </CardSection>

            <CardSection title="Framing">
              <CanvasPreview
                sourceImageData={sourceImageData}
                canvasSize={selectedCanvasSize}
                framingMode={framingMode}
                onFramingModeChange={handleFraming}
                cropX={cropParams.x}
                cropY={cropParams.y}
                cropWidth={cropParams.width}
                cropHeight={cropParams.height}
                onCropChange={handleCropChange}
              />
            </CardSection>

            <CardSection title="Style & Output">
              <ControlPanel
                selectedCanvasSize={selectedCanvasSize}
                onCanvasSizeChange={handleCanvasSizeChange}
                paletteMode={paletteMode}
                onPaletteModeChange={handlePaletteModeChange}
                maxColors={maxColors}
                onMaxColorsChange={handleMaxColorsChange}
                brushMode={brushMode}
                onBrushModeChange={handleBrushModeChange}
                quantizationMethod={quantizationMethod}
                onQuantizationMethodChange={handleQuantizationMethodChange}
                detailLevel={detailLevel}
                onDetailLevelChange={handleDetailLevelChange}
                onPresetApply={handlePresetApply}
                onPageChange={setCurrentPage}
              />
            </CardSection>

            {/* Footer card */}
            <div style={{ marginTop: 'auto', backgroundColor: 'var(--app-panel-bg)', borderRadius: '16px', boxShadow: '0 var(--app-shadow-offset-lg) 0 var(--app-divider)', padding: '1rem 1.25rem' }}>
              <p style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginBottom: '8px' }}>
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

          {/* RIGHT PANEL — result, scrollable */}
          <main className="app-editor-main">
            <div style={{
              minHeight: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'flex-start',
              padding: '1rem',
              width: '100%',
            }}>
              {convertedImageData ? (
                <ConvertedView
                  convertedImageData={convertedImageData}
                  showGrid={showGrid}
                  onToggleGrid={setShowGrid}
                  canvasSize={selectedCanvasSize}
                  paletteMode={paletteMode}
                  isProcessing={isProcessing}
                />
              ) : (
                <p style={{ color: '#a6a6a6', fontSize: '14px' }}>Processing…</p>
              )}
            </div>
          </main>

        </div>
      )}
    </div>
  );
}
