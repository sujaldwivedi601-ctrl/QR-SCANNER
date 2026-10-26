import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
  Search,
  Smartphone,
  Folder,
  Layers,
} from 'lucide-react';
import {
  AutomationSettings,
  PhoneNumberUsage,
  QRJobItem,
  QRJobStatus,
} from '../types';
import { ControllerState } from '../services/automationController';

interface QueueDashboardProps {
  jobs: QRJobItem[];
  activeJob: QRJobItem | null;
  controllerState: ControllerState;
  processedCount: number;
  settings: AutomationSettings;
  phoneNumbers: PhoneNumberUsage[];
  folderName: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRetryFailed: () => void;
  onRetrySingle: (jobId: string) => void;
  onNavigateToTab: (tab: 'phones' | 'folder' | 'settings') => void;
}

export const QueueDashboard: React.FC<QueueDashboardProps> = ({
  jobs,
  activeJob,
  controllerState,
  processedCount,
  settings,
  phoneNumbers,
  folderName,
  onStart,
  onPause,
  onResume,
  onStop,
  onRetryFailed,
  onRetrySingle,
  onNavigateToTab,
}) => {
  const [filter, setFilter] = useState<'all' | 'successful' | 'failed' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectingJob, setInspectingJob] = useState<QRJobItem | null>(null);

  // Computed metrics
  const totalCount = jobs.length;
  const successCount = jobs.filter((j) => j.status === 'SUCCESS').length;
  const failedCount = jobs.filter(
    (j) =>
      j.status === 'FAILED' ||
      j.status === 'INVALID_QR' ||
      j.status === 'URL_ERROR' ||
      j.status === 'WEBSITE_UNAVAILABLE' ||
      j.status === 'PHONE_FIELD_NOT_FOUND' ||
      j.status === 'OTP_REQUEST_FAILED' ||
      j.status === 'OTP_TIMEOUT' ||
      j.status === 'OTP_INVALID' ||
      j.status === 'SUBMIT_FAILED' ||
      j.status === 'AUTOMATION_ERROR'
  ).length;
  const pendingCount = jobs.filter((j) => j.status === 'PENDING').length;
  const activeCount = jobs.filter((j) => j.status === 'PROCESSING').length;

  // Filtered queue
  const filteredJobs = jobs.filter((job) => {
    if (filter === 'successful' && job.status !== 'SUCCESS') return false;
    if (filter === 'pending' && job.status !== 'PENDING') return false;
    if (
      filter === 'failed' &&
      job.status !== 'FAILED' &&
      job.status !== 'INVALID_QR' &&
      job.status !== 'URL_ERROR' &&
      job.status !== 'WEBSITE_UNAVAILABLE' &&
      job.status !== 'PHONE_FIELD_NOT_FOUND' &&
      job.status !== 'OTP_REQUEST_FAILED' &&
      job.status !== 'OTP_TIMEOUT' &&
      job.status !== 'OTP_INVALID' &&
      job.status !== 'SUBMIT_FAILED' &&
      job.status !== 'AUTOMATION_ERROR'
    ) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        job.fileName.toLowerCase().includes(q) ||
        (job.decodedUrl && job.decodedUrl.toLowerCase().includes(q)) ||
        (job.referenceId && job.referenceId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Active phone number
  const activePhone = phoneNumbers.find((p) => p.status === 'active') || phoneNumbers[0];

  const getStatusBadge = (status: QRJobStatus) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Success
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-sky-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            Processing
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Pending
          </span>
        );
      case 'OTP_TIMEOUT':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium">
            <XCircle className="w-3.5 h-3.5 text-amber-400" />
            OTP Timeout
          </span>
        );
      case 'INVALID_QR':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            Invalid QR
          </span>
        );
      case 'PHONE_FIELD_NOT_FOUND':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            Phone Field Missing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            {status.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8 bg-slate-50 min-h-[calc(100vh-65px)]">
      {/* Pre-Start Checklist / Main Action Hero when Idle */}
      {controllerState === 'idle' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-red-600 font-bold block">
                Workflow Pre-flight Readiness
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-black">
                Automated QR Sequential Processing
              </h1>
              
              {/* Unboxed Metadata Checklist */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-600 pt-1">
                <button
                  onClick={() => onNavigateToTab('phones')}
                  className="flex items-center gap-1.5 text-slate-700 hover:text-red-600 transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5 text-red-600" />
                  <span>Phone Numbers:</span>
                  <strong className="text-black">{phoneNumbers.length} authorized</strong>
                </button>

                <span aria-hidden="true" className="text-slate-300">·</span>

                <button
                  onClick={() => onNavigateToTab('folder')}
                  className="flex items-center gap-1.5 text-slate-700 hover:text-red-600 transition-colors"
                >
                  <Folder className="w-3.5 h-3.5 text-black" />
                  <span>QR Folder:</span>
                  <strong className="text-black">{folderName || 'Not selected'}</strong>
                </button>

                <span aria-hidden="true" className="text-slate-300">·</span>

                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-red-600" />
                  <span>Batch Limit:</span>
                  <strong className="text-black font-mono tabular-nums">{settings.batchLimit} items</strong>
                </div>

                <span aria-hidden="true" className="text-slate-300">·</span>

                <div className="flex items-center gap-1.5">
                  <span>Queued:</span>
                  <strong className="text-black font-mono tabular-nums">{jobs.length} items</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={onStart}
                disabled={jobs.length === 0}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-40 transition-all shadow-md shadow-red-600/20"
              >
                <Play className="w-4 h-4 fill-current" />
                START AUTOMATION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">Total QR Codes</span>
          <span className="text-2xl font-black font-mono tabular-nums text-black">{totalCount}</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">Processed</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono tabular-nums text-black">{processedCount}</span>
            <span className="text-xs text-slate-400 font-mono">/ {settings.batchLimit}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs text-emerald-700 font-semibold block mb-1">Successful</span>
          <span className="text-2xl font-black font-mono tabular-nums text-emerald-600">{successCount}</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs text-red-600 font-semibold block mb-1">Failed</span>
          <span className="text-2xl font-black font-mono tabular-nums text-red-600">{failedCount}</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-500 font-semibold block mb-1">Pending FIFO</span>
          <span className="text-2xl font-black font-mono tabular-nums text-slate-700">{pendingCount}</span>
        </div>
      </div>

      {/* Live Automation Execution Card when running or paused */}
      {(controllerState === 'running' || controllerState === 'paused' || activeJob) && (
        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-red-600 uppercase tracking-wider font-bold block">
                {controllerState === 'running' ? 'Active Worker in Progress' : 'Automation Paused'}
              </span>
              <h2 className="text-lg font-black text-black mt-0.5">
                Current Item: <span className="font-mono text-red-600">{activeJob?.fileName || 'Waiting for next job...'}</span>
              </h2>
              {activeJob?.phoneNumberUsed && (
                <div className="flex items-center gap-2 text-xs text-slate-600 font-mono mt-1">
                  <span>Using line: <strong className="text-black">{activeJob.phoneNumberUsed}</strong></span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>Batch Progress: <strong className="text-black tabular-nums">{processedCount} / {settings.batchLimit}</strong></span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {controllerState === 'running' ? (
                <button
                  onClick={onPause}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                  PAUSE
                </button>
              ) : (
                <button
                  onClick={onResume}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  RESUME
                </button>
              )}
              <button
                onClick={onStop}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                STOP
              </button>
            </div>
          </div>

          {/* Active Job Real-Time Step Logs */}
          {activeJob && activeJob.stepLogs.length > 0 && (
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-xs max-h-44 overflow-y-auto space-y-1 text-slate-100">
              {activeJob.stepLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`shrink-0 font-bold ${
                      log.status === 'success'
                        ? 'text-emerald-400'
                        : log.status === 'error'
                        ? 'text-red-400'
                        : log.status === 'warning'
                        ? 'text-amber-400'
                        : 'text-cyan-400'
                    }`}
                  >
                    [{log.step}]
                  </span>
                  <span className="text-slate-200 truncate">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Queue Table Controls & Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Segmented Filter Buttons */}
          <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200 self-start shadow-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilter('successful')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                filter === 'successful'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              Successful ({successCount})
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                filter === 'failed'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              Failed ({failedCount})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                filter === 'pending'
                  ? 'bg-slate-200 text-black shadow-xs'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              Pending ({pendingCount})
            </button>
          </div>

          {/* Search Input & Retry Action */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search file or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-black placeholder-slate-400 focus:outline-none focus:border-red-600 shadow-xs"
              />
            </div>

            {failedCount > 0 && (
              <button
                onClick={onRetryFailed}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap shrink-0 shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry Failed ({failedCount})
              </button>
            )}
          </div>
        </div>

        {/* High-Density Data Grid */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Order / File</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Extracted Target URL</th>
                  <th className="py-3 px-4">Line Used</th>
                  <th className="py-3 px-4 text-right">Result / Reference</th>
                  <th className="py-3 px-4 text-center">Logs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                      {jobs.length === 0
                        ? 'No QR codes loaded. Please select your "QR Code" folder to begin.'
                        : 'No QR jobs matching selected filter criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job, index) => (
                    <tr
                      key={job.id}
                      className="hover:bg-slate-50/80 transition-colors h-11"
                    >
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {job.qrDataUrl ? (
                            <img
                              src={job.qrDataUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 rounded border border-slate-200 bg-white object-contain shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded border border-slate-200 bg-slate-100 flex items-center justify-center font-mono text-[9px] text-slate-500 shrink-0">
                              QR
                            </div>
                          )}
                          <div>
                            <span className="font-mono font-bold text-black block">
                              {job.fileName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              FIFO #{index + 1}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {getStatusBadge(job.status)}
                      </td>

                      <td className="py-2.5 px-4 max-w-xs truncate font-mono text-slate-600">
                        {job.decodedUrl ? (
                          <span title={job.decodedUrl}>{job.decodedUrl}</span>
                        ) : (
                          <span className="text-slate-400">None (Decode failed)</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap font-mono text-slate-700">
                        {job.phoneNumberUsed || '—'}
                      </td>

                      <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono">
                        {job.referenceId ? (
                          <span className="text-black font-extrabold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {job.referenceId}
                          </span>
                        ) : job.errorReason ? (
                          <span className="text-red-600 text-[11px] font-semibold" title={job.errorReason}>
                            {job.errorReason.length > 28
                              ? `${job.errorReason.substring(0, 28)}...`
                              : job.errorReason}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => setInspectingJob(job)}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-black bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
                        >
                          View ({job.stepLogs.length})
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Step Logs Inspection Modal */}
      {inspectingJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-black font-mono">
                  {inspectingJob.fileName}
                </h3>
                <span className="text-xs text-slate-500 font-semibold">
                  Status: {inspectingJob.status} · Attempts: {inspectingJob.attempts}
                </span>
              </div>
              <button
                onClick={() => setInspectingJob(null)}
                className="p-1 text-slate-400 hover:text-black text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-2 bg-slate-50">
              {inspectingJob.stepLogs.length === 0 ? (
                <p className="text-slate-400">No logs recorded yet.</p>
              ) : (
                inspectingJob.stepLogs.map((log, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1 shadow-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span
                        className={`font-black ${
                          log.status === 'success'
                            ? 'text-emerald-600'
                            : log.status === 'error'
                            ? 'text-red-600'
                            : log.status === 'warning'
                            ? 'text-amber-600'
                            : 'text-black'
                        }`}
                      >
                        {log.step}
                      </span>
                      <span className="text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-slate-800 leading-relaxed break-all">
                      {log.message}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-white">
              {inspectingJob.status !== 'SUCCESS' && inspectingJob.status !== 'PROCESSING' && (
                <button
                  onClick={() => {
                    onRetrySingle(inspectingJob.id);
                    setInspectingJob(null);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100"
                >
                  Retry This Item
                </button>
              )}
              <button
                onClick={() => setInspectingJob(null)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-black rounded-lg hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
