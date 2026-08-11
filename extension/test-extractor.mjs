import assert from 'node:assert/strict'
import { extractJobDetails } from './extractor-core.js'

const structured = extractJobDetails({
  title: 'Ignored fallback',
  url: 'https://boards.greenhouse.io/orbit/jobs/123',
  canonicalUrl: 'https://boards.greenhouse.io/orbit/jobs/123',
  meta: {}, headings: [], companies: [], locations: [], salaries: [], employmentTypes: [],
  jsonLd: [JSON.stringify({
    '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Software Engineering Intern',
    hiringOrganization: { '@type': 'Organization', name: 'Orbit Labs' },
    jobLocation: { address: { addressLocality: 'Singapore', addressCountry: 'SG' } },
    employmentType: 'INTERN',
    baseSalary: { currency: 'SGD', value: { minValue: 3500, maxValue: 4500, unitText: 'MONTH' } },
  })],
}, '2026-08-11')

assert.deepEqual(structured.values, {
  company: 'Orbit Labs', role: 'Software Engineering Intern', type: 'Internship', location: 'Singapore, SG',
  salary: 'SGD 3,500–4,500 per month', appliedDate: '2026-08-11', status: 'Applied', source: 'Greenhouse',
  url: 'https://boards.greenhouse.io/orbit/jobs/123', nextStep: '', nextDate: '', notes: '',
})

const fallback = extractJobDetails({
  title: 'Data Analyst - Daylight | LinkedIn', url: 'https://www.linkedin.com/jobs/view/123',
  canonicalUrl: '', meta: { 'og:site_name': 'LinkedIn' }, jsonLd: [], headings: ['Data Analyst'],
  companies: ['Daylight'], locations: ['Singapore'], salaries: [], employmentTypes: ['Full-time'],
}, '2026-08-11')

assert.equal(fallback.values.company, 'Daylight')
assert.equal(fallback.values.role, 'Data Analyst')
assert.equal(fallback.values.source, 'LinkedIn')
assert.equal(fallback.values.salary, '')
assert.equal(fallback.captured.salary, false)

console.log('Extension extraction tests passed')
