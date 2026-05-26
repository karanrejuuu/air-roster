import { type ReactNode } from 'react'
import styles from './Overline.module.css'

export function Overline({ children }: { children: ReactNode }) {
  return <span className={styles.overline}>{children}</span>
}
