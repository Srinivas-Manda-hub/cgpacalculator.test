import assert from 'node:assert/strict'
import test from 'node:test'
import { branchSubjects, calculateResult, calculateSemester, gradeOptions } from '../src/calculation.js'

test('ports all seven branches and 56 semesters', () => {
  assert.equal(Object.keys(branchSubjects).length, 7)
  const semesterCount = Object.values(branchSubjects).reduce(
    (count, branch) => count + Object.values(branch).reduce((yearCount, year) => yearCount + Object.keys(year).length, 0),
    0,
  )
  assert.equal(semesterCount, 56)
})

test('calculates a perfect CSE first-semester SGPA using course credits', () => {
  const grades = Object.fromEntries(
    branchSubjects.CSE['Year 1']['Semester 1'].map((_, index) => [`Year 1|Semester 1|${index}`, 'S']),
  )
  const result = calculateSemester({ branch: 'CSE', year: 'Year 1', semester: 'Semester 1', grades })

  assert.equal(result.credits, 15)
  assert.equal(result.points, 150)
  assert.equal(result.sgpa, 10)
})

test('uses weighted grades and includes valid extra subjects', () => {
  const result = calculateSemester({
    branch: 'CSE',
    year: 'Year 1',
    semester: 'Semester 1',
    grades: { 'Year 1|Semester 1|0': 'A' },
    extraSubjects: [{ name: 'Robotics', credit: 1.5, grade: 'B' }],
  })

  assert.equal(result.credits, 16.5)
  assert.equal(result.subjects[0].weightedPoints, 27)
  assert.equal(result.subjects.at(-1).name, 'Robotics')
})

test('calculates CGPA only from included semesters', () => {
  const result = calculateResult({
    branch: 'CSE',
    calculateAll: true,
    includedSemesters: ['Year 1|Semester 1'],
    grades: Object.fromEntries(
      branchSubjects.CSE['Year 1']['Semester 1'].map((_, index) => [`Year 1|Semester 1|${index}`, 'S']),
    ),
  })

  assert.equal(result.semesterResults.length, 1)
  assert.equal(result.cgpa, 10)
})

test('rejects invalid branch, semester, and grade input', () => {
  assert.throws(() => calculateResult({ branch: 'UNKNOWN' }), /Invalid branch/)
  assert.throws(() => calculateSemester({ branch: 'CSE', year: 'Year 9', semester: 'Semester 1' }), /Invalid branch/)
  assert.throws(() => calculateSemester({
    branch: 'CSE', year: 'Year 1', semester: 'Semester 1', grades: { 'Year 1|Semester 1|0': 'X' },
  }), /Invalid grade/)
  assert.deepEqual(gradeOptions, ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'Ab'])
})

test('calculates Ab as a failed-credit backlog using the shared R23 configuration', () => {
  const result = calculateSemester({
    branch: 'CSE',
    year: 'Year 1',
    semester: 'Semester 1',
    grades: Object.fromEntries(branchSubjects.CSE['Year 1']['Semester 1'].map((_, index) => [`Year 1|Semester 1|${index}`, 'S'])),
    extraSubjects: [{ name: 'Absent lab', credit: 1.5, grade: 'Ab' }],
  })
  assert.equal(result.credits, 16.5)
  assert.equal(result.backlogs, 1)
  assert.equal(result.sgpa, Number((150 / 16.5).toFixed(2)))
})