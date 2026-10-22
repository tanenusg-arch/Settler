import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Plus,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { ApiKey } from '../types/payment';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  keys: ApiKey[];
  onKeysUpdated: (keys: ApiKey[]) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  keys,
  onKeysUpdated,
}) => {
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [keyName, setKeyName] = useState<string>('');
  const [keyRole, setKeyRole] = useState<'live' | 'test'>('live');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<ApiKey | null>(null);
  const [hasCopiedNewKey, setHasCopiedNewKey] = useState<boolean>(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = keyName.trim();
    if (!cleanName) {
      setErrorMsg('Please enter a descriptive name for this API key');
      return;
    }

    setErrorMsg(null);

    // Generate cryptographically random token
    const prefix = keyRole === 'live' ? 'sk_live_' : 'sk_test_';
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const fullToken = `${prefix}${randomHex}`;
    const masked = `${fullToken.slice(0, 8)}****************${fullToken.slice(-4)}`;

    const newKeyObj: ApiKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      key: fullToken,
      maskedKey: masked,
      createdAt: new Date().toISOString(),
      isRevealed: true, // Visible ONLY until first copy
      role: keyRole,
    };

    const updated = [newKeyObj, ...keys];
    onKeysUpdated(updated);
    setNewlyCreatedKey(newKeyObj);
    setIsCreating(false);
    setKeyName('');
    setHasCopiedNewKey(false);
  };

  // THE FIRST COPY TRIGGERS PERMANENT HIDING
  const handleCopyFreshKey = (keyObj: ApiKey) => {
    navigator.clipboard.writeText(keyObj.key);
    setHasCopiedNewKey(true);

    // After first copy, permanently hide and mask the secret
    setTimeout(() => {
      const updated = keys.map((k) =>
        k.id === keyObj.id
          ? {
              ...k,
              isRevealed: false,
              key: k.maskedKey, // Plaintext permanently wiped from storage
            }
          : k
      );
      onKeysUpdated(updated);
      if (newlyCreatedKey && newlyCreatedKey.id === keyObj.id) {
        setNewlyCreatedKey((prev) =>
          prev ? { ...prev, isRevealed: false, key: prev.maskedKey } : null
        );
      }
    }, 1200);
  };

  const handleCopyExistingMasked = (keyObj: ApiKey) => {
    navigator.clipboard.writeText(keyObj.maskedKey);
    setCopiedKeyId(keyObj.id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleDeleteKey = (id: string) => {
    if (confirm('Are you sure you want to revoke and delete this API key? This action is irreversible.')) {
      onKeysUpdated(keys.filter((k) => k.id !== id));
      if (newlyCreatedKey?.id === id) {
        setNewlyCreatedKey(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black font-bold">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight font-sans">
                API Key Management
              </h3>
              <p className="text-xs text-neutral-400">
                Generate secret keys for REST verification requests.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-900 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Freshly Generated Key Alert - One-Time View */}
        {newlyCreatedKey && (
          <div className="rounded-xl border border-neutral-700 bg-black p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-white" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Secret Key Created
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                {newlyCreatedKey.role}
              </span>
            </div>

            {newlyCreatedKey.isRevealed ? (
              <div className="space-y-2">
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Please copy this key now. For your security, <strong className="text-white">it will be permanently hidden</strong> after you copy it or close this window.
                </p>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-neutral-950 border border-neutral-700">
                  <span className="font-mono text-xs text-white flex-1 break-all select-all font-medium">
                    {newlyCreatedKey.key}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyFreshKey(newlyCreatedKey)}
                    className="px-3 py-1.5 rounded bg-white text-black hover:bg-neutral-200 font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    {hasCopiedNewKey ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copied & Hidden!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Key</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-neutral-500" />
                  <span className="font-mono text-neutral-400">{newlyCreatedKey.maskedKey}</span>
                </div>
                <span className="text-[11px] text-neutral-400 font-medium">
                  Hidden for security
                </span>
              </div>
            )}
          </div>
        )}

        {/* Creation Form */}
        {isCreating ? (
          <form
            onSubmit={handleGenerateKey}
            className="rounded-xl border border-neutral-800 bg-black p-4 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Create New API Key
              </span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs text-neutral-500 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div>
              <label htmlFor="keyName" className="block text-xs text-neutral-400 mb-1">
                Key Label / Description <span className="text-white">*</span>
              </label>
              <input
                id="keyName"
                type="text"
                autoFocus
                required
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. Production Checkout, Telegram Bot, Shopify..."
                className="w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-sans"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">Environment</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKeyRole('live')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                    keyRole === 'live'
                      ? 'border-white bg-neutral-900 text-white font-semibold'
                      : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white'
                  }`}
                >
                  Production (sk_live_)
                </button>
                <button
                  type="button"
                  onClick={() => setKeyRole('test')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                    keyRole === 'test'
                      ? 'border-white bg-neutral-900 text-white font-semibold'
                      : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white'
                  }`}
                >
                  Development (sk_test_)
                </button>
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-white bg-neutral-900 border border-neutral-700 p-2 rounded">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              Generate Secret Key
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
              Active Keys ({keys.length})
            </span>
            <button
              type="button"
              onClick={() => {
                setIsCreating(true);
                setNewlyCreatedKey(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 font-semibold text-xs transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create New Key</span>
            </button>
          </div>
        )}

        {/* Existing Keys List */}
        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {keys.length === 0 && !isCreating && (
            <div className="rounded-xl border border-dashed border-neutral-800 p-8 text-center bg-black">
              <KeyRound className="h-6 w-6 text-neutral-600 mx-auto mb-2" />
              <h4 className="text-xs font-semibold text-white">No API Keys Yet</h4>
              <p className="mt-1 text-[11px] text-neutral-500 max-w-xs mx-auto">
                Users create their own secret keys. Click &quot;Create New Key&quot; above to generate your first key.
              </p>
            </div>
          )}

          {keys.map((k) => (
            <div
              key={k.id}
              className="rounded-xl border border-neutral-800 bg-black p-3.5 flex items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white truncate">{k.name}</span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                    {k.role}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-neutral-400 text-[11px]">
                    {k.maskedKey}
                  </span>
                  <span className="text-[10px] text-neutral-600">
                    Created {new Date(k.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="Copy masked identifier"
                  onClick={() => handleCopyExistingMasked(k)}
                  className="p-1.5 rounded hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedKeyId === k.id ? (
                    <Check className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  title="Revoke / Delete Key"
                  onClick={() => handleDeleteKey(k.id)}
                  className="p-1.5 rounded hover:bg-neutral-900 text-neutral-500 hover:text-white transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Security Info Footnote */}
        <div className="border-t border-neutral-800 pt-3 text-[11px] text-neutral-500 space-y-1 font-mono">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Lock className="h-3 w-3" />
            <span>Pass via Header:</span>
          </div>
          <div className="p-2 rounded bg-black border border-neutral-800 text-neutral-300 break-all select-all">
            Authorization: Bearer sk_live_************************
          </div>
        </div>
      </div>
    </div>
  );
};
