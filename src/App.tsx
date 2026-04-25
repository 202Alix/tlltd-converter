import React, { useState, useCallback, useEffect } from 'react';
import { Upload, ZoomIn, ZoomOut, Grid3x3, Download, RotateCcw, HelpCircle, Hand, Pipette, Wand2, ChevronLeft } from 'lucide-react';
import LogoUrl from './assets/Logo_ResizeMee.svg';
import { ImageUpload } from './components/ImageUpload';
import { ControlPanel } from './components/ControlPanel';
import { CanvasPreview } from './components/CanvasPreview';
import { ConvertedView } from './components/ConvertedView';
import { Footer } from './components/Footer';
import { CanvasSelector } from './components/CanvasSelector';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { License } from './pages/License';
import { Contact } from './pages/Contact';
import { processImage } from './lib/imageProcessor';
import { CANVAS_SIZES, PALETTES, CanvasSizeKey } from './lib/palettes';
import { QuantizationMethod } from './lib/quantizer';
import { DetailLevel } from './lib/imageProcessor';

type PageType = 'app' | 'privacy' | 'terms' | 'license' | 'contact';

const Tooltip: React.FC<{ text: string }> = ({ text }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', cursor: 'help', flexShrink: 0 }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <HelpCircle size={20} style={{ color: '#a6a6a6' }} />
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
  const [selectedColorFilter, setSelectedColorFilter] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(1);

  // Debounce detail level changes to reduce computation
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (sourceImageData) {
        processConversion(sourceImageData, selectedCanvasSize, quantizationMethod, cropParams.x, cropParams.y, cropParams.width, cropParams.height, detailLevel);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [detailLevel, sourceImageData, selectedCanvasSize, quantizationMethod, cropParams, paletteMode, maxColors]);

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
  };

  const handleQuantizationMethodChange = (method: QuantizationMethod) => {
    setQuantizationMethod(method);
    if (sourceImageData) {
      processConversion(sourceImageData, selectedCanvasSize, method, cropParams.x, cropParams.y, cropParams.width, cropParams.height, detailLevel);
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
        if (!ctx) {
          resolve(null);
          return;
        }
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
              // Migrate old canvas size keys to new ones
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

              // Process the image with loaded settings
              const canvasSize = migratedCanvasSize as CanvasSizeKey;
              const method = (state.quantizationMethod || 'nearest-color') as QuantizationMethod;
              const cropParams = state.cropParams || { x: 0, y: 0, width: 306, height: 306 };
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
                    sourceX: Math.round(cropParams.x),
                    sourceY: Math.round(cropParams.y),
                    sourceWidth: Math.round(cropParams.width),
                    sourceHeight: Math.round(cropParams.height),
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

  return (
    <>
      {/* Render legal pages */}
      {currentPage === 'privacy' && (
        <div className="min-h-screen text-foreground" style={{ paddingLeft: 'clamp(16px, 5vw, 32px)', paddingRight: 'clamp(16px, 5vw, 32px)', paddingBottom: 'clamp(24px, 6vw, 48px)', backgroundColor: 'transparent' }}>
          <div style={{ paddingTop: '16px' }}>
            <button
              onClick={() => setCurrentPage('app')}
              className="px-6 py-3 text-white rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold"
              style={{
                backgroundColor: '#FF8000',
                marginBottom: '24px'
              }}
            >
              <ChevronLeft strokeWidth={3} size={20} />
              Back to App
            </button>
          </div>
          <PrivacyPolicy />
        </div>
      )}

      {currentPage === 'terms' && (
        <div className="min-h-screen text-foreground" style={{ paddingLeft: 'clamp(16px, 5vw, 32px)', paddingRight: 'clamp(16px, 5vw, 32px)', paddingBottom: 'clamp(24px, 6vw, 48px)', backgroundColor: 'transparent' }}>
          <div style={{ paddingTop: '16px' }}>
            <button
              onClick={() => setCurrentPage('app')}
              className="px-6 py-3 text-white rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold"
              style={{
                backgroundColor: '#FF8000',
                marginBottom: '24px'
              }}
            >
              <ChevronLeft strokeWidth={3} size={20} />
              Back to App
            </button>
          </div>
          <TermsOfService />
        </div>
      )}

      {currentPage === 'license' && (
        <div className="min-h-screen text-foreground" style={{ paddingLeft: 'clamp(16px, 5vw, 32px)', paddingRight: 'clamp(16px, 5vw, 32px)', paddingBottom: 'clamp(24px, 6vw, 48px)', backgroundColor: 'transparent' }}>
          <div style={{ paddingTop: '16px' }}>
            <button
              onClick={() => setCurrentPage('app')}
              className="px-6 py-3 text-white rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold"
              style={{
                backgroundColor: '#FF8000',
                marginBottom: '24px'
              }}
            >
              <ChevronLeft strokeWidth={3} size={20} />
              Back to App
            </button>
          </div>
          <License />
        </div>
      )}

      {currentPage === 'contact' && (
        <div className="min-h-screen text-foreground" style={{ paddingLeft: 'clamp(16px, 5vw, 32px)', paddingRight: 'clamp(16px, 5vw, 32px)', paddingBottom: 'clamp(24px, 6vw, 48px)', backgroundColor: 'transparent' }}>
          <div style={{ paddingTop: '16px' }}>
            <button
              onClick={() => setCurrentPage('app')}
              className="px-6 py-3 text-white rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold"
              style={{
                backgroundColor: '#FF8000',
                marginBottom: '24px'
              }}
            >
              <ChevronLeft strokeWidth={3} size={20} />
              Back to App
            </button>
          </div>
          <Contact />
        </div>
      )}

      {/* Main app */}
      {currentPage === 'app' && (
      <div className="min-h-screen text-foreground relative flex flex-col" style={{ backgroundColor: 'transparent' }}>
        {/* Header */}
        <header className="w-full bg-white" style={{ boxShadow: '0 6px 0 #FFC336' }}>
          <div style={{ paddingLeft: 'clamp(16px, 5vw, 32px)', paddingRight: 'clamp(16px, 5vw, 32px)', paddingTop: '1rem', paddingBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
            <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
              <img src={LogoUrl} alt="Logo" style={{ height: '44px', width: 'auto', borderRadius: '8px', flexShrink: 0 }} />
              <h1
                className="text-2xl sm:text-3xl font-black"
                style={{ color: 'black', lineHeight: '1.2' }}
              >
                ResizeMee
              </h1>
            </div>
            {sourceImageData && (
              <button
                onClick={() => {
                  setSourceImageData(null);
                  setConvertedImageData(null);
                  setOriginalImageSize(null);
                  setShowGrid(false);
                }}
                className="px-6 py-3 rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold whitespace-nowrap text-sm sm:text-base"
                style={{ border: '2px solid #FF8000', backgroundColor: 'transparent', color: '#FF8000', flexShrink: 0 }}
              >
                <Upload strokeWidth={3} className="w-5 h-5" />
                <span className="hidden sm:inline">Upload Different Image</span>
                <span className="sm:hidden">Upload</span>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 flex flex-col" style={{ paddingLeft: 'clamp(16px, 5vw, 32px)', paddingRight: 'clamp(16px, 5vw, 32px)', paddingTop: 'clamp(2.5rem, 8vw, 4rem)' }}>
        <div className="max-w-6xl mx-auto relative z-10 w-full" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(1.5rem, 5vw, 2rem)' }}>

        {!sourceImageData ? (
          <div className="rounded-3xl" style={{ backgroundColor: 'white', boxShadow: '0 6px 0 #FFC336', borderRadius: '24px', padding: '16px' }}>
            <ImageUpload onImageLoaded={handleImageLoaded} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(1.5rem, 5vw, 2rem)' }}>
            {/* Shape Selection Section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ backgroundColor: 'white', boxShadow: '0 6px 0 #FFC336', padding: 'clamp(0.9rem, 4vw, 1.5rem) clamp(1rem, 5vw, 2rem) 0.5rem', textAlign: 'center', borderRadius: '24px 24px 0 0', width: 'fit-content', maxWidth: '100%' }}>
                <h2 style={{ color: 'black', margin: '0', fontSize: 'clamp(1.4rem, 6vw, 28px)', fontWeight: 'bold', whiteSpace: 'normal', lineHeight: '1.15' }}>
                  Shape Selection
                </h2>
              </div>
              <div style={{ backgroundColor: 'white', boxShadow: '0 6px 0 #FFC336', padding: 'clamp(1rem, 4vw, 2rem)', width: '100%', borderRadius: '24px', maxWidth: '100%', boxSizing: 'border-box' }}>
                <CanvasSelector
                  selectedCanvasSize={selectedCanvasSize}
                  onCanvasSizeChange={handleCanvasSizeChange}
                />
              </div>
            </div>

            {/* Conversion Settings Section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ backgroundColor: 'white', boxShadow: '0 6px 0 #FFC336', padding: 'clamp(0.9rem, 4vw, 1.5rem) clamp(1rem, 5vw, 2rem) 0.5rem', textAlign: 'center', borderRadius: '24px 24px 0 0', width: 'fit-content', maxWidth: '100%' }}>
                <h2 style={{ color: 'black', margin: '0', fontSize: 'clamp(1.4rem, 6vw, 28px)', fontWeight: 'bold', whiteSpace: 'normal', lineHeight: '1.15' }}>
                  Conversion Settings
                </h2>
              </div>
              <div style={{ backgroundColor: 'white', boxShadow: '0 6px 0 #FFC336', padding: 'clamp(1rem, 4vw, 2rem)', width: '100%', borderRadius: '24px', maxWidth: '100%', boxSizing: 'border-box' }}>
                <ControlPanel
                  selectedCanvasSize={selectedCanvasSize}
                  onCanvasSizeChange={handleCanvasSizeChange}
                  paletteMode={paletteMode}
                  onPaletteModeChange={setPaletteMode}
                  maxColors={maxColors}
                  onMaxColorsChange={setMaxColors}
                  quantizationMethod={quantizationMethod}
                  onQuantizationMethodChange={handleQuantizationMethodChange}
                  detailLevel={detailLevel}
                  onDetailLevelChange={setDetailLevel}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>

            <div style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', display: 'grid', gap: 'clamp(1.5rem, 5vw, 2rem)', gridAutoRows: 'max-content' }}>
              {/* Position Image Panel */}
              <div className="rounded-3xl" style={{ gridColumn: 'auto', backgroundColor: 'white', boxShadow: '0 6px 0 #FFC336', borderRadius: '24px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="flex items-center gap-2 mb-4">
                  <h2
                    className="text-2xl font-black"
                    style={{ color: 'black', textAlign: 'center' }}
                  >
                    Your image
                  </h2>
                  <Tooltip text="Move and zoom your image to choose exactly what gets converted." />
                </div>
                <CanvasPreview
                  sourceImageData={sourceImageData}
                  canvasSize={selectedCanvasSize}
                  positionX={cropParams.x}
                  positionY={cropParams.y}
                  onCropChange={handleCropChange}
                />
              </div>

              {/* Preview Result Panel */}
              <div className="rounded-3xl" style={{ gridColumn: 'auto', backgroundColor: 'white', boxShadow: '0 6px 0 #FFC336', borderRadius: '24px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="flex items-center gap-2 mb-4">
                  <h2
                    className="text-2xl font-black"
                    style={{ color: 'black', textAlign: 'center' }}
                  >
                    Converted image
                  </h2>
                  <Tooltip text="This shows how your converted image will look. You can zoom, move around, and download it." />
                </div>
                {convertedImageData ? (
                  <ConvertedView
                    convertedImageData={convertedImageData}
                    showGrid={showGrid}
                    onToggleGrid={setShowGrid}
                    canvasSize={selectedCanvasSize}
                    paletteMode={paletteMode}
                  />
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    <p>Preview will appear here after image upload</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
        </div>
      </div>
      )}

      {/* Footer */}
      <Footer currentPage={currentPage} onPageChange={setCurrentPage} />
    </>
  );
}
