import test from 'node:test'
import assert from 'node:assert/strict'

import { getEntryScreen } from '../src/appFlow.js'

test('shows login before authentication', () => {
  assert.equal(getEntryScreen(false), 'login')
})

test('shows the home screen after successful login', () => {
  assert.equal(getEntryScreen(true), 'home')
})
