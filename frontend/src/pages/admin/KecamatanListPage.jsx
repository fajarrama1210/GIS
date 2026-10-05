// Halaman daftar kecamatan — tabel admin dengan edit & hapus.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Search, Trash2 } from 'lucide-react'
import { useKecamatan } from '@/hooks/useKecamatan'
import { useToast } from '@/components/ui/Toast'
import api from '@/lib/api'
import { formatNumber, formatGrowth } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { SkeletonTable } from '@/components/ui/Skeleton'

const PAGE_SIZE = 10

export default function KecamatanListPage() {
  const { data, loading, refetch } = useKecamatan()
  const addToast = useToast()
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [query])

  const filteredData = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return data

    return data.filter((row) =>
      row.nama_kecamatan?.toLowerCase().includes(normalized) ||
      row.kode_kecamatan?.toLowerCase().includes(normalized) ||
      row.kabupaten?.toLowerCase().includes(normalized) ||
      row.provinsi?.toLowerCase().includes(normalized)
    )
  }, [data, query])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedData = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/kecamatan.php?id=${deleteTarget.id}`)
      addToast({ message: `${deleteTarget.nama_kecamatan} berhasil dihapus.`, type: 'success' })
      refetch()
    } catch (err) {
      addToast({ message: err.response?.data?.message || 'Gagal menghapus data.', type: 'error' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900 dark:text-zinc-100">
            Data Kecamatan
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {filteredData.length} kecamatan terdaftar
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari kecamatan..."
              className="w-full sm:w-64 pl-9 pr-3 py-2 text-sm rounded-md border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-jember-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <Link to="/admin/kecamatan/baru">
            <Button>
              <Plus size={14} /> Tambah
            </Button>
          </Link>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-5">
            <SkeletonTable rows={8} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                  {['No', 'Kecamatan / Wilayah', 'Kode', 'Penduduk', 'Laju (%)', 'Luas (km²)', 'Faskes', 'Lat, Lng', 'Aksi'].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap ${
                        h === 'Faskes' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-400">
                      Tidak ada data yang cocok.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-fast"
                    >
                      <td className="px-4 py-3 text-zinc-500 text-center text-xs font-medium">
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="font-semibold">{row.nama_kecamatan}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {row.kabupaten || 'Kabupaten Jember'}, {row.provinsi || 'JAWA TIMUR'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {row.kode_kecamatan}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {formatNumber(row.jumlah_penduduk)}
                      </td>
                      <td className={`px-4 py-3 font-medium ${row.laju_pertumbuhan >= 0 ? 'text-jember-600' : 'text-red-500'}`}>
                        {formatGrowth(row.laju_pertumbuhan)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.luas_wilayah}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-center">{row.jumlah_faskes ?? 0}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{row.latitude}, {row.longitude}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link to={`/admin/kecamatan/${row.id}/edit`}>
                            <Button size="sm" variant="secondary">
                              <Pencil size={12} />
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filteredData.length > 0 && (
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Halaman {currentPage} dari {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <Modal
        open={!!deleteTarget}
        title="Hapus Kecamatan"
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        confirmText="Ya, Hapus"
        confirmVariant="danger"
        loading={deleting}
      >
        Apakah Anda yakin ingin menghapus{' '}
        <span className="font-semibold">{deleteTarget?.nama_kecamatan}</span>?
        Tindakan ini tidak dapat dibatalkan.
      </Modal>
    </div>
  )
}
