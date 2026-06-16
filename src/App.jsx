import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  GripVertical, 
  Trash2, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  LayoutGrid,
  Eye,
  Maximize,
  Minimize,
  Moon,
  Sun,
  Download,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';

// --- SVG Noise Filter for Realistic Paper Effect ---
const PaperTexture = ({ spineSide, isCover }) => {
  return (
    <React.Fragment>
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.35] mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='3.0' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
      {!isCover && (
        <React.Fragment>
          <div 
            className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-100"
            style={{
              background: spineSide === 'left' 
                ? 'linear-gradient(to right, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.05) 10%, rgba(0,0,0,0) 30%)'
                : 'linear-gradient(to left, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.05) 10%, rgba(0,0,0,0) 30%)'
            }}
          />
          {spineSide === 'left' && (
            <svg className="absolute top-0 bottom-0 left-0 w-[2px] h-full pointer-events-none" preserveAspectRatio="none">
              <defs>
                <linearGradient id="spine-highlight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
                </linearGradient>
              </defs>
              <line x1="0.25" y1="0" x2="0.25" y2="100%" stroke="url(#spine-highlight)" strokeWidth="0.5" />
            </svg>
          )}
        </React.Fragment>
      )}
    </React.Fragment>
  );
};

export default function App() {
  const [mode, setMode] = useState('upload'); 
  const [images, setImages] = useState([]);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [animatingIndex, setAnimatingIndex] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // State for upload guidance & processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const previewContainerRef = useRef(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [dlScale, setDlScale] = useState('x1');
  const [dlBg, setDlBg] = useState('transparent');
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentSheet, setCurrentSheet] = useState(0);

  const dragStartRef = useRef(null);
  const isDraggingRef = useRef(false);

  // --- Upload Logic (Auto Detect & Split Landscape Pages) ---
  const handleFiles = async (fileList) => {
    setIsProcessing(true);
    setUploadError(null);
    const processedImages = [];
    const MAX_SIZE_MB = 10;
    let hasOversizedFiles = false;

    // KUNCI PERBAIKAN: Konversi FileList yang "hidup" menjadi Array statis 
    // agar tidak terhapus saat e.target.value direset ke null
    const filesArray = Array.from(fileList);

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];

      // File Size Validation
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        hasOversizedFiles = true;
        continue;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;

      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve; 
      });

      // Ratio check - if Landscape (Width > Height), split into two
      if (img.width > img.height) {
        const halfWidth = Math.floor(img.width / 2);
        const rightWidth = img.width - halfWidth;
        
        const c1 = document.createElement('canvas');
        const c2 = document.createElement('canvas');
        c1.width = halfWidth;
        c1.height = img.height;
        c2.width = rightWidth;
        c2.height = img.height;
        
        const ctx1 = c1.getContext('2d');
        const ctx2 = c2.getContext('2d');
        
        // Memaksimalkan kualitas pemotongan
        ctx1.imageSmoothingQuality = 'high';
        ctx2.imageSmoothingQuality = 'high';

        // Draw left half
        ctx1.drawImage(img, 0, 0, halfWidth, img.height, 0, 0, halfWidth, img.height);
        // Draw right half
        ctx2.drawImage(img, halfWidth, 0, rightWidth, img.height, 0, 0, rightWidth, img.height);

        // Export blob dengan kualitas maksimal (1.0)
        const blob1 = await new Promise(res => c1.toBlob(res, 'image/jpeg', 1.0));
        const blob2 = await new Promise(res => c2.toBlob(res, 'image/jpeg', 1.0));

        const baseId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        processedImages.push({
          id: baseId + '-L',
          url: URL.createObjectURL(blob1),
          name: `${file.name} (Left)`
        });
        processedImages.push({
          id: baseId + '-R',
          url: URL.createObjectURL(blob2),
          name: `${file.name} (Right)`
        });
      } else {
        // If file is A5 (Portrait), import as is
        processedImages.push({
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          url: url,
          name: file.name
        });
      }
    }

    if (hasOversizedFiles) {
      setUploadError(`Some files were skipped for exceeding the ${MAX_SIZE_MB}MB limit.`);
      setTimeout(() => setUploadError(null), 5000);
    }

    setImages(prev => [...prev, ...processedImages]);
    setIsProcessing(false);
  };

  const handleDropUpload = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverItem = (e, index) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const newImages = [...images];
    const draggedItem = newImages[draggedIdx];
    newImages.splice(draggedIdx, 1);
    newImages.splice(index, 0, draggedItem);
    setDraggedIdx(index);
    setImages(newImages);
  };

  const handleDragEnd = () => setDraggedIdx(null);
  const removeImage = (id) => setImages(images.filter(img => img.id !== id));
  
  // --- Fullscreen Logic ---
  const isFullscreenMode = isFullscreen || isPseudoFullscreen;

  const toggleFullscreen = async () => {
    if (isFullscreenMode) {
      if (isFullscreen && document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch (e) {}
      }
      setIsPseudoFullscreen(false);
      setIsFullscreen(false);
      setShowExportMenu(false);
    } else {
      try {
        if (document.fullscreenEnabled && previewContainerRef.current?.requestFullscreen) {
          await previewContainerRef.current.requestFullscreen();
        } else {
          throw new Error("Native fullscreen disabled.");
        }
      } catch (err) {
        setIsPseudoFullscreen(true);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) setShowExportMenu(false);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isPseudoFullscreen) {
        setIsPseudoFullscreen(false);
        setShowExportMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPseudoFullscreen]);

  useEffect(() => {
    if (mode === 'preview') {
      setCurrentSheet(0);
      setAnimatingIndex(null);
    }
  }, [mode]);

  useEffect(() => {
    if (animatingIndex !== null) {
      const timer = setTimeout(() => setAnimatingIndex(null), 1200);
      return () => clearTimeout(timer);
    }
  }, [animatingIndex, currentSheet]);

  // --- Preview Logic ---
  const sheets = [];
  for (let i = 0; i < Math.ceil(images.length / 2); i++) {
    sheets.push({ front: images[i * 2] || null, back: images[i * 2 + 1] || null });
  }

  const turnNext = () => {
    if (currentSheet < sheets.length) {
      setAnimatingIndex(currentSheet);
      setCurrentSheet(prev => prev + 1);
    }
    setShowExportMenu(false);
  };

  const turnPrev = () => {
    if (currentSheet > 0) {
      setAnimatingIndex(currentSheet - 1);
      setCurrentSheet(prev => prev - 1);
    }
    setShowExportMenu(false);
  };

  const handleDragDown = (e) => {
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    if (!clientX) return;
    dragStartRef.current = clientX;
    isDraggingRef.current = true;
    setShowExportMenu(false);
  };

  const handleDragMove = (e) => {
    if (!isDraggingRef.current || dragStartRef.current === null) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    if (!clientX) return;
    
    const deltaX = clientX - dragStartRef.current;
    if (Math.abs(deltaX) > 80) {
      if (deltaX < 0) { turnNext(); } else { turnPrev(); }
      isDraggingRef.current = false;
      dragStartRef.current = null;
    }
  };

  const handleDragEndAction = () => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
  };

  // --- Canvas Exporter (Static PNG) ---
  const downloadSpread = async () => {
    setIsDownloading(true);
    try {
      const isFrontCover = currentSheet === 0;
      const isBackCover = currentSheet === sheets.length;
      
      const leftPage = !isFrontCover ? sheets[currentSheet - 1].back : null;
      const rightPage = !isBackCover ? sheets[currentSheet].front : null;

      const baseWidth = 1000;
      const baseHeight = 1414;
      const scaleMult = dlScale === 'x2' ? 2 : 1;
      
      const padding = dlBg === 'transparent' ? 0 : 160 * scaleMult;
      const zineWidth = ((isFrontCover || isBackCover) ? baseWidth : baseWidth * 2) * scaleMult;
      const zineHeight = baseHeight * scaleMult;
      
      const canvas = document.createElement('canvas');
      canvas.width = zineWidth + (padding * 2);
      canvas.height = zineHeight + (padding * 2);
      const ctx = canvas.getContext('2d');

      if (dlBg !== 'transparent') {
        ctx.fillStyle = dlBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 40 * scaleMult;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 20 * scaleMult;
        ctx.fillStyle = '#ffffff'; 
        ctx.fillRect(padding, padding, zineWidth, zineHeight);
        
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      const loadImg = (src) => new Promise((resolve) => {
        if (!src) return resolve(null);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });

      const noiseSvgStr = "<svg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='3.5' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>";
      const noiseSvgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(noiseSvgStr);

      const [leftImg, rightImg, noiseImg] = await Promise.all([
        loadImg(leftPage?.url),
        loadImg(rightPage?.url),
        loadImg(noiseSvgUrl)
      ]);

      // Implement Object-Cover to prevent stretched images on export
      const drawPage = (img, xOffset) => {
        const dx = padding + xOffset;
        const dy = padding;
        const dw = baseWidth * scaleMult;
        const dh = zineHeight;
        
        if (img) {
          const imgRatio = img.width / img.height;
          const targetRatio = dw / dh;
          let sx, sy, sw, sh;

          if (imgRatio > targetRatio) {
            // Image is wider than target, crop sides
            sh = img.height;
            sw = img.height * targetRatio;
            sx = (img.width - sw) / 2;
            sy = 0;
          } else {
            // Image is taller than target, crop top/bottom
            sw = img.width;
            sh = img.width / targetRatio;
            sx = 0;
            sy = (img.height - sh) / 2;
          }
          
          ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(dx, dy, dw, dh);
        }
      };

      if (isFrontCover) drawPage(rightImg, 0);
      else if (isBackCover) drawPage(leftImg, 0);
      else { drawPage(leftImg, 0); drawPage(rightImg, baseWidth * scaleMult); }

      ctx.globalCompositeOperation = 'multiply';

      if (noiseImg) {
        ctx.globalAlpha = 0.35;
        const pattern = ctx.createPattern(noiseImg, 'repeat');
        ctx.fillStyle = pattern;
        ctx.save();
        ctx.translate(padding, padding);
        ctx.fillRect(0, 0, zineWidth, zineHeight); 
        ctx.restore();
        ctx.globalAlpha = 1.0;
      }

      if (!isFrontCover && !isBackCover) {
        const spineX = padding + (baseWidth * scaleMult);
        
        const leftGrad = ctx.createLinearGradient(spineX, padding, spineX - (baseWidth * scaleMult), padding);
        leftGrad.addColorStop(0, 'rgba(0,0,0,0.3)'); 
        leftGrad.addColorStop(0.1, 'rgba(0,0,0,0.05)');
        leftGrad.addColorStop(0.3, 'rgba(0,0,0,0)'); 
        ctx.fillStyle = leftGrad; 
        ctx.fillRect(padding, padding, baseWidth * scaleMult, zineHeight);

        const rightGrad = ctx.createLinearGradient(spineX, padding, spineX + (baseWidth * scaleMult), padding);
        rightGrad.addColorStop(0, 'rgba(0,0,0,0.3)'); 
        rightGrad.addColorStop(0.1, 'rgba(0,0,0,0.05)');
        rightGrad.addColorStop(0.3, 'rgba(0,0,0,0)'); 
        ctx.fillStyle = rightGrad; 
        ctx.fillRect(spineX, padding, baseWidth * scaleMult, zineHeight);
      }

      ctx.globalCompositeOperation = 'source-over';

      if (!isFrontCover && !isBackCover) {
        const spineX = padding + (baseWidth * scaleMult);
        const highlightGrad = ctx.createLinearGradient(0, padding, 0, padding + zineHeight);
        highlightGrad.addColorStop(0, 'rgba(255,255,255,0.45)');
        highlightGrad.addColorStop(1, 'rgba(255,255,255,0.0)');
        ctx.fillStyle = highlightGrad;
        ctx.fillRect(spineX, padding, 1 * scaleMult, zineHeight);
      }

      const link = document.createElement('a');
      link.download = `zine-spread-${currentSheet}-${dlScale}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error("Export failed", e);
    }
    setIsDownloading(false);
  };

  const renderExportControls = (inPopover = false) => {
    const bgLabels = { 'transparent': 'Transparent', '#ffffff': 'White', '#000000': 'Black', '#18181b': 'Zinc' };
    
    const activeBtnClass = `w-full py-1.5 text-[9px] font-bold tracking-wider uppercase rounded-md transition-all shadow-sm border ${
      isDarkMode 
        ? 'bg-zinc-800 border-white/5 text-white' 
        : 'bg-white border-black/5 text-zinc-900'
    }`;
    
    const inactiveBtnClass = `w-full py-1.5 text-[9px] font-bold tracking-wider uppercase rounded-md transition-all border border-transparent ${
      isDarkMode 
        ? 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5' 
        : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/5'
    }`;

    return (
      <div className={`p-4 rounded-2xl border space-y-4 transition-all duration-300 ${inPopover ? (isDarkMode ? 'bg-zinc-900/95 border-white/10 backdrop-blur-xl shadow-2xl' : 'bg-white/95 border-black/10 backdrop-blur-xl shadow-2xl') : (isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-black/[0.02] border-black/5')}`}>
        {!inPopover && <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 block">Export Options</span>}
        
        <div className="space-y-1.5">
          <label className={`text-[9px] font-bold uppercase tracking-wider block ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>Scale</label>
          <div className={`flex gap-1 rounded-lg p-1 border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
            <button onClick={() => setDlScale('x1')} className={dlScale === 'x1' ? activeBtnClass : inactiveBtnClass}>Standard</button>
            <button onClick={() => setDlScale('x2')} className={dlScale === 'x2' ? activeBtnClass : inactiveBtnClass}>High-Res</button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={`text-[9px] font-bold uppercase tracking-wider block ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>Backdrop</label>
          <div className={`grid grid-cols-2 gap-1 rounded-lg p-1 border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
            {['transparent', '#ffffff', '#000000', '#18181b'].map(bg => (
              <button key={bg} onClick={() => setDlBg(bg)} className={dlBg === bg ? activeBtnClass : inactiveBtnClass}>
                {bgLabels[bg]}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={() => { downloadSpread(); setShowExportMenu(false); }} 
          disabled={isDownloading} 
          className={`w-full py-2 text-[10px] font-bold tracking-widest uppercase rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-1.5 shadow-sm ${isDarkMode ? 'bg-white text-zinc-950 hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}
        >
          {isDownloading ? 'Saving...' : <><Download className="w-3.5 h-3.5" /> Save PNG</>}
        </button>
      </div>
    );
  };

  return (
    <div className={`isolate relative min-h-screen w-full flex flex-col md:flex-row font-sans transition-colors duration-500 overflow-hidden ${isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'}`}>
      
      {/* LEFT SIDEBAR */}
      {!isFullscreenMode && (
        <aside className={`w-full md:w-80 flex-none flex flex-col justify-between border-b md:border-b-0 md:border-r backdrop-blur-xl transition-all duration-300 z-50 ${isDarkMode ? 'bg-zinc-950/80 border-white/5 shadow-2xl' : 'bg-white/80 border-black/5'}`}>
          
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <BookOpen className="text-zinc-400 dark:text-zinc-500 w-5 h-5 shrink-0" />
              <span className="h-4 w-px bg-zinc-700/30 dark:bg-white/10" />
              <h1 className="text-sm font-semibold tracking-widest uppercase">Zine Preview</h1>
            </div>

            <div className={`flex rounded-full p-1 border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
              <button 
                onClick={() => setMode('upload')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs uppercase tracking-wider font-semibold rounded-full transition-all ${mode === 'upload' ? (isDarkMode ? 'bg-white text-zinc-950 shadow-md' : 'bg-zinc-900 text-white shadow-md') : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Grid
              </button>
              <button 
                onClick={() => setMode('preview')}
                disabled={images.length === 0}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs uppercase tracking-wider font-semibold rounded-full transition-all disabled:opacity-30 ${mode === 'preview' ? (isDarkMode ? 'bg-white text-zinc-950 shadow-md' : 'bg-zinc-900 text-white shadow-md') : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
            </div>

            <hr className="border-zinc-800/30 dark:border-white/5" />

            {mode === 'upload' ? (
              <div className="space-y-4">
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 block">Actions</span>
                
                <label className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold tracking-wide transition-all text-xs uppercase border ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'} ${isDarkMode ? 'bg-zinc-100 border-zinc-100 text-zinc-950 hover:bg-zinc-300' : 'bg-zinc-900 border-zinc-900 text-white hover:bg-zinc-800'}`}>
                  {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />} 
                  {isProcessing ? 'Processing...' : 'Upload Pages'}
                  <input type="file" multiple accept="image/*" className="hidden" disabled={isProcessing} onChange={(e) => { handleFiles(e.target.files); e.target.value = null; }} />
                </label>

                <button 
                  onClick={() => setImages([])}
                  disabled={images.length === 0 || isProcessing}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 border rounded-xl font-semibold tracking-wide transition-all text-xs uppercase disabled:opacity-40 disabled:cursor-not-allowed ${isDarkMode ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400' : 'bg-red-50 border-red-200 hover:bg-red-100 text-red-600'}`}
                >
                  <Trash2 className="w-3.5 h-3.5 pointer-events-none" /> Clear All
                </button>

                {uploadError && (
                  <div className="flex items-start gap-1.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] leading-relaxed font-medium animate-fadeIn">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <p>{uploadError}</p>
                  </div>
                )}

                <div className="pt-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 block mb-1">Status</span>
                  <p className="text-xs text-zinc-400 font-medium tracking-wide">
                    {images.length} {images.length === 1 ? 'page' : 'pages'} registered
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 block">Flip Spread</span>
                  <div className="flex items-center justify-between gap-2">
                    <button 
                      onClick={turnPrev} 
                      disabled={currentSheet === 0}
                      className={`flex-1 flex justify-center py-2.5 border rounded-xl transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-30' : 'bg-black/5 border-black/5 text-zinc-600 hover:bg-black/10 disabled:opacity-30'}`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-semibold tracking-wider text-center shrink-0 w-24">
                      {currentSheet === 0 ? "Cover" : `Spread ${currentSheet}/${sheets.length}`}
                    </span>
                    <button 
                      onClick={turnNext} 
                      disabled={currentSheet === sheets.length}
                      className={`flex-1 flex justify-center py-2.5 border rounded-xl transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-30' : 'bg-black/5 border-black/5 text-zinc-600 hover:bg-black/10 disabled:opacity-30'}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {renderExportControls(false)}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-zinc-800/30 dark:border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">System settings</span>
            
            <div className="flex items-center gap-2">
              {mode === 'preview' && (
                <button 
                  onClick={toggleFullscreen}
                  className={`p-2 rounded-full border transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-zinc-400 hover:text-white' : 'bg-black/5 border-black/5 text-zinc-500 hover:text-zinc-900'}`}
                  title="Toggle Fullscreen"
                >
                  <Maximize className="w-3.5 h-3.5" />
                </button>
              )}

              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-full border transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-yellow-300 hover:bg-white/10' : 'bg-black/5 border-black/5 text-zinc-600 hover:bg-black/10'}`}
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* RIGHT WORKSPACE */}
      <main ref={previewContainerRef} className="flex-1 h-screen overflow-y-auto relative z-10">
        
        {/* Upload Mode View */}
        {mode === 'upload' && (
          <div className="w-full max-w-[1800px] mx-auto p-6 sm:p-10 pb-24 animate-fadeIn">
            {images.length === 0 ? (
              <label 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropUpload}
                className={`cursor-pointer w-full py-40 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all duration-300 px-4 text-center ${isProcessing ? 'opacity-50 pointer-events-none' : ''} ${isDarkMode ? 'border-white/10 bg-white/[0.02] hover:border-white/20' : 'border-black/10 bg-black/[0.01] hover:border-black/20'}`}
              >
                <div className={`p-5 rounded-full border mb-5 ${isDarkMode ? 'bg-white/[0.03] border-white/5' : 'bg-black/[0.02] border-black/5'}`}>
                  {isProcessing ? <Loader2 className={`w-8 h-8 animate-spin ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`} /> : <UploadCloud className={`w-8 h-8 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`} />}
                </div>
                <h3 className={`text-lg sm:text-xl font-semibold tracking-wide ${isDarkMode ? 'text-zinc-200' : 'text-zinc-700'}`}>
                  {isProcessing ? 'Processing File...' : 'Upload Image'}
                </h3>
                <p className={`text-[13px] sm:text-sm mt-3 max-w-lg mx-auto leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  Ideal format: <strong className={`font-semibold ${isDarkMode ? 'text-zinc-200' : 'text-zinc-800'}`}>A5 Portrait (148 x 210 mm)</strong>.<br />
                  <strong className={`font-semibold ${isDarkMode ? 'text-zinc-200' : 'text-zinc-800'}`}>Landscape</strong> images (spreads) will be automatically split into two A5 pages.<br/>
                  Maximum file size: 10MB.
                </p>
                <input type="file" multiple accept="image/*" className="hidden" disabled={isProcessing} onChange={(e) => { handleFiles(e.target.files); e.target.value = null; }} />
              </label>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 min-[1800px]:grid-cols-8 gap-4 sm:gap-6">
                  {images.map((img, index) => {
                    let badgeLabel = `Page ${index}`;
                    if (index === 0) badgeLabel = "Front Cover";
                    if (index === images.length - 1 && index !== 0) badgeLabel = "Back Cover";

                    return (
                      <div 
                        key={img.id} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => handleDragOverItem(e, index)} onDragEnd={handleDragEnd}
                        className={`group relative rounded-xl shadow-lg border overflow-hidden cursor-move transition-all duration-300 ${isDarkMode ? 'bg-zinc-900 border-white/10' : 'bg-white border-black/10'} ${draggedIdx === index ? 'opacity-30 scale-95 border-dashed' : 'hover:scale-[1.02] hover:shadow-2xl'}`}
                        style={{ aspectRatio: '1 / 1.414' }}
                      >
                        {img.url ? (
                          <img src={img.url} alt={`Page ${index}`} className="w-full h-full object-cover bg-white pointer-events-none transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center pointer-events-none ${isDarkMode ? 'bg-zinc-800 text-zinc-600' : 'bg-zinc-100 text-zinc-400'}`}>
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Blank Page</span>
                          </div>
                        )}
                        
                        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3 pointer-events-none">
                          <div className="flex justify-between items-start">
                            <div className="bg-black/75 text-white text-[10px] tracking-wider uppercase font-semibold px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10">
                              {badgeLabel}
                            </div>
                            <button 
                              onClick={() => removeImage(img.id)} 
                              className="p-1.5 bg-neutral-950/80 hover:bg-neutral-900 border border-white/10 text-white rounded-full transition-colors pointer-events-auto shadow-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                            </button>
                          </div>
                          <div className="self-center p-2 text-white/50 bg-black/40 rounded-full backdrop-blur-md border border-white/5 shadow-md">
                            <GripVertical className="w-5 h-5 pointer-events-none" />
                          </div>
                        </div>

                        <div className={`absolute top-3 left-3 text-[9px] tracking-wider uppercase font-bold px-2.5 py-1 rounded-full shadow-md opacity-100 group-hover:opacity-0 transition-opacity duration-300 border ${isDarkMode ? 'bg-zinc-950/80 border-white/5 text-zinc-300 backdrop-blur-sm' : 'bg-white/80 border-black/5 text-zinc-700 backdrop-blur-sm'}`}>
                          {badgeLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Mockup Preview Mode */}
        {mode === 'preview' && (
          <div className={`w-full h-full flex flex-col relative transition-all duration-300 pointer-events-none ${isFullscreenMode ? 'fixed inset-0 z-[99999] h-screen' : ''}`}>
            
            {isFullscreenMode && (
              <div 
                className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-zinc-950/50 backdrop-blur-xl px-5 py-2.5 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[999999] border border-white/10 pointer-events-auto"
                style={{ transform: 'translateZ(10px) translateX(-50%)' }}
              >
                <button onClick={turnPrev} disabled={currentSheet === 0} className="p-1.5 text-zinc-300 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-300 hover:bg-white/5 rounded-full transition-all">
                  <ChevronLeft className="w-4 h-4 pointer-events-none" />
                </button>
                <span className="text-zinc-300 font-semibold text-xs tracking-wider uppercase px-2 pointer-events-none">
                  {currentSheet === 0 ? "Cover" : `Spread ${currentSheet}/${sheets.length}`}
                </span>
                <button onClick={turnNext} disabled={currentSheet === sheets.length} className="p-1.5 text-zinc-300 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-300 hover:bg-white/5 rounded-full transition-all">
                  <ChevronRight className="w-4 h-4 pointer-events-none" />
                </button>
                <div className="w-px h-5 bg-white/10 mx-1 pointer-events-none"></div>

                <div className="relative flex items-center justify-center">
                  {showExportMenu && (
                    <div className="absolute bottom-[calc(100%+16px)] left-1/2 -translate-x-1/2 w-64 animate-fadeIn">
                      {renderExportControls(true)}
                    </div>
                  )}
                  <button 
                    onClick={() => setShowExportMenu(!showExportMenu)} 
                    className={`p-1.5 rounded-full transition-all ${showExportMenu ? 'bg-white/20 text-white' : 'text-zinc-300 hover:text-white hover:bg-white/5'}`}
                    title="Export Options"
                  >
                    <Download className="w-4 h-4 pointer-events-none" />
                  </button>
                </div>

                <div className="w-px h-5 bg-white/10 mx-1 pointer-events-none"></div>
                <button onClick={toggleFullscreen} className="p-1.5 text-zinc-300 hover:text-white hover:bg-white/5 rounded-full transition-all">
                  <Minimize className="w-4 h-4 pointer-events-none" />
                </button>
              </div>
            )}

            <div 
              className={`flex-1 w-full h-full flex items-center justify-center p-8 pb-16 relative z-10 pointer-events-none overflow-hidden select-none transition-all duration-300 ${isFullscreenMode ? (isDarkMode ? 'pt-8 bg-zinc-950' : 'pt-8 bg-zinc-50') : 'pt-24'}`}
              onMouseDown={handleDragDown}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEndAction}
              onMouseLeave={handleDragEndAction}
              onTouchStart={handleDragDown}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEndAction}
            >
              <div 
                className="relative pointer-events-auto mx-auto cursor-grab active:cursor-grabbing scale-95 md:scale-100" 
                style={{ 
                  perspective: '3000px', 
                  aspectRatio: '2 / 1.414',
                  width: isFullscreenMode ? 'min(95%, calc((100vh - 120px) * 1.414))' : 'min(100%, calc((100vh - 180px) * 1.414))',
                  maxWidth: isFullscreenMode ? '1400px' : '1050px'
                }}
              >
                <div className="absolute inset-0 bg-black/60 blur-3xl rounded-xl transform translate-y-16 scale-[0.97] pointer-events-none"></div>

                {/* RIGHT PAGE — the flipping sheets stack, anchored to right half */}
                <div className="absolute top-0 bottom-0 right-0 w-1/2 pointer-events-none animate-scaleIn">
                  {sheets.map((sheet, index) => {
                    const isFlipped = index < currentSheet;
                    let computedZIndex = isFlipped ? index : sheets.length - index;
                    if (index === animatingIndex) computedZIndex = 100;
                    else if (index === currentSheet || index === currentSheet - 1) computedZIndex += 20;
                    
                    return (
                      <div key={index} className="absolute inset-0 origin-left pointer-events-none" style={{ transformStyle: 'preserve-3d', transition: 'transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)', willChange: 'transform', transform: isFlipped ? 'rotateY(-180deg)' : 'rotateY(0deg)', zIndex: computedZIndex }}>
                        
                        <div className="absolute inset-0 bg-[#fcfcfb] border-l border-black/10 overflow-hidden cursor-pointer pointer-events-auto" style={{ backfaceVisibility: 'hidden' }} onClick={turnNext}>
                          {sheet.front && sheet.front.url ? <img src={sheet.front.url} alt="Page" className="w-full h-full object-cover pointer-events-none animate-fadeIn" /> : <div className="w-full h-full flex items-center justify-center text-zinc-400 pointer-events-none bg-neutral-100"><span className="text-[10px] font-bold tracking-widest uppercase opacity-35">Blank Page</span></div>}
                          <PaperTexture spineSide="left" isCover={index === 0} />
                        </div>

                        <div className="absolute inset-0 bg-[#fcfcfb] border-r border-black/10 overflow-hidden cursor-pointer pointer-events-auto" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }} onClick={turnPrev}>
                          {sheet.back && sheet.back.url ? <img src={sheet.back.url} alt="Page" className="w-full h-full object-cover pointer-events-none animate-fadeIn" /> : <div className="w-full h-full flex items-center justify-center text-zinc-400 pointer-events-none bg-neutral-100"><span className="text-[10px] font-bold tracking-widest uppercase opacity-35">Blank Page</span></div>}
                          <PaperTexture spineSide="right" isCover={index === sheets.length - 1} />
                        </div>
                        
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {!isFullscreenMode && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-zinc-400/50 text-[10px] tracking-widest uppercase z-30 pointer-events-none bg-black/40 border border-white/5 px-5 py-2 rounded-full backdrop-blur-sm whitespace-nowrap">
                Drag layout spread to flip pages
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}