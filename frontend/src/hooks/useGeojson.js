/**
 * useGeojson — Mengambil GeoJSON gabungan dari semua kabupaten
 * yang punya data di database (via /api/geojson.php).
 *
 * GeoJSON di-cache secara in-memory agar tidak re-fetch tiap render.
 * Cache di-invalidate saat `invalidateKey` berubah (misalnya setelah upload GeoJSON baru).
 */
import { useEffect, useState, useRef } from 'react'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/backend/api'

let cachedGeojson    = null
let cachedInvalidKey = null

export function useGeojson(invalidateKey = 'default') {
  const [geojson, setGeojson]   = useState(
    cachedInvalidKey === invalidateKey ? cachedGeojson : null,
  )
  const [loading, setLoading]   = useState(
    cachedInvalidKey !== invalidateKey || !cachedGeojson,
  )
  const [error, setError]       = useState(null)
  const cancelledRef            = useRef(false)

  useEffect(() => {
    // Cache masih valid
    if (cachedInvalidKey === invalidateKey && cachedGeojson) {
      setGeojson(cachedGeojson)
      setLoading(false)
      return
    }

    cancelledRef.current = false
    setLoading(true)
    setError(null)

    fetch(`${BASE_URL}/geojson.php`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return res.json()
      })
      .then((json) => {
        if (cancelledRef.current) return
        const featureCount = json?.features?.length ?? 0
        console.log('[useGeojson] features loaded:', featureCount)

        cachedGeojson    = json
        cachedInvalidKey = invalidateKey

        setGeojson(json)
        setError(null)
      })
      .catch((err) => {
        if (cancelledRef.current) return
        console.error('[useGeojson] error:', err)
        setError(err)
      })
      .finally(() => {
        if (!cancelledRef.current) setLoading(false)
      })

    return () => {
      cancelledRef.current = true
    }
  }, [invalidateKey])

  return { geojson, loading, error }
}

/** Invalidate cache global (panggil setelah upload GeoJSON baru) */
export function invalidateGeojsonCache() {
  cachedGeojson    = null
  cachedInvalidKey = null
}