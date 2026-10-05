import { MapPin } from 'lucide-react'

function SelectField({ id, label, value, options, onChange, disabled, placeholder }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}{option.source === 'admin' ? ' (Data admin)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function GeographySelector({
  provinces,
  regencies,
  districts,
  province,
  regency,
  district,
  onProvinceChange,
  onRegencyChange,
  onDistrictChange,
  disabled = false,
}) {
  return (
    <section className="card flex flex-col gap-3 p-4" aria-label="Pilih wilayah">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        <MapPin size={15} className="text-jember-600" />
        Wilayah yang ditampilkan
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField
          id="province-select"
          label="Provinsi"
          value={province}
          options={provinces}
          onChange={onProvinceChange}
          disabled={disabled || provinces.length === 0}
        />
        <SelectField
          id="regency-select"
          label="Kabupaten/Kota"
          value={regency}
          options={regencies}
          onChange={onRegencyChange}
          disabled={disabled || !province || regencies.length === 0}
          placeholder="Semua kabupaten/kota"
        />
        <SelectField
          id="district-select"
          label="Kecamatan"
          value={district}
          options={districts}
          onChange={onDistrictChange}
          disabled={disabled || !regency || districts.length === 0}
          placeholder="Semua kecamatan"
        />
      </div>
    </section>
  )
}
