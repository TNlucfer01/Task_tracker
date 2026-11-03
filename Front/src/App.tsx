// Top level: loads the session, then routes to a page inside the shell (or shows sign in).
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { onSignedOut } from './api/client'
import { auth } from './api/endpoints'
import type { Me } from './api/types'
import { Shell, ToastHost } from './components/Shell'
import { Button, Empty } from './components/ui'
import { ClockProvider } from './lib/clock'
import { href, useRoute } from './lib/router'
import { can, SessionContext } from './lib/session'
import { applyTheme, savedTheme } from './lib/theme'
import { onToast } from './lib/toast'
import { Account } from './pages/Account'
import { Dashboard } from './pages/Dashboard'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { People } from './pages/People'
import { Person } from './pages/Person'
import { ProjectPage } from './pages/Project'
import { Projects } from './pages/Projects'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { TaskPage } from './pages/Task'
import { Tasks } from './pages/Tasks'
import { Time } from './pages/Time'

applyTheme(savedTheme())

/** Picks the page for the current route, checking permissions. */
function Page({ me, parts, params }: { me: Me; parts: string[]; params: URLSearchParams }) {
  const [section, id] = parts
  const n = Number(id)
  const denied = (
    <Empty action={<Button onClick={() => (window.location.hash = href())}>Go home</Button>}>
      Your role doesn't include this page. Ask an admin if you need access.
    </Empty>
  )
  switch (section) {
    case undefined:
      return <Home />
    case 'tasks':
      return n ? <TaskPage id={n} /> : <Tasks params={params} />
    case 'projects':
      return n ? <ProjectPage id={n} params={params} /> : <Projects />
    case 'dashboard':
      return can(me, 'dashboard.view') ? <Dashboard /> : denied
    case 'people':
      if (!can(me, 'people.view')) return denied
      return n ? <Person id={n} /> : <People />
    case 'time':
      return <Time />
    case 'reports':
      return can(me, 'reports.export') ? <Reports /> : denied
    case 'settings':
      return <Settings tab={id} />
    case 'account':
      return <Account />
    default:
      return <Empty action={<Button onClick={() => (window.location.hash = href())}>Go home</Button>}>That page doesn't exist.</Empty>
  }
}

/** The app root. */
export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const [message, setMessage] = useState<string | null>(null)
  const { parts, params } = useRoute()

  const refresh = useCallback(async () => {
    try {
      setMe((await auth.me()).user)
    } catch {
      setMe(null)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return onSignedOut(() => setMe(null))
  }, [refresh])

  useEffect(() => {
    let timer = 0
    return onToast((m) => {
      setMessage(m)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setMessage(null), 3200)
    })
  }, [])

  const signOut = useCallback(async () => {
    await auth.logout().catch(() => {})
    setMe(null)
    window.location.hash = href()
  }, [])

  let body: ReactNode
  if (me === undefined) body = <div className="grid min-h-dvh place-items-center text-ink-faint">Loading…</div>
  else if (me === null) body = <Login onSignedIn={setMe} />
  else
    body = (
      <SessionContext.Provider value={{ me, refresh, signOut }}>
        <ClockProvider enabled={can(me, 'time.track')}>
          <Shell section={parts[0] ?? ''}>
            <Page me={me} parts={parts} params={params} />
          </Shell>
        </ClockProvider>
      </SessionContext.Provider>
    )

  return (
    <>
      {body}
      <ToastHost message={message} />
    </>
  )
}
