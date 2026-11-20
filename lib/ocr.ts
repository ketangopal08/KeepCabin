import Tesseract from 'tesseract.js'
import type { ExpenseCategory } from './supabase'

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
  /** Numeric grand total (e.g. 1250.5), ready for a number input */
  amount: number | null
  /** Receipt date normalised to YYYY-MM-DD, ready for a date input */
  isoDate: string | null
  /** Category guessed from merchant / keywords on the receipt */
  category: ExpenseCategory | null
  /** True when the amount is confirmed by subtotal + charges + tax − discount arithmetic */
  amountVerified: boolean
  /** Total GST / tax on the receipt (CGST + SGST + IGST + cess …), when listed */
  taxAmount: number | null
  /** Seller GSTIN, only when it passes the GSTIN checksum */
  gstin: string | null
  /** Mean Tesseract confidence (0–100) of the pass used; null when parsing stored text */
  confidence: number | null
}

export type RunOcrOptions = {
  /** Optional diagnostics hook (pass timings, confidences, fallbacks) */
  debug?: (message: string, data?: unknown) => void
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
  // Indian receipts (GST / GSTIN / CGST …) without a readable ₹ sign
  if (/\b(c|s|i|ut)?gst(in)?\b|\bhsn\b|\bpaise\b/i.test(text)) return '₹'
  return '$'
}

// ── Amount regex ──────────────────────────────────────────────────────────────
// Handles: 1,00,000.50 | 1,250.00 | 100 | 12.5 (Indian + Western formatting)
const AMOUNT_CORE = '[\\d,]+(?:\\.\\d{1,2})?'
// Optional currency prefix — includes OCR misreads of ₹ (R$, Rs)
const CURR_PREFIX = '(?:₹|Rs\\.?\\s*|R\\$\\s*|INR\\s*|\\$|€|£|¥|AED\\s*)?'
const AMOUNT_RE   = new RegExp(`${CURR_PREFIX}(${AMOUNT_CORE})`)

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * OCR a receipt image (blob:, data: or http(s) URL) in the browser.
 * Pipeline: canvas preprocessing → Tesseract pass 1 (grayscale) → optional
 * pass 2 (adaptive binarisation, different page segmentation) only when pass 1
 * looks weak. Any failure falls back to a plain `Tesseract.recognize`.
 */
export async function runOcr(imageUrl: string, options: RunOcrOptions = {}): Promise<OcrResult> {
  const debug = options.debug
  let prepared: PreparedImage
  try {
    prepared = await prepareImage(imageUrl)
  } catch (e) {
    debug?.('preprocess failed, using original image', e)
    prepared = { primary: imageUrl, secondary: null }
  }
  try {
    return await recognizeReceipt(prepared.primary, prepared.secondary, options, imageUrl)
  } catch (e) {
    debug?.('multi-pass OCR failed, falling back to Tesseract.recognize', e)
    const { data } = await Tesseract.recognize(imageUrl, 'eng', { errorHandler: (err: unknown) => debug?.('tesseract error', err) })
    return { ...parseReceiptText(data.text), confidence: data.confidence ?? null }
  }
}

export function parseReceiptText(text: string): OcrResult {
  const currency = detectCurrency(text)
  const lines    = text.split('\n').map(l => l.trim()).filter(Boolean)
  const money    = analyseAmounts(lines, text)
  const best     = money.amount
  const total    = best ? `${currency}${best.raw}` : null
  const date     = findDate(lines)

  return {
    raw:      text,
    merchant: findMerchant(lines, text),
    date:     date?.raw ?? null,
    total,
    items:    findItems(lines, total, currency),
    currency,
    amount:   best?.value ?? null,
    isoDate:  date?.iso ?? null,
    category: detectCategory(text),
    amountVerified: money.verified,
    taxAmount: money.tax,
    gstin:    findGstin(text),
    confidence: null,
  }
}

// ── Recognition (multi-pass, single worker) ──────────────────────────────────

type PassResult = { result: OcrResult, score: number, weak: boolean, ms: number }

const OUTPUT: Partial<Tesseract.OutputFormats> = { text: true, blocks: true, hocr: false, tsv: false }

/**
 * Runs up to two Tesseract passes on one worker. `secondary` (a lazily built,
 * differently preprocessed image) is only used when the first pass looks weak.
 * If pass 1 read almost nothing, pass 2 uses the untouched `original` instead,
 * so preprocessing can never make a receipt unreadable.
 * Exported so the same logic can be exercised outside the browser.
 */
export async function recognizeReceipt(
  primary: Tesseract.ImageLike,
  secondary: (() => Promise<Tesseract.ImageLike | null>) | null,
  options: RunOcrOptions = {},
  original: Tesseract.ImageLike | null = null,
): Promise<OcrResult> {
  const debug = options.debug
  // errorHandler: report worker errors through the rejected promise only
  // (without it tesseract.js also throws an uncaught error)
  const worker = await Tesseract.createWorker('eng', 1, { errorHandler: (e: unknown) => debug?.('tesseract error', e) })
  try {
    const pass = async (image: Tesseract.ImageLike, psm: string, label: string): Promise<PassResult> => {
      const t0 = Date.now()
      await worker.setParameters({
        tessedit_pageseg_mode: psm as Tesseract.PSM,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      })
      const { data } = await worker.recognize(image, { rotateAuto: true }, OUTPUT)
      const text = layoutText(data)
      const result = { ...parseReceiptText(text), confidence: Math.round(data.confidence ?? 0) }
      const out = { result, score: scoreResult(result), weak: isWeak(result), ms: Date.now() - t0 }
      debug?.(`pass ${label}`, { psm, ms: out.ms, confidence: result.confidence, score: out.score, weak: out.weak, amount: result.amount, verified: result.amountVerified, isoDate: result.isoDate })
      return out
    }

    let first: PassResult
    try {
      first = await pass(primary, '4', '1 (enhanced, PSM 4)')
    } catch (e) {
      // Preprocessed image unreadable → same settings on the original image
      if (!original || original === primary) throw e
      debug?.('pass 1 failed on preprocessed image, retrying original', e)
      first = await pass(original, '4', '1 (original image, PSM 4)')
      primary = original
      secondary = null
    }
    if (!first.weak) return first.result

    try {
      const nearlyEmpty = first.result.raw.replace(/[^A-Za-z]/g, '').length < 20
      if (nearlyEmpty && original && original !== primary) {
        return mergePasses(first, await pass(original, '3', '2 (original image, PSM 3)'))
      }
      let image: Tesseract.ImageLike | null = null
      try { image = secondary ? await secondary() : null } catch (e) { debug?.('secondary preprocess failed', e) }
      // Without a second image, retry the same one with automatic page segmentation
      const second = image
        ? await pass(image, '6', '2 (binarised, PSM 6)')
        : await pass(primary, '3', '2 (same image, PSM 3)')
      return mergePasses(first, second)
    } catch (e) {
      debug?.('pass 2 failed, keeping pass 1', e)
      return first.result
    }
  } finally {
    await worker.terminate().catch(() => undefined)
  }
}

