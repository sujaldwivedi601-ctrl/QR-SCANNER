import React, { useState, useRef } from 'react';
import {
  FolderCheck,
  UploadCloud,
  Folder,
  Check,
  Loader2,
  AlertCircle,
  FolderOpen,
  Images,
  ArrowRight,
} from 'lucide-react';
import { buildQueueFromFiles } from '../services/qrScanner';
import { saveJobsToDB } from '../services/db';
import { saveFolderName } from '../services/storage';
import { QRJobItem } from '../types';

interface FolderSelectorProps {
  currentFolderName: string;
  queueCount: number;
  onQueueGenerated: (jobs: QRJobItem[], folderName: string) => void;
  onContinueToDashboard?: () => void;
  showOnboardingNext?: boolean;
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({
  currentFolderName,
  queueCount,
  onQueueGenerated,
  onContinueToDashboard,
  showOnboardingNext = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFolderDisplay, setSelectedFolderDisplay] = useState(currentFolderName || 'QR Code');
  const [isDragOver, setIsDragOver] = useState(false);
  const [justProcessedCount, setJustProcessedCount] = useState<number | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  /**
   * Processes a list of image files, builds the FIFO queue, persists to DB,
   * updates application state, and immediately transitions to the queue dashboard.
   */
  const processExtractedFiles = async (files: File[], folderName: string) => {
    setIsProcessing(true);
    setErrorMessage('');
    setJustProcessedCount(null);

    try {
      const validImages = files.filter(
        (f) => /\.(png|jpe?g|webp|bmp|gif|svg)$/i.test(f.name) || f.type.startsWith('image/')
      );

      if (validImages.length === 0) {
        setIsProcessing(false);
        setErrorMessage(
          `No image files detected in folder "${folderName}". Please ensure your QR code images (.png, .jpg) are inside this folder.`
        );
        return;
      }

      setProgressText(`Decoding ${validImages.length} QR code images...`);

      // Build deterministic FIFO queue from images
      const jobs = await buildQueueFromFiles(validImages, (processed, total, currentName) => {
        setProgressText(`Decoding QR images: ${processed} / ${total} (${currentName})`);
      });

      // Persist to IndexedDB and LocalStorage
      await saveJobsToDB(jobs);
      saveFolderName(folderName);
      setSelectedFolderDisplay(folderName);
      setJustProcessedCount(jobs.length);

      // Notify parent component with new jobs and folder name
      onQueueGenerated(jobs, folderName);

      setProgressText(`Successfully processed ${jobs.length} QR codes! Opening queue dashboard...`);

      // Immediately transition to Queue Dashboard without hanging
      setTimeout(() => {
        setIsProcessing(false);
        setProgressText('');
        if (onContinueToDashboard) {
          onContinueToDashboard();
        }
      }, 400);
    } catch (err: any) {
      setIsProcessing(false);
      setProgressText('');
      setErrorMessage(`Error building QR queue: ${err.message || String(err)}`);
    }
  };

  /**
   * Primary Action: Uses the native File System Access API (showDirectoryPicker)
   * to select the local folder, iteratively extract files, and process them immediately.
   */
  const handleSelectFolderNative = async () => {
    setErrorMessage('');

    // Check if the native File System Access API is supported
    if ('showDirectoryPicker' in window) {
      try {
        // Request directory access from the user
        const dirHandle = await (window as any).showDirectoryPicker({
          id: 'qr-code-folder-picker',
          mode: 'read',
          startIn: 'pictures',
        });

        const folderName = dirHandle.name || 'QR Code';
        setIsProcessing(true);
        setProgressText(`Scanning directory "${folderName}" for QR images...`);

        const files: File[] = [];

        // Traverse directory entries asynchronously
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            try {
              const file = await entry.getFile();
              if (
                /\.(png|jpe?g|webp|bmp|gif|svg)$/i.test(file.name) ||
                file.type.startsWith('image/')
              ) {
                files.push(file);
              }
            } catch (fileErr) {
              console.warn(`Could not read file entry: ${entry.name}`, fileErr);
            }
          }
        }

        // Process files immediately and transition to queue dashboard
        await processExtractedFiles(files, folderName);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User deliberately cancelled the directory picker dialog; do not show error
          return;
        }

        console.warn('Native showDirectoryPicker failed or restricted by environment, engaging fallback:', err);
        // Fallback to directory input element
        folderInputRef.current?.click();
        return;
      }
    }

    // Fallback for browsers without File System Access API
    folderInputRef.current?.click();
  };

  /**
   * Fallback Action: Allows selecting images directly from folder
   * (Works 100% on mobile gallery and all desktop browsers)
   */
  const handleSelectImagesFallback = () => {
    setErrorMessage('');
    filesInputRef.current?.click();
  };

  // Handle directory input change event
  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const name = (fileList[0] as any).webkitRelativePath?.split('/')[0] || 'QR Code';
    processExtractedFiles(Array.from(fileList), name);
  };

  // Handle multi-image input change event
  const handleFilesInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    processExtractedFiles(Array.from(fileList), 'QR Code');
  };

  // Drag and Drop handlers
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
      await processExtractedFiles(files, 'QR Code');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Editorial Header */}
      <div className="mb-8">
        <span className="text-xs font-bold text-red-600 uppercase tracking-wider block mb-1">
          Folder Management
        </span>
        <h1 className="text-2xl font-black tracking-tight text-black">
          QR Code Folder Selection
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Select your local folder containing QR-code images to build the deterministic FIFO queue.
        </p>
      </div>

      {/* 3-Step Clear Instructions Card */}
      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 mb-8 space-y-4">
        <h2 className="text-xs font-bold text-black uppercase tracking-wider">
          How to organize your folder
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <span className="text-xs font-mono text-red-600 font-bold block mb-1">STEP 01</span>
            <strong className="text-sm text-black block mb-1">Create Folder</strong>
            <p className="text-xs text-slate-600 leading-relaxed">
              Create a local folder named <code className="text-red-600 font-mono font-bold bg-red-50 px-1 py-0.5 rounded">QR Code</code> in your device gallery or storage.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <span className="text-xs font-mono text-red-600 font-bold block mb-1">STEP 02</span>
            <strong className="text-sm text-black block mb-1">Deposit QR Images</strong>
            <p className="text-xs text-slate-600 leading-relaxed">
              Drop all QR code images into the folder (e.g. <code className="text-black font-mono">QR_001.png</code>, <code className="text-black font-mono">QR_002.png</code>).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <span className="text-xs font-mono text-red-600 font-bold block mb-1">STEP 03</span>
            <strong className="text-sm text-black block mb-1">Authorize Once</strong>
            <p className="text-xs text-slate-600 leading-relaxed">
              Click &quot;Select &apos;QR Code&apos; Folder&quot; below. The app scans, decodes, and immediately opens your automated queue dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Current Folder Status Callout */}
      {queueCount > 0 && !isProcessing && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FolderCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="text-xs text-emerald-900 font-bold block">
                Active QR Folder: <strong className="text-emerald-950 font-black">{selectedFolderDisplay}</strong>
              </span>
              <span className="text-xs text-emerald-700">
                <strong className="text-black font-mono tabular-nums">{queueCount}</strong> QR images decoded and queued in deterministic FIFO order.
              </span>
            </div>
          </div>

          {onContinueToDashboard && (
            <button
              onClick={onContinueToDashboard}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shrink-0 shadow-xs"
            >
              Go to Queue Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Error Notice */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Folder Picker Action Surface */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`p-8 rounded-2xl border-2 transition-all text-center space-y-5 bg-white ${
          isDragOver ? 'border-red-600 bg-red-50/30 ring-4 ring-red-100' : 'border-black shadow-sm'
        }`}
      >
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600">
          <Folder className="w-7 h-7" />
        </div>

        <div>
          <h3 className="text-lg font-black text-black">
            {queueCount > 0 ? 'Replace or Rescan QR Code Folder' : 'Select your QR Code Folder'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Uses the native File System Access API to read folder images directly on this device. After selection, the app immediately processes the files and opens your queue dashboard.
          </p>
        </div>

        {/* Hidden directory and multi-image inputs */}
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

        <input
          ref={filesInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesInputChange}
          className="hidden"
        />

        {isProcessing ? (
          <div className="py-6 space-y-3 bg-slate-50 rounded-xl border border-slate-200 max-w-md mx-auto">
            <Loader2 className="w-7 h-7 text-red-600 animate-spin mx-auto" />
            <span className="text-xs font-mono font-bold text-slate-900 block">
              {progressText || 'Processing QR code images...'}
            </span>
            <span className="text-[11px] text-slate-500 block">
              Building FIFO queue and preparing dashboard...
            </span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSelectFolderNative}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-xs font-bold text-white bg-black hover:bg-slate-800 rounded-xl transition-colors shadow-sm active:scale-[0.99]"
            >
              <FolderOpen className="w-4 h-4 text-red-500" />
              Select &apos;QR Code&apos; Folder (Native API)
            </button>

            <button
              type="button"
              onClick={handleSelectImagesFallback}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors shadow-xs"
            >
              <Images className="w-4 h-4 text-blue-600" />
              Select Images from &apos;QR Code&apos; Folder
            </button>
          </div>
        )}
      </div>

      {/* Onboarding Flow Proceed Button if explicitly shown */}
      {showOnboardingNext && onContinueToDashboard && (
        <div className="flex justify-end pt-8 mt-6 border-t border-slate-200">
          <button
            onClick={onContinueToDashboard}
            disabled={queueCount === 0}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-colors shadow-xs"
          >
            Go to Automation Dashboard
            <Check className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
