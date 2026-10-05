// Form create/edit kecamatan — mengikuti pola CRUD admin sebelum integrasi BPS.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

export const PROVINSI_LIST = [
  'ACEH',
  'BALI',
  'BANGKA BELITUNG',
  'BANTEN',
  'BENGKULU',
  'DAERAH ISTIMEWA YOGYAKARTA',
  'DKI JAKARTA',
  'GORONTALO',
  'JAMBI',
  'JAWA BARAT',
  'JAWA TENGAH',
  'JAWA TIMUR',
  'KALIMANTAN BARAT',
  'KALIMANTAN SELATAN',
  'KALIMANTAN TENGAH',
  'KALIMANTAN TIMUR',
  'KALIMANTAN UTARA',
  'KEPULAUAN RIAU',
  'LAMPUNG',
  'MALUKU',
  'MALUKU UTARA',
  'NUSA TENGGARA BARAT',
  'NUSA TENGGARA TIMUR',
  'PAPUA',
  'PAPUA BARAT',
  'RIAU',
  'SULAWESI BARAT',
  'SULAWESI SELATAN',
  'SULAWESI TENGAH',
  'SULAWESI TENGGARA',
  'SULAWESI UTARA',
  'SUMATERA BARAT',
  'SUMATERA SELATAN',
  'SUMATERA UTARA',
]

const schema = z.object({
  kode_kecamatan:   z.string()
    .optional()
    .or(z.literal(''))
    .refine((code) => !code || /^\d{7}$/.test(code), 'Kode harus 7 digit atau kosongkan untuk dibuat otomatis'),
  nama_kecamatan:   z.string().min(2, 'Min 2 karakter').max(50, 'Maks 50 karakter'),
  jumlah_penduduk:  z.coerce.number().int('Harus bilangan bulat').min(1, 'Min 1'),
  laju_pertumbuhan: z.coerce.number().min(-10, 'Min -10').max(20, 'Maks 20'),
  luas_wilayah:     z.coerce.number().min(0.01, 'Min 0.01'),
  jumlah_faskes:    z.coerce.number().int().min(0).optional().default(0),
  jumlah_rentan:    z.coerce.number().int().min(0).optional().default(0),
  latitude:         z.coerce.number().min(-90, 'Min -90').max(90, 'Maks 90'),
  longitude:        z.coerce.number().min(-180, 'Min -180').max(180, 'Maks 180'),
})

const fieldLabels = {
  kode_kecamatan: 'Kode kecamatan',
  nama_kecamatan: 'Nama kecamatan',
  jumlah_penduduk: 'Jumlah penduduk',
  laju_pertumbuhan: 'Laju pertumbuhan',
  luas_wilayah: 'Luas wilayah',
  jumlah_faskes: 'Jumlah fasilitas kesehatan',
  jumlah_rentan: 'Jumlah penduduk rentan',
  latitude: 'Latitude',
  longitude: 'Longitude',
}

