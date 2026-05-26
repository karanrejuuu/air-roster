import styles from './StatusDot.module.css'

export type DotColor = 'green' | 'amber' | 'red' | 'gray'

export function StatusDot({ color }: { color: DotColor }) {
  return <span className={`${styles.dot} ${styles[color]}`} />
}
