import { useEffect, useMemo, useState } from 'react'
import { ClerkProvider, SignIn, useAuth } from '@clerk/react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import { getEntryScreen } from './appFlow.js'
import {
  BRANCH_OPTIONS,
  DEFAULT_PROFILE,
  DEFAULT_SEMESTER_RESULTS,
  JNTUK_R23_CONFIG,
  SEMESTER_OPTIONS,
  SUBJECT_BANK,
} from './config/jntukR23.js'
import {
  calculateAcademicSummary,
  calculateGradePoint,
  calculateSGPA,
  gradeOptions,
  migrateGrade,
} from './services/calculationService.js'

const STORAGE_KEY = 'jntuk-r23-dashboard'
const COURSE_TYPES = JNTUK_R23_CONFIG.courseTypes
const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'calculator', label: 'Calculator', icon: '＋' },
  { id: 'sgpa', label: 'SGPA', icon: '▤' },
  { id: 'cgpa', label: 'CGPA', icon: '⌁' },
  { id: 'profile', label: 'Profile', icon: '◉' },
]
const GRADE_CLASS = { S: 'grade-s', A: 'grade-a', B: 'grade-b', C: 'grade-c', D: 'grade-d', E: 'grade-e', F: 'grade-f', Ab: 'grade-ab' }

function normalizeBranch(branch) {
  if (BRANCH_OPTIONS.includes(branch)) return branch
  if (branch?.includes('Computer Science')) return 'CSE'
  if (branch?.includes('Electronics')) return 'ECE'
  return 'CSE'
}

function normalizeProfile(profile = {}) {
  return { ...DEFAULT_PROFILE, ...profile, branch: normalizeBranch(profile.branch || DEFAULT_PROFILE.branch) }
}

function normalizeSemesterResults(results = [], sourceGradeScale = JNTUK_R23_CONFIG.gradeScaleVersion) {
  return results.map((result) => {
    const subjects = (result.subjects || []).map((subject) => {
      const mappedGrade = migrateGrade(subject.grade, sourceGradeScale)
      return { ...subject, grade: gradeOptions.includes(mappedGrade) ? mappedGrade : 'F', courseType: subject.courseType || 'Theory' }
    })
    const performance = calculateSGPA(subjects)
    return { ...result, subjects, sgpa: performance.sgpa, percentage: performance.percentage, backlogs: performance.backlogs }
  })
}

function readLocalRecord() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return null
    const record = JSON.parse(saved)
    return {
      gradeScaleVersion: JNTUK_R23_CONFIG.gradeScaleVersion,
      profile: normalizeProfile(record.profile),
      semesterResults: normalizeSemesterResults(
        Array.isArray(record.semesterResults) ? record.semesterResults : DEFAULT_SEMESTER_RESULTS,
        Number(record.gradeScaleVersion || 1),
      ),
    }
  } catch {
    return null
  }
}

function AccountButton({ profile, onOpenProfile }) {
  const label = profile.name || 'Student'
  return (
    <button className="account-control account-button" type="button" onClick={onOpenProfile} aria-label="Open student profile">
      <div className="avatar" aria-hidden="true">{label.charAt(0).toUpperCase()}</div>
      <span className="account-name">{label}</span>
      <span className="profile-chevron" aria-hidden="true">↗</span>
    </button>
  )
}

function GradeBadge({ grade }) {
  return <span className={`grade-badge ${GRADE_CLASS[grade] || 'grade-f'}`}>{grade}</span>
}

