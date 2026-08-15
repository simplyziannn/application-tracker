export const REVIEW_INTERVALS = [3, 7, 14, 30]
export const DAILY_REVIEW_LIMIT = 3

const normalizeProblemTitle = (title) => title.toLowerCase().replace(/^redo\s+/, '').trim()
const daysBetween = (from, to) => Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000)

export function createQuestionPlan(practiceDays) {
  return practiceDays.reduce((plan, day) => {
    day.questions.forEach((title) => {
      const key = normalizeProblemTitle(title)
      const entry = plan.get(key) || { appearances: 0, days: [] }
      entry.appearances += 1
      entry.days.push(day.id)
      plan.set(key, entry)
    })
    return plan
  }, new Map())
}

export function recommendReviews(dueProblems, roadmapDay, questionPlan, today) {
  const remaining = dueProblems.map((problem) => {
    const plan = questionPlan.get(normalizeProblemTitle(problem.title))
    const upcoming = plan?.days.some((day) => day >= roadmapDay && day <= roadmapDay + 7)
    const overdueDays = Math.max(0, daysBetween(problem.nextReview, today))
    const difficultyWeight = { Easy: 0, Medium: 8, Hard: 16 }[problem.difficulty] || 0
    const score = overdueDays * 4
      + (problem.lastResult === 'again' ? 40 : 0)
      + (upcoming ? 30 : 0)
      + (plan?.appearances || 0) * 8
      + difficultyWeight
      + Math.max(0, 3 - problem.reviews) * 4
    const reason = problem.lastResult === 'again'
      ? 'Needs reinforcement'
      : upcoming
        ? 'Relevant this week'
        : (plan?.appearances || 0) > 1
          ? 'High-value repeat'
          : overdueDays >= 3
            ? `${overdueDays} days overdue`
            : difficultyWeight
              ? 'Higher challenge'
              : 'Due for recall'
    return { problem, score, reason }
  })
  const recommendations = []
  const selectedTopics = new Map()
  while (remaining.length && recommendations.length < DAILY_REVIEW_LIMIT) {
    remaining.sort((a, b) => {
      const aAdjusted = a.score - (selectedTopics.get(a.problem.topic) || 0) * 12
      const bAdjusted = b.score - (selectedTopics.get(b.problem.topic) || 0) * 12
      return bAdjusted - aAdjusted || a.problem.nextReview.localeCompare(b.problem.nextReview) || a.problem.title.localeCompare(b.problem.title)
    })
    const selected = remaining.shift()
    recommendations.push(selected)
    selectedTopics.set(selected.problem.topic, (selectedTopics.get(selected.problem.topic) || 0) + 1)
  }
  return recommendations
}
