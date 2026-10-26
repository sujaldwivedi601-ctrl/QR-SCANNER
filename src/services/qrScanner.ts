import jsQR from 'jsqr';
import { BrowserQRCodeReader } from '@zxing/library';
import { QRJobItem, QRJobStatus } from '../types';

export interface DecodedQRResult {
  success: boolean;
  rawText?: string;
  status: QRJobStatus;
  errorReason?: string;
  dataUrl?: string; // thumbnail
}

/**
 * Normalizes and validates QR code payloads into valid, navigable URLs.
 * Automatically handles domain-only strings, missing protocols, query strings, and custom ports.
 */
export function validateSafeUrl(urlText: string): { isValid: boolean; reason?: string; sanitizedUrl?: string } {
  if (!urlText || typeof urlText !== 'string') {
    return { isValid: false, reason: 'Empty QR code payload' };
  }

  let trimmed = urlText.trim();
  if (!trimmed) {
    return { isValid: false, reason: 'Blank QR code payload' };
  }

  // Allow relative test portal links
  if (trimmed.startsWith('/')) {
    return { isValid: true, sanitizedUrl: trimmed };
  }

  // If payload does not have a scheme (e.g. "www.example.com" or "portal.site/verify"), prepend https://
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    if (trimmed.includes('.') || trimmed.includes(':') || trimmed.includes('/')) {
      trimmed = `https://${trimmed}`;
    }
  }

  // Attempt URL parse
  try {
    const parsed = new URL(trimmed);
    return { isValid: true, sanitizedUrl: parsed.toString() };
  } catch {
    // If not standard URL format, but contains text, preserve it safely
    return { isValid: true, sanitizedUrl: trimmed };
  }
}

// Cached ZXing reader instance
const zxingReader = new BrowserQRCodeReader();

/**
 * Robust multi-engine QR code decoder:
 * 1. Native browser BarcodeDetector API (if available - fast, hardware accelerated)
 * 2. ZXing BrowserQRCodeReader (highly resilient on skewed, tilted, dark mode, blurred photos)
 * 3. jsQR with quiet-zone padding, scaling, and contrast inversion
 */
export async function decodeQRFromImageElement(img: HTMLImageElement): Promise<string | null> {
  // 1. Try Native BarcodeDetector if supported by the browser
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      const barcodes = await barcodeDetector.detect(img);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue.trim();
      }
    } catch (e) {
      // Native detector unavailable or threw, continue to ZXing
    }
  }

  // 2. Try ZXing BrowserQRCodeReader directly on the image element
  try {
    const result = await zxingReader.decodeFromImageElement(img);
    if (result && result.getText()) {
      return result.getText().trim();
    }
  } catch {
    // ZXing first pass miss, continue to multi-pass canvas strategies
  }

  // 3. Multi-pass Canvas Strategy (jsQR + ZXing on preprocessed canvases)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // Scales to attempt: natural, downscaled (for large phone camera photos), and padded
  const scales = [
    { maxDim: 1200, addBorder: true },  // optimal mobile photo size with white quiet-zone border
    { maxDim: img.width, addBorder: false }, // native resolution
    { maxDim: 800, addBorder: true },   // high density QR code optimization
    { maxDim: 1600, addBorder: true },  // tiny QR codes in large frames
  ];

  for (const { maxDim, addBorder } of scales) {
    let w = img.width;
    let h = img.height;
    if (w > maxDim || h > maxDim) {
      const scale = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const padding = addBorder ? Math.max(24, Math.round(w * 0.08)) : 0;
    canvas.width = w + padding * 2;
    canvas.height = h + padding * 2;

    // Fill white background to guarantee quiet zone around QR code
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, padding, padding, w, h);

    // Attempt jsQR on standard canvas
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (code && code.data && code.data.trim()) {
        return code.data.trim();
      }
    } catch {
      // ignore
    }

    // Attempt ZXing on this canvas
    try {
      const zxRes = await (zxingReader as any).decodeFromCanvas(canvas);
      if (zxRes && zxRes.getText && zxRes.getText()) {
        return zxRes.getText().trim();
      }
    } catch {
      // ignore
    }

    // High contrast thresholding (helps with shadows, screen glare, low contrast prints)
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let p = 0; p < d.length; p += 4) {
        const brightness = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
        const val = brightness > 130 ? 255 : 0;
        d[p] = val;
        d[p + 1] = val;
        d[p + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);

      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (code && code.data && code.data.trim()) {
        return code.data.trim();
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Reads any image file and decodes its QR code reliably
 */
export async function decodeQRFromFile(file: File): Promise<DecodedQRResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();

      img.onload = async () => {
        try {
          const detectedText = await decodeQRFromImageElement(img);

          if (!detectedText) {
            resolve({
              success: false,
              status: 'INVALID_QR',
              errorReason: 'No QR code pattern detected. Please ensure the QR code is clearly visible.',
              dataUrl,
            });
            return;
          }

          const validation = validateSafeUrl(detectedText);

          resolve({
            success: true,
            rawText: validation.sanitizedUrl || detectedText,
            status: 'PENDING',
            dataUrl,
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          resolve({
            success: false,
            status: 'INVALID_QR',
            errorReason: `Decode error: ${errorMsg}`,
            dataUrl,
          });
        }
      };

      img.onerror = () => {
        resolve({
          success: false,
          status: 'INVALID_QR',
          errorReason: 'Unable to open image format',
          dataUrl,
        });
      };

      img.src = dataUrl;
    };

    reader.onerror = () => {
      resolve({
        success: false,
        status: 'INVALID_QR',
        errorReason: 'File reading failure',
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Builds a deterministic FIFO queue from a list of files
 */
export async function buildQueueFromFiles(
  files: File[],
  onProgress?: (processed: number, total: number, currentName: string) => void
): Promise<QRJobItem[]> {
  // Sort files deterministically by natural order (QR_001.png, QR_002.png...)
  const sortedFiles = [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  const jobs: QRJobItem[] = [];

  for (let i = 0; i < sortedFiles.length; i++) {
    const file = sortedFiles[i];
    onProgress?.(i + 1, sortedFiles.length, file.name);

    const decoded = await decodeQRFromFile(file);

    const job: QRJobItem = {
      id: `job-${Date.now()}-${i + 1}-${Math.random().toString(36).substring(2, 7)}`,
      fileName: file.name,
      fileSize: file.size,
      qrDataUrl: decoded.dataUrl,
      decodedUrl: decoded.rawText,
      status: decoded.status,
      errorReason: decoded.errorReason,
      attempts: 0,
      maxRetries: 2,
      stepLogs: [
        {
          step: 'DECODE',
          timestamp: new Date().toISOString(),
          status: decoded.success ? 'success' : 'error',
          message: decoded.success
            ? `Decoded URL: ${decoded.rawText}`
            : `Decode issue: ${decoded.errorReason || 'Unable to decode'}`,
        },
      ],
    };

    jobs.push(job);
  }

  return jobs;
}