// Pass 1 is good enough when amount and date were found, confidence is decent
// and — if the receipt itemises subtotal/tax/charges — the arithmetic checks out.
function isWeak(r: OcrResult): boolean {
  const itemised = /sub\s*-?\s*tota|item\s*tota|taxable|\b[cs]gst\b|discount|delivery\s*charge/i.test(r.raw)
  return (r.confidence ?? 0) < 70 || r.amount === null || r.isoDate === null || (itemised && !r.amountVerified)
}

function scoreResult(r: OcrResult): number {
  return (r.amount !== null ? 3 : 0) + (r.amountVerified ? 3 : 0) + (r.isoDate ? 2 : 0)
    + (r.merchant ? 1 : 0) + (r.category ? 0.5 : 0) + (r.confidence ?? 0) / 50
}

function mergePasses(a: PassResult, b: PassResult): OcrResult {
  const [best, other] = b.score > a.score ? [b.result, a.result] : [a.result, b.result]
  // Keep the better pass whole (raw text stays consistent with its fields);
  // only fill fields it could not read from the other pass.
  const merged: OcrResult = { ...best }
  if (merged.amount === null && other.amount !== null) {
    merged.amount = other.amount; merged.total = other.total; merged.amountVerified = other.amountVerified
  }
  if (!merged.isoDate && other.isoDate) { merged.isoDate = other.isoDate; merged.date = other.date }
  if (!merged.merchant && other.merchant) merged.merchant = other.merchant
  if (!merged.category && other.category) merged.category = other.category
  if (!merged.gstin && other.gstin) merged.gstin = other.gstin
  if (merged.taxAmount === null && other.taxAmount !== null) merged.taxAmount = other.taxAmount
  return merged
}

type BBox = { x0: number, y0: number, x1: number, y1: number }

// Rebuild the text row by row from Tesseract's line boxes, so a label and its
// amount stay on one line even when Tesseract puts them in different blocks
// (e.g. "Grand Total:" on the left, "₹73" far right).
export function layoutText(page: { text: string, lines?: { text: string, bbox: BBox }[] | null }): string {
  const lines = (page.lines ?? []).filter(l => l.text.trim())
  if (lines.length < 2) return page.text
  const sorted = [...lines].sort((a, b) => (a.bbox.y0 + a.bbox.y1) - (b.bbox.y0 + b.bbox.y1))
  const rows: { y0: number, y1: number, parts: { x: number, text: string }[] }[] = []
  for (const l of sorted) {
    const h = l.bbox.y1 - l.bbox.y0
    const row = rows.find((r) => {
      const overlap = Math.min(r.y1, l.bbox.y1) - Math.max(r.y0, l.bbox.y0)
      return overlap > 0.5 * Math.min(h, r.y1 - r.y0)
        && r.parts.every(p => p.x !== l.bbox.x0)
    })
    const part = { x: l.bbox.x0, text: l.text.replace(/\s+$/, '') }
    if (row) {
      row.parts.push(part)
      row.y0 = Math.min(row.y0, l.bbox.y0)
      row.y1 = Math.max(row.y1, l.bbox.y1)
    } else {
      rows.push({ y0: l.bbox.y0, y1: l.bbox.y1, parts: [part] })
    }
  }
  return rows
    .sort((a, b) => a.y0 - b.y0)
    .map(r => r.parts.sort((a, b) => a.x - b.x).map(p => p.text.trim()).join('   '))
    .join('\n')
}

// ── Image pre-processing ──────────────────────────────────────────────────────
// Phone photos of receipts are often small, low-contrast, tinted or unevenly
// lit. Pass 1 uses an upscaled, contrast-normalised grayscale image; pass 2
// (only when needed) uses a locally-thresholded black/white version.
// Any failure (no DOM, CORS-tainted canvas, decode error) falls back to the
// original URL so OCR still runs exactly as before.

type PreparedImage = {
  primary: Tesseract.ImageLike
  secondary: (() => Promise<Tesseract.ImageLike | null>) | null
}

/** Glyph height (px) Tesseract reads best at — roughly a 30px capital letter */
const TARGET_TEXT_HEIGHT = 26
/** Keep canvases well under mobile Safari's ~16.7 MP limit */
const MAX_PIXELS = 12_000_000

/**
 * Scale factor for OCR: bring the measured glyph height to ~30px (upscaling
 * small screenshots, downscaling huge photos). Without a measurement, falls
 * back to sizing the longest side to 1800–3000px.
 */
export function chooseScale(width: number, height: number, textHeight: number | null): number {
  if (!width || !height) return 1
  const longest = Math.max(width, height)
  let scale = textHeight
    ? Math.min(Math.max(TARGET_TEXT_HEIGHT / textHeight, 0.4), 3.5)
    : longest < 1600 ? 1800 / longest : longest > 3000 ? 3000 / longest : 1
  scale = Math.min(scale, Math.sqrt(MAX_PIXELS / (width * height)), 4000 / longest)
  return Math.round(scale * 100) / 100
}

/** Minimal canvas surface shared by HTMLCanvasElement and server-side canvas libs */
export type CanvasFactory = (width: number, height: number) => HTMLCanvasElement

function drawScaled(source: CanvasImageSource, width: number, height: number, scale: number, createCanvas: CanvasFactory) {
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.fillStyle = '#fff' // transparent PNGs → white paper, not black
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h) // throws on a CORS-tainted canvas → caller falls back
  return { canvas, ctx, imageData, w, h }
}

/**
 * Canvas preprocessing shared by the browser (`runOcr`) and offline tests:
 * 1. measure glyph height on a ≤1600px analysis copy, 2. redraw at the scale
 * that puts glyphs at ~30px, 3. flatten lighting + stretch contrast (pass-1
 * image), 4. lazily build the adaptive-threshold image (pass-2) if needed.
 */
