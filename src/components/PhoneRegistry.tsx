import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, ShieldAlert, PhoneCall } from 'lucide-react';
import { PhoneNumberUsage } from '../types';
import { savePhoneNumbers } from '../services/storage';

interface PhoneRegistryProps {
  phoneNumbers: PhoneNumberUsage[];
  onUpdate: (numbers: PhoneNumberUsage[]) => void;
  onContinue?: () => void;
  showOnboardingNext?: boolean;
}

export const PhoneRegistry: React.FC<PhoneRegistryProps> = ({
  phoneNumbers,
  onUpdate,
  onContinue,
  showOnboardingNext = false,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editMaxLimit, setEditMaxLimit] = useState(25);

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newMaxLimit, setNewMaxLimit] = useState(25);

  const handleSetActive = (id: string) => {
    const updated = phoneNumbers.map((p) => ({
      ...p,
      status: p.id === id ? ('active' as const) : p.status === 'active' ? ('available' as const) : p.status,
    }));
    savePhoneNumbers(updated);
    onUpdate(updated);
  };

  const handleRemove = (id: string) => {
    const updated = phoneNumbers.filter((p) => p.id !== id);
    // If we removed the active one, mark the first remaining as active
    if (!updated.some((p) => p.status === 'active') && updated.length > 0) {
      updated[0].status = 'active';
    }
    savePhoneNumbers(updated);
    onUpdate(updated);
  };

  const handleStartEdit = (p: PhoneNumberUsage) => {
    setEditingId(p.id);
    setEditLabel(p.label);
    setEditNumber(p.number);
    setEditMaxLimit(p.maxLimit);
  };

  const sanitizeMobile = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.substring(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.substring(1);
    if (digits.length > 10) return digits.slice(-10);
    return digits || val.trim();
  };

  const handleSaveEdit = (id: string) => {
    if (!editNumber.trim()) return;
    const clean = sanitizeMobile(editNumber);
    const updated = phoneNumbers.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          label: editLabel.trim() || p.label,
          number: clean,
          maxLimit: Math.max(1, editMaxLimit),
        };
      }
      return p;
    });
    savePhoneNumbers(updated);
    onUpdate(updated);
    setEditingId(null);
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNumber.trim()) return;
    if (phoneNumbers.length >= 4) {
      alert('Maximum of 4 authorized phone numbers supported.');
      return;
    }

    const clean = sanitizeMobile(newNumber);
    const newItem: PhoneNumberUsage = {
      id: `pn-${Date.now()}`,
      label: newLabel.trim() || `Authorized Line ${phoneNumbers.length + 1}`,
      number: clean,
      status: phoneNumbers.length === 0 ? 'active' : 'available',
      usageCount: 0,
      maxLimit: Math.max(1, newMaxLimit),
    };

    const updated = [...phoneNumbers, newItem];
    savePhoneNumbers(updated);
    onUpdate(updated);
    setNewLabel('');
    setNewNumber('');
    setIsAddingNew(false);
  };

  const handleResetUsage = (id: string) => {
    const updated = phoneNumbers.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          usageCount: 0,
          status: p.status === 'limit_reached' ? ('available' as const) : p.status,
        };
      }
      return p;
    });
    savePhoneNumbers(updated);
    onUpdate(updated);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Editorial Header */}
      <div className="mb-8">
        <span className="text-xs font-bold text-red-600 uppercase tracking-wider block mb-1">
          Local Number Storage
        </span>
        <h1 className="text-2xl font-black tracking-tight text-black">
          Authorized Phone Numbers
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Register 2 to 4 authorized business phone numbers for automated FIFO rotation.
        </p>
      </div>

      {/* Security and Privacy Local Storage Notice */}
      <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-black">Local Device Storage Notice</span>
          <p className="text-slate-600 leading-relaxed">
            Your saved phone numbers and application settings are stored strictly inside your browser’s local storage on this device. No remote database or permanent user tracking is used. OTPs are never permanently stored.
          </p>
        </div>
      </div>

      {/* Phone Numbers List */}
      <div className="space-y-3 mb-6">
        {phoneNumbers.map((item) => {
          const isEditing = editingId === item.id;
          const isActive = item.status === 'active';
          const isLimitReached = item.status === 'limit_reached' || item.usageCount >= item.maxLimit;

          return (
            <div
              key={item.id}
              className={`p-4 rounded-xl border-2 transition-all ${
                isActive
                  ? 'bg-red-50/40 border-red-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Line Label</label>
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-black focus:outline-none focus:border-red-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={editNumber}
                      onChange={(e) => setEditNumber(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-black font-mono focus:outline-none focus:border-red-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Usage Limit</label>
                    <input
                      type="number"
                      value={editMaxLimit}
                      onChange={(e) => setEditMaxLimit(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-black font-mono focus:outline-none focus:border-red-600"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(item.id)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-black transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <PhoneCall className={`w-4 h-4 ${isActive ? 'text-red-600' : 'text-slate-400'}`} />
                      <span className="font-bold text-black text-sm">{item.label}</span>
                      
                      {/* Unboxed Metadata Text according to Zero-Pill Constitution */}
                      <span className="text-xs text-slate-300">·</span>
                      <span
                        className={`text-xs font-bold ${
                          isActive
                            ? 'text-red-600'
                            : isLimitReached
                            ? 'text-amber-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {isActive ? 'Active Primary' : isLimitReached ? 'Limit Reached' : 'Available Backup'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600 font-mono pl-7">
                      <span className="text-black font-bold">{item.number}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span>
                        Usage: <strong className="text-black tabular-nums">{item.usageCount}</strong> / {item.maxLimit}
                      </span>
                      {item.lastUsedAt && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-slate-400">
                            Last used {new Date(item.lastUsedAt).toLocaleTimeString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {isLimitReached && (
                      <button
                        onClick={() => handleResetUsage(item.id)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:text-black transition-colors"
                      >
                        Reset Count
                      </button>
                    )}

                    {!isActive && !isLimitReached && (
                      <button
                        onClick={() => handleSetActive(item.id)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-800 hover:text-black bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300"
                      >
                        Set Active
                      </button>
                    )}

                    <button
                      onClick={() => handleStartEdit(item)}
                      className="p-1.5 text-slate-500 hover:text-black rounded-lg transition-colors"
                      title="Edit number"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                      title="Remove number"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add New Line Form */}
      {isAddingNew ? (
        <form onSubmit={handleAddNew} className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-6 space-y-4">
          <span className="text-xs font-bold text-black uppercase tracking-wider block">
            Add Authorized Phone Number
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Label (e.g. Line B)</label>
              <input
                type="text"
                placeholder="Line identifier"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-black focus:outline-none focus:border-red-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Required)</label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-black font-mono focus:outline-none focus:border-red-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Max Batch Limit</label>
              <input
                type="number"
                value={newMaxLimit}
                onChange={(e) => setNewMaxLimit(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-black font-mono focus:outline-none focus:border-red-600"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Add Number
            </button>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="px-4 py-2 text-xs text-slate-500 hover:text-black transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        phoneNumbers.length < 4 && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="w-full py-3 px-4 border-2 border-dashed border-slate-300 hover:border-black rounded-xl text-xs font-bold text-slate-700 hover:text-black flex items-center justify-center gap-2 transition-colors mb-6"
          >
            <Plus className="w-4 h-4" />
            Add Another Authorized Phone Number ({phoneNumbers.length}/4)
          </button>
        )
      )}

      {/* Onboarding Flow Proceed Button */}
      {showOnboardingNext && onContinue && (
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            onClick={onContinue}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-xs"
          >
            Continue to Step 2: Select QR Folder
            <Check className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
