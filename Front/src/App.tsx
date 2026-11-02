import { useEffect, useState, type FormEvent } from 'react'
import {
  ApiError,
  getCurrentUser,
  getTasks,
  login,
  logout,
  type Task,
  type User,
} from './utils/api'
import './App.css'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    async function restoreSession() {
      try {
        const { user: currentUser } = await getCurrentUser()

        if (!isCurrent) {
          return
        }

        setUser(currentUser)
        const { tasks: assignedTasks } = await getTasks()

        if (isCurrent) {
          setTasks(assignedTasks)
        }
      } catch (sessionError) {
        if (isCurrent && !(sessionError instanceof ApiError && sessionError.status === 401)) {
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : 'Unable to connect to the server.',
          )
        }
      } finally {
        if (isCurrent) {
          setLoading(false)
        }
      }
    }

    void restoreSession()

    return () => {
      isCurrent = false
    }
  }, [])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const { user: signedInUser } = await login(identifier, password)
      setUser(signedInUser)
      setPassword('')
      const { tasks: assignedTasks } = await getTasks()
      setTasks(assignedTasks)
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Unable to sign in. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    setSubmitting(true)
    setError(null)

    try {
      await logout()
      setUser(null)
      setTasks([])
      setPassword('')
    } catch (logoutError) {
      setError(
        logoutError instanceof Error
          ? logoutError.message
          : 'Unable to sign out. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <p className="status-message" role="status">Checking your session...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="page-shell">
        <section className="auth-card" aria-labelledby="login-title">
          <div className="brand-mark" aria-hidden="true">T</div>
          <p className="eyebrow">TASK TRACKER</p>
          <h1 id="login-title">Welcome back</h1>
          <p className="card-description">Sign in to see the tasks assigned to you.</p>

          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="identifier">Username or email</label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Your username or email"
              required
              maxLength={320}
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              required
              maxLength={1024}
            />

            {error && <p className="error-message" role="alert">{error}</p>}

            <button type="submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <section className="task-panel" aria-labelledby="tasks-title">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">TASK TRACKER</p>
            <h1 id="tasks-title">Your tasks</h1>
            <p className="card-description">Signed in as {user.name} · {user.email}</p>
          </div>
          <button
            className="sign-out-button"
            type="button"
            onClick={handleLogout}
            disabled={submitting}
          >
            {submitting ? 'Please wait...' : 'Sign out'}
          </button>
        </header>

        {error && <p className="error-message" role="alert">{error}</p>}

        {tasks.length === 0 ? (
          <p className="empty-state">There are no tasks assigned to you yet.</p>
        ) : (
          <ul className="task-list">
            {tasks.map((task) => (
              <li className="task-card" key={task.id}>
                <h2>{task.name}</h2>
                {task.description && <p>{task.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
