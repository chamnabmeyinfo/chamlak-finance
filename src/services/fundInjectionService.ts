/**
 * Double-Entry Bookkeeping Ledger & Fund Injection Orchestrator
 * Handles execution, idempotency, ledger balancing, and metadata generation.
 */

import { ComplianceEngine, ComplianceCheckResult } from './complianceEngine';

export type InjectionType =
  | 'EQUITY_FUNDING'
  | 'PERSONAL_INJECTION'
  | 'DEBT_FINANCING'
  | 'INTERCOMPANY_TRANSFER'
  | 'NON_DILUTIVE_CAPITAL'
  | 'WORKING_CAPITAL_ADVANCE';

export type InjectionStatus =
  | 'PENDING'
  | 'AML_HOLD'
  | 'KYC_REQUIRED'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED';

export interface LedgerEntry {
  accountType: string;
  accountNumber: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
  currency: string;
}

export interface LedgerTransaction {
  id: string;
  referenceId: string;
  description: string;
  entries: LedgerEntry[];
  timestamp: string;
}

export interface FundInjectionRecord {
  id: string;
  idempotencyKey: string;
  organizationId: string;
  injectionType: InjectionType;
  status: InjectionStatus;
  amount: number;
  currency: string;
  counterpartyName: string;
  counterpartyTaxId?: string;
  sourceAccount: string;
  destinationAcc: string;
  referenceNote?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  complianceResult: ComplianceCheckResult;
  ledgerTransaction: LedgerTransaction;
  
  // Type-specific Metadatas
  equityDetail?: {
    cartaSyncId?: string;
    shareClass: string;
    pricePerShare: number;
    sharesIssued: number;
    postMoneyValuation: number;
    dilutionPercentage: number;
  };
  debtSchedule?: {
    principalAmount: number;
    annualRatePct: number;
    termMonths: number;
    monthlyPayment: number;
    originationFee: number;
    amortizationTable: Array<{ month: number; principalPayment: number; interestPayment: number; remainingBalance: number }>;
  };
  intercompanyDetail?: {
    parentEntity: string;
    subsidiaryEntity: string;
    crossBorder: boolean;
    fxRate: number;
    transferPricingRef: string;
    taxJurisdiction: string;
  };
  grantMilestones?: Array<{
    grantorAgency: string;
    milestoneIndex: number;
    title: string;
    trancheAmount: number;
    isRestricted: boolean;
    isCompleted: boolean;
    dueDate: string;
  }>;
  workingCapitalRisk?: {
    factorRate: number;
    holdbackPct: number;
    maxApprovedLimit: number;
    collateralInvoices: string[];
    riskScore: number;
  };

  createdAt: string;
  updatedAt: string;
}

export interface CreateInjectionInput {
  idempotencyKey: string;
  organizationId?: string;
  injectionType: InjectionType;
  amount: number;
  currency: string;
  counterpartyName: string;
  counterpartyTaxId?: string;
  sourceAccount: string;
  destinationAcc: string;
  referenceNote?: string;
  isCrossBorder?: boolean;
  originCountry?: string;

  // Type specific inputs
  equityParams?: {
    shareClass: string;
    preMoneyValuation: number;
    pricePerShare: number;
  };
  debtParams?: {
    annualRatePct: number;
    termMonths: number;
    originationFeePct: number;
  };
  intercompanyParams?: {
    parentEntity: string;
    subsidiaryEntity: string;
    fxRate: number;
    taxJurisdiction: string;
  };
  grantParams?: {
    grantorAgency: string;
    milestones: Array<{ title: string; trancheAmount: number; dueDate: string }>;
  };
  workingCapitalParams?: {
    factorRate: number;
    holdbackPct: number;
    collateralInvoices: string[];
  };
}

// In-Memory store to guarantee idempotency and instant execution
const processedKeys = new Map<string, FundInjectionRecord>();
const injectionDatabase: FundInjectionRecord[] = [];

