import type { Category } from './supabase'

export type CategorySuggestion =
  | { kind: 'existing'; name: string }
  | { kind: 'new';      name: string }
  | { kind: 'none' }

export const CATEGORY_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
]

const KEYWORD_MAP: Record<string, string[]> = {
  'Food & dining': [
    'restaurant', 'cafe', 'mcdonald', 'pizza', 'food', 'dining', 'bakery', 'sushi', 'bar',
    'grill', 'burger', 'coffee', 'starbucks', 'swiggy', 'zomato', 'dominos', 'kfc', 'haldiram',
    'barbeque', 'biryani', 'dhaba', 'canteen', 'mess', 'hotel', 'chai', 'dosa', 'thali',
    'curry', 'noodles', 'wrap', 'sandwich',
  ],
  'Groceries': [
    'grocery', 'groceries', 'supermarket', 'mart', 'bigbasket', 'blinkit', 'zepto', 'dmart',
    'reliance fresh', 'more supermarket', 'spencer', 'nature basket', 'vegetables', 'fruits',
    'dairy', 'milk', 'ration', 'provision', 'general store', 'kirana',
  ],
  'Software': [
    'amazon', 'microsoft', 'adobe', 'license', 'subscription', 'software', 'saas',
    'app store', 'google play', 'aws', 'azure', 'digitalocean', 'github', 'netlify', 'vercel',
    'zoho', 'tally', 'godaddy', 'hostinger',
  ],
  'Travel': [
    'hotel', 'flight', 'airline', 'uber', 'taxi', 'airbnb', 'travel', 'airport', 'booking',
    'lyft', 'ola', 'rapido', 'redbus', 'irctc', 'indigo', 'air india', 'spicejet', 'vistara',
    'makemytrip', 'goibibo', 'cleartrip', 'bus', 'train', 'metro', 'auto', 'cab', 'toll',
    'petrol', 'diesel', 'fuel', 'parking',
  ],
  'Office': [
    'staples', 'office', 'printer', 'supplies', 'fedex', 'ups', 'courier', 'postage', 'depot',
    'stationery', 'pen', 'paper', 'notebook', 'whiteboard', 'amazon business',
  ],
  'Health': [
    'pharmacy', 'clinic', 'hospital', 'dentist', 'medical', 'health', 'cvs', 'walgreens',
    'apollo', 'medplus', 'netmeds', '1mg', 'pharmeasy', 'doctor', 'diagnostic', 'lab',
    'pathology', 'medicine', 'tablet', 'capsule', 'chemist', 'dispensary',
  ],
  'Shopping': [
    'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'tatacliq', 'reliance digital',
    'croma', 'vijay sales', 'clothing', 'apparel', 'fashion', 'electronics', 'mobile',
    'gadget', 'shoes', 'footwear', 'jewellery', 'jewelry',
  ],
  'Utilities': [
    'electricity', 'water', 'gas', 'broadband', 'internet', 'wifi', 'airtel', 'jio',
    'vi ', 'bsnl', 'postpaid', 'prepaid', 'recharge', 'bill payment', 'insurance',
    'emi', 'loan', 'rent',
  ],
}

export function detectCategory(
  ocrText: string,
  existingCategories: Category[],
): CategorySuggestion {
  if (!ocrText || ocrText.trim().length < 3) return { kind: 'none' }

  const lower = ocrText.toLowerCase()

  for (const [categoryName, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) {
      const exists = existingCategories.some(c => c.name === categoryName)
      return { kind: exists ? 'existing' : 'new', name: categoryName }
    }
  }

  // No keyword match — propose the merchant name (first non-empty line ≥ 3 chars)
  const firstLine = ocrText
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length >= 3)

  if (firstLine) {
    return { kind: 'new', name: firstLine.slice(0, 50) }
  }

  return { kind: 'none' }
}

export function nextCategoryColor(existingCategories: Category[]): string {
  const usedColors = new Set(existingCategories.map(c => c.color))
  return CATEGORY_COLORS.find(c => !usedColors.has(c)) ?? CATEGORY_COLORS[0]!
}
