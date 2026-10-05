// Utility: format angka, kelas Tailwind (cn helper), dan lain-lain.

/**
 * Gabungkan class Tailwind secara kondisional (pengganti clsx/cn).
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function resolveApiAssetUrl(path) {
  const apiUrl = new URL(import.meta.env.VITE_API_URL || '/backend/api', window.location.origin)
  return new URL(path, apiUrl).toString()
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
