import QRCode from 'qrcode';
import { QRJobItem } from '../types';

export interface SampleQROptions {
  count?: number;
  includeInvalid?: boolean;
}

/**
 * Generates sample QR code images and returns File objects ready for queueing or downloading
 */
export async function generateSampleQRFiles(count = 6, includeInvalid = true): Promise<File[]> {
  const files: File[] = [];

  for (let i = 1; i <= count; i++) {
    const pad = String(i).padStart(3, '0');
    const fileName = `QR_${pad}.png`;

    // Make the last one invalid if requested to demonstrate resilient error handling
    if (includeInvalid && i === count) {
      // Create a dummy plain canvas with noise/text instead of a QR code
      const dummyCanvas = document.createElement('canvas');
      dummyCanvas.width = 256;
      dummyCanvas.height = 256;
      const ctx = dummyCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#64748b';
        ctx.font = '14px monospace';
        ctx.fillText('NON-QR IMAGE TEST', 40, 128);
      }
      const blob = await new Promise<Blob | null>((res) => dummyCanvas.toBlob(res, 'image/png'));
      if (blob) {
        files.push(new File([blob], fileName, { type: 'image/png' }));
      }
      continue;
    }

    // Scenarios for testing the workflow
    let scenario = 'standard_success';
    if (i === 3) scenario = 'custom_otp';
    if (i === 4) scenario = 'limit_switch';

    // Target URL pointing to test portal
    const url = `/api/test-portal?ref=JOB_${pad}&scenario=${scenario}&token=${Math.random().toString(36).substring(2, 9)}`;

    // Generate real PNG QR
    const dataUrl = await QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    files.push(new File([blob], fileName, { type: 'image/png' }));
  }

  return files;
}

/**
 * Generates pre-decoded QRJobItem list for instant demo without folder selection
 */
export async function generateSampleJobs(count = 6): Promise<QRJobItem[]> {
  const jobs: QRJobItem[] = [];

  for (let i = 1; i <= count; i++) {
    const pad = String(i).padStart(3, '0');
    const fileName = `QR_${pad}.png`;

    if (i === count) {
      jobs.push({
        id: `job-sample-${Date.now()}-${i}`,
        fileName,
        status: 'INVALID_QR',
        errorReason: 'No valid QR code pattern detected in image',
        attempts: 0,
        maxRetries: 2,
        stepLogs: [
          {
            step: 'DECODE',
            timestamp: new Date().toISOString(),
            status: 'error',
            message: 'Image does not contain a decipherable 2D QR matrix',
          },
        ],
      });
      continue;
    }

    const url = `/api/test-portal?ref=JOB_${pad}&scenario=standard_success`;
    const dataUrl = await QRCode.toDataURL(url, { width: 180, margin: 1 });

    jobs.push({
      id: `job-sample-${Date.now()}-${i}`,
      fileName,
      qrDataUrl: dataUrl,
      decodedUrl: url,
      status: 'PENDING',
      attempts: 0,
      maxRetries: 2,
      stepLogs: [
        {
          step: 'DECODE',
          timestamp: new Date().toISOString(),
          status: 'success',
          message: `Decoded URL: ${url}`,
        },
      ],
    });
  }

  return jobs;
}
