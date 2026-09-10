const GRID_SIZE = 25

function inBox(r: number, c: number, r0: number, c0: number) {
  return r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7
}

function finder(r: number, c: number, r0: number, c0: number) {
  const dr = r - r0
  const dc = c - c0
  const m = Math.max(Math.abs(dr - 3), Math.abs(dc - 3))
  return m === 3 || m <= 1
}

function isOn(r: number, c: number) {
  if (inBox(r, c, 0, 0)) return finder(r, c, 0, 0)
  if (inBox(r, c, 0, GRID_SIZE - 7)) return finder(r, c, 0, GRID_SIZE - 7)
  if (inBox(r, c, GRID_SIZE - 7, 0)) return finder(r, c, GRID_SIZE - 7, 0)
  const h = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453
  return h - Math.floor(h) > 0.5
}

export interface QrGridProps {
  size: number
  cell: number
}

export function QrGrid({ size, cell }: QrGridProps) {
  return (
    <div style={{ width: size, height: size, display: 'flex', flexDirection: 'column' }}>
      {Array.from({ length: GRID_SIZE }, (_, r) => (
        <div key={r} style={{ display: 'flex' }}>
          {Array.from({ length: GRID_SIZE }, (_, c) => (
            <div
              key={c}
              style={{ width: cell, height: cell, background: isOn(r, c) ? '#16171A' : 'transparent' }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
