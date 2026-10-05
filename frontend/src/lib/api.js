// frontend/src/lib/api.js
import axios from 'axios'
import useAuthStore from '@/stores/authStore'

// Endpoint geography?action=map memanggil BPS & BIG secara eksternal.
// Saat cold cache (DB kosong) bisa makan 60-90 detik — jangan timeout terlalu cepat.
// Endpoint ringan (provinces, regencies) tetap 15 detik.
export const TIMEOUT_FAST = 15_000   // 15s  — untuk list, auth, CRUD
export const TIMEOUT_SLOW = 120_000  // 120s — untuk map/BPS/BIG cold call

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/backend/api',
  withCredentials: true,
  timeout: TIMEOUT_FAST,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const csrfToken = useAuthStore.getState().csrfToken
  if (csrfToken && config.headers) {
    config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})

export default api
