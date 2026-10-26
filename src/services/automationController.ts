import {
  AutomationSettings,
  PhoneNumberUsage,
  QRJobItem,
  QRJobStatus,
  StepLog,
} from '../types';
import { saveJobToDB, saveJobsToDB } from './db';
import {
  getActivePhoneNumber,
  incrementPhoneUsage,
  rotateToNextPhoneNumber,
  savePhoneNumbers,
} from './storage';

export type ControllerState = 'idle' | 'running' | 'paused' | 'stopped' | 'completed';

export interface AutomationCallbacks {
  onStateChange: (state: ControllerState) => void;
  onActiveJobChange: (job: QRJobItem | null) => void;
  onJobUpdate: (job: QRJobItem) => void;
  onQueueUpdate: (jobs: QRJobItem[]) => void;
  onPhoneNumbersUpdate: (numbers: PhoneNumberUsage[]) => void;
  onOtpRequired: (payload: { jobId: string; phoneNumber: string; timeoutSeconds: number } | null) => void;
  onBatchLimitReached: (processedCount: number, limit: number) => void;
}

export class AutomationController {
  private queue: QRJobItem[] = [];
  private state: ControllerState = 'idle';
  private activeJob: QRJobItem | null = null;
  private settings: AutomationSettings;
  private phoneNumbers: PhoneNumberUsage[];
  private callbacks: AutomationCallbacks;
  private processedInCurrentBatch = 0;
  private shouldStop = false;

  constructor(
    settings: AutomationSettings,
    phoneNumbers: PhoneNumberUsage[],
    callbacks: AutomationCallbacks
  ) {
    this.settings = settings;
    this.phoneNumbers = phoneNumbers;
    this.callbacks = callbacks;
  }

  public updateSettings(settings: AutomationSettings) {
    this.settings = settings;
  }

  public updatePhoneNumbers(numbers: PhoneNumberUsage[]) {
    this.phoneNumbers = numbers;
  }

  public setQueue(jobs: QRJobItem[]) {
    this.queue = jobs;
    this.callbacks.onQueueUpdate([...this.queue]);
  }

  public getQueue(): QRJobItem[] {
    return this.queue;
  }

  public getState(): ControllerState {
    return this.state;
  }

  public getActiveJob(): QRJobItem | null {
    return this.activeJob;
  }

  public getProcessedCount(): number {
    return this.processedInCurrentBatch;
  }

  public start() {
    if (this.state === 'running') return;
    this.shouldStop = false;
    this.processedInCurrentBatch = 0;
    this.setState('running');
    this.processNextInQueue();
  }

  public pause() {
    if (this.state !== 'running') return;
    this.setState('paused');
  }

  public resume() {
    if (this.state !== 'paused') return;
    this.setState('running');
    this.processNextInQueue();
  }

  public stop() {
    this.shouldStop = true;
    this.setState('stopped');
    this.activeJob = null;
    this.callbacks.onActiveJobChange(null);
    this.callbacks.onOtpRequired(null);
  }

  public retryFailedJobs() {
    const updated = this.queue.map((item) => {
      if (
        item.status === 'FAILED' ||
        item.status === 'OTP_TIMEOUT' ||
        item.status === 'OTP_REQUEST_FAILED' ||
        item.status === 'SUBMIT_FAILED' ||
        item.status === 'WEBSITE_UNAVAILABLE' ||
        item.status === 'AUTOMATION_ERROR'
      ) {
        if (item.attempts < (this.settings.maxRetries || 2)) {
          return {
            ...item,
            status: 'PENDING' as QRJobStatus,
            errorReason: undefined,
          };
        }
      }
      return item;
    });

    this.queue = updated;
    saveJobsToDB(this.queue);
    this.callbacks.onQueueUpdate([...this.queue]);

    if (this.state === 'idle' || this.state === 'completed' || this.state === 'stopped') {
      this.start();
    }
  }

