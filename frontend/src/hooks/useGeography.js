import { useEffect, useState } from 'react'
import api from '@/lib/api'

const EAST_JAVA_CODE = '3500000'

export function useGeography() {
  const [provinces, setProvinces] = useState([])
  const [regencies, setRegencies] = useState([])
  const [districts, setDistricts] = useState([])
  const [province, setProvince] = useState('')
  const [regency, setRegency] = useState('')
  const [district, setDistrict] = useState('')
  const [mapData, setMapData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [regionsLoading, setRegionsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.get('/geography.php?action=provinces')
      .then((response) => {
        if (!active) return
        const list = response.data.data
        setProvinces(list)
        if (!list.length) {
          setLoading(false)
          setError('BPS tidak mengembalikan daftar provinsi.')
          return
        }
        setProvince(list.some((item) => item.code === EAST_JAVA_CODE)
          ? EAST_JAVA_CODE
          : list[0]?.code || '')
        setError('')
      })
      .catch((requestError) => {
        if (active) {
          setLoading(false)
          setError(requestError.response?.data?.message || 'Daftar provinsi gagal dimuat.')
        }
      })
      .finally(() => {
        if (active) setRegionsLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!province) {
      setRegencies([])
      setRegency('')
      return undefined
    }
    let active = true
    setRegencies([])
    setDistricts([])
    setRegency('')
    setDistrict('')
    setRegionsLoading(true)
    api.get('/geography.php?action=regencies', { params: { parent: province } })
      .then((response) => {
        if (active) {
          setRegencies(response.data.data)
          setError('')
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Daftar kabupaten/kota gagal dimuat.')
      })
      .finally(() => {
        if (active) setRegionsLoading(false)
      })
    return () => { active = false }
  }, [province])

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
    api.get('/geography.php?action=districts', { params: { parent: regency } })
      .then((response) => {
        if (active) {
          setDistricts(response.data.data)
          setError('')
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Daftar kecamatan gagal dimuat.')
      })
      .finally(() => {
        if (active) setRegionsLoading(false)
      })
    return () => { active = false }
  }, [regency])

  useEffect(() => {
    if (!province || regionsLoading) return undefined
    let active = true
    setLoading(true)
    setMapData(null)
    setError('')
    api.get('/geography.php?action=map', {
      params: { province, regency, district },
    })
      .then((response) => {
        if (active) setMapData(response.data.data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Data wilayah dan statistik gagal dimuat.')
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
    data: mapData?.regions || [],
    geojson: mapData?.geojson || null,
    loading: loading || regionsLoading,
    regionsLoading,
    error,
  }
}
