import axios from 'axios'
import useAuthStore from '@/stores/authStore'

const api = axios.create({
  baseURL: 'http://localhost/GIS/backend/api',
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