  private setState(newState: ControllerState) {
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  private async processNextInQueue() {
    if (this.shouldStop || this.state !== 'running') {
      return;
    }

    // Check batch limit
    if (this.processedInCurrentBatch >= this.settings.batchLimit) {
      this.callbacks.onBatchLimitReached(this.processedInCurrentBatch, this.settings.batchLimit);
      this.setState('completed');
      this.activeJob = null;
      this.callbacks.onActiveJobChange(null);
      return;
    }

    // Strictly FIFO: Find first PENDING job in deterministically ordered queue
    const nextJobIndex = this.queue.findIndex((job) => job.status === 'PENDING');

    if (nextJobIndex === -1) {
      // No more pending jobs!
      this.setState('completed');
      this.activeJob = null;
      this.callbacks.onActiveJobChange(null);
      return;
    }

    const job = { ...this.queue[nextJobIndex] };
    this.activeJob = job;
    this.callbacks.onActiveJobChange(job);

    // Get currently active authorized phone number
    let activePhone = getActivePhoneNumber(this.phoneNumbers);
    if (!activePhone) {
      // Try to rotate to any available
      const { updatedNumbers, nextNumber } = rotateToNextPhoneNumber(this.phoneNumbers);
      this.phoneNumbers = updatedNumbers;
      this.callbacks.onPhoneNumbersUpdate(this.phoneNumbers);
      activePhone = nextNumber;
    }

    if (!activePhone) {
      // All authorized numbers have reached limit or are disabled
      job.status = 'AUTOMATION_ERROR';
      job.errorReason = 'No active authorized phone number available';
      this.updateJobInQueue(job);
      this.stop();
      return;
    }

    // Transition job to PROCESSING
    job.status = 'PROCESSING';
    job.attempts += 1;
    job.phoneNumberUsed = activePhone.number;
    job.startedAt = new Date().toISOString();
    this.addJobLog(job, 'PROCESSING', 'info', `Processing initiated with ${activePhone.label} (${activePhone.number})`);
    this.updateJobInQueue(job);

    // Start background status poll to detect if Playwright requests human OTP input
    let otpPoller: any = null;
    let otpReported = false;
    otpPoller = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/automation/job-status?jobId=${job.id}`);
        const statusData = await statusRes.json();
        if (statusData.active && statusData.status === 'waiting_for_otp' && !otpReported) {
          otpReported = true;
          this.callbacks.onOtpRequired({
            jobId: job.id,
            phoneNumber: activePhone.number,
            timeoutSeconds: this.settings.otpTimeoutSeconds || 60,
          });
        } else if (statusData.status !== 'waiting_for_otp' && otpReported) {
          otpReported = false;
          this.callbacks.onOtpRequired(null);
        }
      } catch {
        // silent polling catch
      }
    }, 700);

    // Call backend automation service
    try {
      const response = await fetch('/api/automation/run-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job,
          phoneNumber: activePhone,
          settings: this.settings,
        }),
      });

      clearInterval(otpPoller);
      this.callbacks.onOtpRequired(null);

      const data = await response.json();

      job.status = data.status || (data.success ? 'SUCCESS' : 'FAILED');
      job.errorReason = data.errorReason;
      job.referenceId = data.referenceId;
      job.completedAt = new Date().toISOString();

      if (Array.isArray(data.stepLogs)) {
        job.stepLogs = [...job.stepLogs, ...data.stepLogs];
      }

      // Check for phone number limit reached signal from target service
      if (
        data.status === 'FAILED' &&
        data.errorReason &&
        (data.errorReason.includes('limit reached') || data.errorReason.includes('too many attempts'))
      ) {
        if (this.settings.autoRotateOnLimit) {
          const { updatedNumbers, nextNumber } = rotateToNextPhoneNumber(
            this.phoneNumbers,
            activePhone.id,
            'limit_reached'
          );
          this.phoneNumbers = updatedNumbers;
          this.callbacks.onPhoneNumbersUpdate(this.phoneNumbers);
          this.addJobLog(
            job,
            'PHONE_ROTATED',
            'warning',
            `Target reached limit on ${activePhone.number}. Rotated to ${nextNumber ? nextNumber.number : 'None'}`
          );
        }
      } else if (data.status === 'SUCCESS') {
        // Increment usage count for active phone
        const { updatedNumbers, isLimitReached } = incrementPhoneUsage(this.phoneNumbers, activePhone.id);
        this.phoneNumbers = updatedNumbers;
        this.callbacks.onPhoneNumbersUpdate(this.phoneNumbers);

        if (isLimitReached && this.settings.autoRotateOnLimit) {
          const { updatedNumbers: rotated } = rotateToNextPhoneNumber(
            this.phoneNumbers,
            activePhone.id,
            'limit_reached'
          );
          this.phoneNumbers = rotated;
          this.callbacks.onPhoneNumbersUpdate(this.phoneNumbers);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      job.status = 'AUTOMATION_ERROR';
      job.errorReason = `Network/Worker error: ${msg}`;
      this.addJobLog(job, 'AUTOMATION_ERROR', 'error', msg);
    }

    this.processedInCurrentBatch += 1;
    this.updateJobInQueue(job);

    // Pause briefly (750ms) between FIFO items for natural cadence and DOM settling
    setTimeout(() => {
      if (this.state === 'running' && !this.shouldStop) {
        this.processNextInQueue();
      }
    }, 750);
  }

  private addJobLog(
    job: QRJobItem,
    step: string,
    status: 'info' | 'success' | 'warning' | 'error',
    message: string
  ) {
    const log: StepLog = {
      step,
      timestamp: new Date().toISOString(),
      status,
      message,
    };
    job.stepLogs.push(log);
  }

  private updateJobInQueue(job: QRJobItem) {
    const index = this.queue.findIndex((item) => item.id === job.id);
    if (index !== -1) {
      this.queue[index] = { ...job };
      saveJobToDB(this.queue[index]);
      this.callbacks.onJobUpdate(this.queue[index]);
      this.callbacks.onQueueUpdate([...this.queue]);
    }
  }
}
