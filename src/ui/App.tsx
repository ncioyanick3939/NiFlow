import { useState } from 'react'
import BottomNav from './BottomNav'
import type { Tab } from './BottomNav'
import SourceStatus from './SourceStatus'
import TodayView from './TodayView'
import WeekView from './WeekView'
import { connectGoogle, disconnectGoogle } from '../lib/supabase'
import { useAuth, useEvents, useNow } from './hooks'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const now = useNow()
  const { connected, ready } = useAuth()
  const { events, states, loading, reload } = useEvents(connected, ready)

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col border-x border-ink/10 bg-paper">
      <SourceStatus
        states={states}
        loading={loading}
        onReload={reload}
        connected={connected}
        onConnect={() => void connectGoogle()}
        onDisconnect={() => void disconnectGoogle()}
      />
      <main className="flex-1 overflow-y-auto">
        {tab === 'today' ? (
          <TodayView events={events} now={now} loading={loading} />
        ) : (
          <WeekView events={events} now={now} loading={loading} />
        )}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
