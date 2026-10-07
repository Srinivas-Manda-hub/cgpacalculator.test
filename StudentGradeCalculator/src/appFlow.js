export function getEntryScreen(isAuthenticated) {
  return isAuthenticated ? 'home' : 'login'
}
