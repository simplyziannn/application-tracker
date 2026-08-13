import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { sankey, sankeyJustify, sankeyLinkHorizontal } from 'd3-sankey'
import {
  ArrowRight, BookOpen, Brain, BriefcaseBusiness, CalendarDays, Check,
  ChevronDown, Clock3, Code2, Download,
  LayoutDashboard, Menu, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Sparkles,
  Target, Trash2, Upload, UserRound, X,
} from 'lucide-react'

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'applications', label: 'Applications', icon: BriefcaseBusiness },
  { id: 'pipeline', label: 'Pipeline', icon: Target },
  { id: 'practice', label: 'Practice', icon: Code2 },
]
const STATUSES = ['Applied', 'Screening', 'Interview', 'Offer', 'Closed']
const STATUS_CLASS = Object.fromEntries(STATUSES.map((status) => [status, status.toLowerCase()]))

const api = {
  async list() {
    const response = await fetch('/api/applications')
    if (!response.ok) throw new Error('Could not load applications')
    return response.json()
  },
  async save(item) {
    const response = await fetch(item.id ? `/api/applications/${item.id}` : '/api/applications', {
      method: item.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
    if (!response.ok) throw new Error('Could not save application')
    return response.json()
  },
  async remove(id) {
    const response = await fetch(`/api/applications/${id}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Could not delete application')
  },
  async importCsv(csv) {
    const response = await fetch('/api/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv }),
    })
    if (!response.ok) throw new Error((await response.json()).error || 'Could not import CSV')
    return response.json()
  },
  async getProfile() {
    const response = await fetch('/api/profile')
    if (!response.ok) throw new Error('Could not load profile')
    return response.json()
  },
  async saveProfile(profile) {
    const response = await fetch('/api/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile),
    })
    if (!response.ok) throw new Error((await response.json()).error || 'Could not save profile')
    return response.json()
  },
}

const formatDate = (date, short = false) => {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-SG', { month: 'short', day: 'numeric', ...(short ? {} : { year: 'numeric' }) }).format(new Date(`${date}T00:00:00`))
}

function Status({ value }) {
  return <span className={`status status-${STATUS_CLASS[value] || 'applied'}`}><span />{value}</span>
}

function CompanyMark({ company }) {
  const palette = ['#2456d8', '#ff5a36', '#6d4aff', '#079c70', '#d94267']
  const index = company.split('').reduce((total, char) => total + char.charCodeAt(0), 0) % palette.length
  return <span className="company-mark" style={{ '--mark': palette[index] }}>{company.slice(0, 1)}</span>
}

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'NS'

function AppShell({ page, setPage, children, onAdd, onImport, profile, onSaveProfile }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const fileRef = useRef(null)
  const navigate = (next) => { setPage(next); setMobileOpen(false); setProfileOpen(false) }
  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (file) await onImport(await file.text())
    event.target.value = ''
  }
  useEffect(() => {
    const closeMenus = (event) => {
      if (event.key === 'Escape') { setMobileOpen(false); setProfileOpen(false) }
    }
    window.addEventListener('keydown', closeMenus)
    return () => window.removeEventListener('keydown', closeMenus)
  }, [])
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><Sparkles /></span><div><strong>Northstar</strong><small>Your search, in focus.</small></div></div>
        <nav aria-label="Main navigation">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button className={page === id ? 'active' : ''} onClick={() => navigate(id)} key={id}><Icon />{label}</button>
          ))}
        </nav>
        <div className="sidebar-tools">
          <p>Data lives in your CSV</p>
          <span>Import a backup or download the latest copy anytime.</span>
          <div className="tool-actions">
            <button className="icon-button" onClick={() => fileRef.current?.click()} title="Import CSV"><Upload /></button>
            <a className="icon-button" href="/api/export" title="Export CSV"><Download /></a>
          </div>
          <input className="sr-only" ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} />
        </div>
        <div className="profile-wrap">
          {profileOpen ? <div className="profile-menu" role="menu">
            <button role="menuitem" onClick={() => { setProfileOpen(false); setProfileModalOpen(true) }}><UserRound /> Edit profile</button>
            <a role="menuitem" href="/api/export"><Download /> Export CSV</a>
          </div> : null}
          <button className="profile" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-haspopup="menu">
            <span>{initials(`${profile.firstName} ${profile.lastName}`)}</span><div><strong>{profile.firstName}</strong><small>{profile.role || 'Job search workspace'}</small></div><ChevronDown className={profileOpen ? 'rotated' : ''} />
          </button>
        </div>
      </aside>
      {mobileOpen ? <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} /> : null}
      <main>
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu /></button>
          <div className="mobile-brand">Northstar</div>
          <button className="button primary" onClick={onAdd}><Plus /> Add application</button>
        </header>
        {children}
      </main>
      {profileModalOpen ? <ProfileModal profile={profile} onClose={() => setProfileModalOpen(false)} onSave={onSaveProfile} /> : null}
    </div>
  )
}

function Sankey({ applications }) {
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((status) => [status, applications.filter((item) => item.status === status).length])), [applications])
  const total = applications.length
  const activeFlow = counts.Screening + counts.Interview + counts.Offer
  const graph = useMemo(() => {
    if (!total) return { nodes: [], links: [] }
    const interviewFlow = counts.Interview + counts.Offer
    const nodes = [
      { id: 'applications', label: 'Applications', color: '#315fd3' },
      { id: 'awaiting', label: 'Awaiting reply', color: '#7d9fe8' },
      { id: 'screening', label: 'Screening', color: '#e1a11f' },
      { id: 'screening-now', label: 'In screening', color: '#e1a11f' },
      { id: 'interview', label: 'Interview', color: '#7658e5' },
      { id: 'interview-now', label: 'In interview', color: '#7658e5' },
      { id: 'offer', label: 'Offer', color: '#0b9a70' },
      { id: 'closed', label: 'Closed', color: '#ea4a4a' },
    ]
    const links = [
      { source: 'applications', target: 'awaiting', value: counts.Applied, color: '#9bb6ed' },
      { source: 'applications', target: 'screening', value: activeFlow, color: '#5d82dd' },
      { source: 'applications', target: 'closed', value: counts.Closed, color: '#ef8d83' },
      { source: 'screening', target: 'screening-now', value: counts.Screening, color: '#e8b84f' },
      { source: 'screening', target: 'interview', value: interviewFlow, color: '#8270da' },
      { source: 'interview', target: 'interview-now', value: counts.Interview, color: '#8976e3' },
      { source: 'interview', target: 'offer', value: counts.Offer, color: '#42ad8b' },
    ].filter((link) => link.value > 0)
    return sankey()
      .nodeId((node) => node.id)
      .nodeAlign(sankeyJustify)
      .nodeWidth(16)
      .nodePadding(28)
      .extent([[58, 38], [1042, 302]])({ nodes: nodes.map((node) => ({ ...node })), links: links.map((link) => ({ ...link })) })
  }, [activeFlow, counts, total])
  const linkPath = sankeyLinkHorizontal()
  return (
    <div className="sankey-wrap" aria-label="Application flow diagram">
      <svg viewBox="0 0 1100 340" role="img" aria-label={`${total} applications flowing through awaiting reply, screening, interview, offer and closed stages`}>
        <g className="sankey-links">
          {graph.links.map((link, index) => <path key={`${link.source.id}-${link.target.id}-${index}`} d={linkPath(link)} stroke={link.color} strokeWidth={Math.max(1, link.width)}><title>{link.source.label} → {link.target.label}: {link.value}</title></path>)}
        </g>
        <g className="sankey-nodes">
          {graph.nodes.map((node) => <g key={node.id}>
            <rect x={node.x0} y={node.y0} width={node.x1 - node.x0} height={Math.max(4, node.y1 - node.y0)} rx="4" fill={node.color}><title>{node.label}: {node.value}</title></rect>
            <text x={node.x0 < 550 ? node.x1 + 10 : node.x0 - 10} y={(node.y0 + node.y1) / 2 - 3} textAnchor={node.x0 < 550 ? 'start' : 'end'}>{node.label}</text>
            <text className="node-value" x={node.x0 < 550 ? node.x1 + 10 : node.x0 - 10} y={(node.y0 + node.y1) / 2 + 15} textAnchor={node.x0 < 550 ? 'start' : 'end'}>{node.value}</text>
          </g>)}
        </g>
      </svg>
      <div className="flow-legend"><span><i className="legend-blue"/>In progress {activeFlow}</span><span><i className="legend-orange"/>Offers {counts.Offer}</span><span><i className="legend-red"/>Closed {counts.Closed}</span><span className="flow-note">Ribbon width represents application count</span></div>
    </div>
  )
}

function Metric({ icon: Icon, value, label, note, accent }) {
  return <div className="metric"><span className={`metric-icon ${accent}`}><Icon /></span><div><strong>{value}</strong><span>{label}</span><small>{note}</small></div></div>
}

function PageHeading({ title, copy, kicker, action }) {
  return <div className="page-heading"><div>{kicker ? <span className="page-kicker">{kicker}</span> : null}<h1>{title}</h1><p>{copy}</p></div>{action}</div>
}

function Overview({ applications, setPage, onEdit, profile }) {
  const [range, setRange] = useState('All time')
  const [rangeOpen, setRangeOpen] = useState(false)
  const [rowMenu, setRowMenu] = useState('')
  const interviews = applications.filter((item) => item.status === 'Interview').length
  const offers = applications.filter((item) => item.status === 'Offer').length
  const active = applications.filter((item) => item.status !== 'Closed').length
  const firstName = profile.firstName || 'there'
  const headlineCopy = interviews || offers
    ? `${firstName}, ${interviews} interview${interviews === 1 ? '' : 's'} and ${offers} offer${offers === 1 ? '' : 's'} are in motion.`
    : `${firstName}, ${active} active application${active === 1 ? '' : 's'} are on the board.`
  const upcoming = [...applications].filter((item) => item.nextDate && item.status !== 'Closed').sort((a, b) => a.nextDate.localeCompare(b.nextDate)).slice(0, 5)
  const flowApplications = useMemo(() => {
    if (range === 'All time') return applications
    const days = range === 'Last 30 days' ? 30 : 90
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return applications.filter((item) => new Date(`${item.appliedDate}T00:00:00`) >= cutoff)
  }, [applications, range])
  return <section className="page overview-page">
    <PageHeading title="The search is taking shape." copy={headlineCopy} />
    <div className="metrics-grid">
      <Metric icon={BriefcaseBusiness} value={active} label="active" note="Across all roles" accent="blue" />
      <Metric icon={CalendarDays} value={interviews} label="interviews" note="In progress" accent="purple" />
      <Metric icon={Sparkles} value={offers} label="offer" note="On the table" accent="coral" />
    </div>
    <section className="panel flow-panel">
      <div className="panel-heading"><div><h2>Application flow</h2><p>Where your opportunities are moving—and where they stop.</p></div><div className="range-control"><button className="button subtle" onClick={() => setRangeOpen((open) => !open)} aria-expanded={rangeOpen}>{range} <ChevronDown /></button>{rangeOpen ? <div className="range-menu" role="menu">{['All time', 'Last 30 days', 'Last 90 days'].map((option) => <button role="menuitem" className={option === range ? 'selected' : ''} key={option} onClick={() => { setRange(option); setRangeOpen(false) }}>{option}{option === range ? <Check /> : null}</button>)}</div> : null}</div></div>
      <Sankey applications={flowApplications} />
    </section>
    <div className="overview-lower">
      <section className="panel recent-panel">
        <div className="panel-heading"><h2>Recent applications</h2><button className="text-button" onClick={() => setPage('applications')}>View all <ArrowRight /></button></div>
        <div className="compact-list">
          {applications.slice(0, 5).map((item) => <div className="compact-row" key={item.id}><CompanyMark company={item.company}/><div className="compact-primary"><strong>{item.company}</strong><span>{item.role}</span></div><Status value={item.status}/><time>{formatDate(item.appliedDate, true)}</time><div className="compact-menu-wrap"><button className="row-menu-button" onClick={() => setRowMenu((open) => open === item.id ? '' : item.id)} aria-label={`Actions for ${item.company}`} aria-expanded={rowMenu === item.id}><MoreHorizontal /></button>{rowMenu === item.id ? <div className="compact-menu" role="menu"><button role="menuitem" onClick={() => { onEdit(item); setRowMenu('') }}><Pencil /> Edit application</button><button role="menuitem" onClick={() => { setRowMenu(''); setPage('pipeline') }}><Target /> View in pipeline</button></div> : null}</div></div>)}
        </div>
      </section>
      <section className="panel actions-panel">
        <div className="panel-heading"><h2>Upcoming actions</h2><button className="text-button" onClick={() => setPage('pipeline')}>Pipeline <ArrowRight /></button></div>
        <div className="action-list">
          {upcoming.map((item) => <div className="action-row" key={item.id}><span className="action-icon"><CalendarDays /></span><div><strong>{item.nextStep || 'Follow up'}</strong><span>{item.company} · {item.role}</span></div><time>{formatDate(item.nextDate, true)}</time></div>)}
        </div>
      </section>
    </div>
  </section>
}

function Applications({ applications, onEdit, onDelete }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const deferredSearch = useDeferredValue(search)
  const filtered = useMemo(() => applications.filter((item) => {
    const matchesStatus = status === 'All' || item.status === status
    const haystack = `${item.company} ${item.role} ${item.location}`.toLowerCase()
    return matchesStatus && haystack.includes(deferredSearch.toLowerCase())
  }), [applications, deferredSearch, status])
  return <section className="page applications-page">
    <PageHeading kicker={`${applications.length} tracked`} title="Applications" copy="Every opportunity, with the context you need." action={<a className="button outline" href="/api/export"><Download /> Export CSV</a>} />
    <div className="filters">
      <label className="search-field"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company, role, or location" /></label>
      <div className="status-tabs">{['All', ...STATUSES].map((item) => <button key={item} onClick={() => setStatus(item)} className={status === item ? 'active' : ''}>{item}</button>)}</div>
    </div>
    <div className="table-panel">
      <div className="application-table table-head"><span>Company & role</span><span>Status</span><span>Applied</span><span>Next step</span><span>Type</span><span /></div>
      <div className="table-body">
        {filtered.map((item) => <article className="application-table table-row" key={item.id}>
          <div className="company-cell"><CompanyMark company={item.company}/><div><strong>{item.company}</strong><span>{item.role} · {item.location}</span></div></div>
          <Status value={item.status}/><time>{formatDate(item.appliedDate)}</time><div className="next-cell"><strong>{item.nextStep || 'No next step'}</strong><span>{formatDate(item.nextDate)}</span></div><span>{item.type}</span>
          <div className="row-actions"><button className="icon-button" onClick={() => onEdit(item)} title="Edit"><Pencil /></button><button className="icon-button danger" onClick={() => onDelete(item)} title="Delete"><Trash2 /></button></div>
        </article>)}
        {!filtered.length ? <div className="empty-state"><Search /><h3>No applications found</h3><p>Try a different search or status.</p></div> : null}
      </div>
      <footer className="table-footer"><span>Showing {filtered.length} of {applications.length} applications</span><span>Saved automatically to CSV</span></footer>
    </div>
  </section>
}

function Pipeline({ applications, onEdit }) {
  return <section className="page pipeline-page">
    <PageHeading kicker="Live view" title="Pipeline" copy="See momentum at a glance. Select any application to update it." />
    <div className="pipeline-summary"><span><strong>{applications.filter((item) => item.status !== 'Closed').length}</strong> active opportunities</span><span><strong>{applications.filter((item) => item.status === 'Interview').length}</strong> in interviews</span><span><strong>{applications.filter((item) => item.status === 'Offer').length}</strong> offers</span></div>
    <div className="board">
      {STATUSES.map((status) => {
        const items = applications.filter((item) => item.status === status)
        return <section className={`board-column column-${STATUS_CLASS[status]}`} key={status}>
          <header><span>{status}</span><strong>{items.length}</strong></header>
          <div className="board-stack">
            {items.map((item) => <button className="pipeline-card" key={item.id} onClick={() => onEdit(item)}>
              <div><CompanyMark company={item.company}/><MoreHorizontal /></div><strong>{item.company}</strong><span>{item.role}</span>
              <footer><small>{item.type}</small><time>{formatDate(item.nextDate || item.appliedDate, true)}</time></footer>
            </button>)}
            {!items.length ? <div className="column-empty">Nothing here yet</div> : null}
          </div>
        </section>
      })}
    </div>
  </section>
}

const PRACTICE_WEEKS = [
  {
    title: 'Foundations', topics: ['Arrays & strings', 'Hash maps', 'Two pointers'],
    days: [
      ['Array traversal', 'Two Sum', 'Running Sum of 1d Array', 'Write the pattern in your own words'],
      ['String basics', 'Valid Anagram', 'Valid Palindrome', 'Explain the frequency-map idea aloud'],
      ['Hash maps', 'Contains Duplicate', 'Ransom Note', 'Redo the core lookup pattern without notes'],
      ['Two pointers', 'Squares of a Sorted Array', 'Merge Sorted Array', 'Name when two pointers are useful'],
      ['In-place arrays', 'Move Zeroes', 'Remove Duplicates from Sorted Array', 'Trace every pointer movement'],
      ['Review day', 'Redo Two Sum', 'Redo Valid Anagram', 'Compare your first and second attempts'],
      ['Light day', 'Best Time to Buy and Sell Stock', 'Majority Element', 'Write one question for next week'],
    ],
  },
  {
    title: 'Core patterns', topics: ['Sliding window', 'Stack', 'Binary search'],
    days: [
      ['Sliding window', 'Best Time to Buy and Sell Stock', 'Maximum Average Subarray I', 'Draw the window on paper'],
      ['Growing windows', 'Longest Substring Without Repeating Characters', 'Minimum Size Subarray Sum', 'Use hints, then explain each pointer'],
      ['Stack basics', 'Valid Parentheses', 'Baseball Game', 'Say why LIFO fits the problem'],
      ['Stack state', 'Min Stack', 'Daily Temperatures', 'Describe the extra-state tradeoff'],
      ['Binary search', 'Binary Search', 'Sqrt(x)', 'Write the loop invariants'],
      ['Boundaries', 'Search Insert Position', 'First Bad Version', 'Test empty and one-item cases'],
      ['Review day', 'Redo Longest Substring', 'Redo Valid Parentheses', 'Log where you got stuck'],
    ],
  },
  {
    title: 'Structures', topics: ['Linked lists', 'Trees', 'BFS & DFS'],
    days: [
      ['Linked lists', 'Reverse Linked List', 'Linked List Cycle', 'Draw prev, current, and next'],
      ['List merging', 'Merge Two Sorted Lists', 'Remove Linked List Elements', 'Explain the dummy-node pattern'],
      ['Tree recursion', 'Maximum Depth of Binary Tree', 'Minimum Depth of Binary Tree', 'State the base case first'],
      ['Tree comparison', 'Same Tree', 'Symmetric Tree', 'Trace one recursive call stack'],
      ['Breadth-first search', 'Binary Tree Level Order Traversal', 'Average of Levels in Binary Tree', 'Explain why a queue fits'],
      ['Depth-first search', 'Invert Binary Tree', 'Path Sum', 'Write recursive and iterative outlines'],
      ['Review day', 'Redo Reverse Linked List', 'Redo Maximum Depth', 'Draw both structures from memory'],
    ],
  },
  {
    title: 'Interview mode', topics: ['Mixed practice', 'Timed sets', 'Mock interviews'],
    days: [
      ['Mixed set', 'Two Sum', 'Valid Palindrome', 'Finish in 45 minutes, then review'],
      ['Mixed set', 'Best Time to Buy and Sell Stock', 'Valid Parentheses', 'Explain before coding'],
      ['Mock interview', 'Single Number', 'Flood Fill', 'Use a strict 45-minute timer'],
      ['Weak-spot day', 'Redo your hardest array miss', 'Redo your hardest tree miss', 'Update your pattern notes'],
      ['Guided medium', 'Group Anagrams', 'Top K Frequent Elements', 'Use hints only after 15 minutes'],
      ['Full mock', 'Merge Two Sorted Lists', 'Product of Array Except Self', 'Speak every decision aloud'],
      ['Final benchmark', 'Redo Two Sum', 'Number of Islands', 'Choose next month’s three focus patterns'],
    ],
  },
]

const PRACTICE_DAYS = PRACTICE_WEEKS.flatMap((week, weekIndex) => week.days.map((tasks, dayIndex) => ({
  id: weekIndex * 7 + dayIndex + 1,
  week: weekIndex + 1,
  title: tasks[0],
  topic: tasks[0],
  questions: [tasks[1], tasks[2]],
  reflectionPrompt: tasks[3],
  tasks: [`Learn: ${tasks[0]}`, `Solve: ${tasks[1]}`, `Solve: ${tasks[2]}`],
})))

const REVIEW_INTERVALS = [1, 3, 7, 14, 30]
const toLocalIso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const todayIso = () => toLocalIso(new Date())
const addDays = (date, days) => {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + days)
  return toLocalIso(next)
}
const isDayComplete = (day, progress) => day.tasks.every((_, index) => progress.checks?.[`${day.id}-${index}`])

function readPracticeData() {
  try {
    const saved = JSON.parse(window.localStorage.getItem('northstar-practice-v2') || 'null')
    if (saved) return { checks: {}, notes: {}, problems: [], ...saved }
    const legacy = JSON.parse(window.localStorage.getItem('northstar-practice-v1') || '{}')
    return { checks: legacy, notes: {}, problems: [] }
  } catch { return { checks: {}, notes: {}, problems: [] } }
}

function Practice() {
  const [progress, setProgress] = useState(readPracticeData)
  const [planOpen, setPlanOpen] = useState(false)
  const [trackerOpen, setTrackerOpen] = useState(true)
  const [addingProblem, setAddingProblem] = useState(false)
  const [problemForm, setProblemForm] = useState({ title: '', topic: '', difficulty: 'Easy' })
  const [seconds, setSeconds] = useState(45 * 60)
  const [timerRunning, setTimerRunning] = useState(false)
  const completedDays = PRACTICE_DAYS.filter((day) => isDayComplete(day, progress)).length
  const recommendedDay = PRACTICE_DAYS.find((day) => !isDayComplete(day, progress)) || PRACTICE_DAYS.at(-1)
  const [selectedDayId, setSelectedDayId] = useState(() => {
    const saved = readPracticeData()
    return (PRACTICE_DAYS.find((day) => !isDayComplete(day, saved)) || PRACTICE_DAYS.at(-1)).id
  })
  const currentDay = PRACTICE_DAYS[selectedDayId - 1] || recommendedDay
  const graduation = new Date('2027-01-01T00:00:00+08:00')
  const daysToGraduation = Math.max(0, Math.ceil((graduation - Date.now()) / 86400000))
  const activeWeek = currentDay.week
  const dueProblems = useMemo(() => progress.problems.filter((problem) => problem.nextReview <= todayIso()).sort((a, b) => a.nextReview.localeCompare(b.nextReview)), [progress.problems])

  useEffect(() => { window.localStorage.setItem('northstar-practice-v2', JSON.stringify(progress)) }, [progress])
  useEffect(() => {
    if (!timerRunning) return undefined
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) { window.clearInterval(timer); setTimerRunning(false); return 0 }
      return value - 1
    }), 1000)
    return () => window.clearInterval(timer)
  }, [timerRunning])

  const addTrackedProblem = (title, topic, difficulty = 'Easy') => setProgress((current) => {
    const duplicate = current.problems.some((problem) => problem.title.toLowerCase() === title.toLowerCase())
    if (duplicate) return current
    const solvedAt = todayIso()
    return { ...current, problems: [{ id: crypto.randomUUID(), title, topic, difficulty, solvedAt, nextReview: addDays(solvedAt, 1), intervalIndex: 0, reviews: 0 }, ...current.problems] }
  })
  const toggleTask = (day, taskIndex) => {
    const key = `${day.id}-${taskIndex}`
    const willComplete = !progress.checks[key]
    setProgress((current) => ({ ...current, checks: { ...current.checks, [key]: !current.checks[key] } }))
    if (willComplete && taskIndex > 0) addTrackedProblem(day.questions[taskIndex - 1], day.topic)
  }
  const updateNote = (value) => setProgress((current) => ({ ...current, notes: { ...current.notes, [currentDay.id]: value } }))
  const submitProblem = (event) => {
    event.preventDefault()
    if (!problemForm.title.trim()) return
    addTrackedProblem(problemForm.title.trim(), problemForm.topic.trim() || 'Mixed practice', problemForm.difficulty)
    setProblemForm({ title: '', topic: '', difficulty: 'Easy' })
    setAddingProblem(false)
  }
  const reviewProblem = (id, result) => setProgress((current) => ({
    ...current,
    problems: current.problems.map((problem) => {
      if (problem.id !== id) return problem
      const intervalIndex = result === 'again' ? 0 : Math.min(problem.intervalIndex + 1, REVIEW_INTERVALS.length - 1)
      return { ...problem, intervalIndex, reviews: problem.reviews + 1, lastResult: result, lastReviewed: todayIso(), nextReview: addDays(todayIso(), REVIEW_INTERVALS[intervalIndex]) }
    }),
  }))
  const removeProblem = (id) => setProgress((current) => ({ ...current, problems: current.problems.filter((problem) => problem.id !== id) }))
  const timerLabel = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return <section className="page practice-page">
    <PageHeading title="Build interview confidence." copy="A beginner-friendly plan that turns practice into patterns you can recognize." />
    <div className="practice-focus-grid">
      <section className="practice-today panel">
        <div className="practice-today-copy"><div className="day-title-row"><span>{currentDay.id === recommendedDay.id ? 'Today' : 'Editing'} · Day {currentDay.id}</span><div className="day-switcher"><button className="icon-button" disabled={currentDay.id === 1} onClick={() => setSelectedDayId((day) => Math.max(1, day - 1))} aria-label="Previous day"><ArrowRight /></button><select aria-label="Choose practice day" value={currentDay.id} onChange={(event) => setSelectedDayId(Number(event.target.value))}>{PRACTICE_DAYS.map((day) => <option value={day.id} key={day.id}>Day {day.id}{isDayComplete(day, progress) ? ' ✓' : ''}</option>)}</select><button className="icon-button" disabled={currentDay.id === 28} onClick={() => setSelectedDayId((day) => Math.min(28, day + 1))} aria-label="Next day"><ArrowRight /></button></div></div><h2>{currentDay.id === 1 ? 'Start with arrays, not pressure.' : currentDay.title}</h2><p>Two focused problems today, followed by a short reflection.</p></div>
        <div className="today-tasks">
          {currentDay.tasks.map((task, index) => <label className={progress.checks[`${currentDay.id}-${index}`] ? 'complete' : ''} key={task}>
            <input type="checkbox" checked={Boolean(progress.checks[`${currentDay.id}-${index}`])} onChange={() => toggleTask(currentDay, index)} /><span className="task-check"><Check /></span><span>{task}</span><ChevronDown />
          </label>)}
        </div>
        <label className="reflection-field"><span><Brain /> Reflect · {currentDay.reflectionPrompt}</span><textarea value={progress.notes[currentDay.id] || ''} onChange={(event) => updateNote(event.target.value)} placeholder="What clicked? Where did you get stuck? What will you try next time?" /><small>{progress.notes[currentDay.id] ? 'Saved automatically — return to any day to review or edit.' : 'Your note saves automatically.'}</small></label>
        <footer><span><Clock3 /> {timerRunning || seconds < 45 * 60 ? timerLabel : '45–60 min'}</span><button className="button primary" onClick={() => { if (seconds === 0) setSeconds(45 * 60); setTimerRunning((running) => !running) }}>{timerRunning ? 'Pause session' : seconds < 45 * 60 && seconds > 0 ? 'Continue session' : "Start today's session"}</button></footer>
      </section>
      <section className="graduation-panel panel">
        <span>Graduation target</span><h2>Jan 1, 2027</h2><p>{daysToGraduation} days to build momentum</p>
        <div className="goal-path">
          {[['Learn fundamentals', BookOpen], ['Build patterns', Brain], ['Mock interviews', Code2], ['Apply ready', BriefcaseBusiness]].map(([label, Icon], index) => <div className={index === 0 ? 'active' : ''} key={label}><span><Icon /></span><strong>{label}</strong></div>)}
        </div>
      </section>
    </div>
    <section className="practice-roadmap panel">
      <header><h2>4-week roadmap</h2><div className="roadmap-header-actions"><div className="roadmap-progress"><span>{completedDays} of 28 sessions complete</span><i><b style={{ width: `${completedDays / 28 * 100}%` }} /></i></div><button className="text-button" onClick={() => setPlanOpen((open) => !open)} aria-expanded={planOpen}>{planOpen ? 'Hide full plan' : 'View full plan'} <ArrowRight /></button></div></header>
      <div className="roadmap-weeks">
        {PRACTICE_WEEKS.map((week, index) => <article className={activeWeek === index + 1 ? 'active' : ''} key={week.title}><div><span>{index + 1}</span><h3>Week {index + 1} · {week.title}</h3></div>{week.topics.map((topic) => <p key={topic}><i />{topic}</p>)}</article>)}
      </div>
    </section>
    {planOpen ? <section className="full-plan" aria-label="Full 28-day LeetCode plan">
      {PRACTICE_WEEKS.map((week, weekIndex) => <div className="plan-week" key={week.title}><header><span>Week {weekIndex + 1}</span><h2>{week.title}</h2></header><div>{week.days.map((tasks, dayIndex) => { const day = weekIndex * 7 + dayIndex + 1; const planDay = PRACTICE_DAYS[day - 1]; const done = isDayComplete(planDay, progress); return <button className={done ? 'complete' : ''} key={day} onClick={() => { setSelectedDayId(day); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><span>Day {day}</span><div><strong>{tasks[1]} + {tasks[2]}</strong><p>{tasks[0]} · {progress.notes[day] ? 'Reflection saved' : tasks[3]}</p></div><span>{done ? <Check /> : 'Edit day'}</span></button> })}</div></div>)}
    </section> : null}
    <section className="mastery-panel panel">
      <header><div><h2>Mastery tracker</h2><p>Problems return on a 1, 3, 7, 14, then 30-day review rhythm.</p></div><div><span className={dueProblems.length ? 'due-count has-due' : 'due-count'}>{dueProblems.length} due today</span><button className="button outline" onClick={() => setAddingProblem((open) => !open)}><Plus /> Add problem</button><button className="text-button" onClick={() => setTrackerOpen((open) => !open)}>{trackerOpen ? 'Hide' : 'Show'} <ChevronDown /></button></div></header>
      {addingProblem ? <form className="problem-form" onSubmit={submitProblem}><label>Problem name<input autoFocus value={problemForm.title} onChange={(event) => setProblemForm((form) => ({ ...form, title: event.target.value }))} placeholder="e.g. Two Sum" /></label><label>Topic<input value={problemForm.topic} onChange={(event) => setProblemForm((form) => ({ ...form, topic: event.target.value }))} placeholder="e.g. Hash maps" /></label><label>Difficulty<select value={problemForm.difficulty} onChange={(event) => setProblemForm((form) => ({ ...form, difficulty: event.target.value }))}><option>Easy</option><option>Medium</option><option>Hard</option></select></label><button className="button primary">Track problem</button></form> : null}
      {trackerOpen ? <div className="mastery-content">
        <section className="review-queue"><div className="tracker-heading"><h3>Review queue</h3><span>Be honest—struggle is useful data.</span></div>{dueProblems.length ? dueProblems.map((problem) => <article className="review-card" key={problem.id}><div><span className={`difficulty difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span><h4>{problem.title}</h4><p>{problem.topic} · reviewed {problem.reviews} time{problem.reviews === 1 ? '' : 's'}</p></div><div className="review-actions"><button onClick={() => reviewProblem(problem.id, 'again')}><RefreshCw /> Again</button><button onClick={() => reviewProblem(problem.id, 'good')}><Check /> Got it</button></div></article>) : <div className="tracker-empty"><Check /><strong>Review queue clear</strong><span>Your next scheduled problem will appear here.</span></div>}</section>
        <section className="problem-library"><div className="tracker-heading"><h3>Problem library</h3><span>{progress.problems.length} tracked</span></div><div className="problem-list">{progress.problems.map((problem) => <article key={problem.id}><div><strong>{problem.title}</strong><span>{problem.topic} · {problem.difficulty}</span></div><div><time>Review {formatDate(problem.nextReview, true)}</time><button className="icon-button danger" onClick={() => removeProblem(problem.id)} aria-label={`Remove ${problem.title}`}><Trash2 /></button></div></article>)}{!progress.problems.length ? <div className="tracker-empty compact"><Code2 /><strong>No problems tracked yet</strong><span>Complete a daily problem or add one yourself.</span></div> : null}</div></section>
      </div> : null}
    </section>
  </section>
}

function ProfileModal({ profile, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ ...profile }))
  const [saving, setSaving] = useState(false)
  const displayName = [form.firstName, form.lastName].filter(Boolean).join(' ')
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const saved = await onSave(form)
    setSaving(false)
    if (saved) onClose()
  }
  return <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
      <header><div><span>Workspace identity</span><h2 id="profile-modal-title">Profile & account</h2></div><button className="icon-button" onClick={onClose} aria-label="Close profile form"><X /></button></header>
      <form onSubmit={submit}>
        <div className="profile-editor-heading"><span>{initials(displayName)}</span><div><strong>{displayName || 'Your name'}</strong><small>These details appear only in your Northstar workspace.</small></div></div>
        <div className="form-grid">
          <label>First name<input required value={form.firstName} onChange={update('firstName')} autoComplete="given-name" /></label>
          <label>Last name<input required value={form.lastName} onChange={update('lastName')} autoComplete="family-name" /></label>
          <label>Email address<input required type="email" value={form.email} onChange={update('email')} autoComplete="email" /></label>
          <label>Current role<input value={form.role} onChange={update('role')} placeholder="e.g. Final-year student" /></label>
          <label>Location<input value={form.location} onChange={update('location')} autoComplete="country-name" /></label>
        </div>
        <footer><button type="button" className="button subtle" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : <><Check /> Save profile</>}</button></footer>
      </form>
    </section>
  </div>
}

