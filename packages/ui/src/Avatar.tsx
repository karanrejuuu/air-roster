import styles from './Avatar.module.css'

type AvatarProps = {
  initials: string
  size?: 'sm' | 'md' | 'lg'
}

export function Avatar({ initials, size = 'md' }: AvatarProps) {
  return <span aria-label={initials} className={`${styles.avatar} ${styles[size]}`}>{initials}</span>
}