export async function preprocessReceiptImage(
  source: CanvasImageSource,
  width: number,
  height: number,
  createCanvas: CanvasFactory,
  encode: (canvas: HTMLCanvasElement) => Promise<Tesseract.ImageLike | null>,
): Promise<PreparedImage | null> {
  if (!width || !height) return null
  const a = Math.min(1, 1600 / Math.max(width, height))
  const probe = drawScaled(source, width, height, a, createCanvas)
  if (!probe) return null
  const probeGray = toGray(probe.imageData.data, probe.w, probe.h)
  // A blank/uniform readback (e.g. canvas fingerprinting protection) → use the original
  if (grayStdDev(probeGray) < 4) return null
  const measured = estimateTextHeight(binarize(probeGray, probe.w, probe.h), probe.w, probe.h)
  const scale = chooseScale(width, height, measured ? measured / a : null)

  const main = drawScaled(source, width, height, scale, createCanvas)
  if (!main) return null
  const { canvas, ctx, imageData, w, h } = main
  const gray = toGray(imageData.data, w, h)
  imageData.data.set(grayToRgba(enhanceGray(gray, w, h)))
  ctx.putImageData(imageData, 0, 0)
  const primary = await encode(canvas)
  if (!primary) return null

  const secondary = async () => {
    imageData.data.set(grayToRgba(binarize(gray, w, h)))
    ctx.putImageData(imageData, 0, 0)
    return encode(canvas)
  }
  return { primary, secondary }
}

async function prepareImage(src: string): Promise<PreparedImage> {
  const original: PreparedImage = { primary: src, secondary: null }
  if (typeof document === 'undefined' || typeof Image === 'undefined') return original
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    if (/^https?:/i.test(src)) i.crossOrigin = 'anonymous'
    i.onload  = () => resolve(i)
    i.onerror = () => reject(new Error('image load failed'))
    i.src = src
  })
  const createCanvas: CanvasFactory = (w, h) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  return (await preprocessReceiptImage(img, img.naturalWidth, img.naturalHeight, createCanvas, canvasToBlob)) ?? original
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try { canvas.toBlob(b => resolve(b), 'image/png') } catch { resolve(null) }
  })
}

function grayStdDev(gray: Uint8ClampedArray): number {
  let sum = 0, sq = 0
  const step = Math.max(1, Math.floor(gray.length / 200_000))
  let n = 0
  for (let p = 0; p < gray.length; p += step) { sum += gray[p]!; sq += gray[p]! * gray[p]!; n++ }
  const mean = sum / n
  return Math.sqrt(Math.max(0, sq / n - mean * mean))
}

/** RGBA → luminance (1 byte per pixel) */
export function toGray(rgba: ArrayLike<number>, width: number, height: number): Uint8ClampedArray {
  const n = width * height
  const out = new Uint8ClampedArray(n)
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const a = rgba[i + 3]! / 255
    const lum = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!
    out[p] = lum * a + 255 * (1 - a) // flatten transparency onto white
  }
  return out
}

export function grayToRgba(gray: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length * 4)
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    out[i] = out[i + 1] = out[i + 2] = gray[p]!
    out[i + 3] = 255
  }
  return out
}

function percentile(hist: Uint32Array, total: number, q: number): number {
  let acc = 0
  for (let v = 0; v < 256; v++) { acc += hist[v]!; if (acc >= total * q) return v }
  return 255
}

/**
 * Paper brightness estimate per pixel: max-pool into blocks larger than a text
 * stroke, dilate + smooth on the block grid, then bilinear upsample.
 * Returns the per-pixel background plus the block grid (for paper masking).
 */
function paperBackground(gray: Uint8ClampedArray, width: number, height: number) {
  const B = Math.max(4, Math.round(Math.min(width, height) / 60))
  const bw = Math.ceil(width / B), bh = Math.ceil(height / B)
  let grid = new Float32Array(bw * bh)
  for (let y = 0; y < height; y++) {
    const by = (y / B) | 0
    for (let x = 0; x < width; x++) {
      const i = by * bw + ((x / B) | 0)
      const v = gray[y * width + x]!
      if (v > grid[i]!) grid[i] = v
    }
  }
  const pass = (src: Float32Array, op: 'max' | 'mean') => {
    const out = new Float32Array(src.length)
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        let acc = op === 'max' ? 0 : 0, n = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy, xx = x + dx
            if (yy < 0 || xx < 0 || yy >= bh || xx >= bw) continue
            const v = src[yy * bw + xx]!
            if (op === 'max') { if (v > acc) acc = v } else { acc += v; n++ }
          }
        }
        out[y * bw + x] = op === 'max' ? acc : acc / n
      }
    }
    return out
  }
  grid = pass(pass(pass(grid, 'max'), 'mean'), 'mean')
  const bg = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const fy = Math.min(Math.max((y + 0.5) / B - 0.5, 0), bh - 1)
    const y0 = fy | 0, y1 = Math.min(y0 + 1, bh - 1), ty = fy - y0
    for (let x = 0; x < width; x++) {
      const fx = Math.min(Math.max((x + 0.5) / B - 0.5, 0), bw - 1)
      const x0 = fx | 0, x1 = Math.min(x0 + 1, bw - 1), tx = fx - x0
      const top = grid[y0 * bw + x0]! * (1 - tx) + grid[y0 * bw + x1]! * tx
      const bot = grid[y1 * bw + x0]! * (1 - tx) + grid[y1 * bw + x1]! * tx
      bg[y * width + x] = top * (1 - ty) + bot * ty
    }
  }
  // Paper level = bright end of the block grid; much darker areas are the
  // table/background around a photographed receipt. The paper mask is eroded
  // by one block so the paper edge (half paper, half table) is masked too.
  const sorted = Float32Array.from(grid).sort()
  const paper = sorted[Math.floor(sorted.length * 0.9)]!
  const dark = grid.map(v => (v < paper * 0.55 ? 1 : 0))
  const offPaper = new Uint8Array(width * height)
  if (dark.some(Boolean)) {
    const near = new Uint8Array(bw * bh)
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        let any = 0
        for (let dy = -1; dy <= 1 && !any; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy, xx = x + dx
            if (yy >= 0 && xx >= 0 && yy < bh && xx < bw && dark[yy * bw + xx]) { any = 1; break }
          }
        }
        near[y * bw + x] = any
      }
    }
    for (let y = 0; y < height; y++) {
      const row = ((y / B) | 0) * bw
      for (let x = 0; x < width; x++) offPaper[y * width + x] = near[row + ((x / B) | 0)]!
    }
  }
  return { bg, paper, offPaper }
}

/**
 * Pass-1 image: divides out uneven lighting/shadows, whitens whatever isn't
 * paper (dark table around a photographed receipt), then stretches contrast
 * so faint ink gets dark while anti-aliased edges stay gray (better for
 * Tesseract's LSTM than hard clipping).
 */
