# EthioPayVerify: Ethiopian Payment Verification Gateway & API

An automated receipt verification platform and developer REST API designed for Ethiopian merchants, e-commerce stores, and developers to verify payment receipt links from **Commercial Bank of Ethiopia (CBE)**, **Awash Bank**, and **eBirr / Telebirr**, preventing fraud and duplicate payment claims.

## User Review & Critical Decisions

> [!IMPORTANT]
> The platform focuses on Ethiopian banking rails requested: **CBE**, **Awash Bank**, and **eBirr**. It includes both a live merchant verification UI and an automated REST API with simulated bank gateways and live link parsing.

- **Confirmed Supported Banks**: Commercial Bank of Ethiopia (CBE Mobile / CBE Birr), Awash Bank (Awash Birr / Internet Banking), and eBirr (Telebirr & eBirr mobile wallets).
- **Core Verification Methodology**:
  1. *Link Domain & SSL Authenticity*: Strict whitelist validation (e.g. `apps.cbe.com.et`, `awashbirr.com`, `ebirr.com`) to instantly reject phishing clones.
  2. *Live Receipt Parser & Scraper*: Backend parser that extracts transaction reference (FT/TXN ID), payer details, recipient merchant account, exact amount in Ethiopian Birr (ETB), and timestamp.
  3. *Duplicate Prevention Ledger*: Tracks verified transaction IDs to alert merchants against replay attacks and double-spending.
- **Developer API**: Full `/api/v1/verify` endpoint with API key authentication, request/response payload inspector, interactive cURL/SDK playground, and webhook simulator.

---

## 1. Overview & Core Concept

### What It Does
When an Ethiopian customer buys a product or service online, they often pay via bank transfer or mobile wallet and send a receipt link or screenshot. **EthioPayVerify** provides:
- A **Web Portal** where merchants can paste a payment receipt link, select the bank (or allow auto-detection), and instantly receive verified payment proof.
- A **REST API Gateway** (`POST /api/v1/verify`) that automated checkouts, Telegram bots, and web apps can call programmatically to verify payments in milliseconds.
- **Anti-Fraud Security**: Detects fake/tampered links, modified query parameters, spoofed domains, and duplicate submissions.

### Target Audience & Persona
- **E-Commerce & Digital Merchants** in Ethiopia (selling on Telegram, Shopify, WooCommerce, or custom sites).
- **Developers & Tech Startups** needing programmatic settlement confirmation without complex individual bank integrations.
- **Finance & Operations Teams** tracking reconciliations across CBE, Awash, and eBirr.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Instant Link Verification**:
   - User pastes a payment link (or clicks one of the provided one-click realistic sample links).
   - The system auto-detects the provider (CBE, Awash, or eBirr) and parses the reference ID.
   - The user clicks **"Verify Payment"**. An inspection modal/card renders showing verification badge (`VERIFIED`, `SUSPICIOUS`, or `DUPLICATE`), verified amount (e.g. `2,450.00 ETB`), payer name, recipient account, reference number, and security audit breakdown.
2. **Developer API & Playground**:
   - Developers switch to the **Developer Hub** tab.
   - Interactive request builder: set API key, method, payload (`bank`, `receipt_url`, `expected_amount`, `merchant_id`).
   - Live execution returns formatted JSON response, latency metrics, and cURL / Node.js / Python snippets.
3. **Audit Ledger & Reconciliation**:
   - Filterable transaction ledger showing historical verifications, status badges, timestamps, amounts, and one-click JSON export.

### Visual Identity & Theme
- **Aesthetic Direction**: High-trust fintech workstation inspired by modern enterprise payment infrastructure (clean dark slate canvas `#0B0F19` with subtle deep slate surfaces `#111827`, border hairline `#1F2937`, and crisp emerald `#10B981` / gold `#F59E0B` status accents).
- **Typography & Hierarchy**:
  - Display & Headings: `Plus Jakarta Sans` for clean, modern structure.
  - Body Prose: `DM Sans` for high legibility at 13px–15px.
  - Data & Financial Numerals: `JetBrains Mono` / `tabular-nums` for all ETB currency values, transaction reference IDs, and timestamps.
