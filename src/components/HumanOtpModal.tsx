import React, { useState, useEffect } from 'react';
import { KeyRound, Clock, AlertCircle } from 'lucide-react';

interface HumanOtpModalProps {
  jobId: string;
  phoneNumber: string;
  timeoutSeconds: number;
  onSubmitOtp: (otp: string) => void;
  onCancel: () => void;
}

export const HumanOtpModal: React.FC<HumanOtpModalProps> = ({
  jobId,
  phoneNumber,
  timeoutSeconds,
  onSubmitOtp,
  onCancel,
}) => {
  const [otpInput, setOtpInput] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(timeoutSeconds || 60);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onCancel();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = otpInput.trim();
    if (!clean) return;
    setSubmitting(true);
    onSubmitOtp(clean);
    // Erase OTP from local component state immediately
    setOtpInput('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-2 border-black rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <KeyRound className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
            <Clock className="w-3.5 h-3.5" />
            <span className="tabular-nums">{secondsLeft}s</span> left
          </div>
        </div>

        <div>
          <h2 className="text-xl font-black text-black tracking-tight">
            OTP required — enter OTP
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            An authorized verification code was dispatched to:
          </p>
          <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-black flex items-center justify-between">
            <span className="text-slate-500 font-sans">Destination:</span>
            <strong className="text-red-600 font-bold">{phoneNumber}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-2">
              Verification Code
            </label>
            <input
              type="text"
              autoFocus
              maxLength={8}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              placeholder="e.g. 482910"
              className="w-full text-center text-2xl font-mono tracking-widest bg-white border-2 border-black rounded-xl px-4 py-3 text-black placeholder-slate-400 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20 shadow-xs"
            />
            <span className="text-[11px] text-slate-500 block mt-1.5 text-center">
              Supports 4-digit, 6-digit, or alphanumeric one-time codes
            </span>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || !otpInput.trim()}
              className="flex-1 py-3 text-xs font-black text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-40 transition-colors shadow-md shadow-red-600/20"
            >
              Verify and Continue
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-3 text-xs font-bold text-slate-700 hover:text-black bg-slate-100 rounded-xl transition-colors border border-slate-200"
            >
              Skip
            </button>
          </div>
        </form>

        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>OTPs are ephemeral and strictly verified in memory without persistent storage.</span>
        </div>
      </div>
    </div>
  );
};
