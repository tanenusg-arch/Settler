import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  EyeOff,
  KeyRound,
  Lock,
  Plus,
  Shield,
  Trash2,
} from 'lucide-react';
import { ApiKey } from '../types/payment';

interface ApiKeyViewProps {
  keys: ApiKey[];
  onKeysChange: (keys: ApiKey[]) => void;
  onOpenCreateModal: () => void;
}

export const ApiKeyView: React.FC<ApiKeyViewProps> = ({
  keys,
  onKeysChange,
  onOpenCreateModal,
}) => {
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const handleCopyMasked = (k: ApiKey) => {
    navigator.clipboard.writeText(k.maskedKey);
    setCopiedKeyId(k.id);
    setTimeout(() => setCopiedKeyId(null), 1500);
  };

  const handleRevoke = (id: string) => {
    if (confirm('Revoke this API key? Any integration using this key will immediately be rejected.')) {
      onKeysChange(keys.filter((k) => k.id !== id));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div className="border-b border-neutral-800 pb-6 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl font-sans">
                API Keys
              </h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                Self-Service
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-xl">
              Create and manage authentication keys for the Ethiopian payment verification REST API.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white text-black hover:bg-neutral-200 font-semibold text-xs transition-colors cursor-pointer shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Secret Key</span>
          </button>
        </div>
      </div>

      {/* Security Rule Callout */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4.5 text-xs text-neutral-300 flex items-start gap-3">
        <Shield className="h-4 w-4 text-white shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-white block font-medium">One-Time Reveal & Permanent Auto-Hide Policy</strong>
          <p className="text-neutral-400 leading-relaxed text-[11px]">
            To protect your transactions and account integrity, full secret keys (<code className="text-white font-mono">sk_live_...</code>) are shown only once upon creation. After your first copy, the plaintext secret is permanently purged from memory and permanently masked.
          </p>
        </div>
      </div>

      {/* Keys Table / Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span className="font-mono uppercase tracking-wider text-[11px]">
            Your Secret Keys ({keys.length})
          </span>
          <span className="text-[11px] text-neutral-500">
            Pass via <code className="text-neutral-300 font-mono">Authorization: Bearer &lt;key&gt;</code>
          </span>
        </div>

        {keys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950 p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black border border-neutral-800 text-neutral-400">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">No API Keys Generated Yet</h3>
              <p className="mt-1 text-xs text-neutral-400 max-w-sm">
                You haven&apos;t created any secret keys yet. Generate your first API key to connect your backend or store to the verification gateway.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black hover:bg-neutral-200 font-semibold text-xs cursor-pointer transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create First Key</span>
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden divide-y divide-neutral-900">
            {keys.map((k) => (
              <div
                key={k.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-black/50 transition-colors"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-sm text-white">{k.name}</span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black border border-neutral-800 text-neutral-300">
                      {k.role === 'live' ? 'Production' : 'Development'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-neutral-400 font-mono">
                      <EyeOff className="h-3.5 w-3.5 text-neutral-500" />
                      <span className="text-neutral-300 font-medium">{k.maskedKey}</span>
                    </div>

                    <span className="text-[11px] text-neutral-500">
                      Created {new Date(k.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyMasked(k)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black hover:bg-neutral-900 border border-neutral-800 text-xs font-medium text-neutral-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedKeyId === k.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-white" />
                        <span>Copied Mask</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Mask</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRevoke(k.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black hover:bg-neutral-900 border border-neutral-800 text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Revoke</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Integration Code Helper */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-white" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Using Your Secret Key
          </h3>
        </div>

        <p className="text-xs text-neutral-400">
          Include your secret key in the <code className="text-white font-mono">Authorization</code> HTTP header when calling <code className="text-white font-mono">POST /api/verify</code>:
        </p>

        <pre className="p-3.5 rounded-lg bg-black border border-neutral-800 text-xs font-mono text-neutral-300 leading-relaxed overflow-x-auto">
{`// Calling SETTLR with your generated key:
const response = await fetch("${window.location.origin}/api/verify", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk_live_your_secret_key_here"
  },
  body: JSON.stringify({
    url: "https://apps.cbe.com.et:9191/receipt/verify?ft=FT261014881"
  })
});`}
        </pre>
      </div>
    </div>
  );
};