export function enhanceGray(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const n = width * height
  const { bg, offPaper } = paperBackground(gray, width, height)
  const flat = new Uint8ClampedArray(n)
  for (let p = 0; p < n; p++) {
    flat[p] = offPaper[p] ? 255 : Math.min(255, (gray[p]! / Math.max(bg[p]!, 1)) * 255)
  }
  const hist = new Uint32Array(256)
  for (let p = 0; p < n; p++) hist[flat[p]!]!++
  const lo = percentile(hist, n, 0.005)
  const hi = Math.max(Math.min(percentile(hist, n, 0.5), 250), lo + 40)
  const range = hi - lo
  const out = new Uint8ClampedArray(n)
  for (let p = 0; p < n; p++) out[p] = ((flat[p]! - lo) * 255) / range
  return out
}

/**
 * Pass-2 image: adaptive (local-mean) threshold on the flattened image.
 * A pixel is ink when it's clearly darker than its neighbourhood, which copes
 * with shadows, gradients, colored text and gray thermal paper.
 */
export function binarize(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const n = width * height
  const src = enhanceGray(gray, width, height)
  const radius = Math.max(7, Math.round(Math.max(width, height) / 70))
  const mean = boxMean(src, width, height, radius)
  const out = new Uint8ClampedArray(n)
  for (let p = 0; p < n; p++) {
    // ink if 12% darker than local mean, and not near-white
    out[p] = src[p]! < mean[p]! * 0.88 && src[p]! < 225 ? 0 : 255
  }
  return despeckle(out, width, height)
}

/**
 * Median height of character-sized connected components in a binary image —
 * used to pick an upscale factor so glyphs land near Tesseract's sweet spot.
 */
export function estimateTextHeight(bin: Uint8ClampedArray, width: number, height: number): number | null {
  const label = new Int32Array(width * height)
  const heights: number[] = []
  const stack: number[] = []
  let next = 0
  for (let start = 0; start < bin.length; start++) {
    if (bin[start] !== 0 || label[start]) continue
    next++
    label[start] = next
    stack.push(start)
    let minY = height, maxY = 0, minX = width, maxX = 0, area = 0
    while (stack.length) {
      const p = stack.pop()!
      const y = (p / width) | 0, x = p - y * width
      area++
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (x > 0 && bin[p - 1] === 0 && !label[p - 1]) { label[p - 1] = next; stack.push(p - 1) }
      if (x < width - 1 && bin[p + 1] === 0 && !label[p + 1]) { label[p + 1] = next; stack.push(p + 1) }
      if (y > 0 && bin[p - width] === 0 && !label[p - width]) { label[p - width] = next; stack.push(p - width) }
      if (y < height - 1 && bin[p + width] === 0 && !label[p + width]) { label[p + width] = next; stack.push(p + width) }
    }
    const h = maxY - minY + 1, w = maxX - minX + 1
    // character-like: not specks, not rules/lines/blobs
    if (h >= 4 && h <= height / 8 && w <= h * 2 && w >= h * 0.15 && area >= 10) heights.push(h)
  }
  if (heights.length < 15) return null
  heights.sort((a, b) => a - b)
  // upper-middle quantile ≈ cap / digit height (lower-case and punctuation are shorter)
  return heights[Math.floor(heights.length * 0.65)]!
}

function boxMean(src: Uint8ClampedArray, width: number, height: number, radius: number): Float32Array {
  // Integral image (Float64 to avoid overflow on large images)
  const W = width + 1
  const integral = new Float64Array(W * (height + 1))
  for (let y = 0; y < height; y++) {
    let row = 0
    for (let x = 0; x < width; x++) {
      row += src[y * width + x]!
      integral[(y + 1) * W + x + 1] = integral[y * W + x + 1]! + row
    }
  }
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(height, y + radius + 1)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(width, x + radius + 1)
      const sum = integral[y1 * W + x1]! - integral[y0 * W + x1]! - integral[y1 * W + x0]! + integral[y0 * W + x0]!
      out[y * width + x] = sum / ((x1 - x0) * (y1 - y0))
    }
  }
  return out
}

/** Removes isolated black pixels (salt noise) from a binary image */
function despeckle(bin: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = bin.slice()
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x
      if (bin[p] !== 0) continue
      let dark = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (bin[p + dy * width + dx] === 0) dark++
      if (dark <= 1) out[p] = 255
    }
  }
  return out
}

// ── Label normalisation (fuzzy keywords) ─────────────────────────────────────
// OCR mangles labels: "Grand Tora", "T0tal", "Tota1", "Arnount", "Net Amt".
// Each word is mapped to a canonical keyword when it's within a small edit
// distance, then label regexes run on the canonical form.

const VOCAB = [
  'grand', 'total', 'subtotal', 'amount', 'payable', 'bill', 'paid', 'final', 'items', 'item',
  'discount', 'delivery', 'charges', 'charge', 'packing', 'packaging', 'service', 'round',
  'rounding', 'roundoff', 'savings', 'coupon', 'promo', 'quantity', 'taxable', 'value', 'balance',
  'change', 'tendered', 'booking', 'platform', 'convenience', 'surcharge', 'handling', 'invoice',
  'date', 'dated', 'cgst', 'sgst', 'igst', 'utgst', 'cess', 'before', 'basic', 'gross',
]

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
      rowMin = Math.min(rowMin, cur[j]!)
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]!
}

function canonicalWord(word: string, prev: string | undefined): string {
  // digit/letter confusions inside words: T0tal, Tota1, 5ub, |tem
  let w = word.toLowerCase()
  if (/[a-z]/.test(w) && /[a-z].*[a-z]/.test(w)) w = w.replace(/0/g, 'o').replace(/[1|!]/g, 'l').replace(/5/g, 's').replace(/\$/g, 's')
  if (VOCAB.includes(w)) return w
  if (w.length >= 4) {
    for (const cand of [w, w.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/cl/g, 'd')]) {
      if (VOCAB.includes(cand)) return cand
      const hit = VOCAB.find(v => v.length >= 4 && editDistance(cand, v, 1) <= 1)
      if (hit) return hit
    }
  }
  // "Grand Tora", "Grand Tomsk", "Net Tota" — "grand" is only ever followed by
  // "total"; after the other qualifiers allow 2 edits
  if (prev === 'grand' && /^t[a-z]{2,6}$/.test(w)) return 'total'
  if (prev && /^(net|bill|sub|final)$/.test(prev) && w.length >= 3 && w[0] === 't' && editDistance(w, 'total', 2) <= 2) return 'total'
  // "Amt"/"Amnt"/"Amout" → amount
  if (/^am(n?t|ou?n?t|t\.?)$/.test(w)) return 'amount'
  return w
}

