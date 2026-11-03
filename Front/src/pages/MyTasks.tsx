import { Brand } from '../components/AppShell'
import { Button, DataState, OverdueTag, TaskStatusPill } from '../components/ui'
import { formatDate, plural } from '../lib/format'
import { useApi, useNow } from '../lib/useApi'
import { getTasks } from '../api/tasks'
import type { User } from '../api/types'

export function MyTasks({ user, onSignOut, signingOut }: { user: User; onSignOut: () => void; signingOut: boolean }) {
  const tasks = useApi(getTasks, 'my-tasks')
  const now = useNow(60_000)

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Brand />
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-ink-soft sm:inline">{user.name}</span>
            <Button onClick={onSignOut} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-8">
        <h1 className="text-[26px] leading-8 font-semibold tracking-tight">Your tasks</h1>
        <DataState
          state={tasks}
          isEmpty={(d) => d.tasks.length === 0}
          empty="No tasks are assigned to you yet. New tasks from your admin will appear here."
        >
          {(data) => {
            const open = data.tasks.filter((t) => t.status !== 'done')
            const done = data.tasks.filter((t) => t.status === 'done')
            return (
              <>
                <p className="mt-1.5 mb-8 text-ink-soft">
                  {plural(open.length, 'open task')}, {done.length} done
                </p>
                <ul className="border-t border-line-strong">
                  {[...open, ...done].map((t) => {
                    const overdue = t.status !== 'done' && t.deadline !== null && new Date(t.deadline).getTime() < now
                    return (
                      <li
                        key={t.id}
                        className={`flex flex-wrap justify-between gap-x-6 gap-y-2 border-b border-line py-5 ${t.status === 'done' ? 'text-ink-soft' : ''}`}
                      >
                        <div className="min-w-0 flex-1">
                          <h2 className="text-lg font-semibold">{t.name}</h2>
                          {t.description && <p className="mt-1 max-w-[65ch]">{t.description}</p>}
                          <p className="mt-1 text-sm text-ink-soft">{t.project?.name ?? 'No project'}</p>
                        </div>
                        <div className="flex flex-col items-start gap-1 text-sm sm:items-end">
                          <TaskStatusPill status={t.status} />
                          <span className="text-ink-soft">
                            {t.deadline ? `Due ${formatDate(t.deadline)}` : 'No deadline'}
                            {overdue && <OverdueTag />}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )
          }}
        </DataState>
      </main>
    </div>
  )
}
