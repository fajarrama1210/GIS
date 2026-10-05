// Root router — mendefinisikan semua rute aplikasi.
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import PublicLayout from '@/components/layout/PublicLayout'
import AdminLayout from '@/components/layout/AdminLayout'
import ProtectedRoute from '@/routes/ProtectedRoute'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/admin/DashboardPage'
import KecamatanListPage from '@/pages/admin/KecamatanListPage'
import KecamatanFormPage from '@/pages/admin/KecamatanFormPage'
import UsersPage from '@/pages/admin/UsersPage'
import NotFoundPage from '@/pages/NotFoundPage'
import useAuthStore from '@/stores/authStore'

function AdminOnlyRoute() {
  const { user } = useAuthStore()
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/admin" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Halaman publik */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Halaman admin — dilindungi ProtectedRoute */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<DashboardPage />} />
            <Route path="/admin/kecamatan" element={<KecamatanListPage />} />
            <Route path="/admin/kecamatan/baru" element={<KecamatanFormPage />} />
            <Route path="/admin/kecamatan/:id/edit" element={<KecamatanFormPage />} />
            <Route element={<AdminOnlyRoute />}>
              <Route path="/admin/users" element={<UsersPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