export class FundInjectionService {
  /**
   * Generates Double-Entry Ledger entries for the injection.
   * Enforces exact balance equality: SUM(Debits) === SUM(Credits).
   */
  public static generateLedgerEntries(
    type: InjectionType,
    amount: number,
    currency: string,
    counterparty: string
  ): LedgerEntry[] {
    switch (type) {
      case 'EQUITY_FUNDING':
        return [
          { accountType: '1010 - Cash & Bank Assets', accountNumber: '1010', direction: 'DEBIT', amount, currency },
          { accountType: '3010 - Preferred / Common Stock Equity', accountNumber: '3010', direction: 'CREDIT', amount, currency }
        ];

      case 'PERSONAL_INJECTION':
        return [
          { accountType: '1010 - Operating Cash (ACH/Stripe)', accountNumber: '1010', direction: 'DEBIT', amount, currency },
          { accountType: '3050 - Owner Capital Contributions', accountNumber: '3050', direction: 'CREDIT', amount, currency }
        ];

      case 'DEBT_FINANCING':
        return [
          { accountType: '1010 - Commercial Cash Reserve', accountNumber: '1010', direction: 'DEBIT', amount, currency },
          { accountType: '2010 - Debt Notes & Commercial Loan Payable', accountNumber: '2010', direction: 'CREDIT', amount, currency }
        ];

      case 'INTERCOMPANY_TRANSFER':
        return [
          { accountType: '1020 - Subsidiary Clearing Account', accountNumber: '1020', direction: 'DEBIT', amount, currency },
          { accountType: '2080 - Intercompany Loan Payable', accountNumber: '2080', direction: 'CREDIT', amount, currency }
        ];

      case 'NON_DILUTIVE_CAPITAL':
        return [
          { accountType: '1030 - Restricted Grant Reserve Account', accountNumber: '1030', direction: 'DEBIT', amount, currency },
          { accountType: '4090 - Deferred Grant Revenue (Milestone Locked)', accountNumber: '4090', direction: 'CREDIT', amount, currency }
        ];

      case 'WORKING_CAPITAL_ADVANCE':
        return [
          { accountType: '1010 - Working Capital Cash Deposit', accountNumber: '1010', direction: 'DEBIT', amount, currency },
          { accountType: '2050 - MCA Advance & Factoring Liability', accountNumber: '2050', direction: 'CREDIT', amount, currency }
        ];
    }
  }

  /**
   * Helper: Calculates debt amortization schedule
   */
  private static calculateAmortization(principal: number, ratePct: number, months: number) {
    const monthlyRate = ratePct / 100 / 12;
    const monthlyPayment = monthlyRate > 0
      ? (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
      : principal / months;

    let balance = principal;
    const table = [];

    for (let m = 1; m <= months; m++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      balance = Math.max(0, balance - principalPayment);
      table.push({
        month: m,
        principalPayment: Number(principalPayment.toFixed(2)),
        interestPayment: Number(interestPayment.toFixed(2)),
        remainingBalance: Number(balance.toFixed(2))
      });
    }

    return { monthlyPayment: Number(monthlyPayment.toFixed(2)), table };
  }

  /**
   * Processes a new Fund Injection with idempotency control, AML compliance,
   * double-entry bookkeeping, and category specific metadata creation.
   */
  public static async executeFundInjection(input: CreateInjectionInput): Promise<FundInjectionRecord> {
    // 1. Idempotency Check
    if (processedKeys.has(input.idempotencyKey)) {
      return processedKeys.get(input.idempotencyKey)!;
    }

    // 2. Evaluate AML/KYC & Compliance Engine
    const complianceResult = ComplianceEngine.evaluateInjection({
      injectionType: input.injectionType,
      amount: input.amount,
      currency: input.currency,
      counterpartyName: input.counterpartyName,
      counterpartyTaxId: input.counterpartyTaxId,
      isCrossBorder: input.isCrossBorder,
      originCountry: input.originCountry,
      sourceAccount: input.sourceAccount
    });

    // 3. Determine Initial Status
    let status: InjectionStatus = 'COMPLETED';
    if (!complianceResult.passed) {
      status = 'REJECTED';
    } else if (complianceResult.amlFlagged || complianceResult.requiresOfficerReview) {
      status = 'AML_HOLD';
    } else if (!complianceResult.kycVerified) {
      status = 'KYC_REQUIRED';
    }

    // 4. Double-Entry Bookkeeping Ledger Generation
    const ledgerEntries = this.generateLedgerEntries(
      input.injectionType,
      input.amount,
      input.currency,
      input.counterpartyName
    );

    const injectionId = `INJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const ledgerTransaction: LedgerTransaction = {
      id: `TX-LEDGER-${Date.now()}`,
      referenceId: injectionId,
      description: `Fund Injection [${input.injectionType}] from ${input.counterpartyName}`,
      entries: ledgerEntries,
      timestamp: new Date().toISOString()
    };

    // 5. Construct Metadata extensions
    let equityDetail;
    let debtSchedule;
    let intercompanyDetail;
    let grantMilestones;
    let workingCapitalRisk;

    if (input.injectionType === 'EQUITY_FUNDING' && input.equityParams) {
      const pps = input.equityParams.pricePerShare || 10;
      const shares = Math.floor(input.amount / pps);
      const postMoney = (input.equityParams.preMoneyValuation || 5000000) + input.amount;
      const dilution = Number(((input.amount / postMoney) * 100).toFixed(2));

      equityDetail = {
        cartaSyncId: `CARTA-SYNC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        shareClass: input.equityParams.shareClass || 'Series A Preferred',
        pricePerShare: pps,
        sharesIssued: shares,
        postMoneyValuation: postMoney,
        dilutionPercentage: dilution
      };
    }

