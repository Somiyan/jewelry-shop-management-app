import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import { useAuth } from '../auth'
import type { AuthUser } from '../auth'
import { Button, Field, Input } from '../components'
import { AlertIcon } from '../components/icons'
import { extractErrorMessage } from '../utils/format'

interface LoginResponse {
  token: string
  user: AuthUser
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', { username, password })
      login(data.user, data.token)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-control bg-accent font-mono text-base font-semibold text-accent-ink"
          >
            A
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink">
              Sonali Jewellers — jewellery shop manager
            </h1>
            <p className="mt-1 text-sm text-ink-muted">Sign in to your staff account.</p>
          </div>
        </div>

        <div className="rounded-panel border border-line bg-surface p-5 sm:p-6">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <Field label="Username or email" required>
              <Input
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="jane.doe"
              />
            </Field>

            <Field label="Password" required>
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger"
              >
                <AlertIcon size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <Button type="submit" loading={isSubmitting} fullWidth>
              {isSubmitting ? 'Signing in' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-ink-muted">
          No account yet?{' '}
          <Link to="/users/add" className="font-medium text-accent hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
