import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clerkClient, clerkMiddleware, getAuth } from '@clerk/express'
import { branchSubjects, calculateResult, gradeOptions } from '../src/calculation.js'
import { resolveAuthorizedParties } from '../src/authConfig.js'
import { createAcademicStore } from './academicStore.js'

const app = express()
const port = Number(process.env.PORT || 5000)
const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectDirectory = path.resolve(currentDirectory, '..')
const distDirectory = path.join(projectDirectory, 'dist')
const authorizedParties = resolveAuthorizedParties(process.env.CLERK_AUTHORIZED_PARTIES)
const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY)
const academicStore = createAcademicStore()

app.disable('x-powered-by')
app.use(express.json({ limit: '128kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, clerkConfigured })
})

if (clerkConfigured) {
  app.use('/api', clerkMiddleware(authorizedParties.length ? { authorizedParties } : {}))
} else {
  app.use('/api', (request, response, next) => {
    if (request.path === '/health') {
      next()
      return
    }
    response.status(503).json({ error: 'Clerk server keys are not configured.' })
  })
}

function requireUser(request, response, next) {
  const { isAuthenticated, userId } = getAuth(request)
  if (!isAuthenticated || !userId) {
    response.status(401).json({ error: 'Sign in to continue.' })
    return
  }
  request.userId = userId
  next()
}

app.get('/api/subjects', requireUser, (_request, response) => {
  response.json({ branches: branchSubjects, grades: gradeOptions })
})

app.get('/api/academic-record', requireUser, async (request, response) => {
  try {
    response.json({ record: await academicStore.get(request.userId) })
  } catch (error) {
    console.error('Unable to load academic record:', error)
    response.status(500).json({ error: 'Could not load your academic record.' })
  }
})

app.put('/api/academic-record', requireUser, async (request, response) => {
  try {
    const record = await academicStore.save(request.userId, request.body)
    response.json({ record })
  } catch (error) {
    if (error instanceof TypeError) {
      response.status(400).json({ error: error.message })
      return
    }
    console.error('Unable to save academic record:', error)
    response.status(500).json({ error: 'Could not save your academic record.' })
  }
})

app.get('/api/me', requireUser, async (request, response) => {
  try {
    const user = await clerkClient.users.getUser(request.userId)
    const primaryEmail = user.emailAddresses.find(
      (address) => address.id === user.primaryEmailAddressId,
    )?.emailAddress ?? null
    response.json({
      id: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username,
      email: primaryEmail,
      imageUrl: user.imageUrl,
    })
  } catch (error) {
    console.error('Unable to load Clerk user:', error)
    response.status(502).json({ error: 'Could not load your Clerk profile.' })
  }
})

app.post('/api/calculate', requireUser, (request, response) => {
  try {
    response.json(calculateResult(request.body ?? {}))
  } catch (error) {
    response.status(400).json({ error: error.message || 'Could not calculate the result.' })
  }
})

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API route not found.' })
})

app.use(express.static(distDirectory))
app.get(/.*/, (_request, response, next) => {
  response.sendFile(path.join(distDirectory, 'index.html'), (error) => {
    if (error) next(error)
  })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`Student Grade Calculator API listening on http://127.0.0.1:${port}`)
  if (!clerkConfigured) {
    console.warn('Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in .env to enable protected API routes.')
  }
})