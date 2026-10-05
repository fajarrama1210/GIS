// Halaman publik utama — hero, stat cards, peta, grafik, tabel.
import { useState, useMemo, useCallback, useEffect } from 'react'
import { Users, TrendingUp, TrendingDown, MapPin } from 'lucide-react'
import { useKecamatan } from '@/hooks/useKecamatan'
import { useGeojson } from '@/hooks/useGeojson'
import { computeStats, formatNumber, formatGrowth, resolveApiAssetUrl } from '@/lib/utils'
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
  const { data, loading, error } = useKecamatan()
  const { geojson, loading: geoLoading, error: geoError } = useGeojson()
  const [mapMode, setMapMode] = useState('penduduk')
  const [chartMode, setChartMode] = useState('penduduk')
  const [hoveredKec, setHoveredKec] = useState(null)
  const [team, setTeam] = useState(null)
  const [teamError, setTeamError] = useState('')

  const stats = useMemo(() => computeStats(data), [data])

  // Data grafik — urutkan dan potong 15 teratas
  const sortedPenduduk = useMemo(
    () => [...data].sort((a, b) => b.jumlah_penduduk - a.jumlah_penduduk).slice(0, 15),
    [data],
  )
  const sortedLaju = useMemo(
    () => [...data].sort((a, b) => b.laju_pertumbuhan - a.laju_pertumbuhan),
    [data],
  )

  // ⚠️ WAJIB useCallback — biar MapView tidak re-render tiap parent render
  const handleHover = useCallback((kec) => setHoveredKec(kec), [])

  useEffect(() => {
    let active = true
    api.get('/team.php')
      .then((response) => {
        if (active) setTeam(response.data.data)
      })
      .catch(() => {
        if (active) setTeamError('Informasi tim tidak dapat dimuat saat ini.')
      })
    return () => { active = false }
  }, [])

  // Debug log — hapus setelah fix terkonfirmasi
  console.log('[HomePage] data:', data?.length,
    '| geojson features:', geojson?.features?.length,
    '| loading:', loading, geoLoading,
    '| error:', error?.message, geoError?.message)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-10">

      {/* Hero */}
      <section>
        <p className="text-xs font-medium text-jember-600 uppercase tracking-widest mb-2">
          BPS Kabupaten Jember &mdash; 2024
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
          Data Penduduk<br />
          <span className="text-jember-600">Kabupaten Jember</span>
        </h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 max-w-xl">
          Visualisasi interaktif data kependudukan 31 kecamatan. Peta choropleth,
          grafik perbandingan, dan tabel lengkap dengan data terkini BPS.
        </p>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              icon={Users}
              label="Total Penduduk"
              value={formatNumber(stats.total)}
              sub="jiwa seluruh kecamatan"
              accent="bg-jember-600"
            />
            <StatCard
              icon={MapPin}
              label="Kecamatan Terpadat"
              value={stats.terpadat.nama_kecamatan}
              sub={`${formatNumber(stats.terpadat.jumlah_penduduk)} jiwa`}
              accent="bg-amber-500"
            />
            <StatCard
              icon={TrendingUp}
              label="Pertumbuhan Tercepat"
              value={stats.tercepat.nama_kecamatan}
              sub={formatGrowth(stats.tercepat.laju_pertumbuhan)}
              accent="bg-jember-700"
            />
            <StatCard
              icon={TrendingDown}
              label="Laju Negatif"
              value={`${stats.negatif} kecamatan`}
              sub="mengalami penurunan"
              accent="bg-red-500"
            />
          </>
        )}
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
        ) : team?.members.length ? (
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