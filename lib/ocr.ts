import Tesseract from 'tesseract.js'

export type LineItem = {
  description: string
  price: string | null
}

export type OcrResult = {
  raw: string
  merchant: string | null
  date: string | null
  items: LineItem[]
  total: string | null
  currency: string | null
}

// ── Currency detection ────────────────────────────────────────────────────────

const CURRENCIES = [
  // ₹ OCR often misreads as: Rs, R$, T, T., F — catch all common variants
  { symbol: '₹', re: /₹|(?:Rs\.?\s*)|(?:\bINR\b)|(?:R\$\s*)/ },
  { symbol: '$', re: /\$|(?:\bUSD\b)/ },
  { symbol: '€', re: /€|(?:\bEUR\b)/ },
  { symbol: '£', re: /£|(?:\bGBP\b)/ },
  { symbol: '¥', re: /¥|(?:\bJPY\b)|(?:\bCNY\b)/ },
  { symbol: 'AED', re: /\bAED\b/ },
]

function detectCurrency(text: string): string {
  for (const { symbol, re } of CURRENCIES) {
    if (re.test(text)) return symbol
  }
  return '$'
}

// ── Amount regex ──────────────────────────────────────────────────────────────
// Handles: 1,00,000.50 | 1,250.00 | 100 | 12.5 (Indian + Western formatting)
const AMOUNT_CORE = '[\\d,]+(?:\\.\\d{1,2})?'
// Optional currency prefix — includes OCR misreads of ₹ (R$, Rs)
const CURR_PREFIX = '(?:₹|Rs\\.?\\s*|R\\$\\s*|INR\\s*|\\$|€|£|¥|AED\\s*)?'
const AMOUNT_RE   = new RegExp(`${CURR_PREFIX}(${AMOUNT_CORE})`)

// ── Public API ────────────────────────────────────────────────────────────────

export async function runOcr(imageUrl: string): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(imageUrl, 'eng')
  return parseReceiptText(data.text)
}

export function parseReceiptText(text: string): OcrResult {
  const currency = detectCurrency(text)
  const lines    = text.split('\n').map(l => l.trim()).filter(Boolean)
  const total    = findTotal(text, currency)

  return {
    raw:      text,
    merchant: findMerchant(lines),
    date:     findDate(text),
    total,
    items:    findItems(lines, total, currency),
    currency,
  }
}

// ── Merchant ──────────────────────────────────────────────────────────────────

const SKIP_LINE_RE = [
  /^\d+$/,                                        // purely numeric
  /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/,         // date
  /^\+?\d[\d\s\-().]{7,}$/,                       // phone number
  /^(gst|gstin|pan|cin|tel|ph|fax|www\.|http|invoice|receipt|bill|tax\s)/i,
  /^[#*\-=_|]+$/,                                 // decorative separators
  /^\d{2}:\d{2}/,                                 // time
]

function findMerchant(lines: string[]): string | null {
  for (const line of lines) {
    if (line.length < 3) continue
    if (SKIP_LINE_RE.some(re => re.test(line))) continue
    return line
  }
  return lines[0] ?? null
}

// ── Date ──────────────────────────────────────────────────────────────────────

const MONTH = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?'

const DATE_PATTERNS = [
  // 01 Jan 2024 / 1 January 2024
  new RegExp(`\\b(\\d{1,2})\\s+(${MONTH})\\s+(\\d{2,4})\\b`, 'i'),
  // Jan 01, 2024 / January 1 2024
  new RegExp(`\\b(${MONTH})\\s+(\\d{1,2}),?\\s+(\\d{2,4})\\b`, 'i'),
  // YYYY-MM-DD / YYYY/MM/DD (ISO-ish)
  /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/,
  // DD/MM/YYYY or DD-MM-YYYY — most common in India
  /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/,
  // DD.MM.YYYY
  /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/,
]

function findDate(text: string): string | null {
  for (const re of DATE_PATTERNS) {
    const m = text.match(re)
    if (m) return m[0]
  }
  return null
}

// ── Total ─────────────────────────────────────────────────────────────────────

// Most specific keywords first to avoid matching "subtotal" instead of "grand total"
const TOTAL_KEYWORDS = [
  'grand\\s+total',
  'net\\s+total',
  'net\\s+amount',
  'total\\s+amount',
  'amount\\s+payable',
  'amount\\s+due',
  'total\\s+due',
  'total\\s+payable',
  'final\\s+total',
  'bill\\s+amount',
  'bill\\s+total',
  'payable',
  'subtotal',
  'total',
]

function findTotal(text: string, currency: string): string | null {
  for (const kw of TOTAL_KEYWORDS) {
    // keyword : amount  →  e.g. "Grand Total: ₹1,250.00" or "Total  1250"
    const re = new RegExp(`${kw}[:\\s]*${CURR_PREFIX}(${AMOUNT_CORE})`, 'i')
    const m  = text.match(re)
    if (m?.[1]) return `${currency}${m[1]}`

    // amount  keyword  →  e.g. "1,250.00  TOTAL"
    const reBefore = new RegExp(`${CURR_PREFIX}(${AMOUNT_CORE})\\s+${kw}`, 'i')
    const mb       = text.match(reBefore)
    if (mb?.[1]) return `${currency}${mb[1]}`
  }
  return null
}

// ── Line items ────────────────────────────────────────────────────────────────

// Lines containing these keywords are taxes/fees/totals, not purchasable items
const NOT_ITEM_RE = /total|subtotal|grand|payable|tax\b|gst|sgst|cgst|igst|vat|cess|service\s+charge|discount|rounding|round\s+off/i

function findItems(lines: string[], total: string | null, currency: string): LineItem[] {
  const items: LineItem[] = []
  // Strip currency and commas for comparison
  const totalDigits = total ? total.replace(/[^\d.]/g, '') : null

  for (const line of lines) {
    if (NOT_ITEM_RE.test(line)) continue
    const m = line.match(AMOUNT_RE)
    if (!m) continue
    const amount = m[1]
    // Skip if this amount matches the total
    if (totalDigits && amount.replace(/,/g, '') === totalDigits.replace(/,/g, '')) continue
    const description = line.replace(AMOUNT_RE, '').replace(/\s+/g, ' ').trim()
    if (description.length < 2) continue
    items.push({ description, price: `${currency}${amount}` })
  }

  return items
}
