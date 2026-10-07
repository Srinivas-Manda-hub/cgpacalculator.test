import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAuthorizedParties } from '../src/authConfig.js'

test('adds the default local Vite ports when no parties are configured', () => {
  const parties = resolveAuthorizedParties('')

  assert.ok(parties.includes('http://127.0.0.1:5173'))
  assert.ok(parties.includes('http://127.0.0.1:5174'))
  assert.ok(parties.includes('http://127.0.0.1:5175'))
  assert.ok(parties.includes('http://localhost:5173'))
  assert.ok(parties.includes('http://localhost:5174'))
  assert.ok(parties.includes('http://localhost:5175'))
})

test('keeps configured parties while including the default local dev ports', () => {
  const parties = resolveAuthorizedParties('http://127.0.0.1:5173,https://example.com')

  assert.ok(parties.includes('http://127.0.0.1:5173'))
  assert.ok(parties.includes('https://example.com'))
  assert.ok(parties.includes('http://127.0.0.1:5174'))
  assert.ok(parties.includes('http://127.0.0.1:5175'))
})