- **Layout Presence**: Full 1440px desktop workspace with top navigation contract (Brand wordmark, views navigation, API Docs button), split-screen verification workbench, quick-load test samples, and real-time transaction ledger.

---

## 3. Key Product Decisions & Trade-Offs

- **Hybrid Parser & Mock Fallback**:
  - *Chosen Approach*: Real server-side HTTP fetch and HTML parser for publicly accessible bank receipt links, paired with a high-fidelity synthetic verification engine with pre-seeded realistic test transactions for private intranet bank links.
  - *Why*: Ethiopian bank receipt links sometimes require local telecom networks or captcha; providing robust regex/DOM extraction plus an intelligent sandbox ensures the demo is 100% testable and production-ready.
- **Anti-Double-Spend Database**:
  - *Chosen Approach*: In-memory / localStorage persistent state storing verified transaction references and timestamps.
  - *Why*: Protects merchants from the most common Ethiopian e-commerce scam (submitting the same 500 ETB receipt to multiple orders).
- **Zero Pill / Anti-AI-Slop Compliance**:
  - *Chosen Approach*: Unboxed metadata with clean typographic dividers (`·`), tabular numerals, and no spurious status dots.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    EthioPayVerify Frontend                  │
│   ┌────────────────────┬─────────────────┬──────────────┐   │
│   │ Instant Verifier   │ Developer API   │ Audit Ledger │   │
│   │ Workbench          │ Playground      │ & Analytics  │   │
│   └─────────┬──────────┴────────┬────────┴──────┬───────┘   │
└─────────────┼───────────────────┼───────────────┼───────────┘
              │                   │               │
              ▼                   ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Express Backend API Proxy                  │
│                                                             │
│   POST /api/v1/verify                                       │
│   ├── 1. Domain Whitelist & URL Sanitizer                   │
│   ├── 2. Bank Detector (CBE | Awash | eBirr)                │
│   ├── 3. Link Parser / Receipt Scraper                      │
│   ├── 4. Duplicate Check & Fraud Rule Engine                │
│   └── 5. Response Builder (Standardized JSON payload)       │
│                                                             │
│   GET /api/v1/transactions (History & Ledger)               │
│   POST /api/v1/webhook/simulate (Webhook Dispatcher)        │
└─────────────────────────────────────────────────────────────┘
```

### Core Entities & Data Model
- **VerificationRequest**:
  - `bank`: `'cbe' | 'awash' | 'ebirr' | 'auto'`
  - `receipt_url`: string
  - `expected_amount_etb`?: number
  - `merchant_account`?: string
- **VerificationResult**:
  - `verification_id`: string (`ver_xxx`)
  - `status`: `'VERIFIED' | 'SUSPICIOUS_DOMAIN' | 'AMOUNT_MISMATCH' | 'DUPLICATE_CLAIM' | 'UNRESOLVED'`
  - `bank`: `'cbe' | 'awash' | 'ebirr'`
  - `transaction_reference`: string (e.g. `FT24098XQ71`, `AW20260481`, `EBIRR981203`)
  - `amount`: number
  - `currency`: `'ETB'`
  - `payer`: `{ name: string, phone_masked: string }`
  - `recipient`: `{ account_or_till: string, name: string }`
  - `timestamp`: string (ISO 8601 & Ethiopian local time)
  - `raw_link_domain`: string
  - `security_checks`: `{ domain_authentic: boolean, ssl_verified: boolean, is_duplicate: boolean, amount_matched: boolean }`

### Verification Sequence
1. User or API client submits receipt link.
2. Server validates URL syntax and cross-references against official bank hostname patterns.
3. If valid, extracts payload parameters or fetches live confirmation page to parse verified fields.
4. Validates against duplicate ledger; if reference exists with earlier timestamp, flags `DUPLICATE_CLAIM`.
5. Returns normalized verification payload and saves record to the merchant audit ledger.
