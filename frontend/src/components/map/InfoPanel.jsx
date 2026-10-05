// Panel info hover di atas peta — menampilkan statistik wilayah aktif.
import { formatNumber, formatGrowth } from '@/lib/utils'

export default function InfoPanel({ kecamatan }) {
  if (!kecamatan) {
    return (
      <div className="absolute top-3 left-3 z-[5] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3 shadow-card text-xs text-zinc-400 pointer-events-none">
        Arahkan kursor ke wilayah
      </div>
    )
  }

  const positif = kecamatan.laju_pertumbuhan >= 0

  return (
    <div className="absolute top-3 left-3 z-[5] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3 shadow-card pointer-events-none min-w-[180px]">
      <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mb-2">
        {kecamatan.nama_wilayah || kecamatan.nama_kecamatan}
      </p>
      <div className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex justify-between gap-6">
          <span>Penduduk</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatNumber(kecamatan.jumlah_penduduk)}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span>Pertumbuhan</span>
          <span className={`font-medium ${positif ? 'text-jember-600' : 'text-red-500'}`}>
            {formatGrowth(kecamatan.laju_pertumbuhan)}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span>Kepadatan</span>
          <span>{formatNumber(kecamatan.kepadatan_penduduk)} jiwa/km²</span>
        </div>
        {kecamatan.sumber_data && (
          <div className="flex justify-between gap-6">
            <span>Sumber</span>
            <span>{kecamatan.sumber_data}{kecamatan.tahun_data ? ` (${kecamatan.tahun_data})` : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}
