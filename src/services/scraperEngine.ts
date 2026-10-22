import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

export interface VerifiedField {
  key: string;
  value: string;
}

export interface VerifiedPaymentData {
  success: boolean;
  url: string;
  bankDetected: string;
  httpStatus?: number;
  responseTimeMs: number;
  verifiedAt: string;
  error?: string;
  extracted: {
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
  verifiedFields: VerifiedField[];
  pageTitle?: string;
  rawTextPreview?: string;
}

export function detectBank(url: string, declaredBank?: string): string {
  if (declaredBank && declaredBank !== 'auto') {
    if (declaredBank.toLowerCase() === 'cbe') return 'Commercial Bank of Ethiopia (CBE)';
    if (declaredBank.toLowerCase() === 'awash') return 'Awash Bank';
    if (declaredBank.toLowerCase() === 'ebirr') return 'eBirr / CooPay';
    return declaredBank.toUpperCase();
  }
  const lower = url.toLowerCase();
  if (lower.includes('ebirr') || lower.includes('telebirr') || lower.includes('coopay')) {
    return 'eBirr / CooPay';
  }
  if (lower.includes('awash')) {
    return 'Awash Bank';
  }
  if (lower.includes('cbe.com.et') || lower.includes('mbreciept') || lower.includes('commercial bank')) {
    return 'Commercial Bank of Ethiopia (CBE)';
  }
  return 'Ethiopian Banking Rail';
}

/**
 * Primary Payment Verification Function
 * Verifies links for CBE, Awash Bank, and eBirr/CooPay.
 * Enforces a 3-second wait for CBE receipt links to match CBE's loading screen buffer.
 */
export async function verifyPaymentLink(
  targetUrl: string,
  declaredBank?: string
): Promise<VerifiedPaymentData> {
  let cleanUrl = targetUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  const startTime = Date.now();
  const bankDetected = detectBank(cleanUrl, declaredBank);
  const verifiedAt = new Date().toISOString();

  // Validate URL structure
  try {
    const testUrl = new URL(cleanUrl);
    if (!testUrl.hostname || !testUrl.protocol.startsWith('http')) {
      throw new Error('Invalid URL');
    }
  } catch {
    return {
      success: false,
      url: cleanUrl,
      bankDetected,
      httpStatus: 400,
      responseTimeMs: 0,
      verifiedAt,
      error: 'Invalid link',
      extracted: {
        transactionId: null,
        amount: null,
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
      verifiedFields: [{ key: 'Status', value: 'Invalid link' }],
      rawTextPreview: 'Invalid link',
    };
  }

  const isCbe =
    (cleanUrl.includes('cbe.com.et') || cleanUrl.includes('mbreciept') || declaredBank === 'cbe') &&
    !cleanUrl.includes('ebirr.com');

  // If tokenId is present for CBE, query direct backend API immediately without waiting
  if (isCbe && !cleanUrl.includes('v2-') && !cleanUrl.includes('mbreciept')) {
    // Brief buffer for SPA loading screen when scraping HTML
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  // 1. Specialized CBE Verification:
  // CBE's new portal uses `https://mbreciept.cbe.com.et/:tokenId` (e.g. v2-hfHCxHAqvXfu4MrwyHc1)
  // which queries CBE's backend API at `https://Mb.cbe.com.et/api/v1/transactions/public/transaction-detail/:tokenId`
  if (isCbe) {
    try {
      let tokenId = '';
      try {
        const parsed = new URL(cleanUrl);
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          tokenId = pathParts[pathParts.length - 1];
        }
      } catch {
        const m = cleanUrl.match(/\b(v2-[A-Za-z0-9_-]+)\b/);
        if (m) tokenId = m[1];
      }

      if (tokenId && (tokenId.startsWith('v2-') || cleanUrl.includes('mbreciept.cbe.com.et'))) {
        const cbeApiUrl = `https://Mb.cbe.com.et/api/v1/transactions/public/transaction-detail/${tokenId}`;
        const cbeRes = await axios.get(cbeApiUrl, {
          headers: {
            'X-App-ID': 'd1292e42-7400-49de-a2d3-9731caa4c819',
            'X-App-Version': '0a01980b-9859-1369-8198-59f403820000',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
          },
          timeout: 12000,
          validateStatus: () => true,
        });

        if (cbeRes.status === 200 && cbeRes.data && (cbeRes.data.id || cbeRes.data.amountDebited || cbeRes.data.debitAmount)) {
          const c = cbeRes.data;
          const responseTimeMs = Date.now() - startTime;
          const verifiedFields: VerifiedField[] = [];

          const pushField = (key: string, value: any) => {
            if (value !== undefined && value !== null && String(value).trim() !== '') {
              verifiedFields.push({ key, value: String(value).trim() });
            }
          };

          const amt = c.amountCredited || c.debitAmount || c.amountDebited;
          const currency = c.debitCurrency || c.creditCurrency || 'ETB';
          const sender = c.debitAccountHolder || null;
          const senderAcc = c.debitAccountNo || null;
          const receiver = c.creditAccountHolder || null;
          const receiverAcc = c.creditAccountNo || null;
          const txDate = (c.dateTimes && c.dateTimes[0]) || c.processingDate || c.debitValueDate || null;
          const pMethod = `CBE Mobile Banking (${c.platformTransactionType || c.transactionType || 'Transfer'})`;
          const feeStr = c.totalChargeAmount ? `${c.totalChargeAmount} ETB` : c.serviceChargeValue || null;

          pushField('Transaction Reference (ID)', c.id);
          pushField('Settled / Credited Amount', `${amt} ${currency}`);
          if (c.amountDebited) pushField('Total Debited', `${c.amountDebited} ${currency}`);
          pushField('Sender (Debited Customer)', sender);
          pushField('Sender Account', senderAcc);
          pushField('Receiver (Credited Beneficiary)', receiver);
          pushField('Receiver Account', receiverAcc);
          pushField('Transaction Status', c.statusDesc || c.status || 'COMPLETED');
          pushField('Third Party Status', c.thirdPartyStatus);
          pushField('Transaction Date & Time', txDate);
          pushField('Payment Channel', c.channel || 'USSD / Mobile');
          pushField('Platform Transaction Type', c.platformTransactionType || c.transactionType);
          pushField('Payment Description', c.description || c.debitTheirRef);
          pushField('Service Charge', c.serviceChargeValue);
          pushField('VAT (15%)', c.vatValue);
          pushField('Disaster Recovery (5%)', c.drCharge);
          pushField('Charge Summary', c.chargeDescription);

          return {
            success: true,
            url: cleanUrl,
            bankDetected: 'Commercial Bank of Ethiopia (CBE)',
            httpStatus: 200,
            responseTimeMs,
            verifiedAt,
            extracted: {
              transactionId: c.id || null,
              amount: amt ? String(amt) : null,
              currency,
              status: c.statusDesc || c.status || 'COMPLETED',
              senderName: sender,
              senderAccountOrPhone: senderAcc,
              receiverName: receiver,
              receiverAccountOrTill: receiverAcc,
              date: txDate,
              paymentMethod: pMethod,
              fee: feeStr,
            },
            verifiedFields,
            pageTitle: 'CBE Mobile Banking Receipt Verification',
            rawTextPreview: `Commercial Bank of Ethiopia (CBE) Receipt Verified.\nReference ID: ${c.id}\nAmount: ${amt} ${currency}\nPayer: ${sender} (${senderAcc})\nBeneficiary: ${receiver} (${receiverAcc})\nStatus: ${c.statusDesc || c.status}\nDate: ${txDate}`,
          };
        }
      }
    } catch (cbeApiErr: any) {
      console.warn('[verify.et] CBE API direct fetch failed, trying standard fetch:', cbeApiErr.message);
    }
  }

  // 2. Standard HTTPS Request with Axios (Handles Awash Bank port 8225, eBirr, and general banking links)
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false, // Critical for Awash bank port 8225
    keepAlive: false,
  });