function MetricCard({ label, value, detail, accent = '' }) {
  return (
    <article className={`metric-card ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  )
}

function PerformanceChart({ semesterResults }) {
  const values = useMemo(() => {
    let credits = 0
    let points = 0
    return semesterResults.map((semester) => {
      const semesterSummary = calculateSGPA(semester.subjects || [])
      credits += semesterSummary.totalCredits
      points += semesterSummary.totalCreditPoints
      return {
        label: semester.semester,
        sgpa: semesterSummary.sgpa,
        cgpa: credits ? points / credits : 0,
      }
    })
  }, [semesterResults])

  if (!values.length) return <div className="empty-chart">Add semester results to see your trend.</div>

  const xAt = (index) => values.length === 1 ? 400 : 38 + (index * 724) / (values.length - 1)
  const yAt = (value) => 214 - (Math.max(0, Math.min(10, value)) / 10) * 174
  const sgpaPoints = values.map((value, index) => `${xAt(index)},${yAt(value.sgpa)}`).join(' ')
  const cgpaPoints = values.map((value, index) => `${xAt(index)},${yAt(value.cgpa)}`).join(' ')

  return (
    <div className="chart-wrap">
      <svg className="trend-chart" viewBox="0 0 800 270" role="img" aria-label="Semester SGPA and cumulative CGPA trend">
        {[0, 2, 4, 6, 8, 10].map((tick) => (
          <g key={tick}>
            <line x1="34" x2="770" y1={yAt(tick)} y2={yAt(tick)} className="chart-gridline" />
            <text x="4" y={yAt(tick) + 4} className="chart-axis-label">{tick}</text>
          </g>
        ))}
        <polyline points={cgpaPoints} className="chart-line chart-line-cgpa" />
        <polyline points={sgpaPoints} className="chart-line chart-line-sgpa" />
        {values.map((value, index) => (
          <g key={value.label}>
            <circle cx={xAt(index)} cy={yAt(value.cgpa)} r="4" className="chart-dot chart-dot-cgpa" />
            <circle cx={xAt(index)} cy={yAt(value.sgpa)} r="4" className="chart-dot chart-dot-sgpa" />
            <text x={xAt(index)} y="246" textAnchor="middle" className="chart-axis-label">{value.label}</text>
          </g>
        ))}
      </svg>
      <div className="chart-legend"><span><i className="legend-sgpa" /> SGPA</span><span><i className="legend-cgpa" /> Overall CGPA</span></div>
    </div>
  )
}

function GradeDistribution({ distribution }) {
  const total = Object.values(distribution).reduce((sum, amount) => sum + amount, 0)
  return (
    <div className="distribution-list">
      {gradeOptions.map((grade) => {
        const count = distribution[grade] || 0
        return (
          <div className="distribution-row" key={grade}>
            <GradeBadge grade={grade} />
            <div className="distribution-track"><span className={GRADE_CLASS[grade]} style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></div>
            <strong>{count}</strong>
          </div>
        )
      })}
    </div>
  )
}

function Modal({ title, description, onClose, children, wide = false }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal-sheet ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-grabber" />
        <div className="modal-heading">
          <div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">×</button>
        </div>
        {children}
      </section>
    </div>
  )
}

function SubjectForm({ initialSubject, mode, onCancel, onSave }) {
  const [subject, setSubject] = useState(() => initialSubject || { code: '', name: '', credits: '', grade: '', courseType: 'Theory' })
  const gradePoint = subject.grade ? calculateGradePoint(subject.grade) : '—'

  function submit(event) {
    event.preventDefault()
    const credits = Number(subject.credits)
    if (!Number.isFinite(credits) || credits <= 0) return
    onSave({
      ...subject,
      id: subject.id || `subject-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
      code: subject.code.trim(),
      name: subject.name.trim(),
      credits,
    })
  }

  return (
    <form className="modal-form" onSubmit={submit}>
      <label className="field"><span>Subject code</span><input maxLength="40" value={subject.code} onChange={(event) => setSubject({ ...subject, code: event.target.value })} placeholder="e.g. CS301" required /></label>
      <label className="field"><span>Subject name</span><input maxLength="160" value={subject.name} onChange={(event) => setSubject({ ...subject, name: event.target.value })} placeholder="Subject name" required /></label>
      <div className="form-grid">
        <label className="field"><span>Credits</span><input type="number" inputMode="decimal" min="0.1" max="30" step="0.1" value={subject.credits} onChange={(event) => setSubject({ ...subject, credits: event.target.value })} placeholder="3.0" required /></label>
        <label className="field"><span>Grade</span><select value={subject.grade} onChange={(event) => setSubject({ ...subject, grade: event.target.value })} required><option value="" disabled>Select grade</option>{gradeOptions.map((grade) => <option key={grade} value={grade}>{grade} · {calculateGradePoint(grade)} — {JNTUK_R23_CONFIG.grades[grade].label}</option>)}</select></label>
      </div>
      <div className="form-grid">
        <div className="grade-point-preview"><span>Grade point</span><strong>{gradePoint}</strong></div>
        <label className="field"><span>Course type</span><select value={subject.courseType || 'Theory'} onChange={(event) => setSubject({ ...subject, courseType: event.target.value })}>{COURSE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
      </div>
      <div className="modal-actions"><button className="button button-outline" type="button" onClick={onCancel}>Cancel</button><button className="button button-primary" type="submit">{mode === 'edit' ? 'Save changes' : 'Add subject'}</button></div>
    </form>
  )
}

