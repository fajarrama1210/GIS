/**
 * MapView — Choropleth Leaflet Multi-Kabupaten Se-Indonesia
 *
 * Layer:
 *   1. ChoroplethLayer — poligon GeoJSON dari semua kabupaten yg ada di DB
 *   2. AutoFitBounds   — otomatis fit bounds ke seluruh data
 *
 * TIDAK ada lagi DynamicMarkersLayer (titik-titik dihapus).
 * Kecamatan yang belum punya GeoJSON ditampilkan abu-abu transparan.
 */
import { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, useMap, LayersControl } from 'react-leaflet'
import L from 'leaflet'
import { formatNumber, formatGrowth, getMapBreaks } from '@/lib/utils'
import Legend from './Legend'

const { BaseLayer } = LayersControl

/* ════════════════ PALETTE & STYLE HELPERS ════════════════ */

const norm = (s) => (s || '').toLowerCase().replace(/^(kabupaten|kota)\s+/u, '').replace(/[^a-z0-9]/g, '')

/**
 * Cari baris data berdasarkan nama kecamatan.
 * GeoJSON Indonesia bisa punya properti: nama, namobj, name, NAMOBJ, NAMA
 */
function findRow(props, data) {
  if (!props || !data || !data.length) return null
  const code = props.kode_wilayah || props.KDCBPS || props.KDBBPS || props.KDPBPS
  if (code) {
    const matchedCode = data.find((row) => String(row.kode_wilayah) === String(code))
    if (matchedCode) return matchedCode
  }
  const key = norm(props.nama_wilayah || props.nama || props.WADMKC || props.WADMKK || props.WADMPR || props.namobj || props.name || '')
  return data.find((row) => norm(row.nama_wilayah || row.nama_kecamatan) === key) || null
}

/** Buat objek style Leaflet */
function makeStyle(row, mode, breaks, highlight = false) {
  const value = Number(mode === 'penduduk' ? row?.jumlah_penduduk : row?.laju_pertumbuhan)
  const fill = row && Number.isFinite(value)
    ? (breaks.find((item) => value <= item.max) || breaks[breaks.length - 1])?.color || '#d4d4d8'
    : '#d4d4d8'
  return {
    fillColor  : fill,
    fillOpacity: highlight ? 0.95 : (!!row ? 0.80 : 0.35),
    color      : '#ffffff',
    weight     : highlight ? 2.5  : 1.5,
    opacity    : !!row ? 1 : 0.6,
  }
}

