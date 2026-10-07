import assert from 'node:assert/strict'
import test from 'node:test'
import { JNTUK_R23_CONFIG } from '../src/config/jntukR23.js'
import {
  calculateAcademicSummary,
  calculateBacklogs,
  calculateClass,
  calculateGradeDistribution,
  calculateGradePoint,
  calculatePercentage,
  calculateSGPA,
} from '../src/services/calculationService.js'

test('uses the configured R23 grades and calculates semester values by credits', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(JNTUK_R23_CONFIG.grades).map(([grade, value]) => [grade, value.point])), {
    S: 10, A: 9, B: 8, C: 7, D: 6, E: 5, F: 0, Ab: 0,
  })
  assert.deepEqual(Object.keys(JNTUK_R23_CONFIG.grades), ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'Ab'])
  assert.equal(calculateGradePoint('F'), 0)
  assert.equal(calculateGradePoint('Ab'), 0)
  assert.equal(calculatePercentage(7.48), 69.8)
  const result = calculateSGPA([
    { credits: 3, grade: 'A' },
    { credits: 1, grade: 'S' },
  ])
  assert.equal(result.totalCredits, 4)
  assert.equal(result.totalCreditPoints, 37)
  assert.equal(result.sgpa, 9.25)
  assert.equal(result.backlogs, 0)
})

test('uses credit-weighted CGPA, configured percentage, and F/Ab backlogs', () => {
  const semesters = [
    { semester: '1-1', subjects: [{ credits: 3, grade: 'A' }] },
    { semester: '1-2', subjects: [{ credits: 1, grade: 'S' }, { credits: 1, grade: 'F' }, { credits: 1, grade: 'Ab' }] },
  ]
  const summary = calculateAcademicSummary(semesters)
  assert.equal(summary.cgpa, 6.17)
  assert.equal(summary.totalCredits, 6)
  assert.equal(summary.totalBacklogs, 2)
  assert.equal(summary.percentage, calculatePercentage(37 / 6))
  assert.equal(calculateBacklogs(semesters[1].subjects), 2)
  assert.equal(summary.gradeDistribution.A, 1)
  assert.equal(summary.gradeDistribution.S, 1)
  assert.equal(summary.gradeDistribution.F, 1)
  assert.equal(summary.gradeDistribution.Ab, 1)
})

test('matches all supplied R23 SGPA calculation cases and includes failed credits', () => {
  const cases = [
    { subjects: [{ credits: 3, grade: 'S' }], expected: 10 },
    { subjects: [{ credits: 3, grade: 'A' }], expected: 9 },
    { subjects: [{ credits: 3, grade: 'D' }], expected: 6 },
    { subjects: [{ credits: 3, grade: 'F' }], expected: 0 },
    { subjects: [{ credits: 3, grade: 'S' }, { credits: 3, grade: 'A' }, { credits: 3, grade: 'B' }], expected: 9 },
    { subjects: [{ credits: 4, grade: 'S' }, { credits: 3, grade: 'A' }, { credits: 3, grade: 'B' }, { credits: 1, grade: 'C' }], expected: 8.91 },
  ]

  for (const { subjects, expected } of cases) assert.equal(calculateSGPA(subjects).sgpa, expected)

  const absent = calculateSGPA([{ credits: 3, grade: 'Ab' }])
  assert.equal(absent.totalCredits, 3)
  assert.equal(absent.totalCreditPoints, 0)
  assert.equal(absent.backlogs, 1)
})

test('uses the configured R23 classification thresholds', () => {
  assert.deepEqual(JNTUK_R23_CONFIG.classBands.map(({ min }) => min), [7.5, 6.5, 5.5, 5, 0])
  assert.equal(calculateClass(7.5), 'First Class with Distinction')
  assert.equal(calculateClass(6.5), 'First Class')
  assert.equal(calculateClass(5.5), 'Second Class')
  assert.equal(calculateClass(5), 'Pass Class')
  assert.equal(calculateClass(4.99), 'Fail')
})

test('empty semesters recalculate to zero rather than retaining cached values', () => {
  const summary = calculateAcademicSummary([{ semester: '4-2', sgpa: 9, percentage: 90, backlogs: 1, subjects: [] }])
  assert.equal(summary.semesterPerformance[0].sgpa, 0)
  assert.equal(summary.semesterPerformance[0].percentage, 0)
  assert.equal(summary.semesterPerformance[0].backlogs, 0)
})