// Kelola akun, role, password, dan konten tim.
import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, RefreshCw, Trash2, Upload, UsersRound, X } from 'lucide-react'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import useAuthStore from '@/stores/authStore'
import { resolveApiAssetUrl } from '@/lib/utils'

const emptyUser = { username: '', password: '', role: 'editor' }
const emptyMember = { name: '', position: '', photo: null }

function requestError(error, fallback) {
  return error.response?.data?.message || fallback
}

export default function UsersPage() {
  const addToast = useToast()
  const { user, csrfToken, setAuth } = useAuthStore()
  const [users, setUsers] = useState([])
  const [team, setTeam] = useState({ name: 'Tim Pengembang', members: [] })
  const [userForm, setUserForm] = useState(emptyUser)
  const [editingUser, setEditingUser] = useState(null)
  const [memberForm, setMemberForm] = useState(emptyMember)
  const [editingMember, setEditingMember] = useState(null)
  const [teamName, setTeamName] = useState('')
  const [deletion, setDeletion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [userBusy, setUserBusy] = useState(false)
  const [teamBusy, setTeamBusy] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [usersResponse, teamResponse] = await Promise.all([
        api.get('/users.php'),
        api.get('/team.php'),
      ])
      setUsers(usersResponse.data.data)
      setTeam(teamResponse.data.data)
      setTeamName(teamResponse.data.data.name)
    } catch (error) {
      setLoadError(requestError(error, 'Data pengguna dan tim gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  function startEditUser(user) {
    setEditingUser(user)
    setUserForm({ username: user.username, role: user.role, password: '' })
  }

  function resetUserForm() {
    setEditingUser(null)
    setUserForm(emptyUser)
  }

  async function saveUser(event) {
    event.preventDefault()
    setUserBusy(true)
    try {
      const payload = { username: userForm.username, role: userForm.role }
      if (userForm.password) payload.password = userForm.password
      if (editingUser) {
        await api.put(`/users.php?id=${editingUser.id}`, payload)
        if (editingUser.id === Number(user?.id)) {
          setAuth({ ...user, username: userForm.username.trim() }, csrfToken)
        }
        addToast({ message: 'User berhasil diperbarui.' })
      } else {
        await api.post('/users.php', payload)
        addToast({ message: 'User berhasil ditambahkan.' })
      }
      resetUserForm()
      await loadData()
    } catch (error) {
      addToast({ message: requestError(error, 'User gagal disimpan.'), type: 'error' })
    } finally {
      setUserBusy(false)
    }
  }

  async function saveTeamName(event) {
    event.preventDefault()
    setTeamBusy(true)
    try {
      await api.post('/team.php?action=settings', { name: teamName })
      setTeam((current) => ({ ...current, name: teamName.trim() }))
      addToast({ message: 'Nama tim berhasil diperbarui.' })
    } catch (error) {
      addToast({ message: requestError(error, 'Nama tim gagal diperbarui.'), type: 'error' })
    } finally {
      setTeamBusy(false)
    }
  }

  function startEditMember(member) {
    setEditingMember(member)
    setMemberForm({ name: member.name, position: member.position, photo: null })
  }

  function resetMemberForm() {
    setEditingMember(null)
    setMemberForm(emptyMember)
  }

  async function saveMember(event) {
    event.preventDefault()
    if (!editingMember && !memberForm.photo) {
      addToast({ message: 'Foto anggota wajib dipilih.', type: 'error' })
      return
    }
    if (memberForm.photo && memberForm.photo.size > 5 * 1024 * 1024) {
      addToast({ message: 'Ukuran foto maksimal 5 MB.', type: 'error' })
      return
    }

    const formData = new FormData()
    formData.append('name', memberForm.name)
    formData.append('position', memberForm.position)
    if (memberForm.photo) formData.append('photo', memberForm.photo)
    const action = editingMember ? 'update' : 'add'
    const url = editingMember
      ? `/team.php?action=${action}&id=${editingMember.id}`
      : `/team.php?action=${action}`

    setTeamBusy(true)
    try {
      await api.post(url, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      addToast({ message: editingMember ? 'Anggota tim berhasil diperbarui.' : 'Anggota tim berhasil ditambahkan.' })
      resetMemberForm()
      await loadData()
    } catch (error) {
      addToast({ message: requestError(error, 'Anggota tim gagal disimpan.'), type: 'error' })
    } finally {
      setTeamBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deletion) return
    const target = deletion
    setTeamBusy(true)
    try {
      if (target.type === 'user') {
        await api.delete(`/users.php?id=${target.item.id}`)
        addToast({ message: 'User berhasil dihapus.' })
      } else {
        await api.delete(`/team.php?id=${target.item.id}`)
        addToast({ message: 'Anggota tim berhasil dihapus.' })
      }
      setDeletion(null)
      await loadData()
    } catch (error) {
      addToast({ message: requestError(error, 'Data gagal dihapus.'), type: 'error' })
    } finally {
      setTeamBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-zinc-400 mb-1">Panel Admin</p>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900 dark:text-zinc-100">Pengguna dan Tim</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Atur akun, hak akses, dan anggota tim yang ditampilkan di beranda.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} /> Muat ulang
        </Button>
      </header>

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <span>{loadError}</span>
          <Button variant="secondary" size="sm" onClick={loadData}>Coba lagi</Button>
        </div>
      )}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Manajemen pengguna</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Password disimpan dalam bentuk hash dan tidak pernah ditampilkan.</p>
        </div>
        <Card>
          <form onSubmit={saveUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="user-username"
              label="Username"
              value={userForm.username}
              onChange={(event) => setUserForm({ ...userForm, username: event.target.value })}
              minLength={3}
              maxLength={50}
              pattern="[A-Za-z0-9_]+"
              autoComplete="off"
              required
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="user-role" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Role</label>
              <select
                id="user-role"
                value={userForm.role}
                onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Input
              id="user-password"
              label={editingUser ? 'Password baru (opsional)' : 'Password awal'}
              type="password"
              value={userForm.password}
              onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              required={!editingUser}
              placeholder={editingUser ? 'Kosongkan jika tidak ingin mengganti' : 'Minimal 8 karakter'}
            />
            <p className="self-end text-xs text-zinc-500 dark:text-zinc-400">
              Password harus mengandung huruf besar, huruf kecil, dan angka.
            </p>
            <div className="sm:col-span-2 flex items-center gap-2">
              <Button type="submit" disabled={userBusy}>
                <Plus size={15} /> {userBusy ? 'Menyimpan...' : editingUser ? 'Simpan perubahan' : 'Tambah user'}
              </Button>
              {editingUser && <Button variant="secondary" onClick={resetUserForm}>Batal edit</Button>}
            </div>
          </form>
        </Card>

        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              <tr><th className="px-4 py-3 font-medium">Username</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Dibuat</th><th className="px-4 py-3 text-right font-medium">Aksi</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {loading ? (
                <tr><td className="px-4 py-5 text-zinc-500" colSpan="4">Memuat data pengguna...</td></tr>
              ) : users.length === 0 ? (
                <tr><td className="px-4 py-5 text-zinc-500" colSpan="4">Belum ada user.</td></tr>
              ) : users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{user.username}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{user.role === 'admin' ? 'Admin' : 'Editor'}</td>
                  <td className="px-4 py-3 text-zinc-500">{new Date(user.created_at).toLocaleDateString('id-ID')}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => startEditUser(user)}><Pencil size={13} /> Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => setDeletion({ type: 'user', item: user })}><Trash2 size={13} /> Hapus</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Pengelolaan tim</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nama dan foto anggota ini ditampilkan pada section Tim di bagian bawah beranda.</p>
        </div>
        <Card>
          <form onSubmit={saveTeamName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              id="team-name"
              label="Nama tim"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              minLength={2}
              maxLength={100}
              required
            />
            <Button type="submit" disabled={teamBusy}>Simpan nama tim</Button>
          </form>
        </Card>

        <Card>
          <form onSubmit={saveMember} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="member-name"
              label="Nama anggota"
              value={memberForm.name}
              onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })}
              maxLength={100}
              required
            />
            <Input
              id="member-position"
              label="Peran (opsional)"
              value={memberForm.position}
              onChange={(event) => setMemberForm({ ...memberForm, position: event.target.value })}
              maxLength={100}
            />
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="member-photo" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Foto anggota {editingMember ? '(opsional jika tidak diganti)' : ''}
              </label>
              <input
                id="member-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required={!editingMember}
                onChange={(event) => setMemberForm({ ...memberForm, photo: event.target.files?.[0] || null })}
                className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-jember-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-jember-700 dark:text-zinc-300 dark:file:bg-jember-950 dark:file:text-jember-300"
              />
              <p className="text-xs text-zinc-500">JPG, PNG, atau WebP; maksimal 5 MB.</p>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <Button type="submit" disabled={teamBusy}>
                <Upload size={14} /> {teamBusy ? 'Menyimpan...' : editingMember ? 'Simpan anggota' : 'Tambah anggota'}
              </Button>
              {editingMember && <Button variant="secondary" onClick={resetMemberForm}><X size={14} /> Batal</Button>}
            </div>
          </form>
        </Card>

        {loading ? (
          <p className="text-sm text-zinc-500">Memuat anggota tim...</p>
        ) : team.members.length === 0 ? (
          <Card className="flex items-center gap-3 text-sm text-zinc-500"><UsersRound size={18} /> Belum ada anggota tim. Tambahkan anggota dan fotonya untuk ditampilkan di beranda.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {team.members.map((member) => (
              <Card key={member.id} className="flex items-center gap-4">
                <img src={resolveApiAssetUrl(member.photo_url)} alt={`Foto ${member.name}`} className="h-16 w-16 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{member.name}</p>
                  <p className="truncate text-xs text-zinc-500">{member.position || 'Anggota tim'}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" aria-label={`Edit ${member.name}`} onClick={() => startEditMember(member)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="sm" aria-label={`Hapus ${member.name}`} onClick={() => setDeletion({ type: 'member', item: member })}><Trash2 size={14} className="text-red-600" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={Boolean(deletion)}
        title={deletion?.type === 'user' ? 'Hapus user' : 'Hapus anggota tim'}
        onClose={() => setDeletion(null)}
        onConfirm={confirmDelete}
        confirmText="Hapus"
        confirmVariant="danger"
        loading={teamBusy}
      >
        Yakin ingin menghapus <strong>{deletion?.item.username || deletion?.item.name}</strong>? Tindakan ini tidak dapat dibatalkan.
      </Modal>
    </div>
  )
}
