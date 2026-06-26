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
}

export async function runOcr(imageUrl: string): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(imageUrl, 'eng')
  const raw = data.text
  return parseReceiptText(raw)
}

export function parseReceiptText(text: string): OcrResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const merchant = lines[0] ?? null

  const dateMatch = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)
  const date = dateMatch ? dateMatch[0] : null

  const totalMatch = text.match(/total[:\s]+\$?([\d,]+\.\d{2})/i)
  const total = totalMatch ? `$${totalMatch[1]}` : null

  const priceRegex = /\$?([\d,]+\.\d{2})/
  const items: LineItem[] = lines
    .slice(1)
    .filter(line => !line.match(/total/i) && priceRegex.test(line))
    .map(line => {
      const priceMatch = line.match(priceRegex)
      return {
        description: line.replace(priceRegex, '').trim(),
        price: priceMatch ? `$${priceMatch[1]}` : null,
      }
    })

  return { raw: text, merchant, date, items, total }
}
