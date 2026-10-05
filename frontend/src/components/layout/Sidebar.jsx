// Sidebar navigasi admin.
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, MapPin, LogOut, Map, UsersRound } from 'lucide-react'
import api from '@/lib/api'
import useAuthStore from '@/stores/authStore'
import { cn } from '@/lib/utils'
import ThemeToggle from './ThemeToggle'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/kecamatan', label: 'Data Kecamatan', icon: MapPin },
  { to: '/admin/users', label: 'Pengguna & Tim', icon: UsersRound, adminOnly: true },
]

export default function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await api.post('/auth.php?action=logout')
    } catch (_) { /* abaikan error jaringan */ }
    clearAuth()
    navigate('/login')
  }

  return (
    <aside className="sticky top-0 h-screen w-56 shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2 px-5 border-b border-zinc-200 dark:border-zinc-800">
        <Map size={16} className="text-jember-600" />
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">GIS Wilayah</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-0.5">
        {navItems.filter(({ adminOnly }) => !adminOnly || user?.role === 'admin').map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-fast',
                isActive
                  ? 'bg-jember-50 text-jember-700 dark:bg-jember-950 dark:text-jember-300'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
              )
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 mb-1">
          <div className="min-w-0">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Masuk sebagai</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{user?.username}</p>
          </div>
          <ThemeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-red-400 transition-fast"
        >
          <LogOut size={15} />
          Keluar
        </button>
      </div>
    </aside>
  )
}
