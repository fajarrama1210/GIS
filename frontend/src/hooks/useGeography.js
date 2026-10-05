import { useEffect, useState, useRef } from 'react'
import api, { TIMEOUT_SLOW } from '@/lib/api'

const EAST_JAVA_CODE  = '3500000'
const DEFAULT_REGENCY = '3509000' // Kabupaten Jember

/* ── Session-level in-memory cache ─────────────────────────────────────── */
// Bertahan selama tab terbuka; key = URL params string
const memCache = new Map()

async function cachedGet(url, params = {}) {
  const key = url + '?' + new URLSearchParams(params).toString()
  if (memCache.has(key)) return memCache.get(key)

  // Coba sessionStorage (bertahan sampai tab ditutup, survives React re-mount)
  try {
    const stored = sessionStorage.getItem('geo:' + key)
    if (stored) {
      const parsed = JSON.parse(stored)
      memCache.set(key, parsed)
      return parsed
    }
  } catch (_) { /* sessionStorage mungkin disabled */ }

  const response = await api.get(url, { params })
  memCache.set(key, response)

  try {
    sessionStorage.setItem('geo:' + key, JSON.stringify(response))
  } catch (_) { /* quota exceeded — skip */ }

  return response
}

function responseArray(response, label) {
  const data = response.data?.data
  if (!Array.isArray(data)) {
    throw new Error(`Respons API ${label} tidak valid.`)
  }
  return data
}

function errorMessage(error, fallback) {
  return error?.response?.data?.message
    || (error instanceof Error ? error.message : '')
    || fallback
}

export function useGeography() {
  const [provinces, setProvinces] = useState([])
  const [regencies, setRegencies] = useState([])
  const [districts, setDistricts] = useState([])
  const [province,  setProvince]  = useState('')
  const [regency,   setRegency]   = useState('')
  const [district,  setDistrict]  = useState('')
  const [mapData,   setMapData]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [regionsLoading, setRegionsLoading] = useState(true)
  const [error,     setError]     = useState('')

  // Track apakah sedang load regencies untuk cegah map fetch terlalu cepat
  const regencyLoadedFor = useRef('')

  /* ── INIT: fetch provinces + default regencies SEKALIGUS (parallel) ──── */
  useEffect(() => {
    let active = true
    setRegionsLoading(true)

    // Jalankan kedua request secara parallel — tidak tunggu satu per satu
    Promise.all([
      cachedGet('/geography.php', { action: 'provinces' }),
      cachedGet('/geography.php', { action: 'regencies', parent: EAST_JAVA_CODE }),
    ])
      .then(([provResponse, regResponse]) => {
        if (!active) return

        const provList = responseArray(provResponse, 'daftar provinsi')
        const regList  = responseArray(regResponse,  'daftar kabupaten/kota')

        setProvinces(provList)

        // Tentukan provinsi awal
        const initialProv = provList.some((p) => p.code === EAST_JAVA_CODE)
          ? EAST_JAVA_CODE
          : provList[0]?.code || ''

        setProvince(initialProv)
        setError('')

        if (initialProv === EAST_JAVA_CODE) {
          // Sudah ada regencies — langsung set, tidak perlu fetch ulang
          setRegencies(regList)

          // Set default regency Jember jika ada
          const hasJember = regList.some((r) => r.code === DEFAULT_REGENCY)
          const initialReg = hasJember ? DEFAULT_REGENCY : (regList[0]?.code || '')
          setRegency(initialReg)
          regencyLoadedFor.current = initialProv
        }
      })
      .catch((requestError) => {
        if (!active) return
        setLoading(false)
        setError(errorMessage(requestError, 'Daftar wilayah gagal dimuat.'))
      })
      .finally(() => {
        if (active) setRegionsLoading(false)
      })

    return () => { active = false }
  }, [])

  /* ── Fetch regencies saat provinsi berubah (skip jika sudah diload) ──── */
  useEffect(() => {
    if (!province) {
      setRegencies([])
      setRegency('')
      return undefined
    }
    // Skip — sudah di-load oleh init effect di atas
    if (regencyLoadedFor.current === province && regencies.length > 0) return undefined

    let active = true
    setRegencies([])
    setDistricts([])
    setRegency('')
    setDistrict('')
    setRegionsLoading(true)

    cachedGet('/geography.php', { action: 'regencies', parent: province })
      .then((response) => {
        if (!active) return
        const list = responseArray(response, 'daftar kabupaten/kota')
        setRegencies(list)
        setError('')
        regencyLoadedFor.current = province
      })
      .catch((requestError) => {
        if (active) setError(errorMessage(requestError, 'Daftar kabupaten/kota gagal dimuat.'))
      })
      .finally(() => {
        if (active) setRegionsLoading(false)
      })

    return () => { active = false }
  }, [province])

  /* ── Fetch districts saat kabupaten berubah ──────────────────────────── */
  useEffect(() => {
    if (!regency) {
      setDistricts([])
      setDistrict('')
      return undefined
    }
    let active = true
    setDistricts([])
    setDistrict('')
    setRegionsLoading(true)

    cachedGet('/geography.php', { action: 'districts', parent: regency })
      .then((response) => {
        if (active) {
          setDistricts(responseArray(response, 'daftar kecamatan'))
          setError('')
        }
      })
      .catch((requestError) => {
        if (active) setError(errorMessage(requestError, 'Daftar kecamatan gagal dimuat.'))
      })
      .finally(() => {
        if (active) setRegionsLoading(false)
      })

    return () => { active = false }
  }, [regency])

  /* ── Fetch map data ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!province || regionsLoading) return undefined
    let active = true
    setLoading(true)
    setMapData(null)
    setError('')

    // Map data: timeout lebih panjang karena BPS/BIG bisa lambat saat cold cache
    api.get('/geography.php', {
      params:  { action: 'map', province, regency, district },
      timeout: TIMEOUT_SLOW,
    })
      .then((response) => {
        const payload = response.data?.data
        if (
          !payload
          || typeof payload !== 'object'
          || Array.isArray(payload)
          || !Array.isArray(payload.regions)
          || payload.geojson?.type !== 'FeatureCollection'
          || !Array.isArray(payload.geojson.features)
        ) {
          throw new Error('Respons API data peta tidak valid.')
        }
        if (active) setMapData(payload)
      })
      .catch((requestError) => {
        if (active) setError(errorMessage(requestError, 'Data wilayah dan statistik gagal dimuat.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [province, regency, district, regionsLoading])

  function selectProvince(value) {
    setProvince(value)
    setRegency('')
    setDistrict('')
  }

  function selectRegency(value) {
    setRegency(value)
    setDistrict('')
  }

  return {
    provinces,
    regencies,
    districts,
    province,
    regency,
    district,
    selectProvince,
    selectRegency,
    setDistrict,
    mapData,
    data:          mapData?.regions || [],
    geojson:       mapData?.geojson || null,
    loading:       loading || regionsLoading,
    regionsLoading,
    error,
  }
}
