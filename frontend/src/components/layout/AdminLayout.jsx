// Layout admin — sidebar kiri, konten kanan.
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { ToastProvider } from '@/components/ui/Toast'

export default function AdminLayout() {
  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </ToastProvider>
  )
}
