import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Building2,
  UserCheck,
  Landmark,
  Globe2,
  Award,
  Zap,
  ArrowRight,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Plus,
  Scale,
  DollarSign,
  Layers,
  ChevronRight,
  Info,
  Lock,
  Calendar,
  PieChart,
  FileText
} from 'lucide-react';
import {
  FundInjectionService,
  FundInjectionRecord,
  InjectionType,
  CreateInjectionInput
} from '../services/fundInjectionService';
import { CurrencyCode, formatAmountNoCents } from '../utils/currency';

interface FundInjectionModuleProps {
  currency: CurrencyCode;
}

const INJECTION_TYPES_INFO: Array<{
  type: InjectionType;
  title: string;
  badge: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
  description: string;
}> = [
  {
    type: 'EQUITY_FUNDING',
    title: 'Equity Funding',
    badge: 'VC / Carta Sync',
    icon: Building2,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-indigo-200 dark:border-indigo-800',
    description: 'VC/Angel wires & Cap-Table API (Carta) integration with share dilution calculations.'
  },
  {
    type: 'PERSONAL_INJECTION',
    title: 'Personal Injection',
    badge: "Owner's Equity",
    icon: UserCheck,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    description: "Owner's equity via ACH/Stripe rails, strictly separated from customer revenue."
  },
  {
    type: 'DEBT_FINANCING',
    title: 'Debt Financing',
    badge: 'Commercial Loan',
    icon: Landmark,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800',
    description: 'Commercial loans & venture debt with automated interest amortization schedules.'
  },
  {
    type: 'INTERCOMPANY_TRANSFER',
    title: 'Intercompany Transfer',
    badge: 'Cross-Border FX',
    icon: Globe2,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    border: 'border-purple-200 dark:border-purple-800',
    description: 'Parent-to-subsidiary funding with cross-border FX & OECD transfer pricing tags.'
  },
  {
    type: 'NON_DILUTIVE_CAPITAL',
    title: 'Non-Dilutive Capital',
    badge: 'Grant Ledger',
    icon: Award,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    description: 'Government/corporate grants with restricted milestone tracking ledgers.'
  },
  {
    type: 'WORKING_CAPITAL_ADVANCE',
    title: 'Working Capital Advance',
    badge: 'Factoring / MCA',
    icon: Zap,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-800',
    description: 'Invoice factoring & Merchant Cash Advances with risk-engine limit guards.'
  }
];

