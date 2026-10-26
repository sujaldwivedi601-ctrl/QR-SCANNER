import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  RefreshCw,
  Image as ImageIcon,
  Zap,
  ZapOff,
  Copy,
  ExternalLink,
  Check,
  ArrowRight,
  UploadCloud,
  AlertCircle,
  ScanLine,
} from 'lucide-react';

interface LiveScannerProps {
  onStartAutomationFlow: () => void;
  onScannedSingleUrl?: (url: string) => void;
}

export const LiveScanner: React.FC<LiveScannerProps> = ({
  onStartAutomationFlow,
  onScannedSingleUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [lastScannedResult, setLastScannedResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  // Initialize camera stream safely
  const startCamera = async (mode: 'environment' | 'user') => {
    try {
      setCameraError(null);

      // Clean up previous stream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment');
      }

      let mediaStream: MediaStream;
      try {
        // Use 'ideal' facingMode to prevent OverconstrainedError on webcams/desktops
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (firstErr) {
        console.warn('Constrained camera stream failed, requesting basic video:', firstErr);
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setStream(mediaStream);
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((playErr) => {
            console.warn('Camera play blocked:', playErr);
          });
        };
      }

      // Check torch capability
      const videoTrack = mediaStream.getVideoTracks()[0];
      const capabilities = (videoTrack?.getCapabilities?.() as any) || {};
      setHasTorch(Boolean(capabilities.torch));
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      setCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was blocked by the browser. Click below to retry or drop any QR image to scan.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No webcam device detected. You can drop any QR image here to scan it instantly.');
      } else {
        setCameraError('Camera stream not available in this view. Use image scan or click to retry.');
      }
    }
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  // Continuous frame scanning loop
  useEffect(() => {
    let animationFrameId: number;

    const scanFrame = () => {
      if (
        isScanning &&
        videoRef.current &&
        canvasRef.current &&
        videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
      ) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          if (qrCode && qrCode.data) {
            const content = qrCode.data.trim();
            if (content && content !== lastScannedResult) {
              try {
                navigator.vibrate?.(100);
              } catch {
                // ignore
              }
              setLastScannedResult(content);
              onScannedSingleUrl?.(content);
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(scanFrame);
    };

    animationFrameId = requestAnimationFrame(scanFrame);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isScanning, lastScannedResult, onScannedSingleUrl]);

  // Toggle torch / flashlight
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn('Torch toggle failed:', err);
      }
    }
  };

  // Flip camera
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Process image from gallery / file picker / drag-and-drop
  const decodeImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          let targetW = img.width;
          let targetH = img.height;
          if (targetW > 1200 || targetH > 1200) {
            const scale = Math.min(1200 / targetW, 1200 / targetH);
            targetW = Math.round(targetW * scale);
            targetH = Math.round(targetH * scale);
          }
          canvas.width = targetW;
          canvas.height = targetH;
          ctx.drawImage(img, 0, 0, targetW, targetH);

          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'attemptBoth',
          });

          if (qr && qr.data) {
            setLastScannedResult(qr.data.trim());
            onScannedSingleUrl?.(qr.data.trim());
          } else {
            alert('No valid QR code detected in the selected image. Please try a clearer QR image.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) decodeImageFile(file);
  };

  const handleDropImage = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      decodeImageFile(file);
    }
  };

  const handleCopy = () => {
    if (!lastScannedResult) return;
    navigator.clipboard.writeText(lastScannedResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-65px)] bg-white text-black px-4 py-6 sm:py-8">
      {/* Prominent White & Blue Button: Automate OTP QR (As specifically specified in brief) */}
      <div className="w-full max-w-md mb-6">
        <button
          onClick={onStartAutomationFlow}
          className="w-full group relative overflow-hidden rounded-2xl bg-white border-2 border-blue-600 p-4 sm:p-5 shadow-lg shadow-blue-500/15 hover:shadow-xl hover:shadow-blue-500/25 transition-all text-left flex items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              Batch Workflow
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-blue-600 tracking-tight group-hover:text-blue-700 transition-colors">
              Automate OTP QR
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Batch process all QR codes from your &apos;QR Code&apos; folder with automated phone &amp; OTP verification.
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-700 transition-all shadow-md">
            <ArrowRight className="w-6 h-6" />
          </div>
        </button>
      </div>

      {/* Google Lens / Google QR Scanner Viewfinder with Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        onDrop={handleDropImage}
        className={`relative w-full max-w-md aspect-[3/4] sm:aspect-square rounded-3xl overflow-hidden bg-black shadow-2xl border-4 transition-all ${
          isDragOver ? 'border-red-600 ring-4 ring-red-200' : 'border-black'
        }`}
      >
        {/* Hidden video and processing canvas */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Viewfinder when Camera is connecting or blocked */}
        {!cameraActive && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-white space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-600/10 border border-red-600/30 flex items-center justify-center text-red-500">
              <Camera className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Google-Style QR Scanner</h3>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                {cameraError || 'Hold your camera over any QR code or drop an image here to scan.'}
              </p>
            </div>

            <div className="flex flex-col gap-2.5 w-full max-w-xs pt-1">
              <button
                onClick={() => startCamera(facingMode)}
                className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors shadow-md"
              >
                Enable / Retry Camera
              </button>

              <button
                onClick={() => galleryInputRef.current?.click()}
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl transition-colors border border-white/20 inline-flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                Scan QR Image from Gallery
              </button>
            </div>
          </div>
        )}

        {/* Google Scanner Overlay: 4 Corner Reticles & Red Laser */}
        {cameraActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72">
              {/* 4 Crisp Red Corner Brackets (Google Lens Style) */}
              <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-red-600 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-red-600 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-red-600 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-red-600 rounded-br-2xl" />

              {/* Animated Red Laser Scanning Line */}
              <div
                className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-bounce"
                style={{
                  top: '50%',
                  animationDuration: '2s',
                  animationIterationCount: 'infinite',
                }}
              />
            </div>
          </div>
        )}

        {/* Top Controls Bar on Scanner: Torch, Flip, Gallery */}
        {cameraActive && (
          <div className="absolute top-4 inset-x-4 flex items-center justify-between z-10">
            <span className="text-[11px] font-bold text-white bg-black/60 backdrop-blur-md px-3 py-1 rounded-full uppercase tracking-wider">
              Align QR Code in frame
            </span>

            <div className="flex items-center gap-2">
              {hasTorch && (
                <button
                  onClick={toggleTorch}
                  className={`p-2.5 rounded-full backdrop-blur-md text-white transition-colors ${
                    torchOn ? 'bg-red-600' : 'bg-black/60 hover:bg-black/80'
                  }`}
                  title="Toggle Flashlight"
                >
                  {torchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
                </button>
              )}

              <button
                onClick={toggleFacingMode}
                className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white transition-colors"
                title="Switch Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={() => galleryInputRef.current?.click()}
                className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white transition-colors"
                title="Scan Image from Gallery"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Hidden gallery file picker */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleGalleryUpload}
          className="hidden"
        />
      </div>

      {/* Scanned Result Card / Bottom Sheet */}
      {lastScannedResult && (
        <div className="w-full max-w-md mt-5 p-5 rounded-2xl bg-white border-2 border-black shadow-xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
              Scanned QR Code
            </span>
            <button
              onClick={() => setLastScannedResult(null)}
              className="text-xs text-slate-400 hover:text-black font-semibold"
            >
              Scan Another
            </button>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-black break-all select-all">
            {lastScannedResult}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {lastScannedResult.startsWith('http://') || lastScannedResult.startsWith('https://') ? (
              <a
                href={lastScannedResult}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-black hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Link
              </a>
            ) : null}

            <button
              onClick={handleCopy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-black font-semibold text-xs rounded-xl transition-colors border border-slate-300"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Text'}
            </button>
          </div>
        </div>
      )}

      {/* Instructions footer */}
      <div className="w-full max-w-md mt-6 text-center text-xs text-slate-500">
        Point at any standard QR code, website URL, WiFi code, or ticket to scan instantly.
      </div>
    </div>
  );
};
