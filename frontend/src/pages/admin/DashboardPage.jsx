// Dashboard admin — ringkasan statistik + aksi cepat.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Users, MapPin, TrendingUp, TrendingDown, Plus, ArrowRight } from 'lucide-react'
import { useGeography } from '@/hooks/useGeography'
import { formatNumber, formatGrowth } from '@/lib/utils'
import GeographySelector from '@/components/GeographySelector'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import useAuthStore from '@/stores/authStore'

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <Card className="flex items-start gap-4">
      <div className={`p-2.5 rounded-md ${accent}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">{label}</p>
        <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 truncate">{value}</p>
        {sub && <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}

export default function DashboardPage() {
  const geography = useGeography()
  const { data, loading, error, mapData } = geography
  const { user } = useAuthStore()
  const stats = useMemo(() => {
    const populated = data.filter((row) => Number.isFinite(row.jumlah_penduduk))
    const growthRows = data.filter((row) => Number.isFinite(row.laju_pertumbuhan))
    if (!populated.length) return null
    return {
      total: populated.reduce((sum, row) => sum + row.jumlah_penduduk, 0),
      populatedCount: populated.length,
      terpadat: populated.reduce((top, row) => row.jumlah_penduduk > top.jumlah_penduduk ? row : top),
      tercepat: growthRows.length
        ? growthRows.reduce((top, row) => row.laju_pertumbuhan > top.laju_pertumbuhan ? row : top)
        : null,
      negatif: growthRows.filter((row) => row.laju_pertumbuhan < 0).length,
    }
  }, [data])

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      {/* Heading */}
      <div>
        <p className="text-xs text-zinc-400 mb-1">Panel Admin</p>
        <h1 className="text-2xl font-serif font-semibold text-zinc-900 dark:text-zinc-100">
          Selamat datang, {user?.username}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Statistik BPS dilengkapi input admin saat data BPS belum tersedia; batas wilayah dari BIG.
        </p>
      </div>

      <GeographySelector
        provinces={geography.provinces}
        regencies={geography.regencies}
        districts={geography.districts}
        province={geography.province}
        regency={geography.regency}
        district={geography.district}
        onProvinceChange={geography.selectProvince}
        onRegencyChange={geography.selectRegency}
        onDistrictChange={geography.setDistrict}
        disabled={geography.regionsLoading && !geography.provinces.length}
      />
      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      {mapData?.stale_data && (
        <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Layanan {Object.keys(mapData.stale_sources || {}).join(' dan ')} sedang membatasi atau gagal menjawab. Statistik resmi yang sebelumnya tersimpan ditampilkan sementara.
        </div>
      )}

      {/* Stat cards */}
      <section>
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
          Ringkasan {mapData?.scope_name || 'Wilayah'} {mapData?.statistic_year ? `(${mapData.statistic_year})` : ''}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : stats ? (
            <>
              <StatCard icon={Users} label="Total Penduduk" value={formatNumber(stats.total)} sub={stats.populatedCount === data.length ? `${data.length} wilayah` : `nilai tersedia di ${stats.populatedCount} dari ${data.length} wilayah`} accent="bg-jember-600" />
              <StatCard icon={MapPin} label="Penduduk Terbanyak" value={stats.terpadat.nama_wilayah} sub={formatNumber(stats.terpadat.jumlah_penduduk)} accent="bg-amber-500" />
              <StatCard icon={TrendingUp} label="Pertumbuhan Tertinggi" value={stats.tercepat?.nama_wilayah || '-'} sub={formatGrowth(stats.tercepat?.laju_pertumbuhan)} accent="bg-jember-700" />
              <StatCard icon={TrendingDown} label="Wilayah Menyusut" value={`${stats.negatif} wilayah`} sub="mengalami penurunan" accent="bg-red-500" />
            </>
          ) : <p className="col-span-full text-sm text-zinc-500">Statistik belum tersedia.</p>}
        </div>
      </section>

      {/* Aksi cepat */}
      <section>
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">Aksi Cepat</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="flex items-center justify-between">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">Tambah Data Kecamatan</p>
              <p className="text-xs text-zinc-400 mt-0.5">Sumber admin dipakai jika statistik BPS belum tersedia</p>
            </div>
            <Link to="/admin/kecamatan/baru">
              <Button size="sm" variant="primary">
                <Plus size={13} /> Tambah
              </Button>
            </Link>
          </Card>
          <Card className="flex items-center justify-between">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">Kelola Data Kecamatan</p>
              <p className="text-xs text-zinc-400 mt-0.5">Kelola sumber admin dan data wilayah yang tersimpan</p>
            </div>
            <Link to="/admin/kecamatan">
              <Button size="sm" variant="secondary">
                Lihat <ArrowRight size={13} />
              </Button>
            </Link>
          </Card>
        </div>
      </section>
    </div>
  )
}
