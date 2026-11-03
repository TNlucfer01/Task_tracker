import { useEffect, useState } from 'react'
import { AppShell } from './components/AppShell'
import { useRoute } from './lib/router'
import { Login } from './pages/Login'
import { MyTasks } from './pages/MyTasks'
import { Attendance } from './pages/admin/Attendance'
import { Overview } from './pages/admin/Overview'
import { People } from './pages/admin/People'
import { Person } from './pages/admin/Person'
import { Projects } from './pages/admin/Projects'
import { Tasks } from './pages/admin/Tasks'
import { getCurrentUser, logout } from './api/auth'
import { ApiError } from './api/client'
import type { User } from './api/types'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let current = true
    getCurrentUser()
      .then(({ user }) => current && setUser(user))
      .catch((error: unknown) => {
        if (current && !(error instanceof ApiError && error.status === 401)) {
          setSessionError(error instanceof Error ? error.message : 'Unable to connect to the server.')
        }
      })
      .finally(() => current && setChecking(false))
    return () => {
      current = false
    }
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await logout()
    } finally {
      setSigningOut(false)
      setUser(null)
      window.location.hash = ''
    }
  }

  if (checking) {
    return (
      <p className="grid min-h-screen place-items-center text-ink-soft" role="status">
        Checking your session…
      </p>
    )
  }

  if (!user) {
    return (
      <>
        {sessionError && (
          <p className="bg-over-tint px-4 py-2.5 text-center text-sm text-over" role="alert">
            {sessionError}
          </p>
        )}
        <Login onSignedIn={setUser} />
      </>
    )
  }

  if (user.role !== 'admin') {
    return <MyTasks user={user} onSignOut={handleSignOut} signingOut={signingOut} />
  }

  return <AdminApp user={user} onSignOut={handleSignOut} signingOut={signingOut} />
}

function AdminApp({ user, onSignOut, signingOut }: { user: User; onSignOut: () => void; signingOut: boolean }) {
  const [section = '', ...params] = useRoute()

  let page
  switch (section) {
    case '':
      page = <Overview />
      break
    case 'people':
      page = params[0] && Number(params[0]) ? <Person key={params[0]} id={Number(params[0])} myId={user.id} /> : <People />
      break
    case 'projects':
      page = <Projects />
      break
    case 'tasks':
      page = <Tasks key={params.join('/')} params={params} />
      break
    case 'attendance':
      page = <Attendance />
      break
    default:
      page = (
        <div className="py-10">
          <h1 className="text-[34px] font-bold tracking-tight">Page not found</h1>
          <p className="mt-2 text-ink-soft">
            This page doesn't exist. <a href="#/">Go to the overview</a>
          </p>
        </div>
      )
  }

  return (
    <AppShell user={user} section={section} onSignOut={onSignOut} signingOut={signingOut}>
      {page}
    </AppShell>
  )
}
