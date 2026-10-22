import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  Lock,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { SupportedBank, VerificationRequest, VerificationResult } from '../types/payment';

interface InstantVerifierProps {
  onVerify: (req: VerificationRequest) => Promise<VerificationResult>;
  onOpenWebhookModal: (result: VerificationResult) => void;
  onNavigateToLedger: () => void;
}

export const InstantVerifier: React.FC<InstantVerifierProps> = ({
  onVerify,
  onOpenWebhookModal,
  onNavigateToLedger,
}) => {
  const [selectedBank, setSelectedBank] = useState<SupportedBank | 'auto'>('auto');
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [expectedAmount, setExpectedAmount] = useState<string>('');
  const [merchantAccount, setMerchantAccount] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<'extracted' | 'raw' | 'security' | 'json'>('extracted');
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [copiedFieldKey, setCopiedFieldKey] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = receiptUrl.trim();
    if (!cleanUrl) return;

    setIsLoading(true);
    setResult(null);
    setErrorMessage(null);

    try {
      const parsedAmount = expectedAmount ? parseFloat(expectedAmount) : undefined;
      const res = await onVerify({
        bank: selectedBank,
        receiptUrl: cleanUrl,
        expectedAmountEtb: !isNaN(parsedAmount as number) ? parsedAmount : undefined,
        merchantAccount: merchantAccount.trim() || undefined,
      });
      setResult(res);
    } catch (err: any) {
      console.error('Verification error:', err);
      setErrorMessage(err.message || 'Unable to verify receipt. Please verify URL and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, isJson = false) => {
    navigator.clipboard.writeText(text);
    if (isJson) {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } else {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const copyFieldValue = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedFieldKey(key);
    setTimeout(() => setCopiedFieldKey(null), 1500);
  };

  // Compile full set of all extracted fields from verifiedFields and extracted
  const allExtractedList: Array<{ key: string; value: string }> = [];

  if (result) {
    if (result.verifiedFields && result.verifiedFields.length > 0) {
      result.verifiedFields.forEach((f) => {
        allExtractedList.push(f);
      });
    }

    // Add extra normalized attributes if not already in list
    if (result.payer?.name && !allExtractedList.some((x) => x.key.toLowerCase().includes('payer') || x.key.toLowerCase().includes('customer'))) {
      allExtractedList.unshift({ key: 'Customer / Payer Name', value: result.payer.name });
    }
    if (result.payer?.phoneMasked && !allExtractedList.some((x) => x.key.toLowerCase().includes('phone'))) {
      allExtractedList.push({ key: 'Payer Phone Number', value: result.payer.phoneMasked });
    }
    if (result.recipient?.name && !allExtractedList.some((x) => x.key.toLowerCase().includes('company') || x.key.toLowerCase().includes('merchant') || x.key.toLowerCase().includes('beneficiary'))) {
      allExtractedList.push({ key: 'Merchant / Beneficiary Name', value: result.recipient.name });
    }
    if (result.recipient?.accountOrTill && !allExtractedList.some((x) => x.key.toLowerCase().includes('account no') || x.key.toLowerCase().includes('till'))) {
      allExtractedList.push({ key: 'Merchant Account / Till', value: result.recipient.accountOrTill });
    }
    if (result.feeEtb !== undefined && result.feeEtb > 0 && !allExtractedList.some((x) => x.key.toLowerCase().includes('fee') || x.key.toLowerCase().includes('charge'))) {
      allExtractedList.push({ key: 'Transaction Fee', value: `${result.feeEtb.toFixed(2)} ETB` });
    }
    if (result.rawLinkDomain && !allExtractedList.some((x) => x.key.toLowerCase().includes('domain'))) {
      allExtractedList.push({ key: 'Verified Domain Host', value: result.rawLinkDomain });
    }
    if (result.responseTimeMs) {
      allExtractedList.push({ key: 'Verification Latency', value: `${result.responseTimeMs} ms` });
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Hero Header */}
      <div className="border-b border-neutral-800 pb-5 pt-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl font-sans">
              Payment Verification
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-neutral-400">
              Paste customer payment receipt link to extract and verify official settlement records.
            </p>
          </div>
          <div className="text-xs text-neutral-500 font-mono">
            POST /api/verify
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: URL and Parameters */}
        <div className="lg:col-span-5 bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="border-b border-neutral-800 pb-3">
            <h2 className="text-sm font-semibold text-white">Inspect Receipt Link</h2>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Supports Commercial Bank of Ethiopia (CBE), Awash Bank, and eBirr
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Bank Segmented Buttons */}
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
                Bank Network
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-black rounded-lg border border-neutral-800 text-xs">
                {(['auto', 'cbe', 'awash', 'ebirr'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelectedBank(b)}
                    className={`py-1.5 px-2 rounded font-medium transition-all cursor-pointer uppercase text-[11px] ${
                      selectedBank === b
                        ? 'bg-neutral-800 text-white font-semibold'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Receipt URL */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="receiptUrl" className="text-xs text-neutral-400 font-medium">
                  Receipt URL <span className="text-white">*</span>
                </label>
                {receiptUrl && (
                  <button
                    type="button"
                    onClick={() => setReceiptUrl('')}
                    className="text-[10px] text-neutral-500 hover:text-white cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <textarea
                id="receiptUrl"
                rows={3}
                required
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                placeholder="https://apps.cbe.com.et:9191/receipt/verify?ft=FT... or https://awashpay.awashbank.com:8225/..."
                className="w-full rounded-lg bg-black border border-neutral-800 px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono resize-y"
              />
            </div>

            {/* Optional parameters */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="expectedAmount" className="block text-xs text-neutral-400 mb-1 font-medium">
                  Expected ETB (Optional)
                </label>
                <input
                  id="expectedAmount"
                  type="number"
                  step="any"
                  value={expectedAmount}
                  onChange={(e) => setExpectedAmount(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full rounded-lg bg-black border border-neutral-800 px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
                />
              </div>
              <div>
                <label htmlFor="merchantAccount" className="block text-xs text-neutral-400 mb-1 font-medium">
                  Account / Till (Optional)
                </label>
                <input
                  id="merchantAccount"
                  type="text"
                  value={merchantAccount}
                  onChange={(e) => setMerchantAccount(e.target.value)}
                  placeholder="e.g. 100012345678"
                  className="w-full rounded-lg bg-black border border-neutral-800 px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !receiptUrl.trim()}
              className="w-full py-2.5 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Scanning & Extracting...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Verify Payment Receipt</span>
                </>
              )}
            </button>
          </form>

          {/* Whitelisted Rails summary */}
          <div className="border-t border-neutral-800 pt-3 text-[11px] text-neutral-500 font-mono space-y-1">
            <div className="flex justify-between">
              <span>CBE:</span>
              <span>apps.cbe.com.et, cbe.com.et</span>
            </div>
            <div className="flex justify-between">
              <span>Awash:</span>
              <span>awashbank.com, awashbirr.com</span>
            </div>
            <div className="flex justify-between">
              <span>eBirr:</span>
              <span>receipt.ebirr.com, ebirr.com</span>
            </div>
          </div>
        </div>

        {/* Right Result Display */}
        <div className="lg:col-span-7">
          {errorMessage && !isLoading && !result && (
            <div className="border border-neutral-700 rounded-xl p-6 bg-neutral-950 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-white shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Invalid Link</h3>
                  <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
                    {errorMessage.toLowerCase().includes('invalid link') ||
                    errorMessage.toLowerCase().includes('connect') ||
                    errorMessage.toLowerCase().includes('failed') ||
                    errorMessage.toLowerCase().includes('http') ||
                    errorMessage.toLowerCase().includes('network')
                      ? 'Invalid link'
                      : errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!result && !isLoading && !errorMessage && (
            <div className="border border-dashed border-neutral-800 rounded-xl p-10 text-center flex flex-col items-center justify-center min-h-[420px] bg-neutral-950">
              <Search className="h-8 w-8 text-neutral-600 mb-3" />
              <h3 className="text-sm font-semibold text-white">No Receipt Verified Yet</h3>
              <p className="mt-1 text-xs text-neutral-400 max-w-xs">
                Enter a payment receipt link on the left and click &quot;Verify Payment Receipt&quot; to inspect all extracted fields.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="border border-neutral-800 rounded-xl p-10 text-center flex flex-col items-center justify-center min-h-[420px] bg-neutral-950">
              <RefreshCw className="h-6 w-6 text-white animate-spin mb-3" />
              <h3 className="text-sm font-semibold text-white">Scanning Payment Receipt...</h3>
              <p className="mt-1 text-xs text-neutral-400 max-w-xs">
                Extracting transaction metadata, validating cryptographic certificates, and checking anti-fraud ledger.
              </p>
            </div>
          )}

          {result && !isLoading && (
            <div className="border border-neutral-800 rounded-xl bg-neutral-950 p-6 space-y-5">
              {/* Status Header */}
              <div className="p-4 rounded-xl border border-neutral-700 bg-black flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {result.status === 'VERIFIED' ? (
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-neutral-400" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block">
                      {result.status === 'VERIFIED' && 'PAYMENT CONFIRMED'}
                      {result.status === 'INVALID_LINK' && 'INVALID LINK'}
                      {result.status === 'SUSPICIOUS_DOMAIN' && 'INVALID LINK'}
                      {result.status === 'DUPLICATE_CLAIM' && 'DUPLICATE CLAIM ALERT (REPLAY)'}
                      {result.status === 'AMOUNT_MISMATCH' && 'AMOUNT MISMATCH DETECTED'}
                      {result.status === 'NOT_FOUND' && 'INVALID LINK'}
                    </span>
                    <p className="mt-0.5 text-xs text-neutral-300">
                      {result.status === 'INVALID_LINK' ? 'Invalid link' : (result.securityChecks?.reason || 'Verified successfully')}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase block">Risk</span>
                  <span className="text-xs font-bold text-white uppercase">
                    {result.status === 'INVALID_LINK' ? 'HIGH' : (result.securityChecks?.tamperRisk || 'LOW')}
                  </span>
                </div>
              </div>

              {/* Financial Metrics Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-y border-neutral-800 py-4">
                <div>
                  <span className="text-xs text-neutral-500 block mb-0.5">Settled Amount</span>
                  <div className="text-2xl font-bold font-mono text-white tabular-nums flex items-baseline gap-1">
                    <span>
                      {result.amount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-xs font-normal text-neutral-400">ETB</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-neutral-500 block mb-0.5">Transaction ID / Ref</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold text-white tabular-nums truncate">
                      {result.transactionReference}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(result.transactionReference, false)}
                      className="text-neutral-500 hover:text-white cursor-pointer shrink-0"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    {copiedRef && <span className="text-[10px] text-white">Copied</span>}
                  </div>
                  <span className="text-[11px] text-neutral-500 block mt-0.5">{result.bankName}</span>
                </div>

                <div>
                  <span className="text-xs text-neutral-500 block mb-0.5">Settlement Timestamp</span>
                  <div className="text-xs font-mono text-white">
                    {result.timestamp}
                  </div>
                </div>
              </div>

              {/* Full Extracted Data Tabs */}
              <div>
                <div className="flex items-center justify-between border-b border-neutral-800 mb-3">
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveResultTab('extracted')}
                      className={`px-3 py-2 font-medium cursor-pointer transition-colors border-b-2 -mb-[1px] flex items-center gap-1.5 ${
                        activeResultTab === 'extracted'
                          ? 'border-white text-white font-semibold'
                          : 'border-transparent text-neutral-400 hover:text-white'
                      }`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>Full Extracted Fields ({allExtractedList.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveResultTab('security')}
                      className={`px-3 py-2 font-medium cursor-pointer transition-colors border-b-2 -mb-[1px] flex items-center gap-1.5 ${
                        activeResultTab === 'security'
                          ? 'border-white text-white font-semibold'
                          : 'border-transparent text-neutral-400 hover:text-white'
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Security Audit</span>
                    </button>

                    {result.rawTextPreview && (
                      <button
                        type="button"
                        onClick={() => setActiveResultTab('raw')}
                        className={`px-3 py-2 font-medium cursor-pointer transition-colors border-b-2 -mb-[1px] flex items-center gap-1.5 ${
                          activeResultTab === 'raw'
                            ? 'border-white text-white font-semibold'
                            : 'border-transparent text-neutral-400 hover:text-white'
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Raw Text</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveResultTab('json')}
                      className={`px-3 py-2 font-medium cursor-pointer transition-colors border-b-2 -mb-[1px] flex items-center gap-1.5 ${
                        activeResultTab === 'json'
                          ? 'border-white text-white font-semibold'
                          : 'border-transparent text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      <span>JSON Payload</span>
                    </button>
                  </div>
                </div>

                {/* Tab 1: Full Extracted Data Key-Value Table */}
                {activeResultTab === 'extracted' && (
                  <div className="rounded-xl border border-neutral-800 bg-black overflow-hidden divide-y divide-neutral-900">
                    {allExtractedList.length === 0 ? (
                      <div className="p-6 text-center text-xs text-neutral-500">
                        No field key-value pairs parsed from the document.
                      </div>
                    ) : (
                      allExtractedList.map((item, idx) => (
                        <div
                          key={`${item.key}-${idx}`}
                          className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-neutral-950/60 transition-colors"
                        >
                          <span className="text-neutral-400 font-medium truncate pr-4">
                            {item.key}
                          </span>
                          <div className="flex items-center gap-2 max-w-[65%] shrink-0">
                            <span className="font-mono text-white text-right truncate select-all">
                              {item.value}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyFieldValue(item.value, item.key)}
                              title="Copy field value"
                              className="text-neutral-600 hover:text-white cursor-pointer"
                            >
                              {copiedFieldKey === item.key ? (
                                <Check className="h-3 w-3 text-white" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab 2: Security Checks */}
                {activeResultTab === 'security' && (
                  <div className="rounded-xl border border-neutral-800 bg-black p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
                        <span className="text-[10px] uppercase font-mono text-neutral-500">Domain Whitelist</span>
                        <div className="flex items-center gap-1.5 font-semibold text-white">
                          <Check className="h-3.5 w-3.5 text-white" />
                          <span>{result.securityChecks?.domainAuthentic ? 'Whitelisted Bank Host' : 'Unrecognized'}</span>
                        </div>
                        <span className="text-[11px] text-neutral-400 block font-mono">{result.rawLinkDomain}</span>
                      </div>

                      <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
                        <span className="text-[10px] uppercase font-mono text-neutral-500">SSL Certificate</span>
                        <div className="flex items-center gap-1.5 font-semibold text-white">
                          <Check className="h-3.5 w-3.5 text-white" />
                          <span>{result.securityChecks?.sslVerified ? 'TLS 1.3 Verified' : 'Unverified'}</span>
                        </div>
                        <span className="text-[11px] text-neutral-400 block">Encrypted banking protocol</span>
                      </div>

                      <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
                        <span className="text-[10px] uppercase font-mono text-neutral-500">Anti-Replay Ledger</span>
                        <div className="flex items-center gap-1.5 font-semibold text-white">
                          <Check className="h-3.5 w-3.5 text-white" />
                          <span>{!result.securityChecks?.duplicateDetected ? 'Unique Transaction' : 'Duplicate Detected'}</span>
                        </div>
                        <span className="text-[11px] text-neutral-400 block">Logged to immutable ledger</span>
                      </div>

                      <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
                        <span className="text-[10px] uppercase font-mono text-neutral-500">Amount Match</span>
                        <div className="flex items-center gap-1.5 font-semibold text-white">
                          <Check className="h-3.5 w-3.5 text-white" />
                          <span>{result.securityChecks?.amountMatched ? 'Matches Order Amount' : 'Amount Mismatch'}</span>
                        </div>
                        <span className="text-[11px] text-neutral-400 block font-mono">{result.amount.toFixed(2)} ETB</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Raw Scraped Text Preview */}
                {activeResultTab === 'raw' && result.rawTextPreview && (
                  <div className="rounded-xl border border-neutral-800 bg-black p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                      <span>Receipt Document Title: <strong className="text-white">{result.pageTitle || 'Bank Slip'}</strong></span>
                    </div>
                    <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-300 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[250px]">
                      {result.rawTextPreview}
                    </pre>
                  </div>
                )}

                {/* Tab 4: JSON Payload */}
                {activeResultTab === 'json' && (
                  <div className="rounded-xl border border-neutral-800 bg-black p-3.5 relative">
                    <div className="absolute top-3 right-3 z-10">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(JSON.stringify(result, null, 2), true)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 hover:text-white cursor-pointer"
                      >
                        {copiedJson ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
                      </button>
                    </div>
                    <pre className="overflow-auto text-xs font-mono text-neutral-200 leading-relaxed max-h-[300px] p-2">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify(result, null, 2), true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-xs font-medium text-neutral-300 hover:text-white cursor-pointer transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copiedJson ? 'Copied JSON' : 'Copy JSON'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenWebhookModal(result)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-xs font-medium text-neutral-300 hover:text-white cursor-pointer transition-colors"
                  >
                    <Send className="h-3 w-3" />
                    <span>Dispatch Webhook</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onNavigateToLedger}
                  className="flex items-center gap-1 text-xs text-white hover:underline cursor-pointer"
                >
                  <span>View in Ledger</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
