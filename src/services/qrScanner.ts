import jsQR from 'jsqr';
import { QRJobItem, QRJobStatus } from '../types';

export interface DecodedQRResult {
  success: boolean;
  rawText?: string;
  status: QRJobStatus;
  errorReason?: string;
  dataUrl?: string; // thumbnail
}

/**
 * Validates if a QR code URL is safe and non-malicious (no SSRF / private networks / script URLs)
 */
export function validateSafeUrl(urlText: string, allowInternalTestPortal = true): { isValid: boolean; reason?: string; sanitizedUrl?: string } {
  if (!urlText || typeof urlText !== 'string') {
    return { isValid: false, reason: 'Empty or non-string QR payload' };
  }

  const trimmed = urlText.trim();

  // Allow relative test portal links if created by test generator
  if (trimmed.startsWith('/api/test-portal') || trimmed.includes('/api/test-portal')) {
    return { isValid: true, sanitizedUrl: trimmed };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, reason: 'Malformed URL in QR code' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, reason: `Disallowed protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check for localhost / loopback / RFC 1918 / AWS / GCP metadata SSRF
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0';
  const isLinkLocal = hostname.startsWith('169.254.');
  const isPrivateIp =
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

  if (isLocalhost || isLinkLocal || isPrivateIp) {
    if (allowInternalTestPortal && (hostname === 'localhost' || hostname === '127.0.0.1') && parsed.pathname.startsWith('/api/test-portal')) {
      return { isValid: true, sanitizedUrl: parsed.toString() };
    }
    return { isValid: false, reason: `Private/internal network access prohibited for security (${hostname})` };
  }

  return { isValid: true, sanitizedUrl: parsed.toString() };
}

/**
 * Reads an image file and decodes its QR code
 */
export async function decodeQRFromFile(file: File): Promise<DecodedQRResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (!ctx) {
            resolve({
              success: false,
              status: 'INVALID_QR',
              errorReason: 'Unable to initialize image canvas context',
              dataUrl,
            });
            return;
          }

          // Helper to attempt jsQR on a canvas
          const tryDecodeCanvas = (c: HTMLCanvasElement): string | null => {
            const context = c.getContext('2d', { willReadFrequently: true });
            if (!context) return null;
            const imgData = context.getImageData(0, 0, c.width, c.height);
            const qr = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'attemptBoth',
            });
            return qr?.data ? qr.data.trim() : null;
          };

          // 1. First attempt: Normal scale (or scaled down if huge photo > 1200px)
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

          let detectedText = tryDecodeCanvas(canvas);

          // 2. Second attempt: If not found and original was scaled, try native full resolution
          if (!detectedText && (targetW !== img.width || targetH !== img.height)) {
            const nativeCanvas = document.createElement('canvas');
            nativeCanvas.width = img.width;
            nativeCanvas.height = img.height;
            const nativeCtx = nativeCanvas.getContext('2d', { willReadFrequently: true });
            if (nativeCtx) {
              nativeCtx.drawImage(img, 0, 0);
              detectedText = tryDecodeCanvas(nativeCanvas);
            }
          }

          // 3. Third attempt: Try high contrast binarization
          if (!detectedText) {
            const binarizedCanvas = document.createElement('canvas');
            binarizedCanvas.width = canvas.width;
            binarizedCanvas.height = canvas.height;
            const bCtx = binarizedCanvas.getContext('2d', { willReadFrequently: true });
            if (bCtx) {
              bCtx.drawImage(canvas, 0, 0);
              const bData = bCtx.getImageData(0, 0, binarizedCanvas.width, binarizedCanvas.height);
              const d = bData.data;
              for (let p = 0; p < d.length; p += 4) {
                const gray = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
                const val = gray > 128 ? 255 : 0;
                d[p] = val;
                d[p + 1] = val;
                d[p + 2] = val;
              }
              bCtx.putImageData(bData, 0, 0);
              detectedText = tryDecodeCanvas(binarizedCanvas);
            }
          }

          if (!detectedText) {
            resolve({
              success: false,
              status: 'INVALID_QR',
              errorReason: 'No valid QR code pattern detected in image',
              dataUrl,
            });
            return;
          }

          const rawText = detectedText;
          const validation = validateSafeUrl(rawText);

          if (!validation.isValid) {
            resolve({
              success: false,
              rawText,
              status: 'URL_ERROR',
              errorReason: validation.reason || 'Untrusted or invalid URL',
              dataUrl,
            });
            return;
          }

          resolve({
            success: true,
            rawText: validation.sanitizedUrl || rawText,
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
          errorReason: 'Corrupted image file or unsupported format',
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
  // Sort files deterministically by name (natural order: QR_001.png, QR_002.png...)
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
