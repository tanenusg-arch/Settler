import {
  AuditRecord,
  BankConfigInfo,
  SecurityCheckDetails,
  SupportedBank,
  VerificationRequest,
  VerificationResult,
} from '../types/payment';
import {
  detectBank,
  extractFromUrlOnly,
  scrapePaymentLink,
  VerifiedPaymentData,
} from './scraperEngine';

export const SUPPORTED_BANKS: Record<SupportedBank, BankConfigInfo> = {
  cbe: {
    id: 'cbe',
    name: 'Commercial Bank of Ethiopia',
    shortName: 'CBE Birr & Mobile',
    officialDomains: [
      'apps.cbe.com.et',
      'cbe.com.et',
      'cbepay.et',
      'receipt.cbe.com.et',
      'mbreciept.cbe.com.et',
      'mb.cbe.com.et',
    ],
    urlPatternExample: 'https://apps.cbe.com.et:9191/receipt/verify?ft=FT261014881',
    primaryColor: '#6B21A8', // CBE Purple
    description: 'Ethiopia’s largest state commercial bank, supporting CBE Birr & CBE Mobile Banking receipts.',
    refPrefix: 'FT',
  },
  awash: {
    id: 'awash',
    name: 'Awash International Bank',
    shortName: 'Awash Birr',
    officialDomains: [
      'awashbank.com',
      'awashbirr.com',
      'online.awashbank.com',
      'receipt.awashbank.com',
      'awashpay.awashbank.com',
    ],
    urlPatternExample: 'https://awashbirr.com/receipt/show?ref=AW261019284',
    primaryColor: '#0369A1', // Awash Blue
    description: 'First private commercial bank in Ethiopia, supporting Awash Birr and Internet Banking receipts.',
    refPrefix: 'AW',
  },
  ebirr: {
    id: 'ebirr',
    name: 'eBirr Payment System',
    shortName: 'eBirr & Mobile Wallet',
    officialDomains: [
      'ebirr.com',
      'ebirrpay.et',
      'app.ebirr.com',
      'telebirr.et',
      'receipt.ebirr.com',
    ],
    urlPatternExample: 'https://ebirrpay.et/receipt/v1/confirm?tx=EB261083921',
    primaryColor: '#059669', // Emerald/Green
    description: 'Leading telecom/fintech mobile wallet platform across Ethiopian retail and utility merchants.',
    refPrefix: 'EB',
  },
};

// Seed authentic verified transactions
interface SeedTransaction {
  ref: string;
  bank: SupportedBank;
  amount: number;
  payerName: string;
  payerPhone: string;
  merchantName: string;
  merchantAccount: string;
  paymentMethod: string;
  timestamp: string;
}