function ApplicationModal({ item, onClose, onSave }) {
  const empty = { company: '', role: '', type: 'Full-time', location: 'Singapore', status: 'Applied', appliedDate: new Date().toISOString().slice(0, 10), nextStep: '', nextDate: '', source: '', salary: '', url: '', notes: '' }
  const [form, setForm] = useState(() => item ? { ...item } : empty)
  const [saving, setSaving] = useState(false)
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const submit = async (event) => { event.preventDefault(); setSaving(true); await onSave(form); setSaving(false) }
  return <div className="modal-layer" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="application-modal-title">
      <header><div><span>{item ? 'Update record' : 'New opportunity'}</span><h2 id="application-modal-title">{item ? 'Edit application' : 'Add application'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close application form"><X /></button></header>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>Company<input required value={form.company} onChange={update('company')} placeholder="e.g. Northwind" /></label>
          <label>Role<input required value={form.role} onChange={update('role')} placeholder="e.g. Product Intern" /></label>
          <label>Status<select value={form.status} onChange={update('status')}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Role type<select value={form.type} onChange={update('type')}><option>Full-time</option><option>Internship</option><option>Contract</option><option>Part-time</option></select></label>
          <label>Location<input value={form.location} onChange={update('location')} /></label>
          <label>Applied date<input required type="date" value={form.appliedDate} onChange={update('appliedDate')} /></label>
          <label>Next step<input value={form.nextStep} onChange={update('nextStep')} placeholder="e.g. Recruiter call" /></label>
          <label>Next date<input type="date" value={form.nextDate} onChange={update('nextDate')} /></label>
          <label>Source<input value={form.source} onChange={update('source')} placeholder="Referral, LinkedIn…" /></label>
          <label>Salary<input value={form.salary} onChange={update('salary')} placeholder="Optional" /></label>
          <label className="span-2">Job link<input type="url" value={form.url} onChange={update('url')} placeholder="https://" /></label>
          <label className="span-2">Notes<textarea value={form.notes} onChange={update('notes')} placeholder="Interview notes, reminders, people to contact…" /></label>
        </div>
        <footer><button type="button" className="button subtle" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : <><Check /> Save application</>}</button></footer>
      </form>
    </section>
  </div>
}

