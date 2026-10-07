import { JNTUK_R23_CONFIG } from '../config/jntukR23.js'

export const gradeOptions = Object.keys(JNTUK_R23_CONFIG.grades)
const gradeMigrations = {
  1: { O: 'S', 'A+': 'A', A: 'B', 'B+': 'C', B: 'D', C: 'E', P: 'E' },
  2: { O: 'S', S: 'A', A: 'B', B: 'C', C: 'D', D: 'E', E: 'E' },
}

export function migrateGrade(grade, sourceVersion) {
  if (sourceVersion >= JNTUK_R23_CONFIG.gradeScaleVersion) return grade
  return gradeMigrations[sourceVersion]?.[grade] ?? grade
}

export function calculateGradePoint(grade) {
  return JNTUK_R23_CONFIG.grades[grade]?.point ?? 0
}

export function calculatePercentage(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0
  const { multiplier, offset } = JNTUK_R23_CONFIG.percentage
  return Number(Math.max(0, Math.min(100, (numericValue - offset) * multiplier)).toFixed(2))
}

export function calculateBacklogs(subjects = []) {
  return (Array.isArray(subjects) ? subjects : []).filter((subject) => subject?.grade === 'F' || subject?.grade === 'Ab').length
}

export function calculateTotalCredits(subjects = []) {
  return (Array.isArray(subjects) ? subjects : []).reduce((total, subject) => {
    const credits = Number(subject?.credits ?? subject?.credit ?? 0)
    return total + (Number.isFinite(credits) && credits > 0 ? credits : 0)
  }, 0)
}

export function normalizeSubject(subject) {
  const credit = Number(subject?.credits ?? subject?.credit ?? 0)
  const grade = String(subject?.grade ?? '').trim()
  const gradePoint = calculateGradePoint(grade)

  return {
    ...subject,
    code: subject?.code ?? subject?.subjectCode ?? 'SUB',
    name: subject?.name ?? subject?.subjectName ?? 'Unnamed Subject',
    credits: Number.isFinite(credit) ? credit : 0,
    grade: grade || 'F',
    gradePoint,
  }
}

export function calculateSGPA(subjects = []) {
  const normalized = (Array.isArray(subjects) ? subjects : [])
    .map(normalizeSubject)
    .filter((subject) => Number(subject.credits) > 0)

  if (!normalized.length) {
    return {
      totalCredits: 0,
      totalCreditPoints: 0,
      sgpa: 0,
      percentage: 0,
      backlogs: 0,
      subjects: [],
    }
  }

  let totalCredits = 0
  let totalCreditPoints = 0
  let backlogs = 0

  const processed = normalized.map((subject) => {
    const credit = Number(subject.credits)
    const gradePoint = Number(subject.gradePoint ?? 0)
    const weightedPoints = credit * gradePoint

    totalCredits += credit
    totalCreditPoints += weightedPoints

    if (subject.grade === 'F' || subject.grade === 'Ab') {
      backlogs += 1
    }

    return {
      ...subject,
      weightedPoints,
    }
  })

  const sgpa = totalCredits ? totalCreditPoints / totalCredits : 0

  return {
    totalCredits,
    totalCreditPoints,
    sgpa: Number(sgpa.toFixed(2)),
    percentage: calculatePercentage(sgpa),
    backlogs,
    subjects: processed,
  }
}

export function calculateCGPA(semesterResults = []) {
  const validSemesters = (semesterResults || []).filter((result) => Array.isArray(result?.subjects))

  if (!validSemesters.length) {
    return {
      cgpa: 0,
      percentage: 0,
      totalCredits: 0,
      totalBacklogs: 0,
      totalSemesters: 0,
    }
  }

  let totalCredits = 0
  let totalWeightedPoints = 0
  let totalBacklogs = 0

  for (const result of validSemesters) {
    const performance = calculateSGPA(result.subjects)
    totalCredits += performance.totalCredits
    totalWeightedPoints += performance.totalCreditPoints
    totalBacklogs += performance.backlogs
  }

  const cgpa = totalCredits ? totalWeightedPoints / totalCredits : 0

  return {
    cgpa: Number(cgpa.toFixed(2)),
    percentage: calculatePercentage(cgpa),
    totalCredits,
    totalBacklogs,
    totalSemesters: validSemesters.length,
  }
}

export function calculateClass(cgpa = 0) {
  const safeValue = Number.isFinite(cgpa) ? cgpa : 0

  for (const band of JNTUK_R23_CONFIG.classBands) {
    if (safeValue >= band.min) {
      return band.label
    }
  }

  return 'Fail'
}

export function calculateAcademicSummary(semesterResults = []) {
  const semesterPerformance = (semesterResults || []).map((result) => {
    const performance = calculateSGPA(result.subjects || [])
    return {
      ...result,
      sgpa: performance.sgpa,
      percentage: performance.percentage,
      backlogs: performance.backlogs,
    }
  })

  const { cgpa, percentage, totalCredits, totalBacklogs, totalSemesters } = calculateCGPA(semesterPerformance)
  const sgpas = semesterPerformance.map((result) => Number(result.sgpa || 0))
  const highestSGPA = sgpas.length ? Math.max(...sgpas) : 0
  const lowestSGPA = sgpas.length ? Math.min(...sgpas) : 0

  return {
    cgpa,
    percentage,
    totalCredits,
    totalBacklogs,
    totalSemesters,
    highestSGPA: Number(highestSGPA.toFixed(2)),
    lowestSGPA: Number(lowestSGPA.toFixed(2)),
    classAwarded: calculateClass(cgpa),
    gradeDistribution: calculateGradeDistribution(semesterPerformance),
    semesterPerformance,
  }
}

export function calculateGradeDistribution(semesterResults = []) {
  const counts = Object.fromEntries(gradeOptions.map((grade) => [grade, 0]))
  for (const result of semesterResults || []) {
    for (const subject of result.subjects || []) {
      const grade = subject.grade
      if (Object.hasOwn(counts, grade)) counts[grade] += 1
    }
  }
  return counts
}

export function getSelectedSemesterSubjects(branch, semesterKey) {
  const branchData = (branch && semesterKey) ? (window.__JNTUK_SUBJECTS ?? {})[branch]?.[semesterKey] ?? [] : []
  return branchData
}
