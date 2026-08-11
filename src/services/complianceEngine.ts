/**
 * Anti-Money Laundering (AML), Know-Your-Customer (KYC), and Tax Categorization Engine
 * Security-first compliance layer for all 6 Fund Injection modalities.
 */

export interface ComplianceCheckResult {
  passed: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  amlFlagged: boolean;
  kycVerified: boolean;
  requiresOfficerReview: boolean;
  reasons: string[];
  taxCategory: string;
  sarTriggered: boolean; // FinCEN Suspicious Activity Report
}

export interface InjectionCompliancePayload {
  injectionType: 'EQUITY_FUNDING' | 'PERSONAL_INJECTION' | 'DEBT_FINANCING' | 'INTERCOMPANY_TRANSFER' | 'NON_DILUTIVE_CAPITAL' | 'WORKING_CAPITAL_ADVANCE';
  amount: number;
  currency: string;
  counterpartyName: string;
  counterpartyTaxId?: string;
  isCrossBorder?: boolean;
  originCountry?: string;
  sourceAccount: string;
}

const AML_THRESHOLD_USD = 10000;
const HIGH_RISK_COUNTRIES = ['IRN', 'PRK', 'SYR', 'RUS', 'CUB', 'MMR'];

export class ComplianceEngine {
  /**
   * Evaluates AML, KYC status, sanctions, and tax hooks for a fund injection
   */
  public static evaluateInjection(payload: InjectionCompliancePayload): ComplianceCheckResult {
    const reasons: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let amlFlagged = false;
    let kycVerified = true;
    let sarTriggered = false;
    let requiresOfficerReview = false;

    // Normalize amount to USD equivalent if needed
    const amountUSD = payload.currency === 'KHR' ? payload.amount / 4000 : payload.amount;

    // 1. AML Threshold Check (FinCEN CTR / SAR threshold $10,000 USD)
    if (amountUSD >= AML_THRESHOLD_USD) {
      amlFlagged = true;
      reasons.push(`Amount ($${amountUSD.toLocaleString()} USD) exceeds the $10,000 AML CTR threshold.`);
      if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
    }

    // 2. High-Risk Country / Cross-Border Check
    if (payload.isCrossBorder && payload.originCountry && HIGH_RISK_COUNTRIES.includes(payload.originCountry.toUpperCase())) {
      amlFlagged = true;
      sarTriggered = true;
      requiresOfficerReview = true;
      riskLevel = 'CRITICAL';
      reasons.push(`Origin jurisdiction (${payload.originCountry}) is on the FATF High-Risk List.`);
    }

    // 3. KYC Verification Trigger for External Equity and Debt
    if (!payload.counterpartyTaxId && (payload.injectionType === 'EQUITY_FUNDING' || payload.injectionType === 'DEBT_FINANCING')) {
      kycVerified = false;
      requiresOfficerReview = true;
      if (riskLevel !== 'CRITICAL') riskLevel = 'HIGH';
      reasons.push('Counterparty Tax ID / Beneficial Owner verification missing for capital injection.');
    }

    // 4. Specific Injection Type Rules & Tax Categorization
    let taxCategory = '';

    switch (payload.injectionType) {
      case 'EQUITY_FUNDING':
        taxCategory = 'NON_TAXABLE_CAPITAL_CONTRIBUTION_SEC_1032';
        if (amountUSD > 500000 && !payload.counterpartyTaxId) {
          requiresOfficerReview = true;
          reasons.push('Large equity round requires accredited investor status verification.');
        }
        break;

      case 'PERSONAL_INJECTION':
        taxCategory = 'OWNERS_EQUITY_CONTRIBUTION';
        if (amountUSD > 50000) {
          reasons.push('Verify separation of personal funds from business revenue to prevent commingling.');
        }
        break;

      case 'DEBT_FINANCING':
        taxCategory = 'LIABILITY_PRINCIPAL_NON_TAXABLE';
        break;

      case 'INTERCOMPANY_TRANSFER':
        taxCategory = 'INTERCOMPANY_TRANSFER_PRICING_OECD_SEC_482';
        if (!payload.isCrossBorder && payload.sourceAccount === 'PARENT_ENTITY') {
          reasons.push('Transfer pricing documentation required for intercompany ledger balance.');
        } else if (payload.isCrossBorder) {
          requiresOfficerReview = true;
          reasons.push('Cross-border intercompany transfer subject to withholding tax evaluation.');
        }
        break;

      case 'NON_DILUTIVE_CAPITAL':
        taxCategory = 'RESTRICTED_GRANT_INCOME_TAXABLE_UPON_MILESTONE';
        reasons.push('Grant funds locked to milestone performance ledger.');
        break;

      case 'WORKING_CAPITAL_ADVANCE':
        taxCategory = 'FACTORING_ADVANCE_LIABILITY';
        if (amountUSD > 250000) {
          riskLevel = 'HIGH';
          reasons.push('MCA / Factoring advance exceeds portfolio concentration risk threshold.');
        }
        break;
    }

    // Lock transaction if critical risk
    const passed = riskLevel !== 'CRITICAL' && kycVerified;

    return {
      passed,
      riskLevel,
      amlFlagged,
      kycVerified,
      requiresOfficerReview,
      reasons,
      taxCategory,
      sarTriggered
    };
  }
}
