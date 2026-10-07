import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createAcademicStore, normalizeAcademicRecord } from '../server/academicStore.js'
import { JNTUK_R23_CONFIG } from '../src/config/jntukR23.js'

function sampleRecord(grade = 'A') {
  return {
    gradeScaleVersion: JNTUK_R23_CONFIG.gradeScaleVersion,
    profile: { branch: 'CSE', name: 'Student' },
    semesterResults: [
      {
        semester: '1-1',
        branch: 'CSE',
        academicYear: '2025-2026',
        sgpa: 0,
        subjects: [{ code: 'MA101', name: 'Mathematics', credits: 4, grade, courseType: 'Theory' }],
      },
    ],
  }
}

test('persists academic records separately for each user', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'jntuk-academic-store-'))
  const store = createAcademicStore(path.join(directory, 'records.json'))

  try {
    const savedRecord = await store.save('student-one', sampleRecord('S'))
    await store.save('student-two', sampleRecord('B'))

    assert.equal((await store.get('student-one')).semesterResults[0].sgpa, 10)
    assert.equal((await store.get('student-two')).semesterResults[0].semester, '1-1')
    assert.equal((await store.get('student-one')).semesterResults[0].subjects[0].grade, 'S')
    assert.equal((await store.get('student-one')).semesterResults[0].subjects[0].courseType, 'Theory')
    assert.equal(savedRecord.semesterResults[0].percentage, 95)
    assert.equal(await store.get('missing-student'), null)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('rejects unsupported branches, semesters, and grades', () => {
  assert.throws(() => normalizeAcademicRecord({ ...sampleRecord(), profile: { branch: 'UNKNOWN' } }), /supported branch/)
  assert.throws(() => normalizeAcademicRecord({
    ...sampleRecord(),
    semesterResults: [{ ...sampleRecord().semesterResults[0], semester: '9-9' }],
  }), /supported branch and semester/)
  assert.throws(() => normalizeAcademicRecord(sampleRecord('X')), /Grade must be one of/)
})

test('migrates legacy grades once and preserves canonical grades on later saves', () => {
  const unversioned = normalizeAcademicRecord({ ...sampleRecord('A+'), gradeScaleVersion: 1 })
  assert.equal(unversioned.semesterResults[0].subjects[0].grade, 'A')
  assert.equal(unversioned.semesterResults[0].sgpa, 9)

  const previousScale = normalizeAcademicRecord({ ...sampleRecord('S'), gradeScaleVersion: 2 })
  assert.equal(previousScale.semesterResults[0].subjects[0].grade, 'A')

  const current = normalizeAcademicRecord({
    ...sampleRecord('B'),
    gradeScaleVersion: JNTUK_R23_CONFIG.gradeScaleVersion,
  })
  const reloaded = normalizeAcademicRecord(current)
  assert.equal(current.semesterResults[0].subjects[0].grade, 'B')
  assert.equal(reloaded.semesterResults[0].subjects[0].grade, 'B')
  assert.equal(reloaded.semesterResults[0].sgpa, 8)
})