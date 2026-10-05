// Halaman publik utama — hero, stat cards, peta, grafik, tabel.
import { useState, useMemo, useCallback, useEffect } from 'react'
import { Users, TrendingUp, TrendingDown, MapPin } from 'lucide-react'
import { useGeography } from '@/hooks/useGeography'
import { formatNumber, formatGrowth, resolveApiAssetUrl } from '@/lib/utils'
import GeographySelector from '@/components/GeographySelector'
import MapView from '@/components/map/MapView'
import InfoPanel from '@/components/map/InfoPanel'
import BarChart from '@/components/chart/BarChart'
import ChartToggle from '@/components/chart/ChartToggle'
import DataTable from '@/components/table/DataTable'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import api from '@/lib/api'

// Komponen StatCard
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

const MAP_MODE_OPTIONS = [
  { value: 'penduduk', label: 'Jumlah Penduduk' },
  { value: 'laju', label: 'Laju Pertumbuhan' },
]

const CHART_OPTIONS = [
  { value: 'penduduk', label: 'Penduduk' },
  { value: 'laju', label: 'Pertumbuhan' },
]

export default function HomePage() {
  const geography = useGeography()
  const { data, loading, error, geojson, mapData } = geography
  const [mapMode, setMapMode] = useState('penduduk')
  const [chartMode, setChartMode] = useState('penduduk')
  const [hoveredKec, setHoveredKec] = useState(null)
  const [team, setTeam] = useState(null)
  const [teamError, setTeamError] = useState('')

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

  // Data grafik — urutkan dan potong 15 teratas
  const sortedPenduduk = useMemo(
    () => [...data].sort((a, b) => (b.jumlah_penduduk ?? -1) - (a.jumlah_penduduk ?? -1)).slice(0, 15),
    [data],
  )
  const sortedLaju = useMemo(
    () => [...data].sort((a, b) => (b.laju_pertumbuhan ?? -Infinity) - (a.laju_pertumbuhan ?? -Infinity)),
    [data],
  )

  // ⚠️ WAJIB useCallback — biar MapView tidak re-render tiap parent render
  const handleHover = useCallback((kec) => setHoveredKec(kec), [])

  useEffect(() => {
    let active = true
    api.get('/team.php')
      .then((response) => {
        const teamData = response.data?.data
        if (
          !teamData
          || typeof teamData !== 'object'
          || Array.isArray(teamData)
          || !Array.isArray(teamData.members)
        ) {
          throw new Error('Respons API informasi tim tidak valid.')
        }
        if (active) setTeam(teamData)
      })
      .catch((requestError) => {
        if (!active) return
        setTeamError(
          requestError instanceof Error && requestError.message.startsWith('Respons API')
            ? requestError.message
            : 'Informasi tim tidak dapat dimuat saat ini.',
        )
      })
    return () => { active = false }
  }, [])

  const scopeTitle = mapData?.scope_name || 'Pilih wilayah'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-10">

      {/* Hero */}
      <section>
        <p className="text-xs font-medium text-jember-600 uppercase tracking-widest mb-2">
          DATA WILAYAH & KEPENDUDUKAN
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
          Peta dan Statistik<br />
          <span className="text-jember-600">{scopeTitle}</span>
        </h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 max-w-xl">
          Jelajahi data wilayah dan statistik penduduk dengan memilih provinsi,
          kabupaten/kota, dan kecamatan. Statistik bersumber dari BPS, dengan
          data admin sebagai pelengkap saat nilai BPS tidak tersedia; batas wilayah dari BIG.
        </p>
      </section>

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
      {mapData && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 -mt-7">
          Sumber statistik: {mapData.data_sources.join(', ')}.{mapData.statistic_year && <> Publikasi BPS: <a className="underline" href={mapData.source.statistics_url} target="_blank" rel="noreferrer">API BPS</a>, {mapData.statistic_year} — {mapData.statistic_title}.</>} Batas wilayah: <a className="underline" href={mapData.source.boundaries_url} target="_blank" rel="noreferrer">BIG (RBI)</a>.
        </p>
      )}
      {mapData?.stale_data && (
        <div role="status" className="-mt-7 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Layanan {Object.keys(mapData.stale_sources || {}).join(' dan ')} sedang membatasi atau gagal menjawab. Data resmi yang sebelumnya tersimpan ditampilkan sementara; tahun statistik tetap tercantum di atas.
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : stats ? (
          <>
            <StatCard
              icon={Users}
              label="Total Penduduk"
              value={formatNumber(stats.total)}
              sub={stats.populatedCount === data.length
                ? `jiwa di ${data.length} wilayah`
                : `nilai tersedia untuk ${stats.populatedCount} dari ${data.length} wilayah`}
              accent="bg-jember-600"
            />
            <StatCard
              icon={MapPin}
              label="Penduduk Terbanyak"
              value={stats.terpadat.nama_wilayah}
              sub={`${formatNumber(stats.terpadat.jumlah_penduduk)} jiwa`}
              accent="bg-amber-500"
            />
            <StatCard
              icon={TrendingUp}
              label="Pertumbuhan Tertinggi"
              value={stats.tercepat?.nama_wilayah || '-'}
              sub={formatGrowth(stats.tercepat?.laju_pertumbuhan)}
              accent="bg-jember-700"
            />
            <StatCard
              icon={TrendingDown}
              label="Wilayah Menyusut"
              value={`${stats.negatif} wilayah`}
              sub={`dari ${data.length} wilayah`}
              accent="bg-red-500"
            />
          </>
        ) : <p className="col-span-full text-sm text-zinc-500">Statistik belum tersedia untuk wilayah ini.</p>}
      </section>

      {/* Peta */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-serif font-semibold text-zinc-900 dark:text-zinc-100">
            Peta Choropleth
          </h2>
          <ChartToggle
            options={MAP_MODE_OPTIONS}
            value={mapMode}
            onChange={setMapMode}
          />
        </div>
        <Card className="p-0 overflow-hidden">
          <div className="relative h-[480px]">
            <MapView
              geojson={geojson}
              data={data}
              mode={mapMode}
              onHover={handleHover}
            />
            <InfoPanel kecamatan={hoveredKec} />
          </div>
        </Card>
      </section>

      {/* Grafik */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-serif font-semibold text-zinc-900 dark:text-zinc-100">
            Grafik Perbandingan
          </h2>
          <ChartToggle options={CHART_OPTIONS} value={chartMode} onChange={setChartMode} />
        </div>
        <Card>
          {loading ? (
            <div className="h-[420px] skeleton rounded" />
          ) : (
            <div className="h-[420px]">
              {chartMode === 'penduduk' ? (
                <BarChart
                  labels={sortedPenduduk.map((d) => d.nama_kecamatan)}
                  values={sortedPenduduk.map((d) => d.jumlah_penduduk)}
                  color="#16a34a"
                  label="Jumlah Penduduk"
                  formatter={(v) => `${v.toLocaleString('id-ID')} jiwa`}
                />
              ) : (
                <BarChart
                  labels={sortedLaju.map((d) => d.nama_kecamatan)}
                  values={sortedLaju.map((d) => d.laju_pertumbuhan)}
                  color="#f59e0b"
                  label="Laju Pertumbuhan (%)"
                  formatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`}
                />
              )}
            </div>
          )}
        </Card>
      </section>

      {/* Tabel */}
      <section>
        <h2 className="text-lg font-serif font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Data Lengkap
        </h2>
        <Card>
          <DataTable data={data} loading={loading} />
        </Card>
      </section>

      {/* Tim */}
      <section aria-labelledby="team-heading">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-widest text-jember-600 mb-1">Di balik data</p>
          <h2 id="team-heading" className="text-xl font-serif font-semibold text-zinc-900 dark:text-zinc-100">
            {team?.name || 'Tim Pengembang'}
          </h2>
        </div>
        {teamError ? (
          <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">{teamError}</p>
        ) : team?.members?.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {team.members.map((member) => (
              <Card key={member.id} className="flex flex-col items-center gap-3 text-center">
                <img
                  src={resolveApiAssetUrl(member.photo_url)}
                  alt={`Foto ${member.name}`}
                  loading="lazy"
                  className="h-24 w-24 rounded-full object-cover ring-2 ring-jember-100 dark:ring-jember-900"
                />
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{member.name}</h3>
                  {member.position && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{member.position}</p>}
                </div>
              </Card>
            ))}
          </div>
        ) : team ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Anggota tim akan segera ditampilkan.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="flex h-40 flex-col items-center justify-center gap-3">
                <div className="h-20 w-20 rounded-full skeleton" />
                <div className="h-3 w-24 skeleton" />
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}