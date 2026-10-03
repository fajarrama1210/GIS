// Halaman login dengan validasi zod + rate limiting frontend.
import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Lock } from 'lucide-react'
import api from '@/lib/api'
import useAuthStore from '@/stores/authStore'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

const schema = z.object({
  username: z
    .string()
    .min(3, 'Username minimal 3 karakter')
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username hanya boleh huruf, angka, atau underscore'),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .regex(/[A-Z]/, 'Harus mengandung huruf kapital')
    .regex(/[a-z]/, 'Harus mengandung huruf kecil')
    .regex(/[0-9]/, 'Harus mengandung angka'),
})

export default function LoginPage() {
  const { user, setAuth } = useAuthStore()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  // Sudah login — redirect ke admin
  if (user) return <Navigate to="/admin" replace />

  async function onSubmit(values) {
    if (rateLimited) return
    setServerError('')
    setRateLimited(true)
    setTimeout(() => setRateLimited(false), 1500)

    try {
      const res = await api.post('/auth.php?action=login', values)
      setAuth(res.data.data, res.data.data.csrf_token)
      navigate('/admin', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.message || 'Terjadi kesalahan. Coba lagi.'
      // Pesan dari server sudah generik; tidak bocorkan info
      setServerError(msg)
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-jember-600 mb-4">
            <Lock size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900 dark:text-zinc-100">
            Masuk ke Panel Admin
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Data Penduduk Kabupaten Jember
          </p>
        </div>

        {/* Form */}
        <div className="card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <Input
              id="username"
              label="Username"
              type="text"
              autoComplete="username"
              placeholder="admin"
              error={errors.username?.message}
              {...register('username')}
            />

            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`w-full px-3 py-2 pr-10 text-sm rounded-md border bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 transition-fast focus:outline-none focus:ring-2 focus:ring-jember-500/30 ${
                    errors.password
                      ? 'border-red-400'
                      : 'border-zinc-200 dark:border-zinc-700 focus:border-jember-500'
                  }`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-fast"
                  aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div className="px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                {serverError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full justify-center"
              disabled={isSubmitting || rateLimited}
            >
              {isSubmitting ? 'Masuk...' : 'Masuk'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/')}
              className="w-full justify-center"
            >
              Kembali ke Beranda
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
