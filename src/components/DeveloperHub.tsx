import React, { useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Info,
  KeyRound,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { ApiKey, VerificationRequest, VerificationResult } from '../types/payment';

interface DeveloperHubProps {
  onVerify: (req: VerificationRequest) => Promise<VerificationResult>;
  apiKeys?: ApiKey[];
  onOpenApiKeyModal?: () => void;
}

type SnippetLanguage = 'javascript' | 'curl' | 'node' | 'python';

export const DeveloperHub: React.FC<DeveloperHubProps> = ({
  onVerify,
  apiKeys = [],
  onOpenApiKeyModal,
}) => {
  const [activeSnippetLang, setActiveSnippetLang] = useState<SnippetLanguage>('javascript');
  const [selectedKeyId, setSelectedKeyId] = useState<string>(
    apiKeys.length > 0 ? apiKeys[0].id : ''
  );
  const [requestPayload, setRequestPayload] = useState<string>(
    JSON.stringify(
      {
        url: 'https://apps.cbe.com.et:9191/receipt/verify?ft=FT261014881',
        expectedAmount: 1500,
      },
      null,
      2
    )
  );
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseLatency, setResponseLatency] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [hasCopiedCode, setHasCopiedCode] = useState<boolean>(false);
  const [hasCopiedResponse, setHasCopiedResponse] = useState<boolean>(false);
  const [hasCopiedSimpleJs, setHasCopiedSimpleJs] = useState<boolean>(false);

  // Quick preset payloads
  const loadPreset = (preset: 'cbe' | 'awash' | 'ebirr') => {
    let payload = {};
    if (preset === 'cbe') {
      payload = {
        url: 'https://apps.cbe.com.et:9191/receipt/verify?ft=FT261014881',
        expectedAmount: 1500,
      };
    } else if (preset === 'awash') {
      payload = {
        url: 'https://awashpay.awashbank.com:8225/-2KDKTI3VSK-4TXWJU',
      };
    } else if (preset === 'ebirr') {
      payload = {
        url: 'https://receipt.ebirr.com/coopay/7kVM6PEyHTvz-hdb2IBfeg',
      };
    }
    setRequestPayload(JSON.stringify(payload, null, 2));
  };

  const handleExecuteRequest = async () => {
    setIsExecuting(true);
    const start = performance.now();
    try {
      const parsed = JSON.parse(requestPayload);
      const res = await onVerify({
        receiptUrl: parsed.url || parsed.receiptUrl,
        bank: parsed.bank,
        expectedAmountEtb: parsed.expectedAmount || parsed.expectedAmountEtb,
        merchantAccount: parsed.merchantAccount,
      });
      const elapsed = Math.round(performance.now() - start);
      setResponseLatency(elapsed);

      let status = 200;
      if (res.status === 'SUSPICIOUS_DOMAIN') status = 403;
      else if (res.status === 'DUPLICATE_CLAIM') status = 409;
      else if (res.status === 'AMOUNT_MISMATCH') status = 422;
      else if (res.status === 'INVALID_LINK' || res.status === 'NOT_FOUND') status = 400;

      setResponseStatus(status);
      setResponseOutput(JSON.stringify(res, null, 2));
    } catch (err: unknown) {
      const elapsed = Math.round(performance.now() - start);
      setResponseLatency(elapsed);
      setResponseStatus(400);
      const errorMessage = err instanceof Error ? err.message : 'Invalid JSON or Request Error';
      setResponseOutput(
        JSON.stringify(
          {
            error: 'Bad Request',
            message: errorMessage,
          },
          null,
          2
        )
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const activeKeyObj = apiKeys.find((k) => k.id === selectedKeyId);
  const bearerTokenPlaceholder = activeKeyObj ? activeKeyObj.maskedKey : 'sk_live_your_secret_key';

  // Generate dynamic code snippet for the ONE working API
  const getSnippet = (): string => {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(requestPayload);
    } catch {
      parsed = { url: 'https://apps.cbe.com.et:9191/receipt/verify?ft=FT261014881' };
    }

    const host = window.location.origin;

    switch (activeSnippetLang) {
      case 'javascript':
        return `// Simple JavaScript to verify Ethiopian payment receipt
async function verifyReceipt() {
  const response = await fetch("${host}/api/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer ${bearerTokenPlaceholder}"
    },
    body: JSON.stringify(${JSON.stringify(parsed, null, 2)})
  });

  const data = await response.json();
  console.log("Status:", data.status);
  console.log("Amount:", data.amount, data.currency);
  console.log("Ref:", data.transactionReference);
  return data;
}

verifyReceipt();`;

      case 'curl':
        return `# Note: Add -L to automatically follow redirects if using Cloud Run preview
curl -L -X POST "${host}/api/verify" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${bearerTokenPlaceholder}" \\
  -d '${JSON.stringify(parsed)}'`;

      case 'node':
        return `import axios from 'axios';

async function verifyPayment() {
  const { data } = await axios.post('${host}/api/verify', ${JSON.stringify(parsed, null, 4)}, {
    headers: {
      'Authorization': 'Bearer ${bearerTokenPlaceholder}'
    }
  });

  if (data.status === 'VERIFIED') {
    console.log(\`Verified \${data.amount} ETB via \${data.bankName} (Ref: \${data.transactionReference})\`);
  }
}

verifyPayment();`;

      case 'python':
        return `import requests

url = "${host}/api/verify"
headers = {
    "Authorization": "Bearer ${bearerTokenPlaceholder}",
    "Content-Type": "application/json"
}
payload = ${JSON.stringify(parsed, null, 4)}

response = requests.post(url, json=payload, headers=headers, allow_redirects=True)
data = response.json()

if data.get("status") == "VERIFIED":
    print(f"Verified {data['amount']} ETB! Ref: {data['transactionReference']}")`;
    }
  };

  const simpleJsCode = `// Minimal 8-line JavaScript helper to verify any receipt
async function verifyPayment(receiptUrl) {
  const res = await fetch('${window.location.origin}/api/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${bearerTokenPlaceholder}'
    },
    body: JSON.stringify({ url: receiptUrl })
  });
  return await res.json();
}

// Example usage:
verifyPayment('https://apps.cbe.com.et:9191/receipt/verify?ft=FT261014881')
  .then(data => console.log('Result:', data));`;

  const copyCode = () => {
    navigator.clipboard.writeText(getSnippet());
    setHasCopiedCode(true);
    setTimeout(() => setHasCopiedCode(false), 2000);
  };

  const copyResponse = () => {
    if (responseOutput) {
      navigator.clipboard.writeText(responseOutput);
      setHasCopiedResponse(true);
      setTimeout(() => setHasCopiedResponse(false), 2000);
    }
  };

  const copySimpleJs = () => {
    navigator.clipboard.writeText(simpleJsCode);
    setHasCopiedSimpleJs(true);
    setTimeout(() => setHasCopiedSimpleJs(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Title */}
      <div className="border-b border-neutral-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl font-sans">
              Verification API
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-neutral-400">
              One unified, reliable REST endpoint to verify CBE, Awash Bank, and eBirr payments.
            </p>
          </div>
          <span className="font-mono text-xs px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-white font-semibold self-start sm:self-auto">
            POST /api/verify
          </span>
        </div>
      </div>

      {/* Simple JS Code Quick-Start Card */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-white" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              Simple JavaScript Implementation
            </h2>
          </div>
          <button
            type="button"
            onClick={copySimpleJs}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 hover:text-white cursor-pointer transition-colors"
          >
            {hasCopiedSimpleJs ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
            <span>{hasCopiedSimpleJs ? 'Copied' : 'Copy JS Code'}</span>
          </button>
        </div>

        <pre className="overflow-x-auto rounded-lg bg-black border border-neutral-800 p-3.5 text-xs font-mono text-neutral-200 leading-relaxed">
          {simpleJsCode}
        </pre>

        <div className="flex items-start gap-2 pt-1 text-[11px] text-neutral-400">
          <Info className="h-3.5 w-3.5 text-neutral-400 shrink-0 mt-0.5" />
          <span>
            Works directly in modern browsers and Node.js 18+. When testing via <code className="text-white font-mono">curl</code> from the command line on Cloud Run preview URLs, use <code className="text-white font-mono">-L</code> to follow redirects automatically.
          </span>
        </div>
      </div>

      {/* Key Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-neutral-800 bg-neutral-950 text-xs">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-white" />
          <span className="text-neutral-400">Authorized Key:</span>
          {apiKeys.length > 0 ? (
            <select
              value={selectedKeyId}
              onChange={(e) => setSelectedKeyId(e.target.value)}
              className="bg-black border border-neutral-800 text-white rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-white"
            >
              {apiKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ({k.maskedKey})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-neutral-500 italic">No keys created yet (using public demo mode)</span>
          )}
        </div>

        {onOpenApiKeyModal && (
          <button
            type="button"
            onClick={onOpenApiKeyModal}
            className="flex items-center gap-1.5 text-neutral-300 hover:text-white font-medium cursor-pointer self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Generate New Key</span>
          </button>
        )}
      </div>

      {/* Playground Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Request */}
        <div className="lg:col-span-6 space-y-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-white" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">Request Runner</h2>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-neutral-500 text-[11px]">Presets:</span>
                <button
                  type="button"
                  onClick={() => loadPreset('cbe')}
                  className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] cursor-pointer"
                >
                  CBE
                </button>
                <button
                  type="button"
                  onClick={() => loadPreset('awash')}
                  className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] cursor-pointer"
                >
                  Awash
                </button>
                <button
                  type="button"
                  onClick={() => loadPreset('ebirr')}
                  className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] cursor-pointer"
                >
                  eBirr
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 bg-black rounded-lg border border-neutral-800 text-xs font-mono">
              <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-white font-bold text-[10px]">
                POST
              </span>
              <span className="text-neutral-200 flex-1 truncate">/api/verify</span>
              <span className="text-neutral-500 text-[10px]">application/json</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-neutral-400 font-medium">Request Body</label>
              </div>
              <textarea
                rows={7}
                value={requestPayload}
                onChange={(e) => setRequestPayload(e.target.value)}
                className="w-full rounded-lg bg-black border border-neutral-800 p-3 text-xs font-mono text-white focus:outline-none focus:border-white leading-relaxed resize-y"
              />
            </div>

            <button
              type="button"
              onClick={handleExecuteRequest}
              disabled={isExecuting}
              className="w-full py-2.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Send API Request</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Response */}
        <div className="lg:col-span-6 space-y-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 min-h-[380px] flex flex-col">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-white" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">Response</h2>
              </div>

              {responseStatus !== null && (
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-white font-bold">
                    HTTP {responseStatus}
                  </span>
                  {responseLatency !== null && (
                    <span className="text-neutral-400 tabular-nums">{responseLatency} ms</span>
                  )}
                </div>
              )}
            </div>

            {responseOutput ? (
              <div className="relative flex-1 flex flex-col">
                <div className="absolute top-2 right-2 z-10">
                  <button
                    type="button"
                    onClick={copyResponse}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-300 hover:text-white cursor-pointer"
                  >
                    {hasCopiedResponse ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                    <span>{hasCopiedResponse ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="flex-1 overflow-auto rounded-lg bg-black border border-neutral-800 p-3.5 text-xs font-mono text-neutral-200 leading-relaxed max-h-[320px]">
                  {responseOutput}
                </pre>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-neutral-800 rounded-lg p-6 text-center bg-black">
                <span className="text-xs font-medium text-neutral-400">Ready</span>
                <p className="mt-1 text-[11px] text-neutral-500 max-w-xs">
                  Click &quot;Send API Request&quot; to test against the live backend.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SDK & Snippets */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Integration Snippets</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Use in your checkout, webhook listener, or bot.</p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-black rounded-lg border border-neutral-800 text-xs">
            {(['javascript', 'curl', 'node', 'python'] as SnippetLanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setActiveSnippetLang(lang)}
                className={`px-2.5 py-1 rounded text-[11px] uppercase transition-all cursor-pointer ${
                  activeSnippetLang === lang
                    ? 'bg-neutral-800 text-white font-semibold'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute top-2.5 right-2.5 z-10">
            <button
              type="button"
              onClick={copyCode}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 hover:text-white cursor-pointer"
            >
              {hasCopiedCode ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
              <span>{hasCopiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-black border border-neutral-800 p-3.5 text-xs font-mono text-neutral-300 leading-relaxed">
            {getSnippet()}
          </pre>
        </div>
      </div>
    </div>
  );
};
