import { Check } from 'lucide-react'
import { create } from 'zustand'
import styles from './Toast.module.css'

export type ToastRecord = {
  id: string
  message: string
  undo?: () => void
}

type ToastState = {
  removeToast: (id: string) => void
  toasts: ToastRecord[]
  toast: (message: string, undo?: () => void) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  toast: (message, undo) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, message, undo }] }))
    window.setTimeout(() => get().removeToast(id), 4000)
  },
  toasts: []
}))

export function ToastViewport() {
  const { removeToast, toasts } = useToastStore()

  return (
    <div className={styles.viewport} role="status">
      {toasts.map((toast) => (
        <div className={styles.toast} key={toast.id}>
          <div className={styles.row}>
            <Check className={styles.icon} size={16} strokeWidth={1.5} />
            <div className={styles.message}>{toast.message}</div>
            {toast.undo ? (
              <button
                className={styles.undo}
                onClick={() => {
                  toast.undo?.()
                  removeToast(toast.id)
                }}
                type="button"
              >
                Undo
              </button>
            ) : null}
          </div>
          <div className={styles.bar} />
        </div>
      ))}
    </div>
  )
}
