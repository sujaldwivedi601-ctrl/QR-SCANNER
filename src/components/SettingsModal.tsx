import React, { useState } from 'react';
import { Settings, Trash2, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AutomationSettings } from '../types';
import { clearAllLocalData, saveSettings } from '../services/storage';
import { clearAllJobsFromDB } from '../services/db';

interface SettingsModalProps {
  settings: AutomationSettings;
  folderName: string;
  phoneCount: number;
  onUpdateSettings: (newSettings: AutomationSettings) => void;
  onDataCleared: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  folderName,
  phoneCount,
  onUpdateSettings,
  onDataCleared,
}) => {
  const [current, setCurrent] = useState<AutomationSettings>({ ...settings });
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (updated: AutomationSettings) => {
    setCurrent(updated);
    saveSettings(updated);
    onUpdateSettings(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleClearData = async () => {
    clearAllLocalData();
    await clearAllJobsFromDB();
    setShowConfirmClear(false);
    onDataCleared();
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Editorial Header */}
      <div>
        <span className="text-xs font-bold text-red-600 uppercase tracking-wider block mb-1">
          Preferences
        </span>
        <h1 className="text-2xl font-black tracking-tight text-black">
          Application Preferences &amp; Settings
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure batch thresholds, failover policies, and local storage retention.
        </p>
      </div>

      <div className="space-y-6">
        {/* Batch Limit Setting */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <strong className="text-sm text-black block">Configurable Batch Limit</strong>
              <p className="text-xs text-slate-500 mt-0.5">
                Total QR jobs executed before the automation halts automatically.
              </p>
            </div>
            <span className="font-mono text-sm font-black text-red-600 tabular-nums">
              {current.batchLimit} items
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {[10, 25, 50, 100].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleSave({ ...current, batchLimit: val })}
                className={`px-4 py-2 text-xs font-bold rounded-xl border transition-colors ${
                  current.batchLimit === val
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-black'
                }`}
              >
                {val} QRs
              </button>
            ))}
          </div>
        </div>

        {/* OTP Timeout Setting */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <strong className="text-sm text-black block">OTP Wait Timeout</strong>
              <p className="text-xs text-slate-500 mt-0.5">
                Maximum seconds to wait for an authorized OTP before marking the item as OTP_TIMEOUT.
              </p>
            </div>
            <span className="font-mono text-sm font-black text-red-600 tabular-nums">
              {current.otpTimeoutSeconds}s
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {[30, 60, 90, 120].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => handleSave({ ...current, otpTimeoutSeconds: sec })}
                className={`px-4 py-2 text-xs font-bold rounded-xl border transition-colors ${
                  current.otpTimeoutSeconds === sec
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-black'
                }`}
              >
                {sec} Seconds
              </button>
            ))}
          </div>
        </div>

        {/* Maximum Retries Setting */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <strong className="text-sm text-black block">Maximum Retries</strong>
              <p className="text-xs text-slate-500 mt-0.5">
                Limit automated retry attempts on failed jobs during &quot;Retry Failed&quot; actions.
              </p>
            </div>
            <span className="font-mono text-sm font-black text-red-600 tabular-nums">
              {current.maxRetries} attempts
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {[1, 2, 3].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleSave({ ...current, maxRetries: val })}
                className={`px-4 py-2 text-xs font-bold rounded-xl border transition-colors ${
                  current.maxRetries === val
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-black'
                }`}
              >
                {val} Max {val === 1 ? 'Retry' : 'Retries'}
              </button>
            ))}
          </div>
        </div>

        {/* Failover / Number Rotation Behavior */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-4 shadow-xs">
          <div>
            <strong className="text-sm text-black block">Automatic Phone Rotation on Limit</strong>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatically switch to the next authorized backup number if a service reports a permitted limit reached.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleSave({ ...current, autoRotateOnLimit: !current.autoRotateOnLimit })}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${
              current.autoRotateOnLimit ? 'bg-red-600' : 'bg-slate-300'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                current.autoRotateOnLimit ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Clear All Local Data */}
        <div className="p-5 rounded-2xl bg-rose-50/50 border border-rose-200 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <strong className="text-sm text-rose-800 block">Clear All Local Data</strong>
              <p className="text-xs text-slate-600 mt-0.5">
                Erase all registered phone numbers, queue history, decoded items, and application preferences from this device.
              </p>
            </div>
            <button
              onClick={() => setShowConfirmClear(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-100 border border-rose-300 rounded-xl hover:bg-rose-200 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Local Data
            </button>
          </div>

          {showConfirmClear && (
            <div className="p-4 rounded-xl bg-white border-2 border-red-600 space-y-3 mt-2 shadow-md">
              <div className="flex items-center gap-2 text-red-600 text-xs font-bold">
                <AlertTriangle className="w-4 h-4" />
                Are you sure you want to delete all local application data?
              </div>
              <p className="text-xs text-slate-700">
                This will reset your {phoneCount} authorized phone numbers and clear all saved QR jobs from IndexedDB. This action cannot be undone.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleClearData}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  Confirm Delete Everything
                </button>
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-black"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