  try {
    const response = await axios.get(cleanUrl, {
      timeout: 5000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,am;q=0.8',
        'Connection': 'close',
      },
      httpsAgent,
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: () => true,
    });

    const responseTimeMs = Date.now() - startTime;
    const httpStatus = response.status;

    if (httpStatus >= 400) {
      return {
        success: false,
        url: cleanUrl,
        bankDetected,
        httpStatus,
        responseTimeMs,
        verifiedAt,
        error: 'Invalid link',
        extracted: {
          transactionId: null,
          amount: null,
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
        verifiedFields: [{ key: 'Status', value: 'Invalid link' }],
        rawTextPreview: 'Invalid link: Website cannot be accessed or receipt does not exist.',
      };
    }

    const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    // If response is JSON directly
    if (typeof response.data === 'object' && response.data !== null) {
      return parseJsonData(response.data, cleanUrl, bankDetected, httpStatus, responseTimeMs, verifiedAt);
    }
    try {
      const parsedJson = JSON.parse(html);
      return parseJsonData(parsedJson, cleanUrl, bankDetected, httpStatus, responseTimeMs, verifiedAt);
    } catch {
      // Proceed to HTML parsing
    }

    return parseHtmlData(html, cleanUrl, bankDetected, httpStatus, responseTimeMs, verifiedAt);
  } catch (_err: any) {
    const responseTimeMs = Date.now() - startTime;

    return {
      success: false,
      url: cleanUrl,
      bankDetected,
      httpStatus: 400,
      responseTimeMs,
      verifiedAt,
      error: 'Invalid link',
      extracted: {
        transactionId: null,
        amount: null,
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
      verifiedFields: [{ key: 'Status', value: 'Invalid link' }],
      rawTextPreview: 'Invalid link: Unable to connect to receipt website.',
    };
  }
}

/**
 * Parses receipt HTML into verified payment attributes
 */
export function parseHtmlData(
  html: string,
  url: string,
  bankDetected: string,
  httpStatus: number,
  responseTimeMs: number,
  verifiedAt: string
): VerifiedPaymentData {
  const $ = cheerio.load(html);

  // Extract embedded JSON from scripts before removing them
  const scriptJsonData: Record<string, any> = {};
  $('script').each((_, script) => {
    const content = $(script).html() || '';
    if (
      content.includes('__NUXT__') ||
      content.includes('__INITIAL_STATE__') ||
      content.includes('receipt') ||
      content.includes('transaction')
    ) {
      const jsonMatches = content.match(/\{[\s\S]*?\}/g);
      if (jsonMatches) {
        for (const jm of jsonMatches) {
          try {
            const parsed = JSON.parse(jm);
            if (typeof parsed === 'object' && parsed !== null) {
              Object.assign(scriptJsonData, parsed);
            }
          } catch {
            //
          }
        }
      }
    }
  });

  // Remove non-content elements
  $('script, style, noscript, svg').remove();

  const pageTitle = $('title').text().trim() || $('h1, h2').first().text().trim() || 'Receipt Details';
  const verifiedFields: VerifiedField[] = [];
  const fieldMap: Record<string, string> = {};

  const addField = (k: string, v: string) => {
    const key = k.trim().replace(/[:：]$/, '').trim();
    const val = v.trim();
    if (key && val && key.length < 90 && val.length < 350) {
      if (!fieldMap[key.toLowerCase()]) {
        fieldMap[key.toLowerCase()] = val;
        verifiedFields.push({ key, value: val });
      }
    }
  };

  // 1. Parse tables (handling 2-column, 3-column with ":" separator like Awash)
  $('table tr').each((_, row) => {
    const ths = $(row).find('th');
    const tds = $(row).find('td');

    if (ths.length >= 1 && tds.length >= 1) {
      addField($(ths[0]).text(), $(tds[0]).text());
    } else if (tds.length === 3) {
      const col0 = $(tds[0]).text().trim();
      const col1 = $(tds[1]).text().trim();
      const col2 = $(tds[2]).text().trim();
      if (col1 === ':' || col1 === '፡' || col1 === '') {
        if (col0 && col2) addField(col0, col2);
      } else {
        if (col0 && col1) addField(col0, col1);
      }
    } else if (tds.length === 2) {
      addField($(tds[0]).text(), $(tds[1]).text());
    }
  });

  // 2. Parse definition lists <dl>
  $('dl').each((_, dl) => {
    $(dl).find('dt').each((i, dt) => {
      const dd = $(dl).find('dd').eq(i);
      if (dd.length) {
        addField($(dt).text(), dd.text());
      }
    });
  });

  // 3. Parse div/flex rows
  $('.row, .item, .field, .detail-item, .receipt-row, .info-row, div[class*="detail"]').each((_, el) => {
    const children = $(el).children();
    if (children.length === 2) {
      addField($(children[0]).text(), $(children[1]).text());
    }
  });

  // 4. Raw text content
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const rawTextPreview = bodyText.substring(0, 1000);

  // URL parameters
  const urlParams = extractFromUrlOnly(url);
  for (const f of urlParams.verifiedFields) {
    addField(`URL Param: ${f.key}`, f.value);
  }

  const findValue = (keywords: string[]): string | null => {
    for (const kw of keywords) {
      for (const [k, v] of Object.entries(fieldMap)) {
        if (k.includes(kw.toLowerCase())) {
          return v;
        }
      }
    }
    return null;
  };

  // Structured Field Extraction:

  // 1. Transaction Reference / FT
  const receiptNoMatch = bodyText.match(
    /(?:RECEIPT NO|Receipt No\.?|የክፍያ ቁጥር\/Receipt No\.?)\s*[:：]?\s*([A-Za-z0-9_-]+)/i
  );
  const txnIdMatch = bodyText.match(/(?:Transaction ID|Trans ID|TXN ID|Ref No|FT No)\s*[:：]?\s*([A-Za-z0-9_-]+)/i);
  let transactionId =
    (receiptNoMatch ? receiptNoMatch[1] : null) ||
    (txnIdMatch ? txnIdMatch[1] : null) ||
    scriptJsonData.transactionId ||
    scriptJsonData.ft ||
    scriptJsonData.reference ||
    findValue([
      'transaction id',
      'trans id',
      'receipt no',
      'የክፍያ ቁጥር',
      'reference',
      'ref no',
      'txn id',
      'ft no',
      'voucher no',
    ]) ||
    urlParams.extracted.transactionId;

  if (!transactionId) {
    const ftMatch = bodyText.match(/\b(FT[0-9A-Z]{7,14}|AW[0-9A-Z]{7,14}|EB[0-9A-Z]{7,14})\b/i);
    if (ftMatch) transactionId = ftMatch[1].trim();
  }

  // 2. Amount
  const directAmountMatch =
    bodyText.match(/AMOUNT:\s*(?:ETB\s*)?([0-9,.]+)/i) ||
    bodyText.match(/(?:Total Amount Paid|ጠቅላላ የተክፈለ)\s*(?:ETB\s*)?([0-9,.]+)/i) ||
    bodyText.match(/Amount\s*[:：]\s*([0-9,.]+)/i);
  let amount = directAmountMatch ? directAmountMatch[1].trim() : null;
  if (!amount && scriptJsonData.amount) {
    amount = String(scriptJsonData.amount);
  }
  if (!amount) {
    amount = findValue(['amount', 'total amount paid', 'settled amount', 'ጠቅላላ የተክፈለ', 'የተከፈለው መጠን']);
  }
  if (!amount) {
    const amtFallback =
      bodyText.match(/(?:ETB|Birr)\s*([0-9,]+(?:\.\d{1,2})?)/i) ||
      bodyText.match(/([0-9,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr)/i);
    if (amtFallback) amount = amtFallback[1].trim();
  }
  if (!amount && urlParams.extracted.amount) {
    amount = urlParams.extracted.amount;
  }

  // 3. Sender Name
  const senderMatch =
    bodyText.match(
      /(?:Sender Name|የከፋይ ስም\/Sender Name)\s*[:：]?\s*([A-Za-z\s]+?)(?=\s+(?:የከፍይ|Sender|Ebirr|Customer|Ordinary|$))/i
    ) || bodyText.match(/(?:Customer Name)\s*[:：]\s*([A-Za-z\s]+?)(?=\s+(?:Account|Phone|Branch|TIN|$))/i);
  let senderName = senderMatch ? senderMatch[1].trim() : null;
  if (!senderName && (scriptJsonData.sender || scriptJsonData.payerName)) {
    senderName = scriptJsonData.sender || scriptJsonData.payerName;
  }
  if (!senderName) {
    senderName = findValue(['customer name', 'sender name', 'የከፋይ ስም', 'sender', 'from', 'debtor', 'payer name']);
  }

  // 4. Sender Account / Phone
  const senderPhoneMatch =
    bodyText.match(/(?:Sender Ebirr no\.|የከፍይ ኢ-ብር ቁጥር\.)\s*[:：]?\s*([0-9+]+)/i) ||
    bodyText.match(/Phone Number\s*[:：]\s*([0-9+]+)/i);
  let senderAccountOrPhone = senderPhoneMatch ? senderPhoneMatch[1].trim() : null;
  if (!senderAccountOrPhone) {
    senderAccountOrPhone = findValue([
      'phone number',
      'sender ebirr no',
      'የከፍይ ኢ-ብር ቁጥር',
      'source account',
      'from account',
      'sender phone',
    ]);
  }

  // 5. Receiver Name
  const receiverMatch =
    bodyText.match(
      /(?:Receiver name|ተቀባይ ስም\/Receiver name)\s*[:：]?\s*([A-Za-z\s]+?)(?=\s+(?:ተቀባይ|Receiver|Mobile|Account|$))/i
    ) || bodyText.match(/(?:Company Name)\s*[:：]\s*([A-Za-z\s]+?)(?=\s+(?:TIN|VAT|PO|Tel|$))/i);
  let receiverName = receiverMatch ? receiverMatch[1].trim() : null;
  if (!receiverName) {
    receiverName = findValue(['receiver name', 'ተቀባይ ስም', 'beneficiary name', 'company name', 'merchant', 'to']);
  }

  // 6. Receiver Account / Till
  const receiverPhoneMatch =
    bodyText.match(/(?:Receiver Account\/Mobile|ተቀባይ ሞባይል\.Receiver Account\/Mobile)\s*[:：]?\s*([0-9+]+)/i) ||
    bodyText.match(/(?:Source Account|Account No)\s*[:：]\s*([0-9A-Z*\/_-]+)/i);
  let receiverAccountOrTill = receiverPhoneMatch ? receiverPhoneMatch[1].trim() : null;
  if (!receiverAccountOrTill) {
    receiverAccountOrTill = findValue([
      'receiver account',
      'account no',
      'ተቀባይ ሞባይል',
      'source account',
      'till',
      'to account',
      'credit account',
    ]);
  }

  // 7. Date
  const dateMatch =
    bodyText.match(
      /DATE:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}(?:\s+[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\s*\+[0-9]+(?:\s*[A-Z]+)?)?)?)/i
    ) || bodyText.match(/Transaction Date\s*[:：]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  let date = dateMatch ? dateMatch[1].trim() : null;
  if (!date) {
    date = findValue(['transaction date', 'payment date', 'የክፍያ ቀን', 'date', 'time']);
  }

  // 8. Status
  const statusMatch = bodyText.match(/(?:transaction status|የክፍያው ሁኔታ\/transaction status)\s*[:：]?\s*([A-Za-z]+)/i);
  let status = statusMatch ? statusMatch[1].trim() : null;
  if (!status) {
    status = findValue(['transaction status', 'status', 'የክፍያው ሁኔታ', 'result']);
  }
  if (!status) {
    if (/completed|success|successful|confirmed/i.test(bodyText)) status = 'COMPLETED';
    else status = 'VERIFIED';
  }

  // 9. Fee / Charges
  const fee = findValue(['charge', 'vat', 'fee', 'ክፍያዎች /charges']) || null;

  // 10. Payment Method
  const paymentMethod = findValue(['payment mode', 'transaction type', 'payment channel', 'የክፍያ ዘዴ']) || bankDetected;

  // Validate that receipt data actually exists
  const hasReceiptData = Boolean(transactionId || amount);
  const isErrorOrNotFound =
    /404|not found|page not found|invalid|error|expired|does not exist/i.test(pageTitle) ||
    /page not found|404 not found|transaction not found|invalid transaction/i.test(bodyText.substring(0, 300));

  if (!hasReceiptData || isErrorOrNotFound) {
    return {
      success: false,
      url,
      bankDetected,
      httpStatus: 400,
      responseTimeMs,
      verifiedAt,
      error: 'Invalid link',
      extracted: {
        transactionId: null,
        amount: null,
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
      verifiedFields: [{ key: 'Status', value: 'Invalid link' }],
      pageTitle: pageTitle || 'Invalid link',
      rawTextPreview: 'Invalid link',
    };
  }

  return {
    success: true,
    url,
    bankDetected,
    httpStatus,
    responseTimeMs,
    verifiedAt,
    extracted: {
      transactionId: transactionId || null,
      amount: amount || null,
      currency: 'ETB',
      status: status || 'VERIFIED',
      senderName: senderName || null,
      senderAccountOrPhone: senderAccountOrPhone || null,
      receiverName: receiverName || null,
      receiverAccountOrTill: receiverAccountOrTill || null,
      date: date || null,
      paymentMethod,
      fee,
    },
    verifiedFields,
    pageTitle,
    rawTextPreview,
  };
}

function parseJsonData(
  data: any,
  url: string,
  bankDetected: string,
  httpStatus: number,
  responseTimeMs: number,
  verifiedAt: string
): VerifiedPaymentData {
  if (!data || typeof data !== 'object') {
    return {
      success: false,
      url,
      bankDetected,
      httpStatus: 400,
      responseTimeMs,
      verifiedAt,
      error: 'Invalid link',
      extracted: {
        transactionId: null,
        amount: null,
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
      verifiedFields: [{ key: 'Status', value: 'Invalid link' }],
      pageTitle: 'Invalid Link',
      rawTextPreview: 'Invalid link',
    };
  }

  const txnId = data.transactionId || data.ref || data.reference || data.ft || data.id || null;
  const amt = data.amount ? String(data.amount) : null;

  if (!txnId && !amt) {
    return {
      success: false,
      url,
      bankDetected,
      httpStatus: 400,
      responseTimeMs,
      verifiedAt,
      error: 'Invalid link',
      extracted: {
        transactionId: null,
        amount: null,
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
      verifiedFields: [{ key: 'Status', value: 'Invalid link' }],
      pageTitle: 'Invalid Link',
      rawTextPreview: 'Invalid link',
    };
  }
  const verifiedFields: VerifiedField[] = [];

  const flatten = (obj: any, prefix = '') => {
    for (const [key, val] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof val === 'object' && val !== null) {
        flatten(val, fullKey);
      } else {
        verifiedFields.push({ key: fullKey, value: String(val) });
      }
    }
  };

  flatten(data);

  return {
    success: true,
    url,
    bankDetected,
    httpStatus,
    responseTimeMs,
    verifiedAt,
    extracted: {
      transactionId: data.transactionId || data.ref || data.reference || data.ft || data.id || null,
      amount: data.amount ? String(data.amount) : null,
      currency: data.currency || 'ETB',
      status: data.status || 'VERIFIED',
      senderName: data.sender || data.payer?.name || null,
      senderAccountOrPhone: data.payer?.phone || data.senderAccount || null,
      receiverName: data.receiver || data.merchant?.name || null,
      receiverAccountOrTill: data.receiverAccount || data.merchant?.account || null,
      date: data.date || data.timestamp || null,
      paymentMethod: data.method || bankDetected,
      fee: data.fee ? String(data.fee) : null,
    },
    verifiedFields,
    pageTitle: 'JSON Response',
    rawTextPreview: JSON.stringify(data, null, 2).substring(0, 1000),
  };
}

export function extractFromUrlOnly(rawUrl: string): {
  extracted: VerifiedPaymentData['extracted'];
  verifiedFields: VerifiedField[];
} {
  const verifiedFields: VerifiedField[] = [];
  let transactionId: string | null = null;
  let amount: string | null = null;

  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    parsed.searchParams.forEach((val, key) => {
      verifiedFields.push({ key, value: val });

      if (['ft', 'ref', 'txn', 'tx', 'reference', 'id', 'transid'].includes(key.toLowerCase())) {
        transactionId = val;
      }
      if (['amt', 'amount', 'total', 'settled'].includes(key.toLowerCase())) {
        amount = val;
      }
    });

    if (!transactionId) {
      const match = rawUrl.match(/\b(FT[0-9A-Z]{7,14}|AW[0-9A-Z]{7,14}|EB[0-9A-Z]{7,14})\b/i);
      if (match) transactionId = match[1].toUpperCase();
    }
  } catch {
    //
  }

  return {
    extracted: {
      transactionId,
      amount,
      currency: 'ETB',
      status: null,
      senderName: null,
      senderAccountOrPhone: null,
      receiverName: null,
      receiverAccountOrTill: null,
      date: null,
      paymentMethod: null,
      fee: null,
    },
    verifiedFields,
  };
}

// Backward-compatible aliases
export const scrapePaymentLink = verifyPaymentLink;
export type ScrapedPaymentData = VerifiedPaymentData;
export type ScrapedField = VerifiedField;
