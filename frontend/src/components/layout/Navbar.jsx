// Navbar halaman publik — logo, navigasi, dan toggle dark mode.
import { Link, useLocation } from 'react-router-dom'
import { Map } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

export default function Navbar() {
  const location = useLocation()

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 hover:text-jember-600 transition-fast">
          <Map size={18} className="text-jember-600" />
          <span className="font-semibold text-sm">GIS Wilayah</span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className={
              location.pathname === '/login'
                ? 'hidden'
                : 'text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-fast'
            }
          >
            Admin
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
