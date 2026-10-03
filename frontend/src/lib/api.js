// frontend/src/lib/api.js
import axios from 'axios'
import useAuthStore from '@/stores/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/backend/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const csrfToken = useAuthStore.getState().csrfToken

  if (csrfToken && config.headers) {
    config.headers['X-CSRF-Token'] = csrfToken
  }

  return config
})

export default api