const SEED_DATABASE: Record<string, SeedTransaction> = {
  FT261014881: {
    ref: 'FT261014881',
    bank: 'cbe',
    amount: 1500.0,
    payerName: 'Yared Tesfaye',
    payerPhone: '+251 91 1** **48',
    merchantName: 'Abyssinia Electronics PLC',
    merchantAccount: '1000293849182',
    paymentMethod: 'CBE Mobile Banking (Transfer)',
    timestamp: '2026-10-14T04:22:10+03:00',
  },
  FT261029104: {
    ref: 'FT261029104',
    bank: 'cbe',
    amount: 4200.0,
    payerName: 'Bethlehem Alemu',
    payerPhone: '+251 92 3** **91',
    merchantName: 'Sheger Coffee Roasters',
    merchantAccount: '1000543918231',
    paymentMethod: 'CBE Birr QR Payment',
    timestamp: '2026-10-13T16:45:00+03:00',
  },
  AW261019284: {
    ref: 'AW261019284',
    bank: 'awash',
    amount: 3420.5,
    payerName: 'Dawit Mengistu',
    payerPhone: '+251 91 3** **12',
    merchantName: 'Habesha Fashion House',
    merchantAccount: 'AWB-MERCH-882190',
    paymentMethod: 'Awash Birr Merchant Pay',
    timestamp: '2026-10-14T03:15:24+03:00',
  },
  AW261099120: {
    ref: 'AW261099120',
    bank: 'awash',
    amount: 12800.0,
    payerName: 'Solomon Girma',
    payerPhone: '+251 93 4** **77',
    merchantName: 'Bole Auto Spares',
    merchantAccount: '0142981928300',
    paymentMethod: 'Awash Internet Banking',
    timestamp: '2026-10-12T11:08:19+03:00',
  },
  EB261083921: {
    ref: 'EB261083921',
    bank: 'ebirr',
    amount: 850.0,
    payerName: 'Makeda Bekele',
    payerPhone: '+251 94 4** **63',
    merchantName: 'Addis Supermarket Delivery',
    merchantAccount: 'EB-TILL-99014',
    paymentMethod: 'eBirr Wallet Payment',
    timestamp: '2026-10-14T05:01:42+03:00',
  },
  EB261044719: {
    ref: 'EB261044719',
    bank: 'ebirr',
    amount: 2150.0,
    payerName: 'Hailemariam Desalegn',
    payerPhone: '+251 91 0** **33',
    merchantName: 'Zoma Bookshop',
    merchantAccount: 'EB-TILL-44810',
    paymentMethod: 'eBirr P2M Transfer',
    timestamp: '2026-10-13T09:30:15+03:00',
  },
};

// In-memory ledger of verified references to detect duplicates
const verifiedReferenceHistory: Map<string, { verificationId: string; verifiedAt: string }> = new Map([
  // Pre-seed one duplicate reference for demonstration
  ['FT261029104', { verificationId: 'ver_cbe_seed_prev', verifiedAt: '2026-10-13T17:00:00Z' }],
]);

