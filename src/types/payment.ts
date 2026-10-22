export type SupportedBank = 'cbe' | 'awash' | 'ebirr';

export type VerificationStatus =
  | 'VERIFIED'
  | 'SUSPICIOUS_DOMAIN'
  | 'AMOUNT_MISMATCH'
  | 'DUPLICATE_CLAIM'
  | 'INVALID_FORMAT'
  | 'NOT_FOUND'
  | 'INVALID_LINK';

export interface SecurityCheckDetails {
  domainAuthentic: boolean;
  sslVerified: boolean;
  duplicateDetected: boolean;
  amountMatched: boolean;
  tamperRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
}

export interface VerificationRequest {
  bank?: SupportedBank | 'auto';
  receiptUrl: string;
  expectedAmountEtb?: number;
  merchantAccount?: string;
  orderReference?: string;
}

export interface VerificationResult {
  id?: string;
  verificationId: string;
  status: VerificationStatus;
  bank: SupportedBank;
  bankName: string;
  transactionReference: string;
  amount: number;
  currency: 'ETB';
  riskScore?: number;
  payer: {
    name: string;
    phoneMasked: string;
    accountMasked?: string;
  };
  recipient: {
    name: string;
    accountOrTill: string;
  };
  timestamp: string;
  verifiedAt: string;
  rawLinkDomain: string;
  securityChecks: SecurityCheckDetails;
  feeEtb?: number;
  paymentMethod: string;
  receiptUrl: string;
  // Unified scraper fields
  success?: boolean;
  bankDetected?: string;
  extracted?: {
    transactionId: string | null;
    amount: string | null;
    currency: string | null;
    status: string | null;
    senderName: string | null;
    senderAccountOrPhone: string | null;
    receiverName: string | null;
    receiverAccountOrTill: string | null;
    date: string | null;
    paymentMethod: string | null;
    fee: string | null;
  };
  verifiedFields?: Array<{ key: string; value: string }>;
  pageTitle?: string;
  rawTextPreview?: string;
  responseTimeMs?: number;
  httpStatus?: number;
  error?: string;
}

export interface AuditRecord extends VerificationResult {
  clientIp?: string;
  source: 'WEB_PORTAL' | 'API_GATEWAY' | 'PLAYGROUND';
  notes?: string;
}

export interface BankConfigInfo {
  id: SupportedBank;
  name: string;
  shortName: string;
  officialDomains: string[];
  urlPatternExample: string;
  primaryColor: string;
  description: string;
  refPrefix: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  maskedKey: string;
  createdAt: string;
  lastUsedAt?: string;
  isRevealed: boolean;
  role: 'live' | 'test';
}

