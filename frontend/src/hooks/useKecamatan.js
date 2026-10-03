import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'

export function useKecamatan() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(() => {
    let cancelled = false

    setLoading(true)
    api.get('/kecamatan.php')
      .then((res) => {
        if (cancelled) return
        const rows = Array.isArray(res.data) ? res.data : (res.data && res.data.data) || []
        setData(rows)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[useKecamatan] error:', err)
        setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}