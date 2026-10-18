import { PageHeader } from '../components/Bits'
import { Feed } from '../components/Feed'
import { Heatmap } from '../components/Heatmap'
import { Freshness } from '../components/SaveStatus'
import { SearchSelect } from '../components/SearchSelect'
import { byName, useIndex } from '../lib/derive'
import { today } from '../lib/dates'

export function Home() {
  const ix = useIndex()
  const exercises = ix.data.exercises
    .filter((e) => !e.archived)
    .sort(byName)
    .map((e) => {
      const m = e.primary_muscle_id ? ix.muscle.get(e.primary_muscle_id) : undefined
      return { id: e.id, label: e.name, color: m?.color, sub: m?.name }
    })
  const muscles = ix.data.muscles
    .filter((m) => !m.archived)
    .sort(byName)
    .map((m) => ({ id: m.id, label: m.name, color: m.color }))

  return (
    <div className="page">
      <PageHeader title={<h1>Gym</h1>} right={<Freshness />} />
      <section className="section">
        <h2>Last 30 days</h2>
        <Heatmap days={30} values={ix.setsPerDate} layout="weeks-as-rows" onTap={(d) => (window.location.hash = `#/log/${d}`)} />
      </section>
      <a className="btn btn-primary btn-block btn-big" href={`#/log/${today()}`}>
        Log workout
      </a>
      <div className="grid-2">
        <SearchSelect options={exercises} placeholder="Exercise" onPick={(id) => (window.location.hash = `#/exercise/${id}`)} />
        <SearchSelect options={muscles} placeholder="Muscle" onPick={(id) => (window.location.hash = `#/muscle/${id}`)} />
      </div>
      <section className="section">
        <h2>History</h2>
        <Feed />
      </section>
    </div>
  )
}
