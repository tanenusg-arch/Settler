/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { InstantVerifier } from './components/InstantVerifier';
import { DeveloperHub } from './components/DeveloperHub';
import { ApiKeyView } from './components/ApiKeyView';
import { AuditLedger } from './components/AuditLedger';
import { ApiKeyModal } from './components/ApiKeyModal';
import { WebhookModal } from './components/WebhookModal';
import { ApiKey, AuditRecord, SupportedBank, VerificationRequest, VerificationResult } from './types/payment';
import { AuthProvider, useAuth } from './context/AuthContext';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, doc, setDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';

const STORAGE_KEY = 'settlr_user_api_keys_v1';

function SettlrApp() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('verifier');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [webhookModalResult, setWebhookModalResult] = useState<VerificationResult | null>(null);
  const [ledgerRecords, setLedgerRecords] = useState<AuditRecord[]>([]);

  // User-created API keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((k: any) => ({
            ...k,
            maskedKey: (k.maskedKey || '').replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '*'),
            key: (k.key || '').replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '*'),
          }));
        }
      }
    } catch (e) {
      console.error('Error loading API keys:', e);
    }
    return [];
  });

  const previousKeyIdsRef = useRef<Set<string>>(new Set(apiKeys.map((k) => k.id)));

  const userId = user?.uid;

  // Firebase Firestore real-time sync for API keys when logged in
  useEffect(() => {
    if (!userId) return;

    const keysQuery = query(collection(db, 'api_keys'), where('ownerId', '==', userId));
    const unsubscribe = onSnapshot(
      keysQuery,
      (snapshot) => {
        const cloudKeys: ApiKey[] = [];
        snapshot.forEach((snap) => {
          const d = snap.data();
          cloudKeys.push({
            id: d.id || snap.id,
            name: d.name || 'API Key',
            key: d.key || d.maskedKey || '',
            maskedKey: d.maskedKey || '',
            createdAt: d.createdAt || new Date().toISOString(),
            lastUsedAt: d.lastUsedAt,
            isRevealed: false,
            role: d.role || 'live',
          });
        });

        if (cloudKeys.length > 0) {
          setApiKeys((prev) => {
            const isSame =
              prev.length === cloudKeys.length &&
              prev.every((pk, i) => pk.id === cloudKeys[i].id && pk.maskedKey === cloudKeys[i].maskedKey);
            if (isSame) return prev;

            const currentUncopied = prev.find((k) => k.isRevealed);
            if (currentUncopied && !cloudKeys.some((k) => k.id === currentUncopied.id)) {
              return [currentUncopied, ...cloudKeys];
            }
            return cloudKeys;
          });
        }
      },
      (error) => {
        console.error('Firestore api_keys sync error:', error);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Firebase Firestore real-time sync for audit records when logged in
  useEffect(() => {
    if (!userId) return;

    const recordsQuery = query(collection(db, 'verification_records'), where('ownerId', '==', userId));
    const unsubscribe = onSnapshot(
      recordsQuery,
      (snapshot) => {
        const cloudRecords: AuditRecord[] = [];
        snapshot.forEach((snap) => {
          const d = snap.data();
          const recId = d.verificationId || snap.id;
          cloudRecords.push({
            id: recId,
            verificationId: recId,
            timestamp: d.createdAt || new Date().toISOString(),
            verifiedAt: d.createdAt || new Date().toISOString(),
            bank: (d.bank as SupportedBank) || 'cbe',
            bankName:
              d.bank === 'awash'
                ? 'Awash Bank'
                : d.bank === 'ebirr'
                ? 'eBirr'
                : 'Commercial Bank of Ethiopia',
            transactionReference: d.transactionReference || 'N/A',
            amount: typeof d.amount === 'number' ? d.amount : 0,
            currency: 'ETB',
            status: d.status || 'VERIFIED',
            rawLinkDomain: d.rawLinkDomain || '',
            receiptUrl: '',
            paymentMethod: 'Electronic Transfer',
            riskScore: typeof d.riskScore === 'number' ? d.riskScore : 0,
            payer: {
              name: d.payerName || 'Payer',
              phoneMasked: d.payerPhoneMasked || '',
            },
            recipient: {
              name: d.recipientName || 'Merchant',
              accountOrTill: d.recipientAccount || '',
            },
            securityChecks: {
              domainAuthentic: d.status === 'VERIFIED',
              sslVerified: true,
              duplicateDetected: d.status === 'DUPLICATE_CLAIM',
              amountMatched: d.status !== 'AMOUNT_MISMATCH',
              tamperRisk: d.status === 'VERIFIED' ? 'LOW' : 'HIGH',
              reason: d.failureReason || 'Audited via Settlr Engine',
            },
            source: 'WEB_PORTAL',
          });
        });

        if (cloudRecords.length > 0) {
          setLedgerRecords((prev) => {
            const map = new Map<string, AuditRecord>();
            cloudRecords.forEach((r) => map.set(r.verificationId, r));
            prev.forEach((r) => {
              if (!map.has(r.verificationId)) map.set(r.verificationId, r);
            });
            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            if (
              merged.length === prev.length &&
              prev.every((pr, i) => pr.verificationId === merged[i].verificationId && pr.status === merged[i].status)
            ) {
              return prev;
            }
            return merged;
          });
        }
      },
      (error) => {
        console.error('Firestore verification_records sync error:', error);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Sync keys state to localStorage and Firestore
  const handleKeysChange = useCallback(async (updated: ApiKey[]) => {
    const sanitized = updated.map((k) => ({
      ...k,
      maskedKey: (k.maskedKey || '').replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '*'),
      key: (k.key || '').replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '*'),
    }));
    setApiKeys(sanitized);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.error('Error saving API keys:', e);
    }

    // Sync to Firestore if authenticated
    if (user) {
      const currentIds = new Set(sanitized.map((k) => k.id));
      const previousIds = previousKeyIdsRef.current;

      // Handle deleted keys
      for (const oldId of previousIds) {
        if (!currentIds.has(oldId)) {
          try {
            await deleteDoc(doc(db, 'api_keys', oldId));
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `api_keys/${oldId}`);
          }
        }
      }

      // Handle new or updated keys
      for (const k of sanitized) {
        try {
          await setDoc(
            doc(db, 'api_keys', k.id),
            {
              id: k.id,
              name: k.name,
              maskedKey: k.maskedKey,
              role: k.role,
              createdAt: k.createdAt,
              lastUsedAt: k.lastUsedAt || new Date().toISOString(),
              ownerId: userId,
            },
            { merge: true }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `api_keys/${k.id}`);
        }
      }
    }

    previousKeyIdsRef.current = new Set(sanitized.map((k) => k.id));
  }, [userId]);

  // Load audit records from backend API
  const fetchLedger = useCallback(async () => {
    try {
      const res = await fetch('/api/ledger');
      const data = await res.json();
      if (data.records && Array.isArray(data.records)) {
        setLedgerRecords((prev) => {
          const map = new Map<string, AuditRecord>();
          prev.forEach((r) => map.set(r.verificationId, r));
          data.records.forEach((r: AuditRecord) => map.set(r.verificationId, r));
          const sorted = Array.from(map.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

          if (
            sorted.length === prev.length &&
            prev.every((pr, i) => pr.verificationId === sorted[i].verificationId && pr.status === sorted[i].status)
          ) {
            return prev;
          }
          return sorted;
        });
      }
    } catch (err) {
      console.error('Failed to load ledger records:', err);
    }
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // The one working verify API call with pure ASCII headers
  const handleVerify = async (req: VerificationRequest): Promise<VerificationResult> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const activeKey = apiKeys.length > 0 ? apiKeys[0] : null;
    if (activeKey && activeKey.key) {
      const pureKey = activeKey.key.trim();
      if (/^sk_[a-zA-Z0-9_]+$/.test(pureKey)) {
        headers['Authorization'] = `Bearer ${pureKey}`;
      }
    }

    const cleanUrl = (req.receiptUrl || '').trim();

    const response = await fetch('/api/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: cleanUrl,
        bank: req.bank,
        expectedAmount: req.expectedAmountEtb,
        merchantAccount: req.merchantAccount,
      }),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error || `Verification failed with HTTP ${response.status}`);
    }

    const data: VerificationResult = await response.json();
    fetchLedger();

    // Persist verified audit log to Firestore if user is logged in
    if (user && data) {
      const recId = data.verificationId || `vr_${Date.now()}`;
      try {
        await setDoc(doc(db, 'verification_records', recId), {
          id: recId,
          verificationId: data.verificationId || recId,
          status: data.status,
          bank: data.bank || req.bank || 'UNKNOWN',
          transactionReference: data.transactionReference || '',
          amount: typeof data.amount === 'number' ? data.amount : 0,
          currency: data.currency || 'ETB',
          payerName: data.payer?.name || '',
          payerPhoneMasked: data.payer?.phoneMasked || '',
          recipientName: data.recipient?.name || '',
          recipientAccount: data.recipient?.accountOrTill || '',
          rawLinkDomain: data.rawLinkDomain || '',
          riskScore: typeof data.riskScore === 'number' ? data.riskScore : 0,
          failureReason: data.securityChecks?.reason || '',
          createdAt: new Date().toISOString(),
          ownerId: user.uid,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `verification_records/${recId}`);
      }
    }

    return data;
  };

  const handleClearLedger = async () => {
    try {
      const res = await fetch('/api/ledger', { method: 'DELETE' });
      const data = await res.json();
      if (data.records) {
        setLedgerRecords(data.records);
      }
    } catch (err) {
      console.error('Failed to reset ledger:', err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-white selection:text-black">
      {/* Top Navbar with three-line menu and Firebase user profile */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        keyCount={apiKeys.length}
      />

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8">
        {/* Tab 1: Verifier */}
        {activeTab === 'verifier' && (
          <InstantVerifier
            onVerify={handleVerify}
            onOpenWebhookModal={(res) => setWebhookModalResult(res)}
            onNavigateToLedger={() => setActiveTab('ledger')}
          />
        )}

        {/* Tab 2: Developer API Console */}
        {activeTab === 'developer' && (
          <DeveloperHub
            onVerify={handleVerify}
            apiKeys={apiKeys}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
          />
        )}

        {/* Tab 3: API Keys Management */}
        {activeTab === 'keys' && (
          <ApiKeyView
            keys={apiKeys}
            onKeysChange={handleKeysChange}
            onOpenCreateModal={() => setIsApiKeyModalOpen(true)}
          />
        )}

        {/* Tab 4: Audit Ledger */}
        {activeTab === 'ledger' && (
          <AuditLedger
            records={ledgerRecords}
            onRefresh={fetchLedger}
            onClearLedger={handleClearLedger}
          />
        )}
      </main>

      {/* Creation Modal (reveals full key once, hides immediately after first copy) */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        keys={apiKeys}
        onKeysUpdated={handleKeysChange}
      />

      <WebhookModal
        isOpen={!!webhookModalResult}
        result={webhookModalResult}
        onClose={() => setWebhookModalResult(null)}
      />

      {/* Modern Monochrome Footer */}
      <footer className="border-t border-neutral-900 bg-black py-7 text-xs text-neutral-500">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-white tracking-tight">SETTLR</span>
            <span className="text-neutral-700">|</span>
            <span className="text-neutral-400">National Ethiopian Payment Gateway Engine</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono text-neutral-500">
            <span>Cloud Firestore</span>
            <span>·</span>
            <span>CBE · Awash · eBirr</span>
            <span>·</span>
            <span className="text-neutral-300">POST /api/verify</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettlrApp />
    </AuthProvider>
  );
}
