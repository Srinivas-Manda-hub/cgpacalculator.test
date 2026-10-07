export function resolveAuthorizedParties(value = process.env.CLERK_AUTHORIZED_PARTIES) {
  const configured = (value || '')
    .split(',')
    .map((party) => party.trim())
    .filter(Boolean)

  const defaults = [
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ]

  return [...new Set([...configured, ...defaults])]
}
