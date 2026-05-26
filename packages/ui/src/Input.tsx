import { forwardRef, type InputHTMLAttributes } from 'react'
import styles from './Input.module.css'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, label, ...props }, ref) {
  const input = <input className={`${styles.field} ${className ?? ''}`} ref={ref} {...props} />
  if (!label) return input
  return <label className={styles.label}>{label}{input}</label>
})
