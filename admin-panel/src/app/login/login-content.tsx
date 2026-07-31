"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn, useSession } from "next-auth/react"
import { authUtils } from "@/shared/utils/auth"

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "Доступ запрещён. Ваш Google-аккаунт не в списке разрешённых.",
  OAuthSignin: "Ошибка входа через Google. Проверьте настройки OAuth.",
  OAuthCallback: "Ошибка callback Google OAuth.",
  Configuration: "OAuth не настроен на сервере (GOOGLE_CLIENT_ID / SECRET).",
  Default: "Ошибка авторизации. Попробуйте снова.",
}

export default function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const oauthError = searchParams.get("error")
    if (oauthError) {
      setError(ERROR_MESSAGES[oauthError] || ERROR_MESSAGES.Default)
    }
  }, [searchParams])

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return

    const establishBackendSession = async () => {
      setLoading(true)
      try {
        const response = await fetch("/api/auth/complete")
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Не удалось получить доступ к backend")
        }

        const { token } = await response.json()
        authUtils.setToken(token)
        router.push("/")
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Ошибка авторизации"
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    establishBackendSession()
  }, [status, session, router])

  const handleGoogleSignIn = () => {
    setError(null)
    setLoading(true)
    signIn("google", { callbackUrl: "/login" })
  }

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Проверка авторизации...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="admin-card w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-lg font-bold text-primary">
            I
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Imba CRM
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Вход для внутренних отчётов на cdn.imba.bet
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {loading ? "Вход..." : "Войти через Google"}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          После входа через Google backend-токен выдаётся автоматически
        </p>
      </div>
    </div>
  )
}