function LoginPage() {
  const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

  if (!clerkPublishableKey) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-hero">
            <p className="eyebrow">Student portal</p>
            <h1>Set up Clerk to enable sign-in.</h1>
            <p>Add your VITE_CLERK_PUBLISHABLE_KEY in the project environment file to connect the verified login page.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-hero">
          <p className="eyebrow">Student portal</p>
          <h1>Plan your academic journey with confidence.</h1>
          <p>Track subjects, calculate SGPA/CGPA, and stay updated on your academic performance in one place.</p>
          <div className="auth-points">
            <span>SGPA</span>
            <span>CGPA</span>
            <span>Semester tracking</span>
          </div>
        </div>

        <div className="auth-panel">
          <div className="page-title-row" style={{ marginBottom: '16px' }}>
            <div>
              <p className="eyebrow">Welcome back</p>
              <h1 style={{ fontSize: '26px', margin: 0 }}>Login</h1>
            </div>
          </div>

          <SignIn
            routing="hash"
            afterSignInUrl="/"
            afterSignUpUrl="/"
            appearance={{
              variables: {
                colorPrimary: '#4a68ff',
                colorBackground: '#ffffff',
                colorInputBackground: '#f8f9fc',
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}

function HomePage({ profile, summary, setView, setSelectedSemester, onAddSubject }) {
  const latest = summary.semesterPerformance.at(-1)
  const trend = summary.semesterPerformance.slice(-4)
  return (
    <div className="page-stack">
      <section className="welcome-row">
        <div><p className="eyebrow">JNTUK R23 · B.TECH</p><h1>Welcome, {profile.name || 'Student'}</h1><p className="muted-copy">Your academic picture, all in one place.</p></div>
        <span className="year-chip">{profile.branch} <i /> {profile.currentYear}</span>
      </section>
      <section className="metric-grid">
        <MetricCard label="Current CGPA" value={summary.cgpa.toFixed(2)} detail={summary.classAwarded} accent="metric-blue" />
        <MetricCard label="Percentage" value={`${summary.percentage.toFixed(2)}%`} detail="R23 conversion" />
        <MetricCard label="Credits earned" value={summary.totalCredits.toFixed(1)} detail="Across saved semesters" />
        <MetricCard label="Backlogs" value={summary.totalBacklogs} detail={summary.totalBacklogs ? 'Needs attention' : 'All clear'} accent={summary.totalBacklogs ? 'metric-red' : ''} />
      </section>
      <section className="quick-actions" aria-label="Quick actions">
        <button type="button" onClick={() => setView('calculator')}><span>＋</span><strong>Calculate SGPA</strong><small>Edit subjects and grades</small></button>
        <button type="button" onClick={onAddSubject}><span>✎</span><strong>Add a subject</strong><small>Update semester details</small></button>
        <button type="button" onClick={() => setView('sgpa')}><span>▤</span><strong>View results</strong><small>Open semester history</small></button>
        <button type="button" onClick={() => setView('cgpa')}><span>⌁</span><strong>CGPA overview</strong><small>Review your progress</small></button>
      </section>
      <section className="home-lower">
        <article className="surface recent-surface">
          <div className="section-heading"><div><p className="eyebrow">Latest result</p><h2>Recent semester</h2></div><button className="text-action" type="button" onClick={() => setView('sgpa')}>All semesters <span>→</span></button></div>
          {latest ? <button className="latest-result" type="button" onClick={() => { setSelectedSemester(latest.semester); setView('calculator') }}>
            <div className="latest-icon">{latest.semester}</div><div className="latest-copy"><strong>{latest.semester} semester</strong><span>{latest.branch} · {latest.academicYear}</span></div><div className="latest-score"><strong>{latest.sgpa.toFixed(2)}</strong><span>SGPA</span></div><span className="chevron">→</span>
          </button> : <div className="empty-state">Add a semester result to start tracking your progress.</div>}
          {latest && <div className="latest-facts"><span>{latest.subjects.length} subjects</span><i /><span>{calculateSGPA(latest.subjects).totalCredits.toFixed(1)} credits</span><i /><span>{latest.backlogs} backlogs</span></div>}
        </article>
        <article className="surface home-trend">
          <div className="section-heading"><div><p className="eyebrow">Recent semesters</p><h2>Performance trend</h2></div><button className="icon-button" type="button" aria-label="Open CGPA analytics" onClick={() => setView('cgpa')}>↗</button></div>
          <div className="mini-bars">{trend.map((semester) => <div className="mini-bar-item" key={semester.id}><strong>{semester.sgpa.toFixed(2)}</strong><span className="mini-bar-track"><i style={{ height: `${semester.sgpa * 10}%` }} /></span><small>{semester.semester}</small></div>)}</div>
        </article>
      </section>
      <footer className="quiet-footer">JNTUK R23 <span>·</span> Grades and credits can be updated anytime.</footer>
    </div>
  )
}

function CalculatorPage({
  profile, semesterResults, selectedSemester, setSelectedSemester, onAddSemester, onAddSubject,
  onEditSubject, onDeleteSubject, onDeleteSemester,
}) {
  const selected = semesterResults.find((result) => result.id === selectedSemester)
  const stats = useMemo(() => calculateSGPA(selected?.subjects || []), [selected])
  return (
    <div className="page-stack">
      <section className="page-title-row"><div><p className="eyebrow">Grade workspace</p><h1>Semester calculator</h1><p className="muted-copy">Edit subjects and see your semester result update instantly.</p></div><span className="year-chip">R23 rules <i /> Active</span></section>
      <section className="surface calculator-surface">
        <div className="calculator-actions">
          <button className="button button-outline" type="button" onClick={onAddSemester}><span>＋</span> Semester</button>
          <button className="button button-outline" type="button" onClick={() => selected && onAddSubject()} disabled={!selected}><span>＋</span> Subject</button>
          <button className="button button-delete" type="button" onClick={() => selected && onDeleteSemester()} disabled={!selected}><span>⌫</span> Delete</button>
        </div>
        <div className="semester-tabs" role="tablist" aria-label="Choose semester">
          {semesterResults.map((semester) => <button key={semester.id} type="button" role="tab" aria-selected={selectedSemester === semester.id} className={selectedSemester === semester.id ? 'semester-tab active' : 'semester-tab'} onClick={() => setSelectedSemester(semester.id)}>{semester.semester} <span>Sem</span></button>)}
          {!semesterResults.length && <p className="empty-inline">Add a semester to begin.</p>}
        </div>
        {selected ? <>
          <div className="subject-list-heading"><div><p className="eyebrow">{selected.branch || profile.branch} · {selected.academicYear || profile.academicYear}</p><h2>{selected.semester} semester</h2></div><span className="subject-total">{selected.subjects.length} subjects</span></div>
          <div className="subject-table-head"><span>Subject</span><span>Grade</span><span>Credits</span><span>Actions</span></div>
          <div className="subject-list">
            {selected.subjects.map((subject, index) => <article className="subject-row" key={subject.id || `${subject.code}-${index}`}>
              <div className="subject-info"><strong>{subject.name}</strong><span>{subject.code} <i /> {subject.courseType || 'Theory'}</span></div>
              <div className="subject-grade"><GradeBadge grade={subject.grade} />{(subject.grade === 'F' || subject.grade === 'Ab') && <span className="backlog-label">BACKLOG</span>}</div>
              <span className="subject-credit">{Number(subject.credits).toFixed(Number(subject.credits) % 1 ? 1 : 0)}</span>
              <div className="subject-actions"><button className="icon-button edit-icon" type="button" aria-label={`Edit ${subject.name}`} title="Edit subject" onClick={() => onEditSubject(subject, index)}>✎</button><button className="icon-button delete-icon" type="button" aria-label={`Delete ${subject.name}`} title="Remove subject" onClick={() => onDeleteSubject(subject, index)}>×</button></div>
            </article>)}
            {!selected.subjects.length && <div className="empty-state">This semester has no subjects yet. Add subjects to calculate SGPA.</div>}
          </div>
          <button className="add-subject-link" type="button" onClick={onAddSubject}><span>＋</span> Add subject to {selected.semester}</button>
          <section className="semester-summary">
            <div className="summary-heading"><div><p className="eyebrow">Live calculation</p><h2>Semester summary</h2></div><span className="summary-method">Credit weighted</span></div>
            <div className="summary-metrics">
              <div><span>Total subjects</span><strong>{stats.subjects.length}</strong></div>
              <div><span>Total credits</span><strong>{stats.totalCredits.toFixed(1)}</strong></div>
              <div><span>Credit points</span><strong>{stats.totalCreditPoints.toFixed(1)}</strong></div>
              <div className="summary-sgpa"><span>SGPA</span><strong>{stats.sgpa.toFixed(2)}</strong></div>
              <div className={stats.backlogs ? 'summary-backlogs has-backlogs' : 'summary-backlogs'}><span>Backlogs</span><strong>{stats.backlogs}</strong></div>
            </div>
            <p className="formula-note">SGPA = Σ (credits × grade points) ÷ total credits</p>
          </section>
          <section className="calculation-breakdown" aria-label="SGPA calculation breakdown">
            <div className="summary-heading"><div><p className="eyebrow">Verify each subject</p><h2>Calculation breakdown</h2></div></div>
            <div className="breakdown-table-wrap">
              <table className="breakdown-table">
                <thead><tr><th>Subject</th><th>Credit</th><th>Grade</th><th>Point</th><th>Credit point</th></tr></thead>
                <tbody>{stats.subjects.map((subject, index) => <tr key={`${subject.code}-${index}`}><td>{subject.name}</td><td>{Number(subject.credits).toFixed(Number(subject.credits) % 1 ? 1 : 0)}</td><td><GradeBadge grade={subject.grade} /></td><td>{subject.gradePoint}</td><td>{subject.weightedPoints.toFixed(1)}</td></tr>)}</tbody>
                <tfoot><tr><th>Total</th><th>{stats.totalCredits.toFixed(1)}</th><th colSpan="2">Credit points</th><th>{stats.totalCreditPoints.toFixed(1)}</th></tr></tfoot>
              </table>
            </div>
            <p className="formula-note">SGPA = {stats.totalCreditPoints.toFixed(1)} ÷ {stats.totalCredits.toFixed(1)} = <strong>{stats.sgpa.toFixed(2)}</strong></p>
          </section>
        </> : <div className="empty-state empty-large">Add a semester to begin building your academic history.</div>}
      </section>
    </div>
  )
}

function SGPAHistoryPage({ semesterResults, summary, onOpenSemester }) {
  return (
    <div className="page-stack">
      <section className="page-title-row"><div><p className="eyebrow">Academic record</p><h1>Semester SGPA</h1><p className="muted-copy">A subject-level view of every semester you have saved.</p></div><span className="year-chip">{summary.totalSemesters} saved <i /> semesters</span></section>
      <section className="semester-history-list">
        {summary.semesterPerformance.map((semester) => {
          const stats = calculateSGPA(semester.subjects)
          return <button className="history-card" type="button" key={semester.id} onClick={() => onOpenSemester(semester.semester)}>
            <span className="history-term">{semester.semester}<small>Sem</small></span>
            <span className="history-main"><strong>{semester.branch} · {semester.academicYear}</strong><span>{semester.subjects.length} subjects <i /> {stats.totalCredits.toFixed(1)} credits</span></span>
            <span className="history-metric"><small>SGPA</small><strong>{stats.sgpa.toFixed(2)}</strong></span>
            <span className="history-metric history-percentage"><small>Percentage</small><strong>{stats.percentage.toFixed(2)}%</strong></span>
            <span className={stats.backlogs ? 'history-backlog has-backlogs' : 'history-backlog'}>{stats.backlogs} backlogs</span>
            <span className="chevron">→</span>
          </button>
        })}
        {!semesterResults.length && <div className="surface empty-state">No semesters yet. Add your first semester in Calculator.</div>}
      </section>
    </div>
  )
}

function CGPADashboard({ summary, semesterResults }) {
  return (
    <div className="page-stack">
      <section className="page-title-row"><div><p className="eyebrow">Cumulative performance</p><h1>CGPA overview</h1><p className="muted-copy">A credit-weighted view of your progress across semesters.</p></div><span className="year-chip">{summary.classAwarded}</span></section>
      <section className="cgpa-hero surface">
        <div className="progress-ring" style={{ '--progress': Math.min(100, summary.cgpa * 10) }}><div><strong>{summary.cgpa.toFixed(2)}</strong><span>CGPA</span></div></div>
        <div className="cgpa-copy"><p className="eyebrow">Overall standing</p><h2>{summary.classAwarded}</h2><p>Calculated from {summary.totalCredits.toFixed(1)} credits across {summary.totalSemesters} saved semesters.</p><div className="cgpa-inline"><span><strong>{summary.percentage.toFixed(2)}%</strong> Percentage</span><i /><span><strong>{summary.totalBacklogs}</strong> Backlogs</span></div></div>
        <div className="progress-ring percentage-ring" style={{ '--progress': summary.percentage }}><div><strong>{summary.percentage.toFixed(1)}%</strong><span>Percentage</span></div></div>
      </section>
      <section className="surface analytics-surface">
        <div className="section-heading"><div><p className="eyebrow">Weighted trend</p><h2>CGPA progress</h2></div><span className="chart-key"><i /> Semester SGPA <i className="chart-key-secondary" /> Overall CGPA</span></div>
        <PerformanceChart semesterResults={summary.semesterPerformance} />
      </section>
      <section className="analytics-lower">
        <article className="surface distribution-surface"><div className="section-heading"><div><p className="eyebrow">All saved subjects</p><h2>Grade distribution</h2></div><span className="small-total">{Object.values(summary.gradeDistribution).reduce((a, b) => a + b, 0)} total</span></div><GradeDistribution distribution={summary.gradeDistribution} /></article>
        <article className="surface performance-surface"><div className="section-heading"><div><p className="eyebrow">SGPA guide</p><h2>Performance bands</h2></div></div><div className="performance-bands">{[
          ['9.00–10.00', 'Excellent', 'band-excellent'], ['8.00–8.99', 'Very good', 'band-very-good'], ['7.00–7.99', 'Good', 'band-good'], ['6.00–6.99', 'Average', 'band-average'], ['5.00–5.99', 'Below average', 'band-low'], ['Below 5.00', 'Needs improvement', 'band-needs-improvement'],
        ].map(([range, label, className]) => <div className="performance-band" key={range}><i className={className} /><span>{range}</span><strong>{label}</strong></div>)}</div></article>
      </section>
      <p className="formula-note">CGPA = Σ (semester credit × grade point) ÷ total credits. Percentage rule is configured in JNTUK R23 settings.</p>
    </div>
  )
}

function ProfilePage({ profile, setProfile }) {
  const fields = [
    ['name', 'Name'], ['rollNumber', 'Roll number'], ['college', 'College'], ['branch', 'Branch'], ['degree', 'Degree'], ['regulation', 'Regulation'], ['academicYear', 'Academic year'], ['currentYear', 'Current year'], ['currentSemester', 'Current semester'], ['email', 'Email'], ['expectedGraduation', 'Expected graduation'],
  ]
  return (
    <div className="page-stack">
      <section className="page-title-row"><div><p className="eyebrow">Student details</p><h1>Your profile</h1><p className="muted-copy">Your academic details are saved with your results.</p></div><div className="profile-monogram">{(profile.name || 'S').charAt(0).toUpperCase()}</div></section>
      <section className="surface profile-surface">
        <div className="profile-header"><div><h2>{profile.name || 'Student'}</h2><p>{profile.email || 'Add an email address'}</p></div><span className="regulation-pill">JNTUK · R23</span></div>
        <div className="profile-fields">{fields.map(([key, label]) => key === 'branch' ? <label className="field" key={key}><span>{label}</span><select value={normalizeBranch(profile.branch)} onChange={(event) => setProfile((current) => ({ ...current, branch: event.target.value }))}>{BRANCH_OPTIONS.map((branch) => <option key={branch}>{branch}</option>)}</select></label> : <label className="field" key={key}><span>{label}</span><input value={profile[key] || ''} type={key === 'email' ? 'email' : 'text'} maxLength="160" onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div>
        <p className="profile-note">Academic records are stored in this browser only. They are not uploaded or synchronized between devices.</p>
      </section>
    </div>
  )
}

function AcademicApp({ view, setView }) {
  const [profile, setProfile] = useState(() => readLocalRecord()?.profile || normalizeProfile())
  const [semesterResults, setSemesterResults] = useState(() => readLocalRecord()?.semesterResults || normalizeSemesterResults(DEFAULT_SEMESTER_RESULTS, 1))
  const [selectedSemester, setSelectedSemester] = useState('3-1')
  const [modal, setModal] = useState(null)
  const [recordStatus, setRecordStatus] = useState('saved')
  const [recordError, setRecordError] = useState('')
  const activeBranch = normalizeBranch(profile.branch)

  const sortedResults = useMemo(() => [...semesterResults].sort((a, b) => SEMESTER_OPTIONS.indexOf(a.semester) - SEMESTER_OPTIONS.indexOf(b.semester)), [semesterResults])
  const summary = useMemo(() => calculateAcademicSummary(sortedResults), [sortedResults])
  const selectedResult = sortedResults.find((result) => result.id === selectedSemester)

  useEffect(() => {
    let active = true
    setRecordStatus('saving')
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ gradeScaleVersion: JNTUK_R23_CONFIG.gradeScaleVersion, profile, semesterResults }))
        if (active) { setRecordStatus('saved'); setRecordError('') }
      } catch (error) {
        if (active) { setRecordStatus('error'); setRecordError(`Could not save in this browser: ${error.message}`) }
      }
    }, 180)
    return () => { active = false; clearTimeout(timeout) }
  }, [profile, semesterResults])

  const updateSemester = (semesterId, update) => {
    setSemesterResults((current) => current.map((result) => result.id === semesterId ? { ...result, ...update } : result))
  }

  const saveSubject = (subject, index = -1) => {
    if (!selectedResult) return
    const subjects = [...selectedResult.subjects]
    if (index < 0) subjects.push(subject)
    else subjects[index] = subject
    updateSemester(selectedResult.id, { subjects })
    setModal(null)
  }

  const openAddSemester = () => setModal({ type: 'add-semester', year: '1', term: '1' })
  const addSemester = (event) => {
    event.preventDefault()
    const semester = `${modal.year}-${modal.term}`
    if (sortedResults.some((result) => result.semester === semester)) {
      setModal({ ...modal, error: `${semester} is already in your academic history.` })
      return
    }
    const subjects = (SUBJECT_BANK[activeBranch]?.[semester] || []).map((subject, index) => ({ ...subject, id: `${semester}-${index}`, grade: 'A' }))
    const next = { id: semester, branch: activeBranch, semester, academicYear: profile.academicYear || '', subjects }
    setSemesterResults((current) => [...current, next])
    setSelectedSemester(semester)
    setModal(null)
  }

  const confirmDeleteSubject = () => {
    if (!selectedResult || !modal) return
    updateSemester(selectedResult.id, { subjects: selectedResult.subjects.filter((_, index) => index !== modal.index) })
    setModal(null)
  }

  const confirmDeleteSemester = () => {
    if (!selectedResult) return
    const nextResults = sortedResults.filter((result) => result.id !== selectedResult.id)
    setSemesterResults(nextResults)
    setSelectedSemester(nextResults[0]?.id || '')
    setModal(null)
  }

  const openSemester = (semester) => {
    setSelectedSemester(semester)
    setView('calculator')
  }

  const openAddSubject = () => setModal({ type: 'subject', mode: 'add', subject: null, index: -1 })
  const openEditSubject = (subject, index) => setModal({ type: 'subject', mode: 'edit', subject: { ...subject }, index })
  const quickAddSubject = () => {
    const targetSemester = sortedResults.find((result) => result.id === selectedSemester) || sortedResults[0]
    if (!targetSemester) {
      setView('calculator')
      openAddSemester()
      return
    }
    setSelectedSemester(targetSemester.id)
    setView('calculator')
    openAddSubject()
  }

  let page
  if (view === 'calculator') page = <CalculatorPage profile={profile} semesterResults={sortedResults} selectedSemester={selectedSemester} setSelectedSemester={setSelectedSemester} onAddSemester={openAddSemester} onAddSubject={openAddSubject} onEditSubject={openEditSubject} onDeleteSubject={(subject, index) => setModal({ type: 'delete-subject', subject, index })} onDeleteSemester={() => setModal({ type: 'delete-semester' })} />
  else if (view === 'sgpa') page = <SGPAHistoryPage semesterResults={sortedResults} summary={summary} onOpenSemester={openSemester} />
  else if (view === 'cgpa') page = <CGPADashboard summary={summary} semesterResults={sortedResults} />
  else if (view === 'profile') page = <ProfilePage profile={profile} setProfile={setProfile} />
  else page = <HomePage profile={profile} summary={summary} setView={setView} setSelectedSemester={setSelectedSemester} onAddSubject={quickAddSubject} />

  return (
    <div className="app-frame">
      <aside className="desktop-sidebar">
        <div className="sidebar-brand"><span className="brand-mark">R23</span><span><strong>JNTUK</strong><small>ACADEMIC TRACKER</small></span></div>
        <p className="sidebar-label">Workspace</p>
        <nav className="side-nav" aria-label="Main navigation">{NAV_ITEMS.map((item) => <button key={item.id} className={view === item.id ? 'side-link active' : 'side-link'} type="button" onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="sidebar-bottom"><div className={`record-status ${recordStatus}`} title={recordError || undefined} aria-live="polite"><i />{recordStatus === 'saving' ? 'Saving in this browser' : recordStatus === 'error' ? 'Local save issue' : 'Saved locally'}</div><div className="sidebar-regulation">B.Tech <span>·</span> Regulation R23</div><AccountButton profile={profile} onOpenProfile={() => setView('profile')} /></div>
      </aside>
      <main className="main-column">
        <header className="mobile-header"><div className="mobile-brand"><span className="brand-mark">R23</span><span><strong>JNTUK</strong><small>Student workspace</small></span></div><div className={`sync-dot ${recordStatus}`} title={recordError || (recordStatus === 'saved' ? 'Saved in this browser' : 'Saving locally')} aria-label={recordStatus === 'saved' ? 'Saved locally' : recordStatus === 'error' ? 'Local save issue' : 'Saving locally'} /><AccountButton profile={profile} onOpenProfile={() => setView('profile')} /></header>
        <div className="page-content">{page}</div>
        <footer className="mobile-sync-note"><span className={`sync-dot ${recordStatus}`} />{recordStatus === 'error' ? recordError : recordStatus === 'saving' ? 'Saving your changes' : 'Saved in this browser only'}</footer>
      </main>
      <nav className="bottom-navigation" aria-label="Main navigation">{NAV_ITEMS.map((item) => <button key={item.id} type="button" className={view === item.id ? 'bottom-nav-item active' : 'bottom-nav-item'} onClick={() => setView(item.id)} aria-current={view === item.id ? 'page' : undefined}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>

      {modal?.type === 'subject' && <Modal title={modal.mode === 'edit' ? 'Edit subject' : 'Add subject'} description={`${selectedSemester} semester`} onClose={() => setModal(null)}><SubjectForm key={`${modal.mode}-${modal.index}`} mode={modal.mode} initialSubject={modal.subject} onCancel={() => setModal(null)} onSave={(subject) => saveSubject(subject, modal.index)} /></Modal>}
      {modal?.type === 'add-semester' && <Modal title="Add semester" description="Choose the year and term for this result." onClose={() => setModal(null)}><form className="modal-form" onSubmit={addSemester}><div className="form-grid"><label className="field"><span>Year</span><select value={modal.year} onChange={(event) => setModal({ ...modal, year: event.target.value, error: '' })}>{[1, 2, 3, 4].map((year) => <option key={year} value={year}>{year}</option>)}</select></label><label className="field"><span>Semester</span><select value={modal.term} onChange={(event) => setModal({ ...modal, term: event.target.value, error: '' })}><option value="1">1</option><option value="2">2</option></select></label></div>{modal.error && <p className="form-error">{modal.error}</p>}<div className="modal-actions"><button className="button button-outline" type="button" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" type="submit">Add {modal.year}-{modal.term}</button></div></form></Modal>}
      {modal?.type === 'delete-subject' && <Modal title="Remove subject?" description={`Are you sure you want to remove ${modal.subject.name}?`} onClose={() => setModal(null)}><div className="modal-actions"><button className="button button-outline" type="button" onClick={() => setModal(null)}>Cancel</button><button className="button button-danger" type="button" onClick={confirmDeleteSubject}>Remove subject</button></div></Modal>}
      {modal?.type === 'delete-semester' && <Modal title={`Delete ${selectedResult?.semester} semester?`} description="This removes the semester and all its subjects and result history." onClose={() => setModal(null)}><div className="modal-actions"><button className="button button-outline" type="button" onClick={() => setModal(null)}>Cancel</button><button className="button button-danger" type="button" onClick={confirmDeleteSemester}>Delete semester</button></div></Modal>}
    </div>
  )
}

function RoutedWorkspace({ entryScreen }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const route = pathname.replace(/^\/+|\/+$/g, '')
  const view = entryScreen === 'home' && !route ? 'home' : NAV_ITEMS.some((item) => item.id === route) ? route : 'home'
  const setView = (nextView) => navigate(nextView === 'home' ? '/' : `/${nextView}`)
  return <AcademicApp view={view} setView={setView} />
}

function ClerkApp() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <div className="loading-screen">Loading authentication…</div>
  }

  if (!isSignedIn) {
    return <LoginPage />
  }

  const entryScreen = getEntryScreen(isSignedIn)

  return (
    <Routes>
      <Route path="/" element={<RoutedWorkspace entryScreen={entryScreen} />} />
      <Route path="/:view" element={<RoutedWorkspace entryScreen={entryScreen} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

  if (!clerkPublishableKey) {
    return <LoginPage />
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ClerkApp />
    </ClerkProvider>
  )
}
