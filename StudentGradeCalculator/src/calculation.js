import { branchSubjects } from './data/branchSubjects.js'
import { calculateGradePoint, calculatePercentage, gradeOptions } from './services/calculationService.js'

const semesterKey = (year, semester) => `${year}|${semester}`

export function calculateSemester({ branch, year, semester, grades = {}, extraSubjects = [] }) {
  const subjects = branchSubjects[branch]?.[year]?.[semester]
  if (!subjects) {
    throw new Error('Invalid branch, year, or semester.')
  }

  const resultSubjects = subjects.map((subject, index) => {
    const grade = grades[`${year}|${semester}|${index}`] ?? 'F'
    if (!gradeOptions.includes(grade)) {
      throw new Error(`Invalid grade for ${subject.name}.`)
    }
    const gradePoint = calculateGradePoint(grade)
    return {
      ...subject,
      grade,
      gradePoint,
      weightedPoints: subject.credit * gradePoint,
    }
  })

  for (const extra of extraSubjects.slice(0, 20)) {
    const name = typeof extra.name === 'string' ? extra.name.trim().slice(0, 100) : ''
    const credit = Number(extra.credit)
    const enteredGrade = typeof extra.grade === 'string' ? extra.grade.trim() : ''
    const grade = enteredGrade.toLowerCase() === 'ab' ? 'Ab' : enteredGrade.toUpperCase()
    if (!name || !Number.isFinite(credit) || credit <= 0 || credit > 30 || !gradeOptions.includes(grade)) {
      continue
    }

    const gradePoint = calculateGradePoint(grade)
    resultSubjects.push({
      name,
      credit,
      grade,
      gradePoint,
      weightedPoints: credit * gradePoint,
    })
  }

  const credits = resultSubjects.reduce((sum, subject) => sum + subject.credit, 0)
  const points = resultSubjects.reduce((sum, subject) => sum + subject.weightedPoints, 0)
  const sgpa = credits ? points / credits : 0
  return {
    year,
    semester,
    credits,
    points,
    sgpa: Number(sgpa.toFixed(2)),
    percentage: calculatePercentage(sgpa),
    backlogs: resultSubjects.filter((subject) => subject.grade === 'F' || subject.grade === 'Ab').length,
    subjects: resultSubjects,
  }
}

export function calculateResult(input) {
  const { branch, calculateAll = false, includedSemesters = [] } = input
  const branchData = branchSubjects[branch]
  if (!branchData) {
    throw new Error('Invalid branch.')
  }

  if (!calculateAll) {
    const result = calculateSemester(input)
    return {
      branch,
      calculateAll: false,
      ...result,
      cgpa: result.sgpa,
    }
  }

  const semesterResults = []
  for (const [year, semesters] of Object.entries(branchData)) {
    for (const semester of Object.keys(semesters)) {
      if (includedSemesters.length && !includedSemesters.includes(semesterKey(year, semester))) {
        continue
      }
      semesterResults.push(calculateSemester({
        branch,
        year,
        semester,
        grades: input.grades,
      }))
    }
  }

  if (!semesterResults.length) {
    throw new Error('Select at least one semester to calculate.')
  }

  const credits = semesterResults.reduce((sum, item) => sum + item.credits, 0)
  const points = semesterResults.reduce((sum, item) => sum + item.points, 0)
  const cgpa = credits ? points / credits : 0
  return {
    branch,
    calculateAll: true,
    semesterResults,
    credits,
    cgpa: Number(cgpa.toFixed(2)),
    percentage: calculatePercentage(cgpa),
  }
}

export { branchSubjects, gradeOptions, semesterKey }