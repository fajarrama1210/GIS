// Utility: format angka, kelas Tailwind (cn helper), dan lain-lain.

/**
 * Gabungkan class Tailwind secara kondisional (pengganti clsx/cn).
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function formatPercent(value) {
  if (value === null || value === undefined) return '-'
  return `${Number(value).toFixed(2)}%`
}

export function resolveApiAssetUrl(path) {
  const apiUrl = new URL(import.meta.env.VITE_API_URL || '/backend/api', window.location.origin)
  return new URL(path, apiUrl).toString()
}

export function getMapBreaks(data, mode) {
  const values = data
    .map((row) => mode === 'penduduk' ? row.jumlah_penduduk : row.laju_pertumbuhan)
    .filter((value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)))
    .map(Number)
    .sort((a, b) => a - b)
  if (!values.length) return []

  const palette = mode === 'penduduk'
    ? ['#d1fae5', '#86efac', '#4ade80', '#16a34a', '#14532d']
    : ['#dc2626', '#fca5a5', '#fde68a', '#86efac', '#14532d']

  return palette.reduce((breaks, color, index) => {
    const max = values[Math.max(0, Math.ceil(((index + 1) * values.length) / palette.length) - 1)]
    if (breaks.length && breaks[breaks.length - 1].max === max) {
      breaks[breaks.length - 1].color = color
    } else {
      breaks.push({ color, max })
    }
    return breaks
  }, [])
}

/**
 * Format bilangan ke string dengan pemisah ribuan (locale Indonesia).
 */
export function formatNumber(value) {
  if (value === null || value === undefined) return '-'
  return Number(value).toLocaleString('id-ID')
}

/**
 * Format laju pertumbuhan: tambah tanda + dan simbol %.
 */
export function formatGrowth(value) {
  if (value === null || value === undefined) return '-'
  const n = Number(value)
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

/**
 * Format koordinat desimal ke string dengan 6 angka di belakang koma.
 */
export function formatCoord(value) {
  return Number(value).toFixed(6)
}

/**
 * Hitung statistik agregat dari array data kecamatan.
 */
export function computeStats(data) {
  if (!data || data.length === 0) return null

  const total = data.reduce((s, d) => s + d.jumlah_penduduk, 0)
  const terpadat = data.reduce((a, b) =>
    a.jumlah_penduduk > b.jumlah_penduduk ? a : b
  )
  const tercepat = data.reduce((a, b) =>
    a.laju_pertumbuhan > b.laju_pertumbuhan ? a : b
  )
  const negatif = data.filter((d) => d.laju_pertumbuhan < 0).length

  return { total, terpadat, tercepat, negatif }
}