/** Canonical lower-case label of a line, e.g. "Grand Tora: «rs" → "grand total rs" */
export function normalizeLabel(line: string): string {
  const words = line.match(/[A-Za-z0-9|$!]*[A-Za-z][A-Za-z0-9|$!]*/g) ?? []
  const out: string[] = []
  for (const word of words) out.push(canonicalWord(word, out[out.length - 1]))
  return out.join(' ').replace(/\bsubtotal\b/g, 'sub total').replace(/\broundoff\b/g, 'round off')
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

// Brands often appear only as a logo (unreadable by OCR) but are usually named
// again in the body text or disclaimer — e.g. "Thanks for choosing Swiggy".
// Loose spellings cover common OCR slips (Swigy, Zomoto, …).
const KNOWN_BRANDS: [RegExp, string][] = [
  [/\bswig+y\b/i, 'Swiggy'],
  [/\bzom[ao]to\b/i, 'Zomato'],
  [/\buber\b/i, 'Uber'],
  [/\bola\s*(cabs?|money)?\b(?=.*\b(ride|trip|cab|fare)\b)/is, 'Ola'],
  [/\brapido\b/i, 'Rapido'],
  [/\birctc\b/i, 'IRCTC'],
  [/\bmake\s*my\s*trip\b/i, 'MakeMyTrip'],
  [/\bgoibibo\b/i, 'Goibibo'],
  [/\bcleartrip\b/i, 'Cleartrip'],
  [/\bixigo\b/i, 'ixigo'],
  [/\bredbus\b/i, 'redBus'],
  [/\boyo\b/i, 'OYO'],
  [/\bairbnb\b/i, 'Airbnb'],
  [/\binterglobe\b|\bindigo\b(?=.*\b(flight|pnr|boarding|airline|6e)\b)/is, 'IndiGo'],
  [/\bair\s*india\b/i, 'Air India'],
  [/\bakasa\s*air\b/i, 'Akasa Air'],
  [/\bspice\s*jet\b/i, 'SpiceJet'],
  [/\bstarbucks\b/i, 'Starbucks'],
  [/\bdomino'?s\b/i, "Domino's"],
  [/\bmc\s*donald'?s\b/i, "McDonald's"],
  [/\bkfc\b/i, 'KFC'],
  [/\bpizza\s*hut\b/i, 'Pizza Hut'],
  [/\bburger\s*king\b/i, 'Burger King'],
  [/\bhaldiram'?s?\b/i, "Haldiram's"],
  [/\bamazon\b/i, 'Amazon'],
  [/\bflipkart\b/i, 'Flipkart'],
  [/\bbig\s*basket\b/i, 'BigBasket'],
  [/\bblinkit\b/i, 'Blinkit'],
  [/\bzepto\b/i, 'Zepto'],
  [/\bdunzo\b/i, 'Dunzo'],
]

// "Thanks for choosing X", "Welcome to X", "Sold by: X" …
const MERCHANT_PHRASE_RE = /\b(?:thanks?\s*(?:you\s+)?for\s+(?:choosing|ordering\s+(?:from|with)|shopping\s+(?:at|with)|visiting|dining\s+(?:at|with)|staying\s+(?:at|with))|welcome\s+to|ordered\s+from|sold\s+by|billed\s+by)\s*:?\s*([^\n,!.:]*)/i

// Greeting / boilerplate lines that are never the merchant name
const BOILERPLATE_RE = /\b(thanks?|thank\s+you|welcome|here\s+(are|is)\s+your|order\s+(details|summary|no|status)|tax\s+invoice|invoice\s+no|cash\s+memo|dear|delivery\s+to|bill\s+to|ship\s+to|customer|duplicate|original|copy)\b/i

function cleanName(s: string): string | null {
  const name = s.replace(/[^\p{L}\p{N}&'.\- ]/gu, ' ').replace(/\s+/g, ' ').trim()
  return name.replace(/[^\p{L}]/gu, '').length >= 3 ? name.slice(0, 60) : null
}

// A real name line is mostly letters; logo OCR junk like "§ swicey" or "Eo ———" isn't
function looksLikeName(line: string): boolean {
  const visible = line.replace(/\s/g, '')
  const letters = visible.replace(/[^\p{L}]/gu, '').length
  return letters >= 3 && letters / visible.length >= 0.7 && !/[§«»©®™|~^_=<>{}[\]\\]/.test(line)
}

function findMerchant(lines: string[], text = lines.join('\n')): string | null {
  // 1. Known brand anywhere on the receipt
  let brand: { name: string, at: number } | null = null
  for (const [re, name] of KNOWN_BRANDS) {
    const m = re.exec(text)
    if (m && (!brand || m.index < brand.at)) brand = { name, at: m.index }
  }
  if (brand) return brand.name

  // 2. Named in a phrase ("Thanks for choosing X"); value may wrap to next line
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(MERCHANT_PHRASE_RE)
    if (!m) continue
    const name = cleanName(m[1] ?? '') ?? (lines[i + 1] && looksLikeName(lines[i + 1]!) ? cleanName(lines[i + 1]!) : null)
    if (name) return name
  }

  // 3. First plausible name line near the top
  for (const line of lines.slice(0, 12)) {
    if (line.length < 3) continue
    if (SKIP_LINE_RE.some(re => re.test(line))) continue
    if (BOILERPLATE_RE.test(line) || !looksLikeName(line)) continue
    return cleanName(line)
  }
  return lines[0] ?? null
}

// ── Date ──────────────────────────────────────────────────────────────────────

const MONTH = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?'
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const monthNum = (s: string) => MONTHS.indexOf(s.slice(0, 3).toLowerCase()) + 1

// Digits as OCR sometimes reads them inside dates: O→0, l/I/|→1, S→5, B→8
const D = '[\\dOoIl|SB]'
const fixDigits = (s: string) => s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5').replace(/B/g, '8')

// Each pattern maps its match to [year, month, day] strings/numbers
const DATE_PATTERNS: { re: RegExp, ymd: (m: RegExpMatchArray) => [string, number, number] }[] = [
  // 01 Jan 2024 / 1-January-2024 / 12 Feb'19
  { re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-.]*(${MONTH})[\\s\\-,.']+(\\d{4}|\\d{2})\\b`, 'gi'), ymd: m => [m[3]!, monthNum(m[2]!), +m[1]!] },
  // Jan 01, 2024 / January 1 2024
  { re: new RegExp(`\\b(${MONTH})[\\s.]+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4}|\\d{2})\\b`, 'gi'), ymd: m => [m[3]!, monthNum(m[1]!), +m[2]!] },
  // YYYY-MM-DD / YYYY/MM/DD (ISO-ish)
  { re: new RegExp(`(?<![\\dA-Za-z])(${D}{4})\\s?[\\/\\-.]\\s?(${D}{1,2})\\s?[\\/\\-.]\\s?(${D}{1,2})(?![\\d])`, 'g'), ymd: m => [fixDigits(m[1]!), +fixDigits(m[2]!), +fixDigits(m[3]!)] },
  // DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY — Indian day-first by default; flips to
  // month-first only when the first number can't be a month (e.g. 03/25/2024)
  {
    re: new RegExp(`(?<![\\dA-Za-z])(${D}{1,2})\\s?[\\/\\-.]\\s?(${D}{1,2})\\s?[\\/\\-.]\\s?(${D}{4}|${D}{2})(?![\\d])`, 'g'),
    ymd: (m) => {
      const a = +fixDigits(m[1]!), b = +fixDigits(m[2]!)
      return b > 12 && a <= 12 ? [fixDigits(m[3]!), a, b] : [fixDigits(m[3]!), b, a]
    },
  },
]

function toIsoDate(yearStr: string, month: number, day: number): string | null {
  if (!/^\d+$/.test(yearStr)) return null
  const year = yearStr.length === 2 ? 2000 + +yearStr : +yearStr
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCMonth() !== month - 1) return null // e.g. 31 Feb
  // Receipts can't be from the future (allow 1 day for timezone slack)
  if (d.getTime() > Date.now() + 86_400_000) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// "Date:", "Bill Dt", "Invoice Date" — but not due / expiry / birth / check-out dates
const DATE_LABEL_RE = /\b(date|dated|dt|bill\s*dt|order\s*placed)\b/i
const NOT_DATE_LABEL_RE = /\b(due|expiry|exp|valid|till|until|dob|birth|check[\s-]*out|delivered)\b/i

function findDate(lines: string[]): { raw: string, iso: string | null } | null {
  let firstRaw: string | null = null
  let best: { raw: string, iso: string, rank: number } | null = null
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!
    for (const { re, ymd } of DATE_PATTERNS) {
      for (const m of line.matchAll(re)) {
        firstRaw ??= m[0]
        const iso = toIsoDate(...ymd(m))
        if (!iso) continue
        const before = line.slice(0, m.index)
        // A "Date:" label on the line wins; otherwise the earliest date
        const labelled = DATE_LABEL_RE.test(before) && !NOT_DATE_LABEL_RE.test(before)
        const rank = (labelled ? 0 : 10_000) + li * 100 + (m.index ?? 0) / 1000
        if (!best || rank < best.rank) best = { raw: m[0], iso, rank }
      }
    }
  }
  if (best) return { raw: best.raw, iso: best.iso }
  return firstRaw ? { raw: firstRaw, iso: null } : null
}

// ── Amounts: totals, components, arithmetic cross-check ──────────────────────

// Strong signals for the final payable amount (run on the canonical label)
const STRONG_TOTAL_RE = /grand total|net (total|amount|payable|pay)|total (amount|payable|due|paid)|amount (payable|due|paid|to pay)|bill (amount|total)|final (total|amount)|to pay\b|payable amount|you pay/
// Weaker signals
const TOTAL_RE = /\btotal\b|\bpayable\b/
// "Amount (Rs): 500.00" on fuel / simple bills — weakest signal
const AMOUNT_LABEL_RE = /^(sale |net |bill )?amount\b/
// Lines that mention "total" but are not the payable total
const NOT_TOTAL_RE = /total (qty|quantity|items?|tax|gst|discount|savings?|saved)|no of items|tendered|balance|change\b|\bcash\b|\bcard\b|\bupi\b|you saved|savings|\bmrp\b|\bwallet\b|\bpaid by\b|\bpayment\b/
const SUBTOTAL_RE = /sub total|items? total|taxable (amount|value|amt)|total before tax|basic (amount|value)|trip fare|ride fare/
const TAX_TOTAL_RE = /total (tax|gst)|(tax|gst) total|total (cgst|sgst)\b/
const TAX_RE = /\b(cgst|sgst|igst|utgst|cess|vat|gst|tax|service tax)\b/
const CHARGE_RE = /\b(delivery|packing|packaging|service charge|platform|convenience|booking|surcharge|handling|tip|toll|parking|fee|charges?)\b/
const DISCOUNT_RE = /\b(discount|coupon|promo|offer|cashback|less|deduction)\b/
const ROUND_RE = /\bround(ing)?( off)?\b/

type Amount = { raw: string, value: number, alts: number[], negative: boolean }

const NUMBER_RE = /\d[\d,]*(?:\.\d{1,2})?/g

/** Number tokens on a line, cleaned of dates, times, percentages and phone/ID noise */
function amountsIn(line: string): Amount[] {
  const clean = line
    // Drop dates/times so "Total 12/03/2024 1,250.00" doesn't yield 12 or 2024
    .replace(/\b\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    // Tax rates ("CGST 2.5%", "@ 9 %") aren't money
    .replace(/@?\s*\d+(?:\.\d+)?\s*%/g, ' ')
    // OCR letter/digit slips inside numbers: 1,O92.00 → 1,092.00, 14l → 141
    .replace(/(?<=\d[.,]?)[Oo](?=[\d.,]|\b)/g, '0')
    .replace(/(?<=\d)[lI|](?=[\d.,])/g, '1')
    .replace(/(?<=\d[.,]?\d*)[sS](?![A-Za-z])/g, '5')
    // Decimal comma "87,50" (a thousands group always has 3 digits)
    .replace(/(\d),(\d{2})(?![\d,])/g, '$1.$2')
    // "1, 092.00" / "87. 50" → stray space after a separator
    .replace(/(\d[,.]) (\d{2,3})\b/g, '$1$2')
  const out: Amount[] = []
  for (const m of clean.matchAll(NUMBER_RE)) {
    const raw = m[0].replace(/,$/, '')
    const value = Number(raw.replace(/,/g, ''))
    // Ignore implausible values (phone numbers, GSTIN fragments, bill numbers)
    if (!Number.isFinite(value) || value <= 0 || value >= 10_000_000) continue
    const before = clean.slice(Math.max(0, m.index! - 4), m.index)
    const negative = /[-–—(]\s*\S?\s*$/.test(before)
    const digits = raw.replace(/\D/g, '')
    const alts: number[] = []
    // Dropped decimal point: "875" for 87.5 / 8.75 (only arithmetic can confirm)
    if (!raw.includes('.') && digits.length >= 3) alts.push(value / 10, value / 100)
    // ₹ read as a glued "2"/"7"/"z": "₹73" → "273" (only arithmetic can confirm)
    if (/^[27]/.test(raw) && digits.length >= 2 && /(^|[\s:(-])$/.test(clean.slice(0, m.index))) {
      const rest = raw.slice(1).replace(/^,/, '')
      const v = Number(rest.replace(/,/g, ''))
      if (rest && !/^0\d/.test(rest) && v > 0) alts.push(v)
    }
    out.push({ raw, value, alts, negative })
  }
  return out
}

// The amount for a keyword line is the right-most number on it, or the first
// number on the next line when the receipt wraps the value below the label.
function amountForLine(lines: string[], i: number): Amount | null {
  const here = amountsIn(lines[i]!)
  if (here.length) return here[here.length - 1]!
  const next = lines[i + 1]
  // Only a bare value line ("₹ 9,152.00"), not another labelled line
  if (next && next.replace(/[^A-Za-z]/g, '').length <= 3) return amountsIn(next)[0] ?? null
  return null
}

type Component = { amount: Amount, kind: 'add' | 'tax' | 'discount' | 'round' }
type TotalCandidate = { amount: Amount, priority: number, index: number }

type MoneyAnalysis = { amount: { raw: string, value: number } | null, verified: boolean, tax: number | null }

const round2 = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

function analyseAmounts(lines: string[], text: string): MoneyAnalysis {
  const totals: TotalCandidate[] = []
  const components: Component[] = []
  let subtotal: Amount | null = null
  let taxTotal: Amount | null = null
  let unreadableTotal = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const label = normalizeLabel(line)
    if (!label) continue
    const strong = STRONG_TOTAL_RE.test(label)
    if (!strong && TAX_TOTAL_RE.test(label)) { taxTotal ??= amountForLine(lines, i); continue }
    if (!strong && NOT_TOTAL_RE.test(label)) continue
    if (!strong && SUBTOTAL_RE.test(label)) { subtotal ??= amountForLine(lines, i); continue }
    if (strong || TOTAL_RE.test(label) || AMOUNT_LABEL_RE.test(label)) {
      const amount = amountForLine(lines, i)
      if (!amount) { if (strong) unreadableTotal = true; continue }
      totals.push({ amount, priority: strong ? 3 : TOTAL_RE.test(label) ? 2 : 1, index: i })
      continue
    }
    // Identifier lines ("Tax Invoice No: …", "GSTIN", "HSN") aren't money
    if (/\b(gstin|invoice|hsn|sac|no|number|reg|pan)\b/.test(label) || /#/.test(line)) continue
    let kind: Component['kind'] | null = null
    if (ROUND_RE.test(label)) kind = 'round'
    else if (DISCOUNT_RE.test(label)) kind = 'discount'
    else if (TAX_RE.test(label)) kind = 'tax'
    else if (CHARGE_RE.test(label)) kind = 'add'
    if (!kind) continue
    const here = amountsIn(line)
    const amount = here[here.length - 1]
    if (amount) components.push({ amount, kind })
  }

  const taxes = components.filter(c => c.kind === 'tax')
  // No explicit subtotal: a weaker "… Total" line above the strongest total
  // (e.g. a misread "Item Total") can stand in for it in the arithmetic check
  if (!subtotal && totals.length > 1) {
    const top = Math.max(...totals.map(t => t.priority))
    const final = totals.find(t => t.priority === top)!
    const above = totals.filter(t => t.priority < top && t.index < final.index)
    if (above.length) subtotal = above[above.length - 1]!.amount
  }
  const solved = reconcile(subtotal, components, totals.filter(t => t.amount !== subtotal))

  let tax: number | null = null
  if (taxTotal) tax = taxTotal.value
  else if (solved?.taxSum !== undefined && solved.taxSum > 0) tax = round2(solved.taxSum)
  else if (taxes.length) tax = round2(taxes.reduce((s, c) => s + c.amount.value, 0))

  if (solved) return { amount: { raw: solved.raw, value: solved.value }, verified: true, tax }

  // No arithmetic confirmation: rank by keyword strength, then larger amount
  let best: TotalCandidate | null = null
  for (const c of totals) {
    if (!best || c.priority > best.priority || (c.priority === best.priority && c.amount.value > best.amount.value)) best = c
  }
  if (best) return { amount: { raw: best.amount.raw, value: best.amount.value }, verified: false, tax }

  if (subtotal) {
    // A "Grand Total" label whose value is unreadable: compute it from the parts
    const parts = components.reduce((s, c) => s + (c.kind === 'discount' ? -c.amount.value : c.kind === 'round' ? (c.amount.negative ? -c.amount.value : c.amount.value) : c.amount.value), 0)
    const computed = round2(subtotal.value + parts)
    // Only trust the sum when every part was read as clean money ("12.50")
    const clean = [subtotal, ...components.map(c => c.amount)].every(a => /\.\d{2}$/.test(a.raw))
    if (computed > 0 && components.length && clean) return { amount: { raw: fmt(computed), value: computed }, verified: false, tax }
    if (unreadableTotal) return { amount: null, verified: false, tax }
    return { amount: { raw: subtotal.raw, value: subtotal.value }, verified: false, tax }
  }
  if (unreadableTotal) return { amount: null, verified: false, tax }

  // Last resort: largest money-looking value (two decimals) on the receipt
  const money = [...text.matchAll(/\d[\d,]*\.\d{2}\b/g)]
    .filter(m => !/\d{1,2}[\/\-.]$/.test(text.slice(Math.max(0, m.index! - 3), m.index)))
    .map(m => ({ raw: m[0], value: Number(m[0].replace(/,/g, '')) }))
    .filter(a => a.value > 0 && a.value < 10_000_000)
  const top = money.sort((a, b) => b.value - a.value)[0]
  return { amount: top ?? null, verified: false, tax }
}

type Solution = { value: number, raw: string, cost: number, priority: number, diff: number, taxSum: number }

/**
 * Find a reading where subtotal + charges + tax − discount (± round off) equals
 * a total candidate. Each number may also be read with a restored decimal
 * point or without a glued ₹ glyph (cost 1 each, at most 2 corrections).
 */
function reconcile(subtotal: Amount | null, components: Component[], totals: TotalCandidate[]): Solution | null {
  if (!subtotal || !totals.length || components.length > 12) return null
  const hasRound = components.some(c => c.kind === 'round')
  const tol = hasRound ? 0.02 : 0.51 // rupee rounding without an explicit round-off line
  const opts = (a: Amount) => [{ v: a.value, cost: 0 }, ...a.alts.map(v => ({ v, cost: 1 }))]

  // Enumerate sums over components with ≤2 corrections (incl. "tax already included")
  type Partial = { sum: number, taxSum: number, cost: number }
  let states: Partial[] = opts(subtotal).map(o => ({ sum: o.v, taxSum: 0, cost: o.cost }))
  for (const c of components) {
    const next: Partial[] = []
    for (const s of states) {
      for (const o of opts(c.amount)) {
        if (s.cost + o.cost > 2) continue
        if (c.kind === 'round') {
          next.push({ ...s, sum: s.sum + o.v, cost: s.cost + o.cost })
          next.push({ ...s, sum: s.sum - o.v, cost: s.cost + o.cost })
        } else if (c.kind === 'discount') {
          next.push({ ...s, sum: s.sum - o.v, cost: s.cost + o.cost })
        } else {
          next.push({ sum: s.sum + o.v, taxSum: s.taxSum + (c.kind === 'tax' ? o.v : 0), cost: s.cost + o.cost })
        }
      }
    }
    states = next.length > 5000 ? next.sort((a, b) => a.cost - b.cost).slice(0, 5000) : next
  }
  // Prices may already include GST (tax lines are informational)
  const taxes = components.filter(c => c.kind === 'tax')
  if (taxes.length) {
    const taxSum = taxes.reduce((s, c) => s + c.amount.value, 0)
    states.push(...states.filter(s => s.cost === 0).map(s => ({ sum: s.sum - taxSum, taxSum: 0, cost: 1 })))
  }

  let best: Solution | null = null
  for (const t of totals) {
    for (const o of opts(t.amount)) {
      for (const s of states) {
        const cost = s.cost + o.cost
        if (cost > 2) continue
        const diff = Math.abs(s.sum - o.v)
        if (diff > tol) continue
        const better = !best || cost < best.cost || (cost === best.cost && (t.priority > best.priority || (t.priority === best.priority && diff < best.diff)))
        if (better) best = { value: o.v, raw: o.cost ? fmt(o.v) : t.amount.raw, cost, priority: t.priority, diff, taxSum: s.taxSum }
      }
    }
  }
  return best
}

// ── GSTIN ─────────────────────────────────────────────────────────────────────
// 15 chars: 2-digit state, 10-char PAN, entity no., 'Z', check char (mod-36).

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const TO_DIGIT: Record<string, string> = { O: '0', D: '0', Q: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7' }
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G', '7': 'T', '4': 'A' }

function gstinValid(g: string): boolean {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const v = GSTIN_CHARS.indexOf(g[i]!) * (i % 2 ? 2 : 1)
    sum += Math.floor(v / 36) + (v % 36)
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === g[14]
}

export function findGstin(text: string): string | null {
  const compact = text.toUpperCase().replace(/[ \t]+/g, '')
  for (const m of compact.matchAll(/(?<![A-Z0-9])[0-9A-Z]{15}(?![A-Z0-9])/g)) {
    const fixed = [...m[0]].map((ch, i) => {
      const digit = i < 2 || (i >= 7 && i <= 10)
      const letter = (i >= 2 && i <= 6) || i === 11
      if (digit) return TO_DIGIT[ch] ?? ch
      if (letter) return TO_LETTER[ch] ?? ch
      if (i === 13) return ch === '2' ? 'Z' : ch
      return ch
    }).join('')
    if (/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(fixed) && gstinValid(fixed)) return fixed
  }
  return null
}

// ── Category ──────────────────────────────────────────────────────────────────
// Keyword scoring. Order of the table breaks ties: a hotel bill that also lists
// restaurant items is accommodation, a cab ride with a "food" ad is travel.

const CATEGORY_KEYWORDS: [ExpenseCategory, RegExp][] = [
  ['accommodation', /\b(hotel|resort|inn|lodge|lodging|oyo|airbnb|treebo|fabhotel|guest\s*house|homestay|hostel|room\s*(no|rent|charges?|tariff)|check[\s-]*(in|out)|night\s*stay|suite)\b/gi],
  ['travel', /\b(uber|ola|rapido|taxi|cab|auto\s*rickshaw|irctc|railway|train|pnr|flight|airline|airways|air\s*india|indigo|vistara|akasa|spicejet|boarding|metro|bus|redbus|toll|fastag|parking|petrol|diesel|fuel|hpcl|bpcl|indian\s*oil|iocl|shell|trip\s*fare|ride|km|filling\s*station|petroleum|nozzle|cng)\b/gi],
  ['food', /\b(restaurant|cafe|caf[eé]|coffee|tea|chai|swiggy|zomato|food|foods|kitchen|dhaba|bakery|bakers|pizza|burger|biryani|meal|meals|lunch|dinner|breakfast|starbucks|mcdonald'?s?|kfc|domino'?s?|subway|haldiram|dine[\s-]*in|table\s*(no|#)|waiter|steward|juice|sweets|thali|beverages?)\b/gi],
]

export function detectCategory(text: string): ExpenseCategory | null {
  let best: { cat: ExpenseCategory, score: number } | null = null
  for (const [cat, re] of CATEGORY_KEYWORDS) {
    const score = text.match(re)?.length ?? 0
    if (score > 0 && (!best || score > best.score)) best = { cat, score }
  }
  return best?.cat ?? null
}

// ── Line items ────────────────────────────────────────────────────────────────

// Lines containing these keywords are taxes/fees/totals, not purchasable items
const NOT_ITEM_RE = /total|subtotal|grand|payable|tax\b|gst|sgst|cgst|igst|vat|cess|service\s+charge|discount|rounding|round\s+off|tendered|balance|change\b/i

function findItems(lines: string[], total: string | null, currency: string): LineItem[] {
  const items: LineItem[] = []
  // Strip currency and commas for comparison
  const totalDigits = total ? total.replace(/[^\d.]/g, '') : null

  for (const line of lines) {
    if (NOT_ITEM_RE.test(line)) continue
    const m = line.match(AMOUNT_RE)
    if (!m) continue
    const amount = m[1]!
    // Skip if this amount matches the total
    if (totalDigits && amount.replace(/,/g, '') === totalDigits.replace(/,/g, '')) continue
    const description = line.replace(AMOUNT_RE, '').replace(/\s+/g, ' ').trim()
    if (description.length < 2) continue
    items.push({ description, price: `${currency}${amount}` })
  }

  return items
}
