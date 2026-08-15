import test from 'node:test'
import assert from 'node:assert/strict'
import { createQuestionPlan, DAILY_REVIEW_LIMIT, recommendReviews } from '../src/reviewRecommendations.js'

const today = '2026-08-15'
const practiceDays = [
  { id: 1, questions: ['Two Sum', 'Valid Anagram'] },
  { id: 6, questions: ['Redo Two Sum', 'Valid Palindrome'] },
  { id: 8, questions: ['Maximum Average Subarray I', 'Best Time to Buy and Sell Stock'] },
]
const questionPlan = createQuestionPlan(practiceDays)
const problem = (id, overrides = {}) => ({
  id, title: id, topic: `Topic ${id}`, difficulty: 'Easy', reviews: 1, nextReview: today, ...overrides,
})

test('caps a large due pool to the daily review limit', () => {
  const due = Array.from({ length: 9 }, (_, index) => problem(`Problem ${index + 1}`))
  assert.equal(recommendReviews(due, 1, questionPlan, today).length, DAILY_REVIEW_LIMIT)
})

test('prioritizes a recent miss and roadmap-relevant repeated question', () => {
  const due = [
    problem('ordinary', { title: 'Ordinary problem' }),
    problem('repeat', { title: 'Two Sum', topic: 'Arrays' }),
    problem('miss', { title: 'Valid Anagram', lastResult: 'again' }),
    problem('hard', { title: 'Unplanned hard', difficulty: 'Hard' }),
  ]
  const picks = recommendReviews(due, 1, questionPlan, today)
  assert.equal(picks[0].problem.id, 'miss')
  assert.ok(picks.some(({ problem: selected }) => selected.id === 'repeat'))
  assert.ok(!picks.some(({ problem: selected }) => selected.id === 'ordinary'))
})

test('old backlog eventually outranks a newly due easy problem', () => {
  const due = [
    problem('old', { title: 'Old backlog', nextReview: '2026-08-01' }),
    problem('new', { title: 'Newly due' }),
  ]
  assert.equal(recommendReviews(due, 20, questionPlan, today)[0].problem.id, 'old')
})
