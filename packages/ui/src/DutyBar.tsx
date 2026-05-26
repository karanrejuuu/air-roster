import styles from './DutyBar.module.css'

type DutyBarProps = {
  max: number
  used: number
}

function stateFor(percent: number) {
  if (percent >= 95) return 'danger'
  if (percent >= 80) return 'warn'
  return 'ok'
}

export function DutyBar({ max, used }: DutyBarProps) {
  const safeMax = Math.max(max, 1)
  const pct = Math.min((used / safeMax) * 100, 100)
  const state = stateFor(pct)

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>{used} / {max} hrs</div>
      <div className={styles.track}>
        <div className={`${styles.fill} ${styles[state]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