function popupHtml(row) {
  const positif   = Number(row.laju_pertumbuhan) >= 0
  const lajuColor = positif ? '#16a34a' : '#dc2626'
  const name = String(row.nama_wilayah || row.nama_kecamatan).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
  const source = String(row.sumber_data || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
  return `
    <div style="font-family:Inter,sans-serif;min-width:190px;padding:4px 0">
      <p style="font-weight:700;font-size:13px;margin:0 0 10px;
                color:#18181b;border-bottom:2px solid #e4e4e7;padding-bottom:8px">
        ${name}
      </p>
      <table style="font-size:12px;width:100%;border-collapse:collapse;line-height:1.7">
        <tr>
          <td style="color:#71717a">Jumlah Penduduk</td>
          <td style="text-align:right;font-weight:700;color:#16a34a">
            ${formatNumber(row.jumlah_penduduk)} jiwa
          </td>
        </tr>
        <tr>
          <td style="color:#71717a">Laju Pertumbuhan</td>
          <td style="text-align:right;font-weight:700;color:${lajuColor}">
            ${formatGrowth(row.laju_pertumbuhan)}
          </td>
        </tr>
        <tr>
          <td style="color:#71717a">Kepadatan</td>
          <td style="text-align:right;color:#3f3f46">
            ${formatNumber(row.kepadatan_penduduk)} jiwa/km²
          </td>
        </tr>
        <tr>
          <td style="color:#71717a">Rasio jenis kelamin</td>
          <td style="text-align:right;color:#3f3f46">
            ${formatNumber(row.rasio_jenis_kelamin)}
          </td>
        </tr>
        ${source ? `<tr><td style="color:#71717a">Sumber</td><td style="text-align:right;color:#3f3f46">${source}${row.tahun_data ? ` (${row.tahun_data})` : ''}</td></tr>` : ''}
      </table>
    </div>
  `
}

/* ════════════════ LAYER 0 — BATAS PROVINSI SE-INDONESIA ════════════════ */
function ProvinsiLayer({ data }) {
  const map = useMap()
  const layerRef = useRef(null)

  // Statistik per provinsi dari data di database
  const provStats = useMemo(() => {
    const stats = {}
    if (!data) return stats
    data.forEach((row) => {
      const p = (row.provinsi || 'JAWA TIMUR').toUpperCase().trim()
      if (!stats[p]) {
        stats[p] = { count: 0, penduduk: 0, faskes: 0, kabupatens: new Set() }
      }
      stats[p].count += 1
      stats[p].penduduk += (Number(row.jumlah_penduduk) || 0)
      stats[p].faskes += (Number(row.jumlah_faskes) || 0)
      if (row.kabupaten) stats[p].kabupatens.add(row.kabupaten)
    })
    return stats
  }, [data])

  useEffect(() => {
    let active = true

    fetch('/indonesia-prov.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Status ' + res.status)
        return res.json()
      })
      .then((provGeo) => {
        if (!active || !provGeo?.features) return

        if (layerRef.current) {
          map.removeLayer(layerRef.current)
          layerRef.current = null
        }

        const layer = L.geoJSON(provGeo, {
          style(feature) {
            const raw = feature.properties?.Propinsi || ''
            const pName = raw.toUpperCase().trim()
            const hasData = !!provStats[pName]

            return {
              color      : hasData ? '#059669' : '#64748b',
              weight     : hasData ? 1.8 : 1.0,
              opacity    : hasData ? 0.85 : 0.45,
              fillColor  : hasData ? '#10b981' : '#94a3b8',
              fillOpacity: hasData ? 0.08 : 0.02,
              dashArray  : hasData ? null : '3',
            }
          },
          onEachFeature(feature, fl) {
            const raw = feature.properties?.Propinsi || ''
            const pName = raw.toUpperCase().trim()
            const stat = provStats[pName]

            if (stat) {
              const kabs = Array.from(stat.kabupatens).slice(0, 3).join(', ')
              const more = stat.kabupatens.size > 3 ? '...' : ''
              fl.bindTooltip(
                `<div style="font-family:Inter,sans-serif;font-size:12px;line-height:1.5">
                  <div style="font-weight:700;color:#18181b">Provinsi ${raw}</div>
                  <div style="color:#059669;font-weight:600">${stat.count} Kecamatan Terdata</div>
                  <div style="font-size:11px;color:#71717a">${kabs}${more}</div>
                  <div style="font-size:11px;color:#3f3f46;margin-top:2px">Total: <strong>${formatNumber(stat.penduduk)} jiwa</strong></div>
                </div>`,
                { permanent: false, direction: 'center', className: 'prov-tooltip', opacity: 0.95 }
              )
            } else {
              fl.bindTooltip(`Provinsi ${raw}`, {
                permanent: false,
                direction: 'center',
                className: 'prov-tooltip',
                opacity: 0.85,
              })
            }

            fl.on('mouseover', function () {
              this.setStyle({
                weight     : 2.2,
                color      : '#10b981',
                fillOpacity: 0.16,
              })
            })
            fl.on('mouseout', function () {
              const hasData = !!provStats[pName]
              this.setStyle({
                color      : hasData ? '#059669' : '#64748b',
                weight     : hasData ? 1.8 : 1.0,
                opacity    : hasData ? 0.85 : 0.45,
                fillColor  : hasData ? '#10b981' : '#94a3b8',
                fillOpacity: hasData ? 0.08 : 0.02,
                dashArray  : hasData ? null : '3',
              })
            })
            fl.on('click', function () {
              map.fitBounds(fl.getBounds(), { padding: [24, 24], maxZoom: 10, animate: true })
            })
          },
        })

        layer.addTo(map)
        layerRef.current = layer
      })
      .catch((err) => {
        console.warn('[ProvinsiLayer] Gagal memuat indonesia-prov.geojson:', err)
      })

    return () => {
      active = false
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [map, provStats])

  return null
}

/* ════════════════ LAYER 1 — CHOROPLETH MULTI-KABUPATEN ════════════════ */
function ChoroplethLayer({ geojson, data, mode, onHover }) {
  const map      = useMap()
  const layerRef = useRef(null)
  const breaks = getMapBreaks(data, mode)

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }
    if (!geojson || !data || data.length === 0) return

    const layer = L.geoJSON(geojson, {
      style(feature) {
        const row = findRow(feature.properties, data)
        return makeStyle(row, mode, breaks)
      },
      pointToLayer(feature, latlng) {
        const row = findRow(feature.properties, data)
        return L.circleMarker(latlng, {
          ...makeStyle(row, mode, breaks),
          radius: 8,
          weight: 2,
        })
      },
      onEachFeature(feature, fl) {
        const row      = findRow(feature.properties, data)
        const geoLabel = feature.properties?.nama_wilayah
                      || feature.properties?.WADMKC
                      || feature.properties?.WADMKK
                      || feature.properties?.WADMPR
                      || feature.properties?.namobj
                      || feature.properties?.NAMOBJ
                      || feature.properties?.name
                      || feature.properties?.NAMA
                      || '?'

        fl.bindTooltip(geoLabel, {
          permanent : false,
          direction : 'center',
          className : 'kec-tooltip',
          opacity   : 0.9,
        })
        fl.on('mouseover', function () {
          this.setStyle(makeStyle(row, mode, breaks, true))
          this.openTooltip()
          if (onHover) onHover(row)
        })
        fl.on('mouseout', function () {
          this.setStyle(makeStyle(row, mode, breaks, false))
          if (onHover) onHover(null)
        })
        if (row) {
          fl.bindPopup(popupHtml(row), { maxWidth: 280 })
          fl.on('click', function () { this.openPopup() })
        } else {
          fl.bindPopup(
            `<p style="font-family:Inter,sans-serif;font-size:12px;color:#71717a;margin:0">
              <strong>${geoLabel}</strong><br/>Data belum tersedia.
            </p>`,
          )
        }
      },
    })

    layer.addTo(map)
    layerRef.current = layer

    /* Label permanen saat zoom cukup dekat */
    const updateTooltips = () => {
      const permanent = map.getZoom() >= 11
      layer.eachLayer((fl) => {
        const tt = fl.getTooltip()
        if (!tt) return
        fl.unbindTooltip()
        const geoLabel = fl.feature?.properties?.nama_wilayah
                       || fl.feature?.properties?.WADMKC
                       || fl.feature?.properties?.WADMKK
                       || fl.feature?.properties?.WADMPR
                       || fl.feature?.properties?.namobj
                       || fl.feature?.properties?.name
                       || ''
        fl.bindTooltip(geoLabel, {
          permanent,
          direction : 'center',
          className : 'kec-tooltip',
          opacity   : 0.9,
        })
        if (permanent) fl.openTooltip()
      })
    }

    map.on('zoomend', updateTooltips)
    updateTooltips() // run once

    /* Zoom to the selected administrative boundary features. */
    const bounds = layer.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [10, 10] })
    }

    return () => {
      map.off('zoomend', updateTooltips)
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [map, geojson, data, mode, onHover])

  return null
}

