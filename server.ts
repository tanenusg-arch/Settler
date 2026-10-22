import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { parseHtmlData } from './src/services/scraperEngine.ts';
import {
  verifyPaymentLink,
  getAuditLedger,
  resetAuditLedger,
} from './src/services/verificationEngine.ts';
import { SupportedBank } from './src/types/payment.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable CORS for all REST API endpoints
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const api = express.Router();

// Health check
api.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'verify.et Ethiopian Payment Verification Gateway & REST API',
    banksSupported: ['cbe', 'awash', 'ebirr'],
    version: '1.2.0',
    timestamp: new Date().toISOString(),
  });
});

// Primary Verify Handler for both /api/verify and /api/v1/verify
const handleVerification = async (req: Request, res: Response) => {
  const targetUrl = (req.body.receiptUrl || req.body.url || req.body.link || '').trim();
  const rawBank = (req.body.bank || '').toLowerCase();
  const bank: SupportedBank | 'auto' | undefined =
    rawBank === 'cbe' || rawBank === 'awash' || rawBank === 'ebirr' || rawBank === 'auto'
      ? rawBank
      : undefined;

  const expectedAmountEtb =
    req.body.expectedAmountEtb !== undefined
      ? parseFloat(req.body.expectedAmountEtb)
      : req.body.expectedAmount !== undefined
      ? parseFloat(req.body.expectedAmount)
      : req.body.amount !== undefined
      ? parseFloat(req.body.amount)
      : undefined;

  const merchantAccount = (req.body.merchantAccount || req.body.account || '').trim() || undefined;
  const orderReference = (req.body.orderReference || req.body.orderId || '').trim() || undefined;
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  if (!targetUrl) {
    res.status(400).json({
      success: false,
      status: 'INVALID_LINK',
      error: 'Invalid link',
    });
    return;
  }

  try {
    const result = await verifyPaymentLink({
      receiptUrl: targetUrl,
      bank,
      expectedAmountEtb: !isNaN(expectedAmountEtb as number) ? expectedAmountEtb : undefined,
      merchantAccount,
      orderReference,
      clientIp,
      source: 'API_GATEWAY',
    } as any);

    res.json(result);
  } catch (_err: any) {
    res.status(400).json({
      success: false,
      status: 'INVALID_LINK',
      error: 'Invalid link',
    });
  }
};

api.post('/verify', handleVerification);
api.post('/scrape', handleVerification);

// Webhook simulation endpoint
api.post('/webhook/simulate', (req: Request, res: Response) => {
  const { webhookUrl, event, verificationId } = req.body;

  if (!webhookUrl) {
    res.status(400).json({ delivered: false, error: 'Missing webhookUrl parameter' });
    return;
  }

  const signature = `sha256=${crypto
    .createHmac('sha256', 'epv_whsec_secret_key_ethiopay_2026')
    .update(JSON.stringify({ event, verificationId, timestamp: Date.now() }))
    .digest('hex')}`;

  const eventName = event || 'payment.verified';
  const deliveredAt = new Date().toISOString();

  res.json({
    delivered: true,
    statusCode: 200,
    message: `Webhook event '${eventName}' successfully dispatched to ${webhookUrl} (Simulated HTTP 200 OK)`,
    signature,
    deliveredAt,
    event: eventName,
    verificationId: verificationId || 'ver_simulated_dispatch',
  });
});

// Audit Ledger API
api.get('/ledger', (_req: Request, res: Response) => {
  const records = getAuditLedger();
  res.json({
    success: true,
    count: records.length,
    records,
  });
});

api.delete('/ledger', (_req: Request, res: Response) => {
  const records = resetAuditLedger();
  res.json({
    success: true,
    message: 'Audit ledger and duplicate tracking history reset successfully.',
    count: records.length,
    records,
  });
});

// Parse HTML source fallback
api.post('/parse-html', (req: Request, res: Response) => {
  const { html, url, bank } = req.body;
  if (!html) {
    res.status(400).json({ success: false, error: 'Missing html string' });
    return;
  }

  const result = parseHtmlData(
    html,
    url || 'pasted-html-source',
    bank || 'Commercial Bank of Ethiopia (CBE)',
    200,
    1,
    new Date().toISOString()
  );

  res.json(result);
});

// Mount router on both /api/v1 and /api
app.use('/api/v1', api);
app.use('/api', api);

// Dev / Prod Vite Integration
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[verify.et] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[verify.et] Failed to start:', err);
  process.exit(1);
});
