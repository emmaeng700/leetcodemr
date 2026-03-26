// Shared auth helpers — safe to import in both client and server components

export const ALLOWED_EMAILS = [
  'emmanuelopponga07@gmail.com',
  'emmanuelacheampong869@gmail.com',
  'michaelakontoke2024@gmail.com',
]

export function isAdmin(email: string | undefined | null): boolean {
  return email === 'emmanuelopponga07@gmail.com'
}
