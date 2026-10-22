import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AuditRecord, SupportedBank, VerificationStatus } from '../types/payment';

interface AuditLedgerProps {
  records: AuditRecord[];
  onRefresh: () => Promise<void>;
  onClearLedger: () => Promise<void>;
}

export const AuditLedger: React.FC<AuditLedgerProps> = ({
  records,
  onRefresh,
  onClearLedger,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bankFilter, setBankFilter] = useState<SupportedBank | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | 'all'>('all');
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const stats = useMemo(() => {
    let totalVolume = 0;
    let verifiedCount = 0;
    let phishingCount = 0;
    let duplicateCount = 0;

    for (const r of records) {
      if (r.status === 'VERIFIED') {
        totalVolume += r.amount;
        verifiedCount++;
      } else if (r.status === 'SUSPICIOUS_DOMAIN') {
        phishingCount++;
      } else if (r.status === 'DUPLICATE_CLAIM') {
        duplicateCount++;
      }
    }

    return {
      totalVolume,
      verifiedCount,
      phishingCount,
      duplicateCount,
      totalCount: records.length,
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (bankFilter !== 'all' && r.bank !== bankFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesRef = r.transactionReference.toLowerCase().includes(query);
        const matchesPayer = r.payer.name.toLowerCase().includes(query);
        const matchesMerchant = r.recipient.name.toLowerCase().includes(query);
        const matchesBank = r.bankName.toLowerCase().includes(query);
        if (!matchesRef && !matchesPayer && !matchesMerchant && !matchesBank) {
          return false;
        }
      }
      return true;
    });
  }, [records, bankFilter, statusFilter, searchQuery]);

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const copyRefToClipboard = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(ref);
    setTimeout(() => setCopiedRef(null), 1500);
  };

  const exportToCsv = () => {
    const headers = [
      'VerificationID',
      'Bank',
      'TransactionReference',
      'Status',
      'Amount_ETB',
      'PayerName',
      'PayerPhone',
      'MerchantName',
      'MerchantAccount',
      'Timestamp',
      'VerifiedAt',
      'Source',
    ];

    const rows = filteredRecords.map((r) => [
      r.verificationId,
      r.bank,
      r.transactionReference,
      r.status,
      r.amount.toFixed(2),
      `"${r.payer.name}"`,
      r.payer.phoneMasked,
      `"${r.recipient.name}"`,
      r.recipient.accountOrTill,
      r.timestamp,
      r.verifiedAt,
      r.source,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl font-sans">
            Audit Ledger
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-400">
            Immutable settlement log for all payment verifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={exportToCsv}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset the verification ledger?')) {
                onClearLedger();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 4 Financial & Security KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <span className="text-xs text-neutral-500 block mb-1">Total Verified</span>
          <div className="text-2xl font-bold font-mono text-white tabular-nums flex items-baseline gap-1">
            <span>{stats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-xs text-neutral-500">ETB</span>
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">
            {stats.verifiedCount} verified transactions
          </span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <span className="text-xs text-neutral-500 block mb-1">Total Checked</span>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {stats.totalCount}
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">
            All submitted receipts
          </span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <span className="text-xs text-neutral-500 block mb-1">Phishing Stopped</span>
          <div className="text-2xl font-bold font-mono text-neutral-300 tabular-nums">
            {stats.phishingCount}
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">
            Untrusted domain links
          </span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <span className="text-xs text-neutral-500 block mb-1">Replay Stopped</span>
          <div className="text-2xl font-bold font-mono text-neutral-300 tabular-nums">
            {stats.duplicateCount}
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">
            Duplicate claims
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by reference ID, name, or bank..."
            className="w-full rounded-lg bg-black border border-neutral-800 pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white font-sans"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black rounded-lg border border-neutral-800 p-0.5 text-xs">
            {(['all', 'cbe', 'awash', 'ebirr'] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBankFilter(b)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all uppercase cursor-pointer ${
                  bankFilter === b
                    ? 'bg-neutral-800 text-white font-semibold'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as VerificationStatus | 'all')}
            className="bg-black border border-neutral-800 text-neutral-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-white cursor-pointer"
          >
            <option value="all">All</option>
            <option value="VERIFIED">Verified</option>
            <option value="INVALID_LINK">Invalid Link</option>
            <option value="SUSPICIOUS_DOMAIN">Phishing</option>
            <option value="DUPLICATE_CLAIM">Duplicate</option>
            <option value="AMOUNT_MISMATCH">Mismatch</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-black text-neutral-400 font-medium">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Bank</th>
                <th className="py-3 px-4">Reference ID</th>
                <th className="py-3 px-4 text-right">Amount (ETB)</th>
                <th className="py-3 px-4">Payer</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-neutral-500">
                    No verification records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.verificationId} className="hover:bg-neutral-900/40 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-white">
                      {r.status === 'INVALID_LINK' ? 'INVALID LINK' : r.status}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap uppercase text-neutral-300">
                      {r.bank}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-mono text-white">
                      <div className="flex items-center gap-1.5">
                        <span>{r.transactionReference}</span>
                        <button
                          type="button"
                          onClick={() => copyRefToClipboard(r.transactionReference)}
                          className="text-neutral-500 hover:text-white cursor-pointer"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        {copiedRef === r.transactionReference && (
                          <span className="text-[10px] text-neutral-400">Copied</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-white">
                      {r.amount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-neutral-300">
                      <div className="truncate max-w-[140px]">{r.payer.name}</div>
                      <div className="text-[10px] font-mono text-neutral-500">{r.payer.phoneMasked}</div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-neutral-400">
                      {new Date(r.timestamp).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedRecord(r)}
                        className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors text-xs cursor-pointer border border-neutral-800"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-950 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white">Audit Record</h3>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-900">
                <span className="text-neutral-500">Status:</span>
                <span className="font-semibold text-white">{selectedRecord.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-900">
                <span className="text-neutral-500">Bank:</span>
                <span className="text-white">{selectedRecord.bankName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-900">
                <span className="text-neutral-500">Reference ID:</span>
                <span className="font-mono text-white">{selectedRecord.transactionReference}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-900">
                <span className="text-neutral-500">Amount:</span>
                <span className="font-mono font-bold text-white">
                  {selectedRecord.amount.toFixed(2)} ETB
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-900">
                <span className="text-neutral-500">Payer:</span>
                <span className="text-white">
                  {selectedRecord.payer.name} ({selectedRecord.payer.phoneMasked})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-900">
                <span className="text-neutral-500">Recipient:</span>
                <span className="text-white">{selectedRecord.recipient.name}</span>
              </div>
              <div className="py-2 bg-black p-3 rounded border border-neutral-800">
                <span className="text-neutral-500 block mb-1 text-[11px]">Audit Reason:</span>
                <p className="text-neutral-300 text-xs">
                  {selectedRecord.securityChecks.reason}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-xs cursor-pointer border border-neutral-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
