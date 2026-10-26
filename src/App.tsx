import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { LiveScanner } from './components/LiveScanner';
import { AutomationWizard } from './components/AutomationWizard';
import { PhoneRegistry } from './components/PhoneRegistry';
import { FolderSelector } from './components/FolderSelector';
import { QueueDashboard } from './components/QueueDashboard';
import { HumanOtpModal } from './components/HumanOtpModal';
import { SettingsModal } from './components/SettingsModal';
import {
  AutomationSettings,
  PhoneNumberUsage,
  QRJobItem,
} from './types';
import {
  loadPhoneNumbers,
  loadSettings,
  savePhoneNumbers,
  saveSettings,
  getSavedFolderName,
} from './services/storage';
import { getAllJobsFromDB, saveJobsToDB } from './services/db';
import {
  AutomationController,
  ControllerState,
} from './services/automationController';

export default function App() {
  // Default to 'scanner' on first view as requested
  const [activeTab, setActiveTab] = useState<'scanner' | 'dashboard' | 'phones' | 'folder' | 'settings' | 'sandbox'>('scanner');
  const [showWizard, setShowWizard] = useState(false);

  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberUsage[]>([]);
  const [settings, setSettings] = useState<AutomationSettings>(loadSettings());
  const [jobs, setJobs] = useState<QRJobItem[]>([]);
  const [folderName, setFolderName] = useState<string>(getSavedFolderName() || '');
  const [controllerState, setControllerState] = useState<ControllerState>('idle');
  const [activeJob, setActiveJob] = useState<QRJobItem | null>(null);
  const [processedCount, setProcessedCount] = useState<number>(0);

  // Human OTP modal state
  const [pendingOtpRequest, setPendingOtpRequest] = useState<{
    jobId: string;
    phoneNumber: string;
    timeoutSeconds: number;
  } | null>(null);

  const controllerRef = useRef<AutomationController | null>(null);

  // Initialize data on mount
  useEffect(() => {
    const loadedPhones = loadPhoneNumbers();
    const loadedSettings = loadSettings();
    const savedFolder = getSavedFolderName() || '';

    setPhoneNumbers(loadedPhones);
    setSettings(loadedSettings);
    setFolderName(savedFolder);

    // Load persisted jobs from IndexedDB
    getAllJobsFromDB()
      .then((loadedJobs) => {
        if (loadedJobs && loadedJobs.length > 0) {
          setJobs(loadedJobs);
        }
      })
      .catch((err) => console.warn('Failed to load jobs from IndexedDB:', err));
  }, []);

  // Update controller callbacks whenever state updates
  useEffect(() => {
    controllerRef.current = new AutomationController(settings, phoneNumbers, {
      onStateChange: (newState) => {
        setControllerState(newState);
      },
      onActiveJobChange: (job) => {
        setActiveJob(job);
      },
      onJobUpdate: (updatedJob) => {
        setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
      },
      onQueueUpdate: (updatedQueue) => {
        setJobs(updatedQueue);
      },
      onPhoneNumbersUpdate: (updatedPhones) => {
        setPhoneNumbers(updatedPhones);
      },
      onOtpRequired: (payload) => {
        setPendingOtpRequest(payload);
      },
      onBatchLimitReached: (processed) => {
        setProcessedCount(processed);
      },
    });

    if (jobs.length > 0) {
      controllerRef.current.setQueue(jobs);
    }
  }, [settings, phoneNumbers]);

  const handleStartAutomation = () => {
    if (!controllerRef.current) return;
    controllerRef.current.setQueue(jobs);
    controllerRef.current.start();
    setActiveTab('dashboard');
  };

  const handlePauseAutomation = () => {
    controllerRef.current?.pause();
  };

  const handleResumeAutomation = () => {
    controllerRef.current?.resume();
  };

  const handleStopAutomation = () => {
    controllerRef.current?.stop();
  };

  const handleRetryFailed = () => {
    controllerRef.current?.retryFailedJobs();
  };

  const handleRetrySingle = (jobId: string) => {
    setJobs((prev) => {
      const updated = prev.map((job) => {
        if (job.id === jobId) {
          return {
            ...job,
            status: 'PENDING' as const,
            errorReason: undefined,
          };
        }
        return job;
      });
      saveJobsToDB(updated);
      controllerRef.current?.setQueue(updated);
      return updated;
    });
  };

  const handleQueueGenerated = (newJobs: QRJobItem[], newFolderName: string) => {
    setJobs(newJobs);
    setFolderName(newFolderName);
    controllerRef.current?.setQueue(newJobs);
  };

  const handleSubmitHumanOtp = async (otp: string) => {
    if (!pendingOtpRequest) return;
    try {
      await fetch('/api/automation/submit-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: pendingOtpRequest.jobId, otp }),
      });
    } catch (err) {
      console.error('Failed to submit human OTP:', err);
    } finally {
      setPendingOtpRequest(null);
    }
  };

  const handleCancelHumanOtp = () => {
    setPendingOtpRequest(null);
  };

  // Called when user finishes the 3-step Automation Wizard
  const handleFinishWizard = (
    newPhones: PhoneNumberUsage[],
    newJobs: QRJobItem[],
    newFolderName: string
  ) => {
    setPhoneNumbers(newPhones);
    setJobs(newJobs);
    setFolderName(newFolderName);
    setShowWizard(false);
    setActiveTab('dashboard');

    if (controllerRef.current) {
      controllerRef.current.updatePhoneNumbers(newPhones);
      controllerRef.current.setQueue(newJobs);
      // Auto-start scanning and automated execution from the selected folder
      setTimeout(() => {
        controllerRef.current?.start();
      }, 300);
    }
  };

  const handleDataCleared = () => {
    setPhoneNumbers(loadPhoneNumbers());
    setSettings(loadSettings());
    setJobs([]);
    setFolderName('');
    setActiveTab('scanner');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Bar Contract (White, Black, Red) */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setShowWizard(false);
        }}
        controllerState={controllerState}
        hasJobs={jobs.length > 0}
        onStart={handleStartAutomation}
        onPause={handlePauseAutomation}
        onResume={handleResumeAutomation}
        onStop={handleStopAutomation}
        onOpenAutomateWizard={() => setShowWizard(true)}
      />

      {/* Main Viewport Container */}
      <main className="flex-1">
        {showWizard ? (
          <AutomationWizard
            initialPhoneNumbers={phoneNumbers}
            onFinishWizard={handleFinishWizard}
            onCancel={() => setShowWizard(false)}
          />
        ) : (
          <>
            {activeTab === 'scanner' && (
              <LiveScanner
                onStartAutomationFlow={() => setShowWizard(true)}
                onScannedSingleUrl={(url) => {
                  console.log('Scanned QR:', url);
                }}
              />
            )}

            {activeTab === 'dashboard' && (
              <QueueDashboard
                jobs={jobs}
                activeJob={activeJob}
                controllerState={controllerState}
                processedCount={processedCount}
                settings={settings}
                phoneNumbers={phoneNumbers}
                folderName={folderName}
                onStart={handleStartAutomation}
                onPause={handlePauseAutomation}
                onResume={handleResumeAutomation}
                onStop={handleStopAutomation}
                onRetryFailed={handleRetryFailed}
                onRetrySingle={handleRetrySingle}
                onNavigateToTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'phones' && (
              <div className="bg-white min-h-[calc(100vh-65px)]">
                <PhoneRegistry
                  phoneNumbers={phoneNumbers}
                  onUpdate={(updated) => {
                    setPhoneNumbers(updated);
                    controllerRef.current?.updatePhoneNumbers(updated);
                  }}
                  showOnboardingNext={false}
                />
              </div>
            )}

            {activeTab === 'folder' && (
              <div className="bg-white min-h-[calc(100vh-65px)]">
                <FolderSelector
                  currentFolderName={folderName}
                  queueCount={jobs.length}
                  onQueueGenerated={handleQueueGenerated}
                  onContinueToDashboard={() => setActiveTab('dashboard')}
                  showOnboardingNext={true}
                />
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="bg-white min-h-[calc(100vh-65px)]">
                <SettingsModal
                  settings={settings}
                  folderName={folderName}
                  phoneCount={phoneNumbers.length}
                  onUpdateSettings={(updated) => {
                    setSettings(updated);
                    controllerRef.current?.updateSettings(updated);
                  }}
                  onDataCleared={handleDataCleared}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Human-in-the-loop OTP Modal */}
      {pendingOtpRequest && (
        <HumanOtpModal
          jobId={pendingOtpRequest.jobId}
          phoneNumber={pendingOtpRequest.phoneNumber}
          timeoutSeconds={pendingOtpRequest.timeoutSeconds}
          onSubmitOtp={handleSubmitHumanOtp}
          onCancel={handleCancelHumanOtp}
        />
      )}
    </div>
  );
}
