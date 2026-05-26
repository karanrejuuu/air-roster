import { type ReactNode } from 'react'
import styles from './Badge.module.css'

export type BadgeVariant = 'ok' | 'warn' | 'danger' | 'neutral'

type BadgeProps = {
  children: ReactNode
  variant?: BadgeVariant
}

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>
}
