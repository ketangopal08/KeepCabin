// Maps vendor-name keywords to a brand domain, then builds a logo URL using
// Google's free favicon service (no API key). Unknown vendors return null so
// callers can fall back to initials.
//
// Order matters: more specific keywords must come before generic ones
// (e.g. "reliance digital" before "reliance").
const BRAND_DOMAINS: [keyword: string, domain: string][] = [
  // Food
  ['swiggy', 'swiggy.com'],
  ['zomato', 'zomato.com'],
  ['starbucks', 'starbucks.in'],
  ['chaayos', 'chaayos.com'],
  ['haldiram', 'haldirams.com'],
  ['haldirams', 'haldirams.com'],
  ['barbeque nation', 'barbequenation.com'],
  ['third wave', 'thirdwavecoffeeroasters.com'],
  ['dominos', 'dominos.co.in'],
  ['mcdonalds', 'mcdonaldsindia.com'],
  ['kfc', 'online.kfc.co.in'],
  ['blinkit', 'blinkit.com'],
  ['zepto', 'zeptonow.com'],
  ['bigbasket', 'bigbasket.com'],
  // Travel
  ['uber', 'uber.com'],
  ['ola', 'olacabs.com'],
  ['indigo', 'goindigo.in'],
  ['rapido', 'rapido.bike'],
  ['irctc', 'irctc.co.in'],
  ['air india', 'airindia.com'],
  ['vistara', 'airvistara.com'],
  ['blusmart', 'blu-smart.com'],
  ['makemytrip', 'makemytrip.com'],
  ['goibibo', 'goibibo.com'],
  // Stay
  ['oyo', 'oyorooms.com'],
  ['taj', 'tajhotels.com'],
  ['lemon tree', 'lemontreehotels.com'],
  ['treebo', 'treebo.com'],
  ['itc hotels', 'itchotels.com'],
  ['marriott', 'marriott.com'],
  ['fabhotels', 'fabhotels.com'],
  // Shopping / software
  ['amazon', 'amazon.in'],
  ['croma', 'croma.com'],
  ['staples', 'staples.com'],
  ['flipkart', 'flipkart.com'],
  ['notion', 'notion.so'],
  ['figma', 'figma.com'],
  ['slack', 'slack.com'],
  ['github', 'github.com'],
  ['zoom', 'zoom.us'],
  ['google', 'google.com'],
  ['microsoft', 'microsoft.com'],
  ['reliance digital', 'reliancedigital.in'],
  ['reliance', 'ril.com'],
  ['paytm', 'paytm.com'],
]

function normalize(name: string) {
  return ` ${name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `
}

export function brandDomain(name?: string | null): string | null {
  if (!name) return null
  const n = normalize(name)
  // Match whole words only, so "ola" doesn't match "Coca-Cola"
  const hit = BRAND_DOMAINS.find(([kw]) => n.includes(` ${kw} `))
  return hit ? hit[1] : null
}

export function brandLogoUrl(name?: string | null, size = 64): string | null {
  const domain = brandDomain(name)
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}` : null
}