    if (input.injectionType === 'DEBT_FINANCING' && input.debtParams) {
      const termMonths = input.debtParams.termMonths || 36;
      const ratePct = input.debtParams.annualRatePct || 7.5;
      const origFee = input.amount * ((input.debtParams.originationFeePct || 1.5) / 100);
      const { monthlyPayment, table } = this.calculateAmortization(input.amount, ratePct, termMonths);

      debtSchedule = {
        principalAmount: input.amount,
        annualRatePct: ratePct,
        termMonths,
        monthlyPayment,
        originationFee: Number(origFee.toFixed(2)),
        amortizationTable: table
      };
    }

    if (input.injectionType === 'INTERCOMPANY_TRANSFER' && input.intercompanyParams) {
      intercompanyDetail = {
        parentEntity: input.intercompanyParams.parentEntity || 'Global Parent Corp Inc.',
        subsidiaryEntity: input.intercompanyParams.subsidiaryEntity || 'Southeast Asia Local LLC',
        crossBorder: !!input.isCrossBorder,
        fxRate: input.intercompanyParams.fxRate || 1.0,
        transferPricingRef: `TP-OECD-${Date.now().toString().slice(-6)}`,
        taxJurisdiction: input.intercompanyParams.taxJurisdiction || 'US-KH Dual Tax Agreement'
      };
    }

    if (input.injectionType === 'NON_DILUTIVE_CAPITAL' && input.grantParams) {
      grantMilestones = input.grantParams.milestones.map((m, idx) => ({
        grantorAgency: input.grantParams?.grantorAgency || 'National Innovation Grant Foundation',
        milestoneIndex: idx + 1,
        title: m.title,
        trancheAmount: m.trancheAmount,
        isRestricted: true,
        isCompleted: idx === 0, // First milestone completed upon release
        dueDate: m.dueDate
      }));
    }

    if (input.injectionType === 'WORKING_CAPITAL_ADVANCE' && input.workingCapitalParams) {
      workingCapitalRisk = {
        factorRate: input.workingCapitalParams.factorRate || 1.15,
        holdbackPct: input.workingCapitalParams.holdbackPct || 15,
        maxApprovedLimit: input.amount * 1.5,
        collateralInvoices: input.workingCapitalParams.collateralInvoices || ['INV-9021', 'INV-9022'],
        riskScore: 740
      };
    }

    const record: FundInjectionRecord = {
      id: injectionId,
      idempotencyKey: input.idempotencyKey,
      organizationId: input.organizationId || 'ORG-PRIMARY',
      injectionType: input.injectionType,
      status,
      amount: input.amount,
      currency: input.currency,
      counterpartyName: input.counterpartyName,
      counterpartyTaxId: input.counterpartyTaxId,
      sourceAccount: input.sourceAccount,
      destinationAcc: input.destinationAcc,
      referenceNote: input.referenceNote,
      riskLevel: complianceResult.riskLevel,
      complianceResult,
      ledgerTransaction,
      equityDetail,
      debtSchedule,
      intercompanyDetail,
      grantMilestones,
      workingCapitalRisk,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save record
    processedKeys.set(input.idempotencyKey, record);
    injectionDatabase.unshift(record);

    return record;
  }

  /**
   * Retrieves all injections
   */
  public static getInjections(): FundInjectionRecord[] {
    return injectionDatabase;
  }

  /**
   * Clears AML hold on an injection (Compliance Officer override)
   */
  public static approveComplianceHold(id: string, officerNotes: string): FundInjectionRecord | null {
    const item = injectionDatabase.find(i => i.id === id);
    if (!item) return null;

    item.status = 'COMPLETED';
    item.complianceResult.reasons.push(`Compliance Officer Approval: ${officerNotes}`);
    item.updatedAt = new Date().toISOString();
    return item;
  }
}
