import React, { useState } from 'react';
import { CheckCircle2, RefreshCw, Send, X } from 'lucide-react';
import { VerificationResult } from '../types/payment';

interface WebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: VerificationResult | null;
}

export const WebhookModal: React.FC<WebhookModalProps> = ({
  isOpen,
  onClose,
  result,
}) => {
  const [webhookUrl, setWebhookUrl] = useState<string>(
    'https://api.my-ecommerce.et/webhooks/payment'
  );
  const [eventType, setEventType] = useState<string>('payment.verified');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [deliveryResponse, setDeliveryResponse] = useState<any | null>(null);

  if (!isOpen || !result) return null;

  const handleSendWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/webhook/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          event: eventType,
          verificationId: result.verificationId,
        }),
      });
      const data = await response.json();
      setDeliveryResponse(data);
    } catch (err: any) {
      setDeliveryResponse({
        delivered: false,
        error: err.message || 'Simulation network error',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-white" />
            <h3 className="text-sm font-bold text-white">Simulate Webhook</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSendWebhook} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-neutral-300 font-medium mb-1">
              Webhook Listener URL
            </label>
            <input
              type="url"
              required
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg bg-black border border-neutral-800 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">
              Event Trigger
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded-lg bg-black border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-white cursor-pointer"
            >
              <option value="payment.verified">payment.verified</option>
              <option value="payment.fraud_detected">payment.fraud_detected</option>
              <option value="payment.duplicate">payment.duplicate</option>
            </select>
          </div>

          <div className="p-3 bg-black rounded-lg border border-neutral-800 space-y-1 font-mono text-[11px] text-neutral-300">
            <div className="flex justify-between">
              <span className="text-neutral-500 font-sans">Reference:</span>
              <span className="text-white font-bold">{result.transactionReference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500 font-sans">Amount:</span>
              <span>{result.amount.toFixed(2)} ETB</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSending}
            className="w-full py-2.5 rounded-lg bg-white text-black hover:bg-neutral-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSending ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Dispatching...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Send Webhook Event</span>
              </>
            )}
          </button>
        </form>

        {deliveryResponse && (
          <div className="p-3.5 bg-black rounded-lg border border-neutral-700 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-white font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              <span>Simulated Delivery Succeeded</span>
            </div>
            <p className="text-neutral-400 text-[11px]">
              {deliveryResponse.message}
            </p>
            <div className="text-[10px] font-mono text-neutral-500 break-all pt-1">
              x-ethiopay-signature: {deliveryResponse.signature}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-xs cursor-pointer border border-neutral-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
