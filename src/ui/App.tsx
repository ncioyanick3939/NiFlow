import { useState } from 'react'
import BottomNav from './BottomNav'
import type { Tab } from './BottomNav'
import SourceStatus from './SourceStatus'
import TodayView from './TodayView'
import WeekView from './WeekView'
import { useEvents, useNow } from './hooks'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const now = useNow()
  const { events, states, loading, reload } = useEvents()

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col border-x border-ink/10 bg-paper">
      <SourceStatus states={states} loading={loading} onReload={reload} />
      <main className="flex-1 overflow-y-auto">
        {tab === 'today' ? (
          <TodayView events={events} now={now} loading={loading} />
        ) : (
          <WeekView />
        )}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
