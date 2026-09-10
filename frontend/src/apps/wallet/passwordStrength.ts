export const STRENGTH_COLORS = ['#EFEFEB', '#C4544A', '#C4864A', '#4A8CC4', '#17795E']
export const STRENGTH_LABELS = ['Enter a password', 'Weak', 'Fair', 'Strong', 'Excellent']

export function computeStrength(pw: string): number {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 12) s++
  return pw ? Math.max(1, s) : 0
}

export function barColor(strength: number, index: number): string {
  return strength >= index ? STRENGTH_COLORS[strength] : STRENGTH_COLORS[0]
}
