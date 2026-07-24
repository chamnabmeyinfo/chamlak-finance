import React, { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { parseWorksheetCSV } from '../utils/worksheetUtils';
import { formatAmount } from '../utils/currency';
import {
  listSpreadsheets,
  createSpreadsheet,
  exportToSpreadsheet,
  importFromSpreadsheet,
  GoogleSpreadsheetFile,
} from '../lib/googleSheetsService';

interface GoogleSheetsIntegrationProps {
  transactions: Transaction[];
  googleToken: string | null;
  onConnectSheets: () => Promise<void>;
  onDisconnectSheets: () => void;
  onImportTransactions: (imported: Omit<Transaction, 'id'>[]) => Promise<void>;
  triggerToast: (msg: string) => void;
}

export const GoogleSheetsIntegration: React.FC<GoogleSheetsIntegrationProps> = ({
  transactions,
  googleToken,
  onConnectSheets,
  onDisconnectSheets,
  onImportTransactions,
  triggerToast,
}) => {
  // Advanced Sheets States
  const [spreadsheets, setSpreadsheets] = useState<GoogleSpreadsheetFile[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string>(() => {
    return localStorage.getItem('finance_tracker_linked_sheet_id') || '1vxYEOUZEFe5aWLw6JJuZ-YuYGFVUfwoN8wXlcwYaRVw';
  });
  const [tabName, setTabName] = useState<string>(() => {
    return localStorage.getItem('finance_tracker_sheet_tab_name') || 'Expenses';
  });
  const [customSheetUrl, setCustomSheetUrl] = useState<string>(
    'https://docs.google.com/spreadsheets/d/1vxYEOUZEFe5aWLw6JJuZ-YuYGFVUfwoN8wXlcwYaRVw/edit#gid=1334759914'
  );
  const [autoSync, setAutoSync] = useState<boolean>(() => {
    return localStorage.getItem('finance_tracker_auto_sync_sheets') === 'true';
  });

  // Public Link and File Import States
  const [publicSheetUrl, setPublicSheetUrl] = useState<string>(
    'https://docs.google.com/spreadsheets/d/1vxYEOUZEFe5aWLw6JJuZ-YuYGFVUfwoN8wXlcwYaRVw/edit#gid=1334759914'
  );
  const [isFetchingPublic, setIsFetchingPublic] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // General Loading/Preview States
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [newSheetName, setNewSheetName] = useState('Expenses Worksheet Ledger');
  const [importedPreview, setImportedPreview] = useState<Omit<Transaction, 'id'>[] | null>(null);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('finance_tracker_linked_sheet_id', selectedSheetId);
  }, [selectedSheetId]);

  useEffect(() => {
    localStorage.setItem('finance_tracker_sheet_tab_name', tabName);
  }, [tabName]);

  useEffect(() => {
    localStorage.setItem('finance_tracker_auto_sync_sheets', String(autoSync));
  }, [autoSync]);

  // Load spreadsheet list from Google Drive when authenticated
  useEffect(() => {
    if (googleToken) {
      fetchSheetsList();
    } else {
      setSpreadsheets([]);
    }
  }, [googleToken]);

  const fetchSheetsList = async () => {
    setIsLoadingList(true);
    try {
      const files = await listSpreadsheets(googleToken!);
      setSpreadsheets(files);
    } catch (e: any) {
      console.error(e);
      triggerToast('Could not load spreadsheets list.');
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleCreateNewSheet = async () => {
    if (!newSheetName.trim()) {
      triggerToast('Please provide a name for the spreadsheet.');
      return;
    }
    setIsCreatingSheet(true);
    try {
      const newFile = await createSpreadsheet(googleToken!, newSheetName.trim());
      setSpreadsheets((prev) => [newFile, ...prev]);
      setSelectedSheetId(newFile.id);
      if (transactions.length > 0) {
        await exportToSpreadsheet(googleToken!, newFile.id, transactions);
      }
      triggerToast(`Spreadsheet "${newFile.name}" created and synced with ${transactions.length} record(s)!`);
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Failed to create spreadsheet.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleToggleAutoSync = async (enabled: boolean) => {
    setAutoSync(enabled);
    if (enabled && googleToken && selectedSheetId) {
      setIsExporting(true);
      try {
        await exportToSpreadsheet(googleToken, selectedSheetId, transactions);
        triggerToast('Auto-sync enabled! Spreadsheet updated with latest database entries.');
      } catch (e: any) {
        console.error(e);
        triggerToast('Auto-sync enabled, but initial sync failed: ' + (e.message || 'Error'));
      } finally {
        setIsExporting(false);
      }
    }
  };

  const handleExport = async () => {
    if (!selectedSheetId) {
      triggerToast('Please select or create a Google Sheet first.');
      return;
    }
    const targetSheet = spreadsheets.find((s) => s.id === selectedSheetId);
    const sheetName = targetSheet ? targetSheet.name : 'selected Google Sheet';
    
    const confirmed = window.confirm(
      `Export current ledger history to "${sheetName}"? This will overwrite the spreadsheet's content.`
    );
    if (!confirmed) return;

    setIsExporting(true);
    try {
      await exportToSpreadsheet(googleToken!, selectedSheetId, transactions);
      triggerToast('Ledger successfully exported to Google Sheets!');
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportPreview = async () => {
    const targetSheetId = customSheetUrl || selectedSheetId;
    if (!targetSheetId) {
      triggerToast('Please enter a Google Sheet URL / ID or select a spreadsheet.');
      return;
    }
    setIsImporting(true);
    setImportedPreview(null);
    try {
      const data = await importFromSpreadsheet(googleToken!, targetSheetId, tabName || 'Expenses');
      if (data.length === 0) {
        triggerToast(`No worksheet records found in sheet tab "${tabName || 'Expenses'}".`);
      } else {
        setImportedPreview(data);
        triggerToast(`Loaded ${data.length} records from Google Sheet tab "${tabName || 'Expenses'}".`);
      }
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  // Import from Public Sheet URL Handler
  const handlePublicSheetImport = async () => {
    if (!publicSheetUrl.trim()) {
      triggerToast('Please provide a Google Sheets URL.');
      return;
    }
    setIsFetchingPublic(true);
    setImportedPreview(null);
    try {
      const response = await fetch('/api/import-public-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl: publicSheetUrl.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to download public sheet');
      }

      const parsed = parseWorksheetCSV(data.csv);
      if (parsed.length === 0) {
        triggerToast('No valid transaction records found in the Google Sheet. Please check the columns layout.');
        return;
      }

      setImportedPreview(parsed);
      triggerToast(`Successfully loaded ${parsed.length} records from public Google Sheet!`);
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Error importing public Google Sheet. Make sure the sheet is public ("Anyone with the link can view").');
    } finally {
      setIsFetchingPublic(false);
    }
  };

  // CSV File Upload Handlers
  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readAndParseCSV(file);
  };

  const readAndParseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;
        const parsed = parseWorksheetCSV(text);
        if (parsed.length === 0) {
          triggerToast('Could not parse any records from the CSV file. Please make sure the format is valid.');
          return;
        }
        setImportedPreview(parsed);
        triggerToast(`Successfully read ${parsed.length} records from ${file.name}!`);
      } catch (err) {
        console.error(err);
        triggerToast('Failed to read CSV file.');
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        readAndParseCSV(file);
      } else {
        triggerToast('Only CSV files are supported for instant upload.');
      }
    }
  };

  const handleConfirmImport = async () => {
    if (!importedPreview || importedPreview.length === 0) return;
    setIsConfirming(true);
    try {
      await onImportTransactions(importedPreview);
      triggerToast(`Successfully imported all ${importedPreview.length} worksheet transaction(s)!`);
      setImportedPreview(null);
    } catch (e: any) {
      console.error(e);
      triggerToast('Failed to save imported transactions.');
    } finally {
      setIsConfirming(false);
    }
  };

  const selectedSheet = spreadsheets.find((s) => s.id === selectedSheetId);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-3xs p-6 space-y-6" id="google-sheets-sync-card">
      
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase font-extrabold text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <CategoryIcon name="FileSpreadsheet" size={14} />
          </span>
          Google Sheets & File Import Hub
        </h4>
        {googleToken && (
          <button
            onClick={onDisconnectSheets}
            className="text-[10px] uppercase font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-all cursor-pointer"
          >
            <CategoryIcon name="Unlink" size={11} />
            Disconnect Sheets
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
        Populate your app ledger by fetching rows directly from any public Google Sheet link or uploading a CSV file.
      </p>

      {/* 2. Public Sheet & CSV File Quick Import (No Login Required) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        
        {/* A. Public Sheet URL Import */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
              🔗 Import Public Google Sheet
            </span>
            <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded">
              No Login Needed
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block">
              Google Sheet URL
            </label>
            <input
              type="text"
              value={publicSheetUrl}
              onChange={(e) => setPublicSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit..."
              className="w-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-xs font-mono font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handlePublicSheetImport}
              disabled={isFetchingPublic || !publicSheetUrl}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-3xs transition cursor-pointer disabled:opacity-50"
            >
              {isFetchingPublic ? (
                <>
                  <CategoryIcon name="Loader2" size={13} className="animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <CategoryIcon name="Download" size={13} />
                  <span>Fetch & Preview Sheet</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* B. Drag & Drop CSV File */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`p-4 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-dashed transition-all flex flex-col justify-between space-y-3 ${
            dragActive 
              ? 'border-indigo-500 bg-indigo-50/25 dark:bg-indigo-950/10' 
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
              📂 Drag & Drop CSV
            </span>
            <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold px-1.5 py-0.5 rounded">
              Local File
            </span>
          </div>

          <div className="text-center py-2 space-y-2 flex-1 flex flex-col justify-center items-center">
            <CategoryIcon name="UploadCloud" size={24} className="text-slate-400 dark:text-slate-500" />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
              Drag file here or click below to select
            </p>
          </div>

          <label className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer text-center select-none">
            <CategoryIcon name="FolderOpen" size={13} />
            <span>Browse CSV File</span>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleCSVFileChange} 
              className="hidden" 
            />
          </label>
        </div>
      </div>

      {/* 3. Bidirectional Secure Account Drive Sync Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CategoryIcon name="Lock" size={12} className="text-indigo-500" />
          <h5 className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 tracking-wider">
            Secure Account Drive Sync (Bidirectional Sync)
          </h5>
        </div>

        {!googleToken ? (
          <div className="p-4 bg-indigo-50/10 dark:bg-indigo-950/5 rounded-xl border border-indigo-100/40 dark:border-indigo-950/20 text-center py-6 space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium max-w-md mx-auto">
              Want to export your live database or sync changes automatically? Link your Google Account to authorize direct Google Drive read/write permissions.
            </p>
            <button
              onClick={onConnectSheets}
              className="mx-auto flex items-center gap-2.5 py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-2xl text-xs transition duration-200 cursor-pointer shadow-3xs hover:shadow"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 fill-current">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>Connect Google Account for Direct Sync</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Direct Sheet ID Import Box */}
            <div className="p-4 bg-slate-50/80 dark:bg-slate-950 rounded-xl border border-indigo-100 dark:border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                  Direct Sheet URL / ID Import
                </span>
                <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded">
                  Target: Expenses
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                    Google Sheet URL or ID
                  </label>
                  <input
                    type="text"
                    value={customSheetUrl}
                    onChange={(e) => setCustomSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1vxYEOUZEFe5aWLw6JJuZ-YuYGFVUfwoN8wXlcwYaRVw..."
                    className="w-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-xs font-mono font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-2 items-center">
                  <div className="w-1/3">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                      Sheet Tab Name
                    </label>
                    <input
                      type="text"
                      value={tabName}
                      onChange={(e) => setTabName(e.target.value)}
                      placeholder="Expenses"
                      className="w-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="w-2/3 pt-4">
                    <button
                      onClick={handleImportPreview}
                      disabled={isImporting || !customSheetUrl}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-3xs transition cursor-pointer disabled:opacity-50"
                    >
                      {isImporting ? (
                        <CategoryIcon name="Loader2" size={13} className="animate-spin" />
                      ) : (
                        <CategoryIcon name="Download" size={13} />
                      )}
                      Import from "{tabName || 'Expenses'}" Tab
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Linked Spreadsheet Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Linked Spreadsheet
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedSheetId}
                  onChange={(e) => setSelectedSheetId(e.target.value)}
                  disabled={isLoadingList}
                  className="flex-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="">-- Select Sheet --</option>
                  {spreadsheets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={fetchSheetsList}
                  disabled={isLoadingList}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl transition cursor-pointer"
                  title="Refresh lists"
                >
                  <CategoryIcon name="RefreshCw" size={14} className={isLoadingList ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Create Spreadsheet Box */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-100/80 dark:border-slate-800/80 space-y-3">
              <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block">
                Create & Initialize New Spreadsheet
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value)}
                  placeholder="Sheet name"
                  className="flex-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={handleCreateNewSheet}
                  disabled={isCreatingSheet || !newSheetName}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-3xs transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  {isCreatingSheet ? (
                    <CategoryIcon name="Loader2" size={11} className="animate-spin" />
                  ) : (
                    <CategoryIcon name="Plus" size={11} />
                  )}
                  Create
                </button>
              </div>
            </div>

            {selectedSheet && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-emerald-100/40 dark:border-emerald-950/20 bg-emerald-50/10 dark:bg-emerald-950/5 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CategoryIcon name="CheckCircle" size={13} />
                      <span>Linked to Google Sheets</span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-[280px]">
                      {selectedSheet.name}
                    </p>
                  </div>
                  {selectedSheet.webViewLink && (
                    <a
                      href={selectedSheet.webViewLink}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="shrink-0 p-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition shadow-3xs"
                    >
                      Open Sheet
                      <CategoryIcon name="ExternalLink" size={10} />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition cursor-pointer disabled:opacity-50"
                  >
                    {isExporting ? (
                      <CategoryIcon name="Loader2" size={13} className="animate-spin" />
                    ) : (
                      <CategoryIcon name="Upload" size={13} />
                    )}
                    Export Ledger
                  </button>

                  <button
                    onClick={handleImportPreview}
                    disabled={isImporting}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 border border-slate-200/50 dark:border-slate-750 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {isImporting ? (
                      <CategoryIcon name="Loader2" size={13} className="animate-spin" />
                    ) : (
                      <CategoryIcon name="Download" size={13} />
                    )}
                    Import Ledger
                  </button>
                </div>

                <label className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-950 rounded-xl border border-slate-100/50 dark:border-slate-800/60 cursor-pointer transition select-none">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => handleToggleAutoSync(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="block text-xs font-extrabold text-slate-700 dark:text-slate-200">
                      Auto-Sync New Records
                    </span>
                    <span className="block text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Automatically write transactions to sheet as they are logged
                    </span>
                  </div>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Import Preview Dialogue (Handles Public Sheet, CSV file & Authenticated Sync row imports) */}
      {importedPreview && (
        <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/40 dark:border-indigo-950/20 rounded-xl space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
              Spreadsheet Import Preview
            </span>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-indigo-100/60 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded">
              {importedPreview.length} Record(s) Found
            </span>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-2 pr-1.5 border-b border-indigo-100/20 dark:border-indigo-950/20 pb-3">
            {importedPreview.slice(0, 5).map((row, idx) => (
              <div key={idx} className="flex justify-between items-center text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="truncate pr-2 text-left">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{row.description}</span>
                  <span className="block text-[9px] text-slate-400 mt-0.5">{row.date} • {row.category}</span>
                </div>
                <span className={`font-mono font-bold ${row.type === 'income' ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'}`}>
                  {row.type === 'income' ? '+' : '-'}{formatAmount(row.amount, row.currency || 'USD')}
                </span>
              </div>
            ))}
            {importedPreview.length > 5 && (
              <p className="text-[10px] text-slate-400 font-semibold text-center mt-1">
                + {importedPreview.length - 5} more entries...
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setImportedPreview(null)}
              disabled={isConfirming}
              className="flex-1 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-850 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={isConfirming}
              className="flex-1 py-2 text-xs font-extrabold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isConfirming ? (
                <>
                  <CategoryIcon name="Loader2" size={13} className="animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <CategoryIcon name="Check" size={13} />
                  <span>Confirm Import ({importedPreview.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
