export default function Pill({ type }) {
  return <span className={`pill pill-${type}`}>{type}</span>
}