/* ════════════════ LAYER 2 — AUTO FIT BOUNDS ════════════════ */
function AutoFitBounds({ geojson, data }) {
  const map = useMap()

  useEffect(() => {
    if (!data || data.length === 0) return

    const points = []

    // 1. Ambil bounds HANYA dari poligon fitur GeoJSON yang SUDAH memiliki data di database
    if (geojson?.features?.length) {
      try {
        const featuresWithData = geojson.features.filter((f) => findRow(f.properties, data))
        if (featuresWithData.length > 0) {
          const subGeojson = { type: 'FeatureCollection', features: featuresWithData }
          const gb = L.geoJSON(subGeojson).getBounds()
          if (gb.isValid()) {
            points.push([gb.getSouth(), gb.getWest()])
            points.push([gb.getNorth(), gb.getEast()])
          }
        }
      } catch (_) {}
    }

    // 2. Tambahkan koordinat lat/lng dari setiap baris data yang ada
    data.forEach((row) => {
      const lat = Number(row.latitude)
      const lng = Number(row.longitude)
      if (lat && lng && !(lat === 0 && lng === 0)) {
        points.push([lat, lng])
      }
    })

    // 3. Zoom dan posisikan kamera tepat ke area yang sudah ada datanya
    if (points.length > 0) {
      const bounds = L.latLngBounds(points)
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 12, animate: true })
      }
    }
  }, [map, geojson, data])

  return null
}

/* ════════════════ MAIN EXPORT ════════════════ */
/**
 * @param {object}   geojson   - GeoJSON FeatureCollection batas wilayah
 * @param {Array}    data      - Array data statistik wilayah
 * @param {string}   mode      - 'penduduk' | 'laju'
 * @param {function} onHover   - callback saat hover kecamatan
 * @param {string}   regency   - kode kabupaten terpilih ('' = semua)
 * @param {string}   district  - kode kecamatan terpilih ('' = semua)
 */
export default function MapView({ geojson, data, mode = 'penduduk', onHover, regency = '', district = '' }) {
  const hasData    = data && data.length > 0
  const hasGeojson = geojson && geojson.features && geojson.features.length > 0

  // Sembunyikan batas provinsi seluruh Indonesia saat sudah ada filter
  // kabupaten atau kecamatan (peta fokus pada choropleth wilayah spesifik)
  const showProvinsiLayer = !regency && !district

  return (
    <MapContainer
      center={[-7.5, 112.5]}
      zoom={6}
      minZoom={4}
      maxZoom={16}
      className="h-full w-full z-0"
      scrollWheelZoom={true}
    >
      <LayersControl position="topright">
        <BaseLayer checked name="OpenStreetMap">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
        </BaseLayer>
        <BaseLayer name="Satelit (Esri)">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
          />
        </BaseLayer>
      </LayersControl>

      {/* Layer 0: Batas Seluruh Provinsi di Indonesia — hanya tampil saat belum ada filter spesifik */}
      {showProvinsiLayer && <ProvinsiLayer data={data} />}

      {/* Layer 1: Choropleth Poligon Kecamatan */}
      {hasGeojson && hasData && (
        <ChoroplethLayer geojson={geojson} data={data} mode={mode} onHover={onHover} />
      )}

      {(hasGeojson || hasData) && (
        <AutoFitBounds geojson={geojson} data={data} />
      )}

      {/* ── Legend ───────────────────────────────────────────── */}
      <Legend mode={mode} data={data} />
    </MapContainer>
  )
}
