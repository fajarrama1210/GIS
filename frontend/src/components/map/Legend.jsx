/**
 * Legend — Leaflet control choropleth.
 * Dirender sebagai control Leaflet biasa di pojok kanan bawah.
 */
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { formatGrowth, formatNumber, getMapBreaks } from '@/lib/utils'

export default function Legend({ mode, data }) {
  const map        = useMap()
  const controlRef = useRef(null)

  useEffect(() => {
    if (controlRef.current) {
      controlRef.current.remove()
      controlRef.current = null
    }

    const breaks = getMapBreaks(data, mode).slice().reverse()
    const title  = mode === 'penduduk' ? 'Jumlah Penduduk' : 'Laju Pertumbuhan'

    const ctrl = L.control({ position: 'bottomright' })
    ctrl.onAdd = () => {
      const div = L.DomUtil.create('div', '')
      div.style.cssText = [
        'background:rgba(255,255,255,0.96)',
        'padding:12px 15px',
        'border-radius:10px',
        'border:1px solid #e4e4e7',
        'box-shadow:0 4px 12px rgba(0,0,0,0.12)',
        'font-family:Inter,system-ui,sans-serif',
        'font-size:11.5px',
        'color:#3f3f46',
        'min-width:155px',
        'backdrop-filter:blur(4px)',
      ].join(';')

      div.innerHTML = `
        <p style="font-weight:700;margin:0 0 10px;font-size:12px;
                  color:#18181b;letter-spacing:.01em">${title}</p>
        ${breaks.map(b => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
            <span style="
              width:16px;height:16px;border-radius:4px;
              background:${b.color};display:inline-block;flex-shrink:0;
              border:1px solid rgba(0,0,0,.10)">
            </span>
            <span style="font-size:11px">≤ ${mode === 'penduduk' ? formatNumber(b.max) : formatGrowth(b.max)}</span>
          </div>
        `).join('')}
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <span style="width:16px;height:16px;border-radius:4px;background:#d4d4d8;display:inline-block;flex-shrink:0;border:1px solid rgba(0,0,0,.10)"></span>
          <span style="font-size:11px">Data tidak tersedia</span>
        </div>
      `
      return div
    }
    ctrl.addTo(map)
    controlRef.current = ctrl

    return () => ctrl.remove()
  }, [map, mode, data])

  return null
}