export default function KecamatanFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const addToast = useToast()
  const [provinces, setProvinces] = useState([])
  const [regencies, setRegencies] = useState([])
  const [provinceCode, setProvinceCode] = useState('3500000')
  const [regencyCode, setRegencyCode] = useState('3509000')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      provinsi: 'JAWA TIMUR',
      kabupaten: 'Kabupaten Jember',
      kode_kecamatan: '',
      nama_kecamatan: '',
      jumlah_penduduk: '',
      laju_pertumbuhan: '',
      luas_wilayah: '',
      jumlah_faskes: '0',
      jumlah_rentan: '0',
      latitude: '',
      longitude: '',
    },
  })

  useEffect(() => {
    let active = true
    api.get('/geography.php?action=provinces')
      .then((response) => {
        if (active) setProvinces(response.data.data)
      })
      .catch((error) => {
        if (active) addToast({ message: error.response?.data?.message || 'Daftar provinsi gagal dimuat.', type: 'error' })
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!provinceCode) {
      setRegencies([])
      return undefined
    }
    let active = true
    api.get('/geography.php?action=regencies', { params: { parent: provinceCode } })
      .then((response) => {
        if (!active) return
        const list = response.data.data
        setRegencies(list)
        if (!isEdit && !list.some((regency) => regency.code === regencyCode) && list.length) {
          setRegencyCode(list[0].code)
        }
      })
      .catch((error) => {
        if (active) addToast({ message: error.response?.data?.message || 'Daftar kabupaten/kota gagal dimuat.', type: 'error' })
      })
    return () => { active = false }
  }, [provinceCode, isEdit])

  useEffect(() => {
    if (!isEdit) return
    let active = true
    api.get('/kecamatan.php')
      .then((response) => {
        if (!active) return
        const found = response.data.data.find((row) => String(row.id) === id)
        if (!found) {
          addToast({ message: 'Data kecamatan tidak ditemukan.', type: 'error' })
          return
        }
        reset(found)
        setRegencyCode(found.kode_kabupaten || '3509000')
        setProvinceCode(`${(found.kode_kabupaten || '3509000').slice(0, 2)}00000`)
      })
      .catch((error) => {
        if (active) addToast({ message: error.response?.data?.message || 'Gagal memuat data.', type: 'error' })
      })
    return () => { active = false }
  }, [id, isEdit])

  async function onSubmit(values) {
    const payload = {
      ...values,
      kode_kecamatan: values.kode_kecamatan?.trim() || '',
      kode_kabupaten: regencyCode,
      sumber_data: 'Input Admin',
      tahun_data: new Date().getFullYear(),
      aktif_di_peta: 1,
    }
    try {
      if (isEdit) {
        await api.put(`/kecamatan.php?id=${id}`, payload)
        addToast({ message: 'Kecamatan berhasil diperbarui.', type: 'success' })
      } else {
        await api.post('/kecamatan.php', payload)
        addToast({ message: 'Kecamatan berhasil ditambahkan.', type: 'success' })
      }
      navigate('/admin/kecamatan')
    } catch (error) {
      const fieldErrors = error.response?.data?.data
      const details = fieldErrors && typeof fieldErrors === 'object'
        ? Object.entries(fieldErrors).map(([field, message]) => `${fieldLabels[field] || field}: ${message}`).join(' ')
        : ''
      addToast({ message: details || error.response?.data?.message || 'Terjadi kesalahan.', type: 'error' })
    }
  }

  function onInvalid(formErrors) {
    const messages = Object.entries(formErrors)
      .map(([field, error]) => `${fieldLabels[field] || field}: ${error.message || 'Periksa kembali nilai.'}`)
      .join(' ')
    addToast({ message: messages || 'Lengkapi data kecamatan dengan benar.', type: 'error' })
  }

  const fields = [
    { name: 'nama_kecamatan',   label: 'Nama Kecamatan',   type: 'text',   placeholder: 'cth. Sumbersari', required: true },
    { name: 'jumlah_penduduk',  label: 'Jumlah Penduduk',  type: 'number', placeholder: '132500', required: true },
    { name: 'laju_pertumbuhan', label: 'Laju Pertumbuhan (%)', type: 'number', placeholder: '1.50', step: '0.01', required: true },
    { name: 'luas_wilayah',     label: 'Luas Wilayah (km²)', type: 'number', placeholder: '37.00', step: '0.01', required: true },
    { name: 'jumlah_faskes',    label: 'Jumlah Faskes',    type: 'number', placeholder: '14' },
    { name: 'jumlah_rentan',    label: 'Penduduk Rentan',  type: 'number', placeholder: '3100' },
    { name: 'latitude',         label: 'Latitude',         type: 'number', placeholder: '-8.162', step: '0.0000001', required: true },
    { name: 'longitude',        label: 'Longitude',        type: 'number', placeholder: '113.723', step: '0.0000001', required: true },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <button
          onClick={() => navigate('/admin/kecamatan')}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-fast mb-3"
        >
          <ArrowLeft size={13} /> Kembali ke Daftar
        </button>
        <h1 className="text-2xl font-serif font-semibold text-zinc-900 dark:text-zinc-100">
          {isEdit ? 'Edit Data Wilayah / Kecamatan' : 'Tambah Wilayah / Kecamatan Baru'}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Masukkan data wilayah dan indikator kependudukan BPS se-Indonesia.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-5" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Provinsi *</span>
              <select
                value={provinceCode}
                onChange={(event) => {
                  setProvinceCode(event.target.value)
                  setRegencyCode('')
                }}
                className="w-full px-3 py-2 text-sm rounded-md border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {provinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Kabupaten/Kota induk *</span>
              <select
                value={regencyCode}
                onChange={(event) => setRegencyCode(event.target.value)}
                className={`w-full px-3 py-2 text-sm rounded-md border bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 ${!regencyCode ? 'border-red-400 dark:border-red-500' : 'border-zinc-200 dark:border-zinc-700'}`}
              >
                <option value="">Pilih kabupaten/kota</option>
                {regencies.map((regency) => <option key={regency.code} value={regency.code}>{regency.name}</option>)}
              </select>
              {!regencyCode && <span className="text-xs text-red-600">Pilih kabupaten/kota induk.</span>}
            </label>
          </div>

          {!isEdit && (
            <Input
              id="kode_kecamatan"
              label="Kode Kecamatan (opsional)"
              type="text"
              placeholder="Kosongkan agar dibuat otomatis"
              error={errors.kode_kecamatan?.message}
              {...register('kode_kecamatan')}
            />
          )}

          {isEdit && <input type="hidden" {...register('kode_kecamatan')} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(({ name, label, type, placeholder, step, required }) => (
              <Input
                key={name}
                id={name}
                label={`${label}${required ? ' *' : ''}`}
                type={type}
                placeholder={placeholder}
                step={step}
                error={errors[name]?.message}
                {...register(name)}
              />
            ))}
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Data yang ditambahkan admin akan ditandai sebagai sumber admin. Statistik BPS yang tersedia tetap diprioritaskan; jika batas BIG tidak tersedia, peta memakai koordinat di atas.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 divider">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/admin/kecamatan')}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting || !regencyCode}>
              {isSubmitting ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah Kecamatan'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
