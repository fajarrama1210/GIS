// Tabel data dengan search, sort kolom, dan pagination client-side.
import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react'
import { formatNumber, formatGrowth, formatPercent } from '@/lib/utils'

const PAGE_SIZE = 10

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown size={13} className="text-zinc-400" />
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-jember-600" />
    : <ChevronDown size={13} className="text-jember-600" />
}

export default function DataTable({ data, loading }) {
  const [query, setQuery] = useState('')
  const [sortCol, setSortCol] = useState('nama_kecamatan')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)

  function toggleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return data.filter((d) => (d.nama_wilayah || d.nama_kecamatan || '').toLowerCase().includes(q))
  }, [data, query])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortCol] ?? ''
      const vb = b[sortCol] ?? ''
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const isBpsData = data.some((row) => row.kode_wilayah)
  const cols = isBpsData
    ? [
        { key: 'nama_wilayah', label: 'Wilayah' },
        { key: 'jumlah_penduduk', label: 'Penduduk' },
        { key: 'laju_pertumbuhan', label: 'Pertumbuhan (%)' },
        { key: 'kepadatan_penduduk', label: 'Jiwa/km²' },
        { key: 'distribusi_penduduk', label: 'Distribusi (%)' },
        { key: 'sumber_data', label: 'Sumber' },
        { key: 'tahun_data', label: 'Tahun' },
      ]
    : [
        { key: 'nama_kecamatan', label: 'Kecamatan' },
        { key: 'jumlah_penduduk', label: 'Penduduk' },
        { key: 'laju_pertumbuhan', label: 'Laju (%)' },
        { key: 'luas_wilayah', label: 'Luas (km²)' },
        { key: 'jumlah_faskes', label: 'Faskes' },
      ]

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 skeleton rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Cari wilayah..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-jember-500/30 transition-fast"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 w-8">#</th>
              {cols.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 transition-fast select-none whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={cols.length + 1} className="px-4 py-8 text-center text-sm text-zinc-400">
                  Tidak ada data yang cocok.
                </td>
              </tr>
            ) : (
              pageData.map((row, idx) => {
                const lajuPositif = row.laju_pertumbuhan >= 0
                return (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-fast"
                  >
                    <td className="px-4 py-3 text-xs text-zinc-400">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{row.nama_wilayah || row.nama_kecamatan}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{formatNumber(row.jumlah_penduduk)}</td>
                    <td className={`px-4 py-3 font-medium ${lajuPositif ? 'text-jember-600' : 'text-red-500'}`}>
                      {formatGrowth(row.laju_pertumbuhan)}
                    </td>
                    {isBpsData ? (
                      <>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatNumber(row.kepadatan_penduduk)}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatPercent(row.distribusi_penduduk)}</td>
                        <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{row.sumber_data || '-'}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.tahun_data || '-'}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.luas_wilayah}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.jumlah_faskes}</td>
                      </>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>{filtered.length} wilayah ditemukan</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-fast"
            >
              &larr;
            </button>
            <span className="px-3">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-fast"
            >
              &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
