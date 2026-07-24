import React, { useState, useRef } from 'react';
import { AppSettings, Transaction } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { GoogleSheetsIntegration } from './GoogleSheetsIntegration';
import { TelegramIntegration } from './TelegramIntegration';
import { AIProviderSettings } from './AIProviderSettings';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetData: () => void;
  onClearData: () => void;
  onNukeData?: () => void;
  triggerToast: (msg: string) => void;
  transactions: Transaction[];
  googleToken: string | null;
  onConnectSheets: () => Promise<void>;
  onDisconnectSheets: () => void;
  onImportTransactions: (imported: Omit<Transaction, 'id'>[]) => Promise<void>;
  currencySymbol?: string;
  user?: any;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetData,
  onClearData,
  onNukeData,
  triggerToast,
  transactions,
  googleToken,
  onConnectSheets,
  onDisconnectSheets,
  onImportTransactions,
  currencySymbol = '$',
  user,
}) => {
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [supportEmail, setSupportEmail] = useState(settings.supportEmail);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [isDragging, setIsDragging] = useState(false);
  const [showNukeModal, setShowNukeModal] = useState(false);
  const [nukeConfirmInput, setNukeConfirmInput] = useState('');

  const [nukeEmail, setNukeEmail] = useState(user?.email || settings.supportEmail || 'guest@chamlackmedia.com');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleSendCode = async () => {
    if (!nukeEmail) {
      triggerToast('Please enter a valid email address.');
      return;
    }
    setIsSendingCode(true);
    try {
      const response = await fetch('/api/send-nuke-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: nukeEmail }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send code');
      }
      setCodeSent(true);
      triggerToast(`📩 Verification code sent! Check server terminal console log.`);
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || 'Error sending code.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      triggerToast('Please enter the 6-digit verification code.');
      return;
    }
    setIsVerifyingCode(true);
    try {
      const response = await fetch('/api/verify-nuke-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: nukeEmail, code: verificationCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify code');
      }
      setVerified(true);
      triggerToast('✅ Verification code verified successfully! Type NUKE to proceed.');
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || 'Incorrect or expired code. Please check and try again.');
    } finally {
      setIsVerifyingCode(false);
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultAllowedTypes = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx'];
  const [allowedFileTypes, setAllowedFileTypes] = useState<string[]>(
    settings.allowedFileTypes && settings.allowedFileTypes.length > 0
      ? settings.allowedFileTypes
      : defaultAllowedTypes
  );
  const [customExtensionInput, setCustomExtensionInput] = useState<string>('');

  const handleSave = (updatedLogo = logoUrl, updatedAllowedTypes = allowedFileTypes) => {
    onUpdateSettings({
      companyName: companyName.trim() || 'CHAMLAK MEDIA',
      tagline: tagline.trim() || 'Finance Hub',
      supportEmail: supportEmail.trim() || 'support@chamlackmedia.com',
      logoUrl: updatedLogo,
      allowedFileTypes: updatedAllowedTypes,
    });
    triggerToast('Settings updated successfully!');
  };

  const toggleExtension = (ext: string) => {
    const normalized = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    let updated: string[];
    if (allowedFileTypes.includes(normalized)) {
      updated = allowedFileTypes.filter((e) => e !== normalized);
    } else {
      updated = [...allowedFileTypes, normalized];
    }
    setAllowedFileTypes(updated);
    handleSave(logoUrl, updated);
  };

  const handleAddCustomExtension = () => {
    if (!customExtensionInput.trim()) return;
    const rawExts = customExtensionInput.split(/[\s,]+/);
    let updated = [...allowedFileTypes];
    rawExts.forEach((raw) => {
      let clean = raw.trim().toLowerCase();
      if (clean) {
        if (!clean.startsWith('.')) clean = `.${clean}`;
        if (!updated.includes(clean)) {
          updated.push(clean);
        }
      }
    });
    setAllowedFileTypes(updated);
    setCustomExtensionInput('');
    handleSave(logoUrl, updated);
    triggerToast('Added custom file extension(s) to allow list!');
  };

  // Handle logo file processing
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      triggerToast('Error: File must be an image.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      triggerToast('Error: Image size must be less than 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      setLogoUrl(base64Data);
      handleSave(base64Data);
      triggerToast('Brand logo uploaded and applied!');
    };
    reader.onerror = () => {
      triggerToast('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleClearLogo = () => {
    setLogoUrl('');
    handleSave('');
    triggerToast('Brand logo reverted to default icon.');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="settings-view">
      {/* 1. Brand Preview Board */}
      <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-900 dark:to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Custom Workspace Logo"
              className="w-16 h-16 rounded-2xl bg-white object-contain shadow-md p-1 border-2 border-indigo-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white/10 border-2 border-dashed border-indigo-200/40 flex items-center justify-center text-indigo-100 shadow-inner">
              <CategoryIcon name="Play" size={24} className="fill-white text-white" />
            </div>
          )}
          <div>
            <span className="text-[10px] bg-indigo-400/30 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Live Brand Preview</span>
            <h3 className="text-xl font-black uppercase tracking-wide mt-1.5 leading-none">
              {companyName ? (
                <>
                  {companyName.split(' ')[0]} <span className="text-teal-300">{companyName.split(' ').slice(1).join(' ') || 'MEDIA'}</span>
                </>
              ) : (
                <>CHAMLAK <span className="text-indigo-600">MEDIA</span></>
              )}
            </h3>
            <p className="text-xs text-indigo-100 font-semibold mt-1 tracking-widest uppercase">{tagline || 'Finance Hub'}</p>
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 text-xs flex flex-col gap-1.5 max-w-xs text-indigo-100">
          <div className="flex items-center gap-1.5">
            <CategoryIcon name="Mail" size={12} className="text-teal-300" />
            <span className="font-bold">Support Contact:</span>
          </div>
          <span className="font-mono text-[11px] select-all truncate max-w-[220px]">{supportEmail || 'No contact email configured'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column - Form details */}
        <div className="md:col-span-2 space-y-6">
          {/* 2. Brand Identity Information Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-3xs p-6 space-y-4">
            <h4 className="text-xs uppercase font-extrabold text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-2">
              <CategoryIcon name="Sliders" size={13} className="text-indigo-500" />
              Workspace Properties
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider" htmlFor="company-name-input">
                  Company / Organization Name
                </label>
                <input
                  id="company-name-input"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition"
                  placeholder="e.g. CHAMLAK MEDIA"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider" htmlFor="tagline-input">
                  Business Hub Tagline
                </label>
                <input
                  id="tagline-input"
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition"
                  placeholder="e.g. Finance Hub"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider" htmlFor="support-email-input">
                Support Contact Email
              </label>
              <input
                id="support-email-input"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition"
                placeholder="e.g. support@chamlackmedia.com"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => handleSave()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-sm hover:shadow-md transition duration-150"
              >
                <CategoryIcon name="CheckCircle" size={13} />
                Save Brand Info
              </button>
            </div>
          </div>

          {/* 3. Drag and Drop Logo Upload Zone */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-3xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase font-extrabold text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-2">
                <CategoryIcon name="Upload" size={13} className="text-teal-500" />
                Business Logo Asset Upload
              </h4>
              {logoUrl && (
                <button
                  onClick={handleClearLogo}
                  className="text-[10px] uppercase font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                >
                  <CategoryIcon name="Trash2" size={10} />
                  Remove Logo
                </button>
              )}
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition cursor-pointer text-center relative ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 hover:bg-slate-50/40 dark:hover:bg-slate-900/40 text-slate-400 dark:text-slate-500'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-3xs">
                <CategoryIcon
                  name="Image"
                  size={24}
                  className={isDragging ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-550'}
                />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Drag and drop your company logo here
                </p>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
                  or click to browse from device (JPEG, PNG, SVG up to 3MB)
                </p>
              </div>
            </div>
          </div>

          {/* Allowed File Extensions / Attachment Policy */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-3xs p-6 space-y-4" id="allowed-file-types-card">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase font-extrabold text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-2">
                <CategoryIcon name="Paperclip" size={13} className="text-indigo-500" />
                Allowed Attachment Extensions & File Policy
              </h4>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                {allowedFileTypes.length} Active Extension(s)
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Configure which file formats are permitted when attaching receipts, bills, and evidence files to transactions.
            </p>

            {/* Quick preset toggles */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Standard Preset Formats
              </label>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Images (JPG, PNG, WebP)', exts: ['.jpg', '.jpeg', '.png', '.webp', '.gif'] },
                  { label: 'PDF Documents (.pdf)', exts: ['.pdf'] },
                  { label: 'Spreadsheets (.csv, .xls, .xlsx)', exts: ['.csv', '.xls', '.xlsx'] },
                  { label: 'Text & Office (.txt, .doc, .docx)', exts: ['.txt', '.doc', '.docx'] },
                ].map((group) => {
                  const allActive = group.exts.every((e) => allowedFileTypes.includes(e));
                  return (
                    <button
                      key={group.label}
                      type="button"
                      onClick={() => {
                        let updated = [...allowedFileTypes];
                        if (allActive) {
                          updated = updated.filter((e) => !group.exts.includes(e));
                        } else {
                          group.exts.forEach((e) => {
                            if (!updated.includes(e)) updated.push(e);
                          });
                        }
                        setAllowedFileTypes(updated);
                        handleSave(logoUrl, updated);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition cursor-pointer flex items-center gap-1.5 ${
                        allActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 shadow-3xs'
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <CategoryIcon name={allActive ? 'Check' : 'Plus'} size={11} />
                      {group.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Extension Pills */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Active Allowed Extensions List
              </label>

              <div className="flex flex-wrap gap-1.5">
                {allowedFileTypes.map((ext) => (
                  <span
                    key={ext}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold"
                  >
                    {ext}
                    <button
                      type="button"
                      onClick={() => toggleExtension(ext)}
                      className="text-slate-400 hover:text-rose-500 transition cursor-pointer ml-0.5"
                      title={`Remove ${ext}`}
                    >
                      <CategoryIcon name="X" size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Add custom extension input */}
            <div className="pt-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Add Custom Extension / Format
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customExtensionInput}
                  onChange={(e) => setCustomExtensionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomExtension();
                    }
                  }}
                  placeholder="e.g. .zip, .xml, .json"
                  className="flex-1 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomExtension}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-3xs transition cursor-pointer flex items-center gap-1"
                >
                  <CategoryIcon name="Plus" size={12} />
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column - Data actions & System utilities */}
        <div className="space-y-6">
          {/* AI Provider & API Keys Configuration */}
          <AIProviderSettings triggerToast={triggerToast} />

          {/* Google Sheets Integration Control Center */}
          <GoogleSheetsIntegration
            transactions={transactions}
            googleToken={googleToken}
            onConnectSheets={onConnectSheets}
            onDisconnectSheets={onDisconnectSheets}
            onImportTransactions={onImportTransactions}
            triggerToast={triggerToast}
          />

          {/* Telegram Accounting Bot Brain Control Center */}
          <TelegramIntegration
            transactions={transactions}
            companyName={companyName || settings.companyName}
            currencySymbol={currencySymbol}
            triggerToast={triggerToast}
          />

          {/* 4. Utilities, Diagnostics & DB Actions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-3xs p-6 space-y-4">
            <h4 className="text-xs uppercase font-extrabold text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-2">
              <CategoryIcon name="Database" size={13} className="text-amber-500" />
              Database Management
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed font-semibold">
              Calibrate and diagnostics control room for resetting, seeding mock lists, or flashing local files database records.
            </p>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={onResetData}
                className="w-full flex items-center gap-2.5 text-left text-xs font-bold p-3 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer transition shadow-3xs"
              >
                <CategoryIcon name="RefreshCcw" size={14} className="text-indigo-500" />
                <div className="flex-1">
                  <span className="block font-bold">Restore Demo Data</span>
                  <span className="block text-[9px] text-slate-400 dark:text-slate-550 mt-0.5">Severs current list with sample files</span>
                </div>
              </button>

              <button
                onClick={onClearData}
                className="w-full flex items-center gap-2.5 text-left text-xs font-bold p-3 border border-amber-200/50 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-100/50 dark:hover:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-xl cursor-pointer transition"
              >
                <CategoryIcon name="Trash2" size={14} className="text-amber-500" />
                <div className="flex-1">
                  <span className="block font-bold">Wipe Transactions Only</span>
                  <span className="block text-[9px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">Clears ledger records keeping settings</span>
                </div>
              </button>

              {/* High-visibility Nuke Data Action */}
              <button
                onClick={() => {
                  setNukeConfirmInput('');
                  setShowNukeModal(true);
                }}
                className="w-full flex items-center gap-2.5 text-left text-xs font-bold p-3.5 border-2 border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl cursor-pointer transition shadow-sm group mt-2"
              >
                <div className="p-2 bg-rose-600 text-white rounded-lg shadow-xs group-hover:scale-105 transition-transform">
                  <CategoryIcon name="Trash2" size={16} />
                </div>
                <div className="flex-1">
                  <span className="block font-black text-rose-700 dark:text-rose-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    💥 Nuke Data (Clear All Data)
                  </span>
                  <span className="block text-[10px] text-rose-600/90 dark:text-rose-400/90 mt-0.5 font-medium">
                    Permanently erases ALL transactions, budgets, settings & local data in the APP
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* 5. System Specifications / Environment Diagnostics */}
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100/50 dark:border-slate-850 rounded-2xl p-5 space-y-3.5">
            <h4 className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-2">
              <CategoryIcon name="ShieldAlert" size={12} className="text-indigo-400" />
              Environment Specs
            </h4>

            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span>Database Status:</span>
                <span className="font-mono font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                  ONLINE
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span>Persistence Strategy:</span>
                <span className="font-mono text-slate-600 dark:text-slate-350 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase text-[9px] font-bold">
                  LOCAL + CLOUD
                </span>
              </div>
              <div className="flex items-center justify-between pb-1">
                <span>Framework Engine:</span>
                <span className="font-mono text-slate-600 dark:text-slate-350">Vite React v18</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NUKE ALL APP DATA CONFIRMATION MODAL */}
      {showNukeModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" id="nuke-modal-overlay">
          <div className="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden" id="nuke-modal-card">
            {/* Modal Header */}
            <div className="bg-rose-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl" id="nuke-icon-badge">
                  <CategoryIcon name="ShieldAlert" size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-black text-base uppercase tracking-wider leading-tight" id="nuke-title">Nuke All App Data</h3>
                  <p className="text-xs text-rose-100 font-medium mt-0.5">Permanent Full System Erase</p>
                </div>
              </div>
              <button
                type="button"
                id="nuke-close-btn"
                onClick={() => {
                  setShowNukeModal(false);
                  setNukeConfirmInput('');
                }}
                className="text-white/80 hover:text-white transition cursor-pointer p-1"
              >
                <CategoryIcon name="X" size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl p-4 text-xs text-rose-800 dark:text-rose-200 space-y-2">
                <p className="font-extrabold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                  <CategoryIcon name="AlertTriangle" size={15} className="text-rose-600 shrink-0" />
                  WARNING: This will permanently erase ALL data in the APP:
                </p>
                <ul className="list-disc list-inside space-y-1 font-medium pl-1 text-[11px] text-rose-700 dark:text-rose-300">
                  <li>All Income & Expense transaction history records</li>
                  <li>All category budget spending limits</li>
                  <li>All workspace brand info, logos & file extension policies</li>
                  <li>All local cache, Telegram bot credentials & AI configs</li>
                  <li>All cloud Firestore records linked to this account</li>
                </ul>
              </div>

              {/* Type NUKE to confirm */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300" id="nuke-confirm-label">
                  Type <span className="font-black text-rose-600 dark:text-rose-400 font-mono text-sm">NUKE</span> below to confirm permanent erasure:
                </label>
                <input
                  type="text"
                  id="nuke-confirm-input"
                  value={nukeConfirmInput}
                  onChange={(e) => setNukeConfirmInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (nukeConfirmInput.trim().toUpperCase() === 'NUKE') {
                        if (onNukeData) onNukeData();
                        else if (onClearData) onClearData();
                        setShowNukeModal(false);
                        setNukeConfirmInput('');
                      }
                    }
                  }}
                  placeholder="Type NUKE to confirm"
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-rose-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                id="nuke-cancel-btn"
                onClick={() => {
                  setShowNukeModal(false);
                  setNukeConfirmInput('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="nuke-confirm-btn"
                onClick={() => {
                  if (nukeConfirmInput.trim().toUpperCase() === 'NUKE') {
                    if (onNukeData) onNukeData();
                    else if (onClearData) onClearData();
                    setShowNukeModal(false);
                    setNukeConfirmInput('');
                  }
                }}
                disabled={nukeConfirmInput.trim().toUpperCase() !== 'NUKE'}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <CategoryIcon name="Trash2" size={14} />
                💥 Erase All App Data Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