function Toast({ message }) { return message ? <div className="toast"><Check />{message}</div> : null }

export default function App() {
  const [page, setPage] = useState(() => window.location.hash.slice(1) || 'overview')
  const [applications, setApplications] = useState([])
  const [profile, setProfile] = useState({ firstName: 'Alex', lastName: 'Johnson', email: 'alex.johnson@example.com', role: 'Job seeker', location: 'Singapore' })
  const [editing, setEditing] = useState(undefined)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2400) }

  useEffect(() => {
    Promise.all([api.list(), api.getProfile()])
      .then(([nextApplications, nextProfile]) => { setApplications(nextApplications); setProfile(nextProfile) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { window.location.hash = page }, [page])
  useEffect(() => {
    const syncPageFromHash = () => {
      const nextPage = window.location.hash.slice(1)
      if (NAV.some((item) => item.id === nextPage)) setPage(nextPage)
    }
    window.addEventListener('hashchange', syncPageFromHash)
    return () => window.removeEventListener('hashchange', syncPageFromHash)
  }, [])

  const openAdd = () => { setEditing(undefined); setModalOpen(true) }
  const openEdit = (item) => { setEditing(item); setModalOpen(true) }
  const save = async (item) => {
    try {
      const saved = await api.save(item)
      setApplications((current) => item.id ? current.map((entry) => entry.id === saved.id ? saved : entry) : [saved, ...current])
      setModalOpen(false); notify(item.id ? 'Application updated' : 'Application added')
    } catch (e) { setError(e.message) }
  }
  const remove = async (item) => {
    if (!window.confirm(`Delete the application for ${item.role} at ${item.company}?`)) return
    try { await api.remove(item.id); setApplications((current) => current.filter((entry) => entry.id !== item.id)); notify('Application deleted') }
    catch (e) { setError(e.message) }
  }
  const importCsv = async (csv) => {
    try { const imported = await api.importCsv(csv); setApplications(imported); notify(`${imported.length} applications imported`) }
    catch (e) { setError(e.message) }
  }
  const saveProfile = async (details) => {
    try {
      const saved = await api.saveProfile(details)
      setProfile(saved)
      notify('Profile updated')
      return true
    } catch (e) { setError(e.message); return false }
  }

  const pages = {
    overview: <Overview applications={applications} setPage={setPage} onEdit={openEdit} profile={profile} />,
    applications: <Applications applications={applications} onEdit={openEdit} onDelete={remove} />,
    pipeline: <Pipeline applications={applications} onEdit={openEdit} />,
    practice: <Practice />,
  }
  return <AppShell page={page} setPage={setPage} onAdd={openAdd} onImport={importCsv} profile={profile} onSaveProfile={saveProfile}>
    {loading ? <div className="loading"><span /><p>Finding your north star…</p></div> : pages[page] || pages.overview}
    {modalOpen ? <ApplicationModal item={editing} onClose={() => setModalOpen(false)} onSave={save} /> : null}
    {error ? <div className="error-banner"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X /></button></div> : null}
    <Toast message={toast} />
  </AppShell>
}
