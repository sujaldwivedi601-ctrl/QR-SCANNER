import React, { useState, useRef } from 'react';
import {
  FolderPlus,
  Play,
  Check,
  Plus,
  Trash2,
  UploadCloud,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Phone,
  Images,
  FolderOpen,
  Download,
  FileCheck,
} from 'lucide-react';
import { PhoneNumberUsage, QRJobItem } from '../types';
import { savePhoneNumbers, saveFolderName } from '../services/storage';
import { buildQueueFromFiles } from '../services/qrScanner';
import { saveJobsToDB } from '../services/db';

interface AutomationWizardProps {
  initialPhoneNumbers: PhoneNumberUsage[];
  onFinishWizard: (phones: PhoneNumberUsage[], jobs: QRJobItem[], folderName: string) => void;
  onCancel: () => void;
}

export const AutomationWizard: React.FC<AutomationWizardProps> = ({
  initialPhoneNumbers,
  onFinishWizard,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: User's real phone numbers (Strictly user-entered, zero dummy data)
  const [phones, setPhones] = useState<PhoneNumberUsage[]>(initialPhoneNumbers || []);
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [phone3, setPhone3] = useState('');

  // Step 2: Folder selection state
  const [folderName, setFolderName] = useState('QR Code');
  const [extractedJobs, setExtractedJobs] = useState<QRJobItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [folderError, setFolderError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // Separate refs for folder picker vs multi-file image picker
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  // Phone operations
  const handleSetActive = (id: string) => {
    setPhones((prev) =>
      prev.map((p) => ({
        ...p,
        status: p.id === id ? 'active' : p.status === 'active' ? 'available' : p.status,
      }))
    );
  };

  const handleRemovePhone = (id: string) => {
    setPhones((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      if (!filtered.some((p) => p.status === 'active') && filtered.length > 0) {
        filtered[0].status = 'active';
      }
      return filtered;
    });
  };

  const handleSaveInitialForm = (e: React.FormEvent) => {
    e.preventDefault();
    const p1 = phone1.trim();
    const p2 = phone2.trim();
    const p3 = phone3.trim();

    if (!p1 || !p2) {
      alert('Please enter at least 2 phone numbers (Number 1 and Number 2).');
      return;
    }

    const newPhoneList: PhoneNumberUsage[] = [
      {
        id: `pn-${Date.now()}-1`,
        number: p1,
        label: 'Phone Number 1 (Primary)',
        status: 'active',
        usageCount: 0,
        maxLimit: 25,
      },
      {
        id: `pn-${Date.now()}-2`,
        number: p2,
        label: 'Phone Number 2',
        status: 'available',
        usageCount: 0,
        maxLimit: 25,
      },
    ];

    if (p3) {
      newPhoneList.push({
        id: `pn-${Date.now()}-3`,
        number: p3,
        label: 'Phone Number 3',
        status: 'available',
        usageCount: 0,
        maxLimit: 25,
      });
    }

    setPhones(newPhoneList);
    savePhoneNumbers(newPhoneList);
    setCurrentStep(2);
  };

  const handleStep1ProceedExisting = () => {
    if (phones.length < 2) {
      alert('Please enter at least 2 phone numbers.');
      return;
    }
    savePhoneNumbers(phones);
    setCurrentStep(2);
  };

  // Process selected file objects
  const processFiles = async (files: File[], detectedName: string) => {
    setFolderError('');
    setIsProcessingFiles(true);
    try {
      const validImages = files.filter((f) =>
        /\.(png|jpe?g|webp|bmp|gif|svg)$/i.test(f.name) || f.type.startsWith('image/')
      );

      if (validImages.length === 0) {
        setIsProcessingFiles(false);
        setFolderError(
          `No image files detected in "${detectedName}". Please make sure your QR code images (.png, .jpg) are inside the folder.`
        );
        return;
      }

      const jobs = await buildQueueFromFiles(validImages, (curr, total, fName) => {
        setProcessingMsg(`Reading QR ${curr} of ${total}: ${fName}`);
      });

      setExtractedJobs(jobs);
      setFolderName(detectedName);
      saveFolderName(detectedName);
      await saveJobsToDB(jobs);
      setIsProcessingFiles(false);
      setProcessingMsg('');

      // Auto-advance to Step 3 after smooth 600ms preview
      setTimeout(() => {
        setCurrentStep(3);
      }, 600);
    } catch (err: any) {
      setIsProcessingFiles(false);
      setFolderError(`Error decoding QR codes: ${err.message || 'Unknown decode error'}`);
    }
  };

  // Method 1: Directory selection (Modern Chromium Directory API or Webkit Directory)
  const handleSelectFolder = async () => {
    setFolderError('');
    try {
      // If window.showDirectoryPicker is allowed and available
      if ('showDirectoryPicker' in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
          const name = dirHandle.name || 'QR Code';
          setIsProcessingFiles(true);
          setProcessingMsg('Accessing folder contents...');

          const files: File[] = [];
          for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
              const f = await entry.getFile();
              if (/\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name)) {
                files.push(f);
              }
            }
          }
          await processFiles(files, name);
          return;
        } catch (dirErr: any) {
          if (dirErr.name === 'AbortError') return;
          console.warn('Native directory picker unavailable in iframe, using folder input fallback:', dirErr);
        }
      }
      // Directory input fallback without conflicting accept filter
      folderInputRef.current?.click();
    } catch {
      folderInputRef.current?.click();
    }
  };

  // Method 2: Multi-image selection from folder (100% fail-proof across Android gallery & desktop)
  const handleSelectImagesFromFolder = () => {
    setFolderError('');
    filesInputRef.current?.click();
  };

  // Folder input change event
  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const detectedName =
      (fileList[0] as any).webkitRelativePath?.split('/')[0] || 'QR Code';
    processFiles(files, detectedName);
  };

  // Multi-image input change event
  const handleFilesInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    processFiles(files, 'QR Code');
  };

  // Drag and Drop support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const items = e.dataTransfer.items;
    const files: File[] = [];

    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const entry = (item as any).webkitGetAsEntry?.();
          if (entry && entry.isDirectory) {
            // Traverse directory entries
            const dirReader = (entry as any).createReader();
            const readEntries = async () => {
              return new Promise<any[]>((resolve) => {
                dirReader.readEntries((entries: any[]) => resolve(entries));
              });
            };
            const dirEntries = await readEntries();
            for (const fileEntry of dirEntries) {
              if (fileEntry.isFile) {
                const f = await new Promise<File>((resolve) => fileEntry.file(resolve));
                files.push(f);
              }
            }
          } else {
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        }
      }
    } else if (e.dataTransfer.files) {
      files.push(...Array.from(e.dataTransfer.files));
    }

    if (files.length > 0) {
      await processFiles(files, 'QR Code');
    }
  };

  // Final Action: Start scanning and automated execution
  const handleStartAutomation = () => {
    savePhoneNumbers(phones);
    saveFolderName(folderName);
    onFinishWizard(phones, extractedJobs, folderName);
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-white text-black py-8 px-4 sm:px-6 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-6">
        {/* Top Header / Back */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to QR Scanner
          </button>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                  currentStep === step
                    ? 'bg-red-600 text-white'
                    : currentStep > step
                    ? 'bg-black text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {currentStep > step ? <Check className="w-3.5 h-3.5" /> : step}
              </div>
            ))}
          </div>
        </div>

        {/* STEP 1: USER ENTERS THEIR REAL PHONE NUMBERS */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider block mb-1">
                Step 1 of 3
              </span>
              <h1 className="text-2xl font-black tracking-tight text-black">
                Enter your authorized phone numbers
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Enter 2 to 3 authorized phone numbers. Stored strictly on this device in your browser.
              </p>
            </div>

            {/* Privacy Callout */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Stored Locally:</strong> These numbers are stored strictly in your browser local storage. No remote database is used.
              </span>
            </div>

            {phones.length === 0 ? (
              <form onSubmit={handleSaveInitialForm} className="space-y-4">
                <div className="p-5 rounded-2xl bg-white border-2 border-black space-y-4 shadow-sm">
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">
                      Phone Number 1 (Required Primary)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        placeholder="Enter your first phone number"
                        value={phone1}
                        onChange={(e) => setPhone1(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono text-black focus:outline-none focus:border-red-600 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">
                      Phone Number 2 (Required)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        placeholder="Enter your second phone number"
                        value={phone2}
                        onChange={(e) => setPhone2(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono text-black focus:outline-none focus:border-red-600 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Phone Number 3 (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        placeholder="Enter optional third phone number"
                        value={phone3}
                        onChange={(e) => setPhone3(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono text-black focus:outline-none focus:border-red-600 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-md shadow-red-600/20"
                  >
                    Save Numbers &amp; Next: QR Folder
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {phones.map((p, idx) => (
                    <div
                      key={p.id}
                      className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-3 ${
                        p.status === 'active'
                          ? 'border-red-600 bg-red-50/40'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            p.status === 'active'
                              ? 'bg-red-600 text-white'
                              : 'bg-black text-white'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-bold text-black font-mono">
                              {p.number}
                            </strong>
                            {p.status === 'active' && (
                              <span className="text-[10px] font-bold text-red-600 uppercase bg-red-100 px-1.5 py-0.5 rounded">
                                Active Primary
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">{p.label}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {p.status !== 'active' && (
                          <button
                            type="button"
                            onClick={() => handleSetActive(p.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-black bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemovePhone(p.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          title="Remove number"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPhones([]);
                      savePhoneNumbers([]);
                    }}
                    className="text-xs text-slate-500 hover:text-black font-semibold"
                  >
                    Reset and Enter New Numbers
                  </button>

                  <button
                    type="button"
                    onClick={handleStep1ProceedExisting}
                    className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-md shadow-red-600/20"
                  >
                    Continue to Step 2: QR Folder
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: USER CREATES / SELECTS THEIR 'QR CODE' FOLDER */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider block mb-1">
                Step 2 of 3
              </span>
              <h1 className="text-2xl font-black tracking-tight text-black">
                Select your &apos;QR Code&apos; folder
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Provide access to your device folder containing all QR code images.
              </p>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  In your phone/PC gallery or storage, create a folder called <strong className="text-black font-mono font-bold bg-white px-1.5 py-0.5 border border-slate-300 rounded">QR Code</strong>.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Save all your QR code images (e.g. <span className="font-mono text-black">QR_001.png</span>, <span className="font-mono text-black">QR_002.png</span>) inside that folder.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Choose either button below to grant access to the folder or its images.
                </p>
              </div>
            </div>

            {/* Dedicated Action Box with Drag-and-Drop & Dual Options */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`p-7 rounded-2xl border-2 transition-all text-center space-y-5 bg-white ${
                isDragOver ? 'border-red-600 bg-red-50/30 ring-4 ring-red-100' : 'border-black shadow-sm'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600">
                <FolderPlus className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-black text-black">
                  Select your &apos;QR Code&apos; folder or QR images
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Click below or drag and drop your folder or QR image files directly into this area.
                </p>
              </div>

              {/* Native directory input (NO accept attribute to prevent Chromium OS folder bug) */}
              <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory=""
                directory=""
                multiple
                onChange={handleFolderInputChange}
                className="hidden"
              />

              {/* Multi-image gallery input (100% works on mobile gallery & desktop) */}
              <input
                ref={filesInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesInputChange}
                className="hidden"
              />

              {isProcessingFiles ? (
                <div className="py-4 space-y-2 bg-slate-50 rounded-xl border border-slate-200">
                  <Loader2 className="w-6 h-6 text-red-600 animate-spin mx-auto" />
                  <span className="text-xs font-mono font-bold text-slate-800 block">
                    {processingMsg || 'Processing QR code images...'}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Decoding URLs &amp; building deterministic FIFO queue...
                  </span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-xs font-bold text-white bg-black hover:bg-slate-800 rounded-xl transition-colors shadow-sm"
                  >
                    <FolderOpen className="w-4 h-4 text-red-500" />
                    Select &apos;QR Code&apos; Folder
                  </button>

                  <button
                    type="button"
                    onClick={handleSelectImagesFromFolder}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors shadow-xs"
                  >
                    <Images className="w-4 h-4 text-blue-600" />
                    Select Images from &apos;QR Code&apos; Folder
                  </button>
                </div>
              )}

              {folderError && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-center justify-center gap-2 mt-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{folderError}</span>
                </div>
              )}
            </div>

            {/* Loaded Files Preview List if any decoded */}
            {extractedJobs.length > 0 && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>
                      Folder Loaded: <strong>{folderName}</strong> ({extractedJobs.length} QR codes decoded)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                    FIFO Order Ready
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
                  {extractedJobs.slice(0, 10).map((j, idx) => (
                    <div
                      key={j.id}
                      className="p-2 rounded-lg bg-white border border-emerald-200 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-slate-400 font-bold shrink-0">#{idx + 1}</span>
                        <span className="font-bold text-black truncate">{j.fileName}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 truncate max-w-xs">
                        {j.decodedUrl || 'URL Decoded'}
                      </span>
                    </div>
                  ))}
                  {extractedJobs.length > 10 && (
                    <div className="text-center text-[10px] text-emerald-800 font-semibold pt-1">
                      + {extractedJobs.length - 10} more QR codes in FIFO sequence
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-600/20"
                  >
                    Proceed to Start Automation ({extractedJobs.length} QR Codes)
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-black"
              >
                Back to Numbers
              </button>
              {extractedJobs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-md shadow-red-600/20"
                >
                  Next: Start Scanning &amp; Automating
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: READY TO START SCANNING AND AUTOMATING */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider block mb-1">
                Step 3 of 3
              </span>
              <h1 className="text-2xl font-black tracking-tight text-black">
                Ready to Start Scanning &amp; Automating
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                When you click start, our system picks one QR code from your &apos;{folderName}&apos; folder, opens the URL, enters your active number, requests OTP, verifies, and moves sequentially to the next QR code.
              </p>
            </div>

            {/* Summary Card */}
            <div className="p-6 rounded-2xl bg-slate-50 border-2 border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 uppercase block mb-1">
                    Your Registered Lines
                  </span>
                  <span className="text-base font-bold font-mono text-black block">
                    {phones.length} Phone Numbers
                  </span>
                  <span className="text-xs text-red-600 font-semibold mt-0.5 block truncate">
                    Active: {phones.find((p) => p.status === 'active')?.number || phones[0]?.number}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 uppercase block mb-1">
                    Folder &amp; Queue Size
                  </span>
                  <span className="text-base font-bold font-mono text-black block">
                    {extractedJobs.length} QR Codes Loaded
                  </span>
                  <span className="text-xs text-slate-600 mt-0.5 block truncate">
                    Folder: &apos;{folderName}&apos;
                  </span>
                </div>
              </div>

              {/* FIFO Queue Order Preview */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs space-y-2">
                <span className="font-bold text-black uppercase tracking-wider text-[11px] block">
                  Deterministic FIFO Execution Order:
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-xs pr-1">
                  {extractedJobs.slice(0, 5).map((job, idx) => (
                    <div
                      key={job.id}
                      className="p-1.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-slate-700"
                    >
                      <span className="font-bold text-black">
                        #{idx + 1} {job.fileName}
                      </span>
                      <span className="text-slate-500 text-[11px]">→ Pending</span>
                    </div>
                  ))}
                  {extractedJobs.length > 5 && (
                    <div className="text-[11px] text-slate-500 text-center pt-1 font-sans">
                      + {extractedJobs.length - 5} additional items queued in FIFO sequence
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 space-y-1">
                <span className="font-bold text-black block">Workflow Rules:</span>
                <p>• Strictly one-by-one sequential FIFO processing.</p>
                <p>• Never processes multiple QR jobs simultaneously.</p>
                <p>• Authorized OTP verification and live progress reporting.</p>
              </div>
            </div>

            {/* Big Action Button: START SCANNING & AUTOMATING */}
            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={handleStartAutomation}
                className="w-full inline-flex items-center justify-center gap-3 py-4 px-6 text-base font-black text-white bg-red-600 hover:bg-red-700 rounded-2xl transition-all shadow-xl shadow-red-600/30 active:scale-[0.99]"
              >
                <Play className="w-5 h-5 fill-current" />
                START SCANNING &amp; AUTOMATING
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-black transition-colors"
              >
                Change or Rescan Folder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
