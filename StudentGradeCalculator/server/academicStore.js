import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BRANCH_OPTIONS, DEFAULT_PROFILE, JNTUK_R23_CONFIG, SEMESTER_OPTIONS } from '../src/config/jntukR23.js'
import { calculateSGPA, gradeOptions, migrateGrade } from '../src/services/calculationService.js'

const profileFields = Object.keys(DEFAULT_PROFILE)
const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultDataFile = path.join(currentDirectory, 'data', 'academic-records.json')

function requireObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(message)
  }
  return value
}

export function normalizeAcademicRecord(value) {
  const record = requireObject(value, 'Academic record must be an object.')
  const sourceGradeScale = Number(record.gradeScaleVersion || 1)
  if (sourceGradeScale > JNTUK_R23_CONFIG.gradeScaleVersion) {
    throw new TypeError('This academic record uses a newer grade scale than the server supports.')
  }
  const profileInput = requireObject(record.profile, 'Profile must be an object.')
  const profile = { ...DEFAULT_PROFILE }

  for (const field of profileFields) {
    if (profileInput[field] !== undefined) {
      if (typeof profileInput[field] !== 'string' || profileInput[field].length > 160) {
        throw new TypeError(`Profile field "${field}" must be a string of at most 160 characters.`)
      }
      profile[field] = profileInput[field].trim()
    }
  }

  if (!BRANCH_OPTIONS.includes(profile.branch)) {
    throw new TypeError('Choose a supported branch.')
  }

  if (!Array.isArray(record.semesterResults) || record.semesterResults.length > SEMESTER_OPTIONS.length) {
    throw new TypeError('Semester results must be an array containing at most eight semesters.')
  }

  const seenSemesters = new Set()
  const semesterResults = record.semesterResults.map((result) => {
    requireObject(result, 'Each semester result must be an object.')
    const semester = result.semester
    const branch = result.branch
    if (!SEMESTER_OPTIONS.includes(semester) || !BRANCH_OPTIONS.includes(branch)) {
      throw new TypeError('Each result must have a supported branch and semester.')
    }
    if (seenSemesters.has(semester)) {
      throw new TypeError(`Semester ${semester} can only have one saved result.`)
    }
    seenSemesters.add(semester)

    if (!Array.isArray(result.subjects) || result.subjects.length > 40) {
      throw new TypeError('Each semester must contain an array of at most 40 subjects.')
    }

    const subjects = result.subjects.map((subject) => {
      requireObject(subject, 'Each subject must be an object.')
      const credits = Number(subject.credits)
      if (!Number.isFinite(credits) || credits <= 0 || credits > 30) {
        throw new TypeError('Subject credits must be a number greater than zero and at most 30.')
      }
      if (typeof subject.name !== 'string' || subject.name.trim().length === 0 || subject.name.length > 160) {
        throw new TypeError('Each subject must have a name of at most 160 characters.')
      }
      if (typeof subject.code !== 'string' || subject.code.length > 40) {
        throw new TypeError('Each subject must have a code of at most 40 characters.')
      }
      const grade = migrateGrade(subject.grade, sourceGradeScale)
      if (!gradeOptions.includes(grade)) {
        throw new TypeError(`Grade must be one of: ${gradeOptions.join(', ')}.`)
      }
      const courseType = subject.courseType || 'Theory'
      if (!JNTUK_R23_CONFIG.courseTypes.includes(courseType)) {
        throw new TypeError('Choose a supported course type.')
      }
      return {
        code: subject.code.trim(),
        name: subject.name.trim(),
        credits,
        grade,
        courseType,
      }
    })

    const performance = calculateSGPA(subjects)
    return {
      id: semester,
      branch,
      semester,
      academicYear: typeof result.academicYear === 'string' ? result.academicYear.slice(0, 20) : profile.academicYear,
      sgpa: performance.sgpa,
      percentage: performance.percentage,
      backlogs: performance.backlogs,
      subjects,
    }
  })

  return { gradeScaleVersion: JNTUK_R23_CONFIG.gradeScaleVersion, profile, semesterResults }
}

export function createAcademicStore(filePath = process.env.ACADEMIC_DATA_FILE || defaultDataFile) {
  let writeQueue = Promise.resolve()

  async function readRecords() {
    try {
      return JSON.parse(await readFile(filePath, 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') return {}
      throw error
    }
  }

  async function writeRecords(records) {
    await mkdir(path.dirname(filePath), { recursive: true })
    const temporaryPath = `${filePath}.${process.pid}.tmp`
    await writeFile(temporaryPath, JSON.stringify(records, null, 2), 'utf8')
    await rename(temporaryPath, filePath)
  }

  return {
    async get(userId) {
      const records = await readRecords()
      return records[userId] ? normalizeAcademicRecord(records[userId]) : null
    },
    save(userId, value) {
      if (typeof userId !== 'string' || userId.length === 0) {
        return Promise.reject(new TypeError('A user ID is required.'))
      }
      const record = normalizeAcademicRecord(value)
      const operation = writeQueue.then(async () => {
        const records = await readRecords()
        records[userId] = record
        await writeRecords(records)
        return record
      })
      writeQueue = operation.catch(() => {})
      return operation
    },
  }
}