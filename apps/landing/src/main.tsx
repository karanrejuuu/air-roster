import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, demoCredentials, routeForRole, useAuth, type UserRole } from '@supabase'
import { Button, Input, Overline, ToastViewport, useToastStore } from '@ui/index'
import '@ui/styles.css'
import { Eye, EyeOff, FileText, Plane, Shield } from 'lucide-react'
import { useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import styles from './styles.module.css'

const qc = new QueryClient()

declare global {
  interface Window {
    __airrosterLandingRoot?: Root
  }
}

function LoginForm() {
  const { profile, signIn } = useAuth()
  const toast = useToastStore((state) => state.toast)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  return (
    <form
      className={styles.loginCard}
      onSubmit={(event) => {
        event.preventDefault()
        setSubmitting(true)
        signIn(email, password)
          .then(() => {
            const demoRole = demoCredentials[email.toLowerCase()]?.role
            window.location.href = routeForRole((demoRole ?? profile?.role ?? 'admin') as UserRole)
          })
          .catch((error: Error) => toast(error.message))
          .finally(() => setSubmitting(false))
      }}
    >
      <Input autoComplete="email" label="Email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
      <label className={styles.passwordLabel}>
        <span>Password</span>
        <div className={styles.passwordWrap}>
          <input
            autoComplete="current-password"
            className={styles.passwordInput}
            onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? 'text' : 'password'}
            value={password}
          />
          <button aria-label="Show password" onClick={() => setShowPassword((value) => !value)} type="button">
            {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
          </button>
        </div>
      </label>
      <span className={styles.chip}>Your role is detected automatically</span>
      <Button disabled={submitting} fullWidth type="submit">{submitting ? 'Signing in' : 'Sign in'}</Button>
      <p className={styles.note}>Forgot password? Contact your airline administrator.</p>
    </form>
  )
}

function App() {
  return (
    <>
      <nav className={styles.nav}>
        <a className={styles.wordmark} href="#top">AirRoster</a>
        <Button onClick={() => document.getElementById('login')?.scrollIntoView({ behavior: 'smooth' })} size="sm" variant="ghost">Sign in</Button>
      </nav>
      <main id="top">
        <section
          className={styles.hero}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            event.currentTarget.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`)
            event.currentTarget.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`)
          }}
        >
          <span className={styles.heroBeam} />
          <span className={styles.heroGrain} />
          <div className={styles.heroInner}>
            <Overline>AVIATION CREW MANAGEMENT</Overline>
            <h1>Every crew, every flight,<br />perfectly rostered.</h1>
            <p>Premium operations tooling for dispatch teams and crew members who need clarity before the aircraft door closes.</p>
            <div className={styles.heroActions}>
              <Button onClick={() => document.getElementById('login')?.scrollIntoView({ behavior: 'smooth' })} size="lg">Get started</Button>
              <a href="#features">Learn more ↓</a>
            </div>
          </div>
        </section>

        <section className={styles.features} id="features">
          <article>
            <Plane size={20} strokeWidth={1.5} />
            <h2>Intelligent rostering</h2>
            <p>Drag-and-drop assignment with real-time duty hour tracking.</p>
          </article>
          <article>
            <FileText size={20} strokeWidth={1.5} />
            <h2>Full flight briefings</h2>
            <p>Pilots and cabin crew get weather, route, aircraft, and crew list.</p>
          </article>
          <article>
            <Shield size={20} strokeWidth={1.5} />
            <h2>Role-based access</h2>
            <p>Admin, dispatcher, pilot and cabin crew each see exactly what they need.</p>
          </article>
        </section>

        <section className={styles.loginSection} id="login">
          <div className={styles.loginHeader}>
            <Overline>SIGN IN TO AIRROSTER</Overline>
            <h2>Welcome back.</h2>
          </div>
          <LoginForm />
          <div className={styles.demoBox}>
            <Overline>Demo credentials</Overline>
            <p><strong>Admin:</strong> admin@airroster.local</p>
            <p><strong>Dispatcher:</strong> dispatcher@airroster.local</p>
            <p><strong>Pilot:</strong> arjun.varma@airroster.local</p>
            <p><strong>Cabin:</strong> nina.joshi@airroster.local</p>
            <small>Password for all demo accounts: AirRoster2026!</small>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div><span>AirRoster</span> © 2026</div>
        <p>Built for modern aviation operations</p>
      </footer>
      <ToastViewport />
    </>
  )
}

const rootElement = document.getElementById('root')!
const root = window.__airrosterLandingRoot ?? createRoot(rootElement)
window.__airrosterLandingRoot = root

root.render(
  <QueryClientProvider client={qc}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>
)
