// Layout halaman publik — navbar di atas, konten di bawah.
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import { ToastProvider } from '@/components/ui/Toast'

export default function PublicLayout() {
  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-400">
          By Matrix &mdash; 2025 &copy; All rights reserved.
        </footer>
      </div>
    </ToastProvider>
  )
}