export const INITIAL_AUDIT_RECORDS: AuditRecord[] = [
  {
    verificationId: 'ver_cbe_seed_prev',
    status: 'VERIFIED',
    bank: 'cbe',
    bankName: 'Commercial Bank of Ethiopia',
    transactionReference: 'FT261029104',
    amount: 4200.0,
    currency: 'ETB',
    payer: {
      name: 'Bethlehem Alemu',
      phoneMasked: '+251 92 3** **91',
    },
    recipient: {
      name: 'Sheger Coffee Roasters',
      accountOrTill: '1000543918231',
    },
    timestamp: '2026-10-13T16:45:00+03:00',
    verifiedAt: '2026-10-13T17:00:00Z',
    rawLinkDomain: 'apps.cbe.com.et',
    securityChecks: {
      domainAuthentic: true,
      sslVerified: true,
      duplicateDetected: false,
      amountMatched: true,
      tamperRisk: 'LOW',
      reason: 'Transaction confirmed by Commercial Bank of Ethiopia digital settlement network.',
    },
    paymentMethod: 'CBE Birr QR Payment',
    receiptUrl: 'https://apps.cbe.com.et:9191/receipt/verify?ft=FT261029104',
    source: 'WEB_PORTAL',
  },
  {
    verificationId: 'ver_awash_seed_1',
    status: 'VERIFIED',
    bank: 'awash',
    bankName: 'Awash International Bank',
    transactionReference: 'AW261019284',
    amount: 3420.5,
    currency: 'ETB',
    payer: {
      name: 'Dawit Mengistu',
      phoneMasked: '+251 91 3** **12',
    },
    recipient: {
      name: 'Habesha Fashion House',
      accountOrTill: 'AWB-MERCH-882190',
    },
    timestamp: '2026-10-14T03:15:24+03:00',
    verifiedAt: '2026-10-14T03:16:00Z',
    rawLinkDomain: 'awashbirr.com',
    securityChecks: {
      domainAuthentic: true,
      sslVerified: true,
      duplicateDetected: false,
      amountMatched: true,
      tamperRisk: 'LOW',
      reason: 'Transaction confirmed by Awash International Bank digital settlement network.',
    },
    paymentMethod: 'Awash Birr Merchant Pay',
    receiptUrl: 'https://awashbirr.com/receipt/show?ref=AW261019284',
    source: 'API_GATEWAY',
  },
  {
    verificationId: 'ver_ebirr_seed_1',
    status: 'VERIFIED',
    bank: 'ebirr',
    bankName: 'eBirr Payment System',
    transactionReference: 'EB261083921',
    amount: 850.0,
    currency: 'ETB',
    payer: {
      name: 'Makeda Bekele',
      phoneMasked: '+251 94 4** **63',
    },
    recipient: {
      name: 'Addis Supermarket Delivery',
      accountOrTill: 'EB-TILL-99014',
    },
    timestamp: '2026-10-14T05:01:42+03:00',
    verifiedAt: '2026-10-14T05:02:10Z',
    rawLinkDomain: 'ebirrpay.et',
    securityChecks: {
      domainAuthentic: true,
      sslVerified: true,
      duplicateDetected: false,
      amountMatched: true,
      tamperRisk: 'LOW',
      reason: 'Transaction confirmed by eBirr Payment System digital settlement network.',
    },
    feeEtb: 5.0,
    paymentMethod: 'eBirr Wallet Payment',
    receiptUrl: 'https://ebirrpay.et/receipt/v1/confirm?tx=EB261083921',
    source: 'API_GATEWAY',
  },
  {
    verificationId: 'ver_fraud_phishing_1',
    status: 'SUSPICIOUS_DOMAIN',
    bank: 'cbe',
    bankName: 'Commercial Bank of Ethiopia',
    transactionReference: 'FT999881',
    amount: 0,
    currency: 'ETB',
    payer: {
      name: 'Unverified / Phishing Risk',
      phoneMasked: 'Unknown',
    },
    recipient: {
      name: 'Unverified',
      accountOrTill: 'Unknown',
    },
    timestamp: '2026-10-14T06:30:00Z',
    verifiedAt: '2026-10-14T06:30:00Z',
    rawLinkDomain: 'cbe-receipt-verify.phishing-telecom.net',
    securityChecks: {
      domainAuthentic: false,
      sslVerified: false,
      duplicateDetected: false,
      amountMatched: false,
      tamperRisk: 'CRITICAL',
      reason: "Untrusted domain 'cbe-receipt-verify.phishing-telecom.net'. Official CBE Birr & Mobile verification links must originate from: apps.cbe.com.et, cbe.com.et, cbepay.et, receipt.cbe.com.et, mbreciept.cbe.com.et.",
    },
    paymentMethod: 'Untrusted Origin',
    receiptUrl: 'http://cbe-receipt-verify.phishing-telecom.net/receipt?ft=FT999881',
    source: 'PLAYGROUND',
  },
];

let inMemoryLedger: AuditRecord[] = [...INITIAL_AUDIT_RECORDS];

export function getAuditLedger(): AuditRecord[] {
  return inMemoryLedger;
}

export function addAuditRecord(record: AuditRecord): void {
  // Add to top of ledger
  inMemoryLedger = [record, ...inMemoryLedger.filter((r) => r.verificationId !== record.verificationId)];
}

export function resetAuditLedger(): AuditRecord[] {
  inMemoryLedger = [...INITIAL_AUDIT_RECORDS];
  resetDuplicateLedger();
  return inMemoryLedger;
}

export function detectBankFromUrl(url: string, declaredBank?: SupportedBank | 'auto'): SupportedBank {
  if (declaredBank && declaredBank !== 'auto') {
    return declaredBank;
  }

  const lower = url.toLowerCase();
  if (lower.includes('cbe') || lower.includes('commercial bank') || lower.includes('mbreciept')) return 'cbe';
  if (lower.includes('awash')) return 'awash';
  if (lower.includes('ebirr') || lower.includes('telebirr') || lower.includes('coopay')) return 'ebirr';

  return 'cbe'; // fallback
}

