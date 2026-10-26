import React from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { ControllerState } from '../services/automationController';

interface TopBarProps {
  activeTab: 'scanner' | 'dashboard' | 'phones' | 'folder' | 'settings' | 'sandbox';
  setActiveTab: (tab: 'scanner' | 'dashboard' | 'phones' | 'folder' | 'settings' | 'sandbox') => void;
  controllerState: ControllerState;
  hasJobs: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onOpenAutomateWizard: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  controllerState,
  hasJobs,
  onStart,
  onPause,
  onResume,
  onStop,
  onOpenAutomateWizard,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      {/* Zone 1: Brand Wordmark (White, Black, Red) */}
      <div
        onClick={() => setActiveTab('scanner')}
        className="flex items-center gap-2.5 shrink-0 cursor-pointer"
      >
        <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-mono font-black text-sm shadow-sm">
          QR
        </div>
        <span className="text-lg font-black tracking-tight text-black whitespace-nowrap shrink-0">
          QR Flow
        </span>
      </div>

      {/* Zone 2: Navigation Links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`hover:text-black transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
            activeTab === 'scanner' ? 'text-red-600 border-red-600 font-bold' : 'border-transparent'
          }`}
        >
          Scan QR
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`hover:text-black transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
            activeTab === 'dashboard' ? 'text-red-600 border-red-600 font-bold' : 'border-transparent'
          }`}
        >
          Automate Queue
        </button>
        <button
          onClick={() => setActiveTab('phones')}
          className={`hover:text-black transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
            activeTab === 'phones' ? 'text-red-600 border-red-600 font-bold' : 'border-transparent'
          }`}
        >
          Phone Numbers
        </button>
        <button
          onClick={() => setActiveTab('folder')}
          className={`hover:text-black transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
            activeTab === 'folder' ? 'text-red-600 border-red-600 font-bold' : 'border-transparent'
          }`}
        >
          QR Folder
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`hover:text-black transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
            activeTab === 'settings' ? 'text-red-600 border-red-600 font-bold' : 'border-transparent'
          }`}
        >
          Settings
        </button>
      </nav>

      {/* Zone 3: Primary Action */}
      <div className="flex items-center gap-2 shrink-0">
        {controllerState === 'running' ? (
          <>
            <button
              onClick={onPause}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
              title="Pause automation"
            >
              <Pause className="w-3.5 h-3.5" />
              Pause
            </button>
            <button
              onClick={onStop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap shrink-0"
              title="Stop automation"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          </>
        ) : controllerState === 'paused' ? (
          <>
            <button
              onClick={onResume}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Resume
            </button>
            <button
              onClick={onStop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          </>
        ) : activeTab === 'dashboard' ? (
          <button
            onClick={onStart}
            disabled={!hasJobs}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors shadow-xs whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Start Automation
          </button>
        ) : (
          <button
            onClick={onOpenAutomateWizard}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-blue-600 bg-white border-2 border-blue-600 hover:bg-blue-50 rounded-lg transition-colors shadow-xs whitespace-nowrap shrink-0"
          >
            Automate OTP QR
          </button>
        )}
      </div>
    </header>
  );
};