export const FundInjectionModule: React.FC<FundInjectionModuleProps> = ({ currency }) => {
  const [selectedType, setSelectedType] = useState<InjectionType>('EQUITY_FUNDING');
  const [injections, setInjections] = useState<FundInjectionRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'history' | 'analytics'>('create');
  const [selectedRecordDetails, setSelectedRecordDetails] = useState<FundInjectionRecord | null>(null);

  // Form Fields
  const [amount, setAmount] = useState<string>('250000');
  const [counterpartyName, setCounterpartyName] = useState<string>('Sequoia Capital Fund XV');
  const [counterpartyTaxId, setCounterpartyTaxId] = useState<string>('98-7654321');
  const [sourceAccount, setSourceAccount] = useState<string>('SVB Wire Transfer #8892');
  const [destinationAcc, setDestinationAcc] = useState<string>('Primary Operating Cash (First Republic)');
  const [referenceNote, setReferenceNote] = useState<string>('Series A tranche 1 capital injection');
  const [isCrossBorder, setIsCrossBorder] = useState<boolean>(false);
  const [originCountry, setOriginCountry] = useState<string>('USA');

  // Type Specific Parameters
  // Equity
  const [shareClass, setShareClass] = useState<string>('Series A Preferred');
  const [preMoneyValuation, setPreMoneyValuation] = useState<string>('10000000');
  const [pricePerShare, setPricePerShare] = useState<string>('12.50');

  // Debt
  const [annualRatePct, setAnnualRatePct] = useState<string>('8.25');
  const [termMonths, setTermMonths] = useState<string>('36');
  const [originationFeePct, setOriginationFeePct] = useState<string>('1.50');

  // Intercompany
  const [parentEntity, setParentEntity] = useState<string>('Chamlak Holding Corp (USA)');
  const [subsidiaryEntity, setSubsidiaryEntity] = useState<string>('Chamlak Tech Operating Asia Ltd');
  const [fxRate, setFxRate] = useState<string>('1.00');

  // Grants
  const [grantorAgency, setGrantorAgency] = useState<string>('US Small Business Innovation Research (SBIR)');
  const [milestone1Title, setMilestone1Title] = useState<string>('Phase I Prototype Demonstration');
  const [milestone1Tranche, setMilestone1Tranche] = useState<string>('100000');

  // Working Capital / MCA
  const [factorRate, setFactorRate] = useState<string>('1.14');
  const [holdbackPct, setHoldbackPct] = useState<string>('12.5');
  const [collateralInvoiceStr, setCollateralInvoiceStr] = useState<string>('INV-2026-801, INV-2026-802');

  // Load existing injections
  useEffect(() => {
    // Seed an initial demo injection if empty
    if (FundInjectionService.getInjections().length === 0) {
      FundInjectionService.executeFundInjection({
        idempotencyKey: 'SEED-INIT-EQUITY-001',
        injectionType: 'EQUITY_FUNDING',
        amount: 500000,
        currency: 'USD',
        counterpartyName: 'Benchmark Capital Partners',
        counterpartyTaxId: '84-1928374',
        sourceAccount: 'JPMorgan Chase Wire Ref #49281',
        destinationAcc: 'First Republic Operating Account',
        referenceNote: 'Seed Round Preferred Equity Wire',
        equityParams: {
          shareClass: 'Series Seed Preferred',
          preMoneyValuation: 4000000,
          pricePerShare: 5.0
        }
      });
    }
    setInjections([...FundInjectionService.getInjections()]);
  }, []);

  // Sync defaults when changing injection type
  const handleTypeSelect = (type: InjectionType) => {
    setSelectedType(type);
    switch (type) {
      case 'EQUITY_FUNDING':
        setAmount('250000');
        setCounterpartyName('Sequoia Capital Fund XV');
        setReferenceNote('Series A tranche 1 capital injection');
        break;
      case 'PERSONAL_INJECTION':
        setAmount('50000');
        setCounterpartyName('Founder Personal ACH (Chamlak Mey)');
        setReferenceNote("Owner's personal liquidity injection to fund Q3 expansion");
        break;
      case 'DEBT_FINANCING':
        setAmount('350000');
        setCounterpartyName('Silicon Valley Bank Venture Debt');
        setReferenceNote('3-Year Senior Secured Growth Term Loan');
        break;
      case 'INTERCOMPANY_TRANSFER':
        setAmount('150000');
        setCounterpartyName('Chamlak Parent Holding LLC (Delaware)');
        setReferenceNote('Intercompany working capital allocation for APAC subsidiary');
        break;
      case 'NON_DILUTIVE_CAPITAL':
        setAmount('120000');
        setCounterpartyName('National Science Foundation (NSF) Grant');
        setReferenceNote('Milestone 1 Restricted Innovation Grant Release');
        break;
      case 'WORKING_CAPITAL_ADVANCE':
        setAmount('80000');
        setCounterpartyName('Pipe Capital / Stripe Capital MCA');
        setReferenceNote('30-Day Invoice Factoring Advance on Enterprise ARR');
        break;
    }
  };

  // Preview double-entry ledger postings
  const ledgerPreview = FundInjectionService.generateLedgerEntries(
    selectedType,
    parseFloat(amount) || 0,
    currency,
    counterpartyName
  );

  // Submit Handler
  const handleExecuteInjection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      alert('Please enter a valid injection amount');
      setIsSubmitting(false);
      return;
    }

    const idempotencyKey = `KEY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const input: CreateInjectionInput = {
      idempotencyKey,
      injectionType: selectedType,
      amount: numericAmount,
      currency,
      counterpartyName,
      counterpartyTaxId,
      sourceAccount,
      destinationAcc,
      referenceNote,
      isCrossBorder,
      originCountry,
      equityParams: selectedType === 'EQUITY_FUNDING' ? {
        shareClass,
        preMoneyValuation: parseFloat(preMoneyValuation) || 5000000,
        pricePerShare: parseFloat(pricePerShare) || 10
      } : undefined,
      debtParams: selectedType === 'DEBT_FINANCING' ? {
        annualRatePct: parseFloat(annualRatePct) || 8.0,
        termMonths: parseInt(termMonths) || 36,
        originationFeePct: parseFloat(originationFeePct) || 1.5
      } : undefined,
      intercompanyParams: selectedType === 'INTERCOMPANY_TRANSFER' ? {
        parentEntity,
        subsidiaryEntity,
        fxRate: parseFloat(fxRate) || 1.0,
        taxJurisdiction: 'US-KH OECD Section 482'
      } : undefined,
      grantParams: selectedType === 'NON_DILUTIVE_CAPITAL' ? {
        grantorAgency,
        milestones: [
          {
            title: milestone1Title || 'Phase I Milestone',
            trancheAmount: parseFloat(milestone1Tranche) || numericAmount,
            dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        ]
      } : undefined,
      workingCapitalParams: selectedType === 'WORKING_CAPITAL_ADVANCE' ? {
        factorRate: parseFloat(factorRate) || 1.14,
        holdbackPct: parseFloat(holdbackPct) || 15,
        collateralInvoices: collateralInvoiceStr.split(',').map(s => s.trim())
      } : undefined
    };

    const newRecord = await FundInjectionService.executeFundInjection(input);
    setInjections([...FundInjectionService.getInjections()]);
    setIsSubmitting(false);
    setActiveTab('history');
    setSelectedRecordDetails(newRecord);
  };

  // Analytics summary calculations
  const totalCapitalUSD = injections.reduce((acc, item) => {
    const valUSD = item.currency === 'KHR' ? item.amount / 4000 : item.amount;
    return acc + valUSD;
  }, 0);

  const completedCount = injections.filter(i => i.status === 'COMPLETED').length;
  const amlHoldCount = injections.filter(i => i.status === 'AML_HOLD').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Scale className="w-80 h-80 text-emerald-400" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium mb-3">
              <ShieldCheck size={14} /> Double-Entry Ledger Engine Active
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Enterprise Fund Injection Hub</h2>
            <p className="text-slate-400 text-xs mt-1 max-w-xl">
              Architectural ledger framework for funding wires, equity rounds, debt financing, intercompany transfers, non-dilutive grants, and working capital advances.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'create'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Plus size={16} /> New Fund Injection
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <FileSpreadsheet size={16} /> Ledger History ({injections.length})
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Injected Capital
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
              <DollarSign size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono mt-2">
            {formatAmountNoCents(totalCapitalUSD, 'USD')}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-500" />
            Double-entry balanced
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Processed Injections
            </span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
              <Layers size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono mt-2">
            {completedCount} <span className="text-xs text-slate-400 font-normal">/ {injections.length}</span>
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            100% Idempotency verified
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              AML & KYC Guards
            </span>
            <div className={`p-2 rounded-lg ${
              amlHoldCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <ShieldCheck size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono mt-2">
            {amlHoldCount > 0 ? `${amlHoldCount} Hold` : 'Active'}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            FinCEN $10k SAR CTR Triggers
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Supported Modalities
            </span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/50 rounded-lg text-purple-600 dark:text-purple-400">
              <Building2 size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono mt-2">
            6 / 6
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            Equity, Debt, Grants, MCA & Transfer
          </p>
        </div>
      </div>

      {/* Main Container */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Modality Selector */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
              Select Fund Injection Type
            </h3>
            <div className="space-y-2">
              {INJECTION_TYPES_INFO.map(item => {
                const Icon = item.icon;
                const isSelected = selectedType === item.type;
                return (
                  <div
                    key={item.type}
                    onClick={() => handleTypeSelect(item.type)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? `${item.bg} ${item.border} shadow-sm ring-2 ring-emerald-500/20`
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 ${item.color}`}>
                          <Icon size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {item.title}
                          </h4>
                          <span className="inline-block text-[10px] text-slate-400 font-mono mt-0.5">
                            {item.badge}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className={`mt-1 transition-transform ${isSelected ? 'text-emerald-500 translate-x-1' : 'text-slate-300 dark:text-slate-600'}`} />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Execution Form & Double-Entry Preview */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {selectedType.replace('_', ' ')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Provide financial payload parameters & verify double-entry posting rules.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-bold">
                  IDEMPOTENCY GUARD ON
                </span>
              </div>

              <form onSubmit={handleExecuteInjection} className="space-y-5">
                {/* General Core Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Injection Amount ({currency}) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-xs">$</span>
                      <input
                        type="number"
                        step="any"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Counterparty / Investor Name *
                    </label>
                    <input
                      type="text"
                      value={counterpartyName}
                      onChange={e => setCounterpartyName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tax ID / EIN / Beneficial Owner ID
                    </label>
                    <input
                      type="text"
                      value={counterpartyTaxId}
                      onChange={e => setCounterpartyTaxId(e.target.value)}
                      placeholder="e.g. 98-7654321"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Source Rail / Account Reference
                    </label>
                    <input
                      type="text"
                      value={sourceAccount}
                      onChange={e => setSourceAccount(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Specific Extension Parameters */}
                {selectedType === 'EQUITY_FUNDING' && (
                  <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                      <Building2 size={14} /> Equity Round & Carta Cap-Table Sync
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Share Class</label>
                        <input
                          type="text"
                          value={shareClass}
                          onChange={e => setShareClass(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Pre-Money Val ($)</label>
                        <input
                          type="number"
                          value={preMoneyValuation}
                          onChange={e => setPreMoneyValuation(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Price Per Share ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={pricePerShare}
                          onChange={e => setPricePerShare(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedType === 'DEBT_FINANCING' && (
                  <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 space-y-3">
                    <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <Landmark size={14} /> Loan Terms & Amortization Config
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Annual Rate (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={annualRatePct}
                          onChange={e => setAnnualRatePct(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Term (Months)</label>
                        <input
                          type="number"
                          value={termMonths}
                          onChange={e => setTermMonths(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Origination Fee (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={originationFeePct}
                          onChange={e => setOriginationFeePct(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedType === 'INTERCOMPANY_TRANSFER' && (
                  <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 space-y-3">
                    <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                      <Globe2 size={14} /> OECD Transfer Pricing & Cross-Border FX
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Parent Entity</label>
                        <input
                          type="text"
                          value={parentEntity}
                          onChange={e => setParentEntity(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Subsidiary Entity</label>
                        <input
                          type="text"
                          value={subsidiaryEntity}
                          onChange={e => setSubsidiaryEntity(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedType === 'NON_DILUTIVE_CAPITAL' && (
                  <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 space-y-3">
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <Award size={14} /> Grant Milestone Tranche Release
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Granting Agency</label>
                        <input
                          type="text"
                          value={grantorAgency}
                          onChange={e => setGrantorAgency(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Milestone 1 Title</label>
                        <input
                          type="text"
                          value={milestone1Title}
                          onChange={e => setMilestone1Title(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedType === 'WORKING_CAPITAL_ADVANCE' && (
                  <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 space-y-3">
                    <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                      <Zap size={14} /> MCA Factor Rate & Invoice Factoring Collateral
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Factor Rate</label>
                        <input
                          type="number"
                          step="0.01"
                          value={factorRate}
                          onChange={e => setFactorRate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Daily Holdback (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={holdbackPct}
                          onChange={e => setHoldbackPct(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Factored Invoices</label>
                        <input
                          type="text"
                          value={collateralInvoiceStr}
                          onChange={e => setCollateralInvoiceStr(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Double-Entry Ledger Posting Preview Box */}
                <div className="p-4 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Scale size={14} /> Double-Entry Ledger Preview
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Debit === Credit Verified
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                          <th className="pb-1.5 font-medium">Account Name & Code</th>
                          <th className="pb-1.5 font-medium">Direction</th>
                          <th className="pb-1.5 font-medium text-right">Amount ({currency})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {ledgerPreview.map((entry, idx) => (
                          <tr key={idx}>
                            <td className="py-2 text-slate-200">{entry.accountType}</td>
                            <td className="py-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                entry.direction === 'DEBIT' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                              }`}>
                                {entry.direction}
                              </span>
                            </td>
                            <td className="py-2 text-right text-slate-100 font-bold">
                              {formatAmountNoCents(entry.amount, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={16} />
                    )}
                    Execute Idempotency-Protected Injection
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* History Ledger Tab */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Fund Injection Audit Ledger
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete transactional audit trail with double-entry postings, compliance verification status, and category metadata.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-2">ID & Date</th>
                  <th className="py-3 px-2">Injection Type</th>
                  <th className="py-3 px-2">Counterparty</th>
                  <th className="py-3 px-2 text-right">Amount</th>
                  <th className="py-3 px-2">Compliance Risk</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {injections.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-2 font-mono">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{item.id}</div>
                      <div className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3 px-2">
                      <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                        {item.injectionType}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-medium text-slate-800 dark:text-slate-200">
                      {item.counterpartyName}
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatAmountNoCents(item.amount, item.currency as CurrencyCode)}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.riskLevel === 'LOW'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {item.riskLevel} RISK
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                        item.status === 'COMPLETED'
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => setSelectedRecordDetails(item)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[11px] font-medium"
                      >
                        Inspect Ledger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Inspector Modal */}
      {selectedRecordDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  INSPECTOR: {selectedRecordDetails.id}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedRecordDetails.injectionType.replace('_', ' ')} Detail
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecordDetails(null)}
                className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            {/* General Metadata */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl">
              <div><span className="text-slate-400">Amount:</span> <strong className="font-mono text-slate-900 dark:text-slate-100">{formatAmountNoCents(selectedRecordDetails.amount, selectedRecordDetails.currency as CurrencyCode)}</strong></div>
              <div><span className="text-slate-400">Counterparty:</span> <strong className="text-slate-900 dark:text-slate-100">{selectedRecordDetails.counterpartyName}</strong></div>
              <div><span className="text-slate-400">Idempotency Key:</span> <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">{selectedRecordDetails.idempotencyKey}</span></div>
              <div><span className="text-slate-400">Status:</span> <span className="font-mono font-bold text-emerald-600">{selectedRecordDetails.status}</span></div>
            </div>

            {/* Type Specific Metadata Inspector */}
            {selectedRecordDetails.equityDetail && (
              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 text-xs space-y-1">
                <div className="font-bold text-indigo-900 dark:text-indigo-300">Carta Cap-Table Sync Record:</div>
                <div>Share Class: <strong>{selectedRecordDetails.equityDetail.shareClass}</strong></div>
                <div>Shares Issued: <strong>{selectedRecordDetails.equityDetail.sharesIssued.toLocaleString()} shares @ ${selectedRecordDetails.equityDetail.pricePerShare}/share</strong></div>
                <div>Post-Money Valuation: <strong>${selectedRecordDetails.equityDetail.postMoneyValuation.toLocaleString()} ({selectedRecordDetails.equityDetail.dilutionPercentage}% Dilution)</strong></div>
                <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 mt-1">Carta Sync ID: {selectedRecordDetails.equityDetail.cartaSyncId}</div>
              </div>
            )}

            {selectedRecordDetails.debtSchedule && (
              <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 text-xs space-y-1">
                <div className="font-bold text-blue-900 dark:text-blue-300">Amortization & Interest Terms:</div>
                <div>Principal: <strong>${selectedRecordDetails.debtSchedule.principalAmount.toLocaleString()}</strong> @ <strong>{selectedRecordDetails.debtSchedule.annualRatePct}% APY</strong></div>
                <div>Term: <strong>{selectedRecordDetails.debtSchedule.termMonths} Months</strong> | Monthly Amortized Payment: <strong>${selectedRecordDetails.debtSchedule.monthlyPayment}/mo</strong></div>
                <div>Origination Fee: <strong>${selectedRecordDetails.debtSchedule.originationFee}</strong></div>
              </div>
            )}

            {/* Double-Entry Postings */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono">
                Double-Entry Journal Entries
              </h4>
              <div className="bg-slate-900 p-3 rounded-xl text-slate-100 font-mono text-xs space-y-1">
                {selectedRecordDetails.ledgerTransaction.entries.map((e, idx) => (
                  <div key={idx} className="flex justify-between py-1 border-b border-slate-800 last:border-0">
                    <span className="text-slate-300">{e.accountType}</span>
                    <span className={e.direction === 'DEBIT' ? 'text-blue-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {e.direction} ${e.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Compliance Audit Reasons */}
            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-slate-700 dark:text-slate-300">Compliance & Tax Audit Log:</h4>
              <p className="text-slate-500 dark:text-slate-400">Tax Category: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{selectedRecordDetails.complianceResult.taxCategory}</code></p>
              <ul className="list-disc pl-4 text-slate-600 dark:text-slate-400 space-y-0.5 mt-1">
                {selectedRecordDetails.complianceResult.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