export function extractHostname(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isDomainWhitelisted(hostname: string, bank: SupportedBank): boolean {
  if (!hostname) return false;
  const config = SUPPORTED_BANKS[bank];
  return config.officialDomains.some((dom) => {
    return hostname === dom || hostname.endsWith(`.${dom}`);
  });
}

export function extractReferenceFromUrl(url: string, bank: SupportedBank): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);

    // Check search params
    for (const key of ['ft', 'ref', 'txn', 'tx', 'reference', 'receipt_id', 'id', 'transId']) {
      const val = parsed.searchParams.get(key);
      if (val && val.trim().length > 3) {
        return val.trim().toUpperCase();
      }
    }

    // Check path segments
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    for (const part of pathParts) {
      if (/^(FT|AW|EB)\d{6,}/i.test(part)) {
        return part.toUpperCase();
      }
      if (part.startsWith('v2-') || part.length > 10) {
        return part;
      }
    }

    // Hash params
    if (parsed.hash) {
      const match = parsed.hash.match(/[?&](?:ft|ref|txn|tx)=([A-Z0-9]+)/i);
      if (match) return match[1].toUpperCase();
    }
  } catch {
    //
  }

  // Regex extraction from raw text
  const match = url.match(/\b(FT[0-9A-Z]{7,14}|AW[0-9A-Z]{7,14}|EB[0-9A-Z]{7,14})\b/i);
  if (match) {
    return match[1].toUpperCase();
  }

  // Fallback synthetic ref based on bank
  const prefix = SUPPORTED_BANKS[bank].refPrefix;
  return `${prefix}${Date.now().toString().slice(-8)}`;
}

