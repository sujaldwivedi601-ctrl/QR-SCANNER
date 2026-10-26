/**
 * Core type definitions for QR Flow Automator
 */

export type QRJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'INVALID_QR'
  | 'URL_ERROR'
  | 'WEBSITE_UNAVAILABLE'
  | 'PHONE_FIELD_NOT_FOUND'
  | 'OTP_REQUEST_FAILED'
  | 'OTP_TIMEOUT'
  | 'OTP_INVALID'
  | 'SUBMIT_FAILED'
  | 'UNSUPPORTED_PAGE'
  | 'AUTOMATION_ERROR';

export interface StepLog {
  step: string;
  timestamp: string;
  status: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface QRJobItem {
  id: string;
  fileName: string;
  fileSize?: number;
  qrDataUrl?: string; // base64 preview
  decodedUrl?: string;
  status: QRJobStatus;
  errorReason?: string;
  referenceId?: string;
  phoneNumberUsed?: string;
  attempts: number;
  maxRetries: number;
  startedAt?: string;
  completedAt?: string;
  stepLogs: StepLog[];
}

export interface PhoneNumberUsage {
  id: string;
  number: string;
  label: string;
  status: 'active' | 'available' | 'limit_reached' | 'disabled';
  usageCount: number;
  maxLimit: number;
  lastUsedAt?: string;
}

export interface AutomationSettings {
  batchLimit: number; // default: 10
  otpTimeoutSeconds: number; // default: 60
  maxRetries: number; // default: 2
  rotationStrategy: 'sequential' | 'balanced';
  humanOtpFallback: boolean; // default: true
  autoRotateOnLimit: boolean; // default: true
  allowAiVisionFallback: boolean; // default: true
  testModePortal: boolean; // whether to redirect or use built-in test portal for demonstrations
}

export interface AutomationMetrics {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  pending: number;
}

export interface OTPRequestPayload {
  jobId: string;
  phoneNumber: string;
  expiresAt: number;
  hint?: string;
}
