import React, { useState } from 'react';
import { Play, Sparkles, ExternalLink, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
import { PhoneNumberUsage, QRJobItem } from '../types';

interface TestSandboxProps {
  phoneNumbers: PhoneNumberUsage[];
  onAddSampleJobAndRun: () => void;
}

export const TestSandbox: React.FC<TestSandboxProps> = ({
  phoneNumbers,
  onAddSampleJobAndRun,
}) => {
  const [iframeKey, setIframeKey] = useState(0);

  const activePhone = phoneNumbers.find((p) => p.status === 'active') || phoneNumbers[0];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Interactive Test Sandbox
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Built-in target portal simulating phone verification, OTP generation, and success confirmation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIframeKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Portal
          </button>
          <button
            onClick={onAddSampleJobAndRun}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-500 transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Run Test Automation Job
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Interactive Target Portal Preview */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <span className="ml-2 font-mono text-[11px] text-slate-300 truncate max-w-xs">
                /api/test-portal?ref=DEMO_PORTAL
              </span>
            </div>
            <a
              href="/api/test-portal?ref=DEMO_PORTAL"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-200 flex items-center gap-1 text-[11px]"
            >
              Open Tab <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="h-[460px] bg-slate-950">
            <iframe
              key={iframeKey}
              src="/api/test-portal?ref=DEMO_PORTAL"
              title="Target Portal Preview"
              className="w-full h-full border-0"
            />
          </div>
        </div>

        {/* Right: Architecture and Workflow Explanation */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <span className="text-xs font-mono uppercase tracking-wider text-sky-400 font-semibold block">
              Workflow Architecture
            </span>
            <h2 className="text-base font-bold text-slate-100">
              How the automation operates
            </h2>

            <ol className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-sky-400 font-bold shrink-0">1.</span>
                <span>
                  <strong>Decodes QR</strong>: Extracts the target URL from the image file and validates safe protocols.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-sky-400 font-bold shrink-0">2.</span>
                <span>
                  <strong>Semantic DOM Discovery</strong>: Searches for phone input using accessible labels, placeholders, and semantic attributes.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-sky-400 font-bold shrink-0">3.</span>
                <span>
                  <strong>OTP Request & Provider</strong>: Triggers OTP dispatch and uses the authorized OTP provider abstraction.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-sky-400 font-bold shrink-0">4.</span>
                <span>
                  <strong>Verification & Result Confirmation</strong>: Submits the one-time code, checks for confirmation banner/reference ID, and logs the result.
                </span>
              </li>
            </ol>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              Security & Compliance Invariants
            </div>
            <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
              <li>No bypass of anti-bot or CAPTCHA controls</li>
              <li>Untrusted QR URLs strictly screened against private network SSRF</li>
              <li>Zero permanent storage of one-time passwords</li>
              <li>Purely local browser state retention</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