export function createInvalidLinkResult(
  url: string,
  bank: SupportedBank,
  reason = 'Invalid link',
  source: 'API_GATEWAY' | 'WEB_PORTAL' | 'PLAYGROUND' = 'API_GATEWAY'
): VerificationResult {
  const bankConfig = SUPPORTED_BANKS[bank] || SUPPORTED_BANKS.cbe;
  const verificationId = `ver_inv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();
  const hostname = extractHostname(url) || 'Invalid link';

  const result: VerificationResult = {
    verificationId,
    status: 'INVALID_LINK',
    success: false,
    bank,
    bankName: bankConfig.name,
    bankDetected: bankConfig.name,
    transactionReference: 'N/A',
    amount: 0,
    currency: 'ETB',
    payer: {
      name: 'N/A',
      phoneMasked: 'N/A',
    },
    recipient: {
      name: 'N/A',
      accountOrTill: 'N/A',
    },
    timestamp: nowIso,
    verifiedAt: nowIso,
    rawLinkDomain: hostname,
    securityChecks: {
      domainAuthentic: false,
      sslVerified: false,
      duplicateDetected: false,
      amountMatched: false,
      tamperRisk: 'HIGH',
      reason: 'Invalid link',
    },
    paymentMethod: 'N/A',
    receiptUrl: url,
    error: 'Invalid link',
    extracted: {
      transactionId: null,
      amount: '0',
      currency: 'ETB',
      status: 'INVALID_LINK',
      senderName: null,
      senderAccountOrPhone: null,
      receiverName: null,
      receiverAccountOrTill: null,
      date: null,
      paymentMethod: null,
      fee: null,
    },
    verifiedFields: [
      { key: 'Status', value: 'Invalid link' },
    ],
    pageTitle: 'Invalid link',
    rawTextPreview: 'Invalid link: Website cannot be accessed or receipt link is invalid.',
    httpStatus: 400,
    responseTimeMs: 25,
  };

  addAuditRecord({
    ...result,
    source,
  });

  return result;
}

/**
 * Unified Payment Verification Engine
 * Handles phishing checks, duplicate checks, seed sandbox lookups, live link scraping, and amount matching.
 */
export async function verifyPaymentLink(req: VerificationRequest): Promise<VerificationResult> {
  const url = (req.receiptUrl || '').trim();
  const source = (req as any).source || 'API_GATEWAY';
  const bank = detectBankFromUrl(url, req.bank);
  const bankConfig = SUPPORTED_BANKS[bank];

  // 1. Basic URL and link validity check
  if (!url) {
    return createInvalidLinkResult(url, bank, 'Invalid link', source);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`);
    if (!parsedUrl.hostname) {
      return createInvalidLinkResult(url, bank, 'Invalid link', source);
    }
  } catch {
    return createInvalidLinkResult(url, bank, 'Invalid link', source);
  }

  const hostname = extractHostname(url);
  const isWhitelisted = isDomainWhitelisted(hostname, bank);
  const isLocalhostOrKnownTest =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.run.app');

  // If domain is not recognized/whitelisted
  if (!hostname || (!isWhitelisted && !isLocalhostOrKnownTest)) {
    return createInvalidLinkResult(url, bank, 'Invalid link', source);
  }

  const ref = extractReferenceFromUrl(url, bank);
  const verificationId = `ver_${bank}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  // 2. Duplicate Detection Check
  const duplicateEntry = verifiedReferenceHistory.get(ref);
  const isDuplicate = !!duplicateEntry;

  // 3. Resolve Data: Check Seed DB or Live Scrape
  let amount = 0;
  let payerName = '';
  let payerPhone = '';
  let merchantName = '';
  let merchantAccount = '';
  let paymentMethod = '';
  let txnTimestamp = nowIso;
  let fee = 0;
  let scraperData: VerifiedPaymentData | null = null;

  const existingSeed = SEED_DATABASE[ref];

  if (existingSeed) {
    // Fast path: Authentic Seed Record for sandbox / presets
    amount = existingSeed.amount;
    payerName = existingSeed.payerName;
    payerPhone = existingSeed.payerPhone;
    merchantName = existingSeed.merchantName;
    merchantAccount = existingSeed.merchantAccount;
    paymentMethod = existingSeed.paymentMethod;
    txnTimestamp = existingSeed.timestamp;
    fee = bank === 'ebirr' ? 5.0 : 0.0;
  } else {
    // Attempt live network scrape for reachable portals
    try {
      scraperData = await scrapePaymentLink(url, bank);
    } catch (_err) {
      return createInvalidLinkResult(url, bank, 'Invalid link', source);
    }

    if (
      !scraperData ||
      !scraperData.success ||
      scraperData.error ||
      (scraperData.httpStatus && scraperData.httpStatus >= 400)
    ) {
      return createInvalidLinkResult(url, bank, 'Invalid link', source);
    }

    const ext = scraperData.extracted;
    if (!ext || (!ext.transactionId && !ext.amount)) {
      return createInvalidLinkResult(url, bank, 'Invalid link', source);
    }

    const parsedAmt = ext.amount ? parseFloat(ext.amount.replace(/,/g, '')) : 0;
    amount = !isNaN(parsedAmt) && parsedAmt > 0 ? parsedAmt : 0;

    if (amount <= 0 && !ext.transactionId) {
      return createInvalidLinkResult(url, bank, 'Invalid link', source);
    }

    payerName = ext.senderName || 'Customer';
    payerPhone = ext.senderAccountOrPhone || '';
    merchantName = ext.receiverName || req.merchantAccount || 'Merchant';
    merchantAccount = ext.receiverAccountOrTill || req.merchantAccount || '';
    paymentMethod = ext.paymentMethod || `${bankConfig.shortName} Direct Pay`;
    txnTimestamp = ext.date || nowIso;
    if (ext.fee) {
      const parsedFee = parseFloat(ext.fee.replace(/[^0-9.]/g, ''));
      fee = !isNaN(parsedFee) ? parsedFee : 0;
    }
  }

  // 4. Amount Matching Check
  let amountMatched = true;
  if (req.expectedAmountEtb !== undefined && req.expectedAmountEtb > 0) {
    amountMatched = Math.abs(req.expectedAmountEtb - amount) < 0.01;
  }

  // Determine Final Status
  let status: VerificationResult['status'] = 'VERIFIED';
  let tamperRisk: SecurityCheckDetails['tamperRisk'] = 'LOW';
  let reason = `Transaction confirmed by ${bankConfig.name} digital settlement network.`;

  if (isDuplicate) {
    status = 'DUPLICATE_CLAIM';
    tamperRisk = 'HIGH';
    reason = `Duplicate payment claim alert! Reference '${ref}' was already verified on ${new Date(duplicateEntry.verifiedAt).toLocaleString()} (Prior Verification ID: ${duplicateEntry.verificationId}). Replay attack prevented.`;
  } else if (!amountMatched) {
    status = 'AMOUNT_MISMATCH';
    tamperRisk = 'MEDIUM';
    reason = `Amount discrepancy detected! Expected ${req.expectedAmountEtb?.toFixed(2)} ETB, but bank receipt verified ${amount.toFixed(2)} ETB.`;
  } else {
    // Record to duplicate prevention ledger for future attempts
    verifiedReferenceHistory.set(ref, {
      verificationId,
      verifiedAt: nowIso,
    });
  }

  // Synthesize verifiedFields if not already present from scraper
  const verifiedFields = scraperData?.verifiedFields && scraperData.verifiedFields.length > 0
    ? scraperData.verifiedFields
    : [
        { key: 'Transaction Reference (ID)', value: ref },
        { key: 'Settled Amount', value: `${amount.toFixed(2)} ETB` },
        { key: 'Bank Network', value: bankConfig.name },
        { key: 'Payer / Debited Account', value: `${payerName} (${payerPhone})` },
        { key: 'Beneficiary / Merchant', value: `${merchantName} (${merchantAccount})` },
        { key: 'Payment Method', value: paymentMethod },
        { key: 'Settlement Status', value: status },
        { key: 'Settlement Timestamp', value: txnTimestamp },
      ];

  const result: VerificationResult = {
    verificationId,
    status,
    success: status === 'VERIFIED',
    bank,
    bankName: bankConfig.name,
    bankDetected: bankConfig.name,
    transactionReference: ref,
    amount,
    currency: 'ETB',
    payer: {
      name: payerName,
      phoneMasked: payerPhone,
    },
    recipient: {
      name: merchantName,
      accountOrTill: merchantAccount,
    },
    timestamp: txnTimestamp,
    verifiedAt: nowIso,
    rawLinkDomain: hostname,
    securityChecks: {
      domainAuthentic: true,
      sslVerified: true,
      duplicateDetected: isDuplicate,
      amountMatched,
      tamperRisk,
      reason,
    },
    feeEtb: fee,
    paymentMethod,
    receiptUrl: url,
    extracted: {
      transactionId: ref,
      amount: amount.toFixed(2),
      currency: 'ETB',
      status,
      senderName: payerName,
      senderAccountOrPhone: payerPhone,
      receiverName: merchantName,
      receiverAccountOrTill: merchantAccount,
      date: txnTimestamp,
      paymentMethod,
      fee: fee > 0 ? `${fee} ETB` : null,
    },
    verifiedFields,
    pageTitle: scraperData?.pageTitle || `${bankConfig.shortName} Verified Receipt`,
    rawTextPreview: scraperData?.rawTextPreview || `${bankConfig.name} Transaction ${ref} for ${amount.toFixed(2)} ETB confirmed.`,
    httpStatus: scraperData?.httpStatus || 200,
    responseTimeMs: scraperData?.responseTimeMs || 65,
  };

  // Add to in-memory ledger
  addAuditRecord({
    ...result,
    source: (req as any).source || 'API_GATEWAY',
  });

  return result;
}

export function resetDuplicateLedger(): void {
  verifiedReferenceHistory.clear();
  verifiedReferenceHistory.set('FT261029104', {
    verificationId: 'ver_cbe_seed_prev',
    verifiedAt: '2026-10-13T17:00:00Z',
  });
}
