/**
 * MapView — Choropleth Leaflet dengan vanilla L.geoJSON() untuk
 * full-control styling, label kecamatan permanen (tampil zoom≥11),
 * dan re-render dinamis saat mode / data berubah.
 */
import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap, LayersControl } from 'react-leaflet'
import L from 'leaflet'
import { formatNumber, formatGrowth, getMapBreaks } from '@/lib/utils'
import Legend from './Legend'

const { BaseLayer } = LayersControl

/* ══════════════════════════════════════════════════════════════════════════
   PALETTE & STYLE HELPERS
══════════════════════════════════════════════════════════════════════════ */

const norm = (s) => (s || '').toLowerCase().replace(/^(kabupaten|kota)\s+/u, '').replace(/[^a-z0-9]/g, '')

/** Cari baris DB berdasarkan properties GeoJSON */
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
    fillOpacity: highlight ? 0.95 : 0.80,
    color      : '#ffffff',
    weight     : highlight ? 2.5  : 1.5,
    opacity    : 1,
  }
}

/** HTML popup detail kecamatan */
function popupHtml(row) {
  const positif  = Number(row.laju_pertumbuhan) >= 0
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

/* ══════════════════════════════════════════════════════════════════════════
   INNER COMPONENT — akses map instance via useMap()
══════════════════════════════════════════════════════════════════════════ */
function ChoroplethLayer({ geojson, data, mode, onHover }) {
  const map      = useMap()
  const layerRef = useRef(null)
  const breaks = getMapBreaks(data, mode)

  useEffect(() => {
    /* Selalu hapus layer lama sebelum membuat yang baru */
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }

    if (!geojson || !data || data.length === 0) return

    const layer = L.geoJSON(geojson, {
      /* ── Style tiap feature ──────────────────────────────────────── */
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

      /* ── Event & tooltip per feature ─────────────────────────────── */
      onEachFeature(feature, fl) {
        const row      = findRow(feature.properties, data)
        const geoLabel = feature.properties?.nama_wilayah
                      || feature.properties?.WADMKC
                      || feature.properties?.WADMKK
                      || feature.properties?.WADMPR
                      || feature.properties?.namobj
                      || feature.properties?.name
                      || '?'

        /* Tooltip: nama kecamatan — permanen saat zoom ≥ 11 */
        fl.bindTooltip(geoLabel, {
          permanent : false,   // mulai tidak permanen
          direction : 'center',
          className : 'kec-tooltip',
          opacity   : 0.9,
        })

        /* Hover */
        fl.on('mouseover', function () {
          this.setStyle(makeStyle(row, mode, breaks, true))
          this.openTooltip()
          if (onHover) onHover(row)
        })
        fl.on('mouseout', function () {
          this.setStyle(makeStyle(row, mode, breaks, false))
          if (onHover) onHover(null)
        })

        /* Popup detail saat klik */
        if (row) {
          fl.bindPopup(popupHtml(row), { maxWidth: 280 })
          fl.on('click', function () {
            this.openPopup()
          })
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

    /* Zoom-dependent permanent tooltip */
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
  /* Rebuild layer setiap kali geojson, data, atau mode berubah */
  }, [map, geojson, data, mode, onHover])

  return null
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════════════════ */
export default function MapView({ geojson, data, mode = 'penduduk', onHover }) {
  const ready = geojson && data && data.length > 0

  return (
    <MapContainer
      center={[-7.5, 112.5]}
      zoom={6}
      minZoom={4}
      maxZoom={16}
      className="h-full w-full z-0"
      scrollWheelZoom={true}
    >
      {/* ── Base layers ──────────────────────────────────────── */}
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

      {/* ── Choropleth layer — hanya render saat data siap ─── */}
      {ready && (
        <ChoroplethLayer
          geojson={geojson}
          data={data}
          mode={mode}
          onHover={onHover}
        />
      )}

      {/* ── Legend ───────────────────────────────────────────── */}
      <Legend mode={mode} data={data} />
    </MapContainer>
  )
}
