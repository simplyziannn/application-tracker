const clean = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

const blockedCompanies = new Set([
  'linkedin', 'indeed', 'glassdoor', 'greenhouse', 'lever', 'workday', 'jobs', 'careers', 'job search',
])

const firstUseful = (values = []) => values.map(clean).find((value) => value && value.length < 180) || ''

const flattenJson = (value, output = []) => {
  if (Array.isArray(value)) value.forEach((item) => flattenJson(item, output))
  else if (value && typeof value === 'object') {
    output.push(value)
    if (value['@graph']) flattenJson(value['@graph'], output)
  }
  return output
}

const findJobPosting = (jsonLd = []) => {
  for (const text of jsonLd) {
    try {
      const values = flattenJson(JSON.parse(text))
      const posting = values.find((item) => {
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']]
        return types.some((type) => String(type).toLowerCase() === 'jobposting')
      })
      if (posting) return posting
    } catch {
      // Some pages include malformed analytics JSON alongside valid structured data.
    }
  }
  return {}
}

const formatAddress = (jobLocation) => {
  const locations = Array.isArray(jobLocation) ? jobLocation : [jobLocation]
  return locations.map((location) => {
    if (!location) return ''
    if (typeof location === 'string') return location
    const address = location.address || location
    if (typeof address === 'string') return address
    return [address.addressLocality, address.addressRegion, address.addressCountry?.name || address.addressCountry]
      .map(clean).filter(Boolean).join(', ')
  }).filter(Boolean).join(' · ')
}

const formatSalary = (baseSalary) => {
  if (!baseSalary) return ''
  if (typeof baseSalary === 'string' || typeof baseSalary === 'number') return clean(baseSalary)
  const value = baseSalary.value || baseSalary
  const currency = clean(baseSalary.currency || value.currency)
  const unit = clean(value.unitText || baseSalary.unitText).toLowerCase()
  const minimum = value.minValue ?? value.value
  const maximum = value.maxValue
  const number = (input) => Number.isFinite(Number(input)) ? Number(input).toLocaleString('en-US') : clean(input)
  const range = minimum && maximum ? `${number(minimum)}–${number(maximum)}` : number(minimum || maximum)
  return [currency, range, unit ? `per ${unit.replace(/^per\s+/, '')}` : ''].filter(Boolean).join(' ')
}

const mapEmploymentType = (value) => {
  const text = (Array.isArray(value) ? value.join(' ') : value || '').toLowerCase()
  if (/intern|internship/.test(text)) return 'Internship'
  if (/part[ -]?time/.test(text)) return 'Part-time'
  if (/contract|contractor|freelance/.test(text)) return 'Contract'
  if (/temporary|temp\b/.test(text)) return 'Temporary'
  if (/graduate|new grad/.test(text)) return 'Graduate'
  if (/full[ -]?time|permanent/.test(text)) return 'Full-time'
  return ''
}

const sourceFromUrl = (url) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const sources = [
      ['linkedin.', 'LinkedIn'], ['indeed.', 'Indeed'], ['glassdoor.', 'Glassdoor'],
      ['greenhouse.io', 'Greenhouse'], ['lever.co', 'Lever'], ['myworkdayjobs.com', 'Workday'],
      ['wellfound.com', 'Wellfound'], ['jobstreet.', 'JobStreet'],
    ]
    return sources.find(([needle]) => host.includes(needle))?.[1] || host
  } catch {
    return ''
  }
}

const cleanRole = (value, company) => {
  let role = clean(value)
  const suffixes = ['LinkedIn', 'Indeed', 'Glassdoor', 'Greenhouse', 'Lever', 'Careers', 'Jobs']
  for (const suffix of [...suffixes, company].filter(Boolean)) {
    role = role.replace(new RegExp(`\\s*(?:[-|–—]\\s*)${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'i'), '')
  }
  return clean(role)
}

export function extractJobDetails(raw, today = new Date().toISOString().slice(0, 10)) {
  const posting = findJobPosting(raw.jsonLd)
  const structuredCompany = clean(posting.hiringOrganization?.name || posting.hiringOrganization)
  const pageCompany = firstUseful(raw.companies)
  const siteName = clean(raw.meta?.['og:site_name'])
  const company = structuredCompany || pageCompany || (!blockedCompanies.has(siteName.toLowerCase()) ? siteName : '')
  const role = cleanRole(clean(posting.title) || firstUseful(raw.headings) || clean(raw.meta?.['og:title']) || raw.title, company)
  const location = formatAddress(posting.jobLocation) || clean(posting.jobLocationType) || firstUseful(raw.locations)
  const salary = formatSalary(posting.baseSalary) || firstUseful(raw.salaries)
  const type = mapEmploymentType(posting.employmentType) || mapEmploymentType(firstUseful(raw.employmentTypes))
  const url = clean(raw.canonicalUrl || raw.url)

  const values = {
    company,
    role,
    type,
    location,
    salary,
    appliedDate: today,
    status: 'Applied',
    source: sourceFromUrl(url),
    url,
    nextStep: '',
    nextDate: '',
    notes: '',
  }
  const captured = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Boolean(value)]))
  return { values, captured }
}

export const sampleJobPage = {
  title: 'Product Design Intern | Acme',
  url: 'https://jobs.example.com/acme/product-design-intern',
  canonicalUrl: 'https://jobs.example.com/acme/product-design-intern',
  meta: { 'og:site_name': 'Example Jobs' },
  headings: ['Product Design Intern'],
  companies: ['Acme'],
  locations: [],
  salaries: [],
  employmentTypes: ['Internship'],
  jsonLd: [],
}
