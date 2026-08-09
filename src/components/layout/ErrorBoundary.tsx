import * as React from 'react'

/**
 * Catches render-time errors so one bad screen cannot take the whole app down.
 *
 * Without a boundary React unmounts the entire tree on any uncaught render error: the window
 * goes blank, the sidebar and header go with it, and there is no way back except restarting
 * the app — which is exactly what "the app crashed and I can't do anything" looks like. It also
 * means the error message is only visible in DevTools, so a user can never report what broke.
 *
 * This keeps the failure local, shows the real message and component stack, and offers two ways
 * out that don't require killing the process: dismiss the error (re-mount the same screen) or
 * go back to the Dashboard.
 */
interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
  componentStack: string | null
  /** Bumped on retry so the subtree remounts from scratch instead of re-throwing immediately. */
  resetKey: number
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: null, resetKey: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the console trail — the main process logs renderer console output.
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack)
    this.setState({ componentStack: info.componentStack ?? null })
  }

  private handleRetry = () => {
    this.setState((s) => ({ error: null, componentStack: null, resetKey: s.resetKey + 1 }))
  }

  private handleGoHome = () => {
    // HashRouter, so this is a same-document navigation; the reload re-mounts everything.
    window.location.hash = '#/'
    window.location.reload()
  }

  render() {
    const { error, componentStack, resetKey } = this.state
    const isAr = document.documentElement.lang === 'ar'

    if (!error) {
      return <React.Fragment key={resetKey}>{this.props.children}</React.Fragment>
    }

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-2xl w-full bg-white border border-rose-200 rounded-xl shadow-sm p-6 space-y-4 text-start">
          <div className="flex items-start gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                {isAr ? 'حدث خطأ غير متوقع في هذه الشاشة' : 'Something went wrong on this screen'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {isAr
                  ? 'بياناتك محفوظة. يمكنك المحاولة مرة أخرى أو العودة إلى لوحة التحكم دون إغلاق البرنامج.'
                  : 'Your data is safe. You can try again or go back to the Dashboard without closing the app.'}
              </p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
            <p className="font-mono text-xs text-rose-300 whitespace-pre-wrap break-words">
              {error.name}: {error.message}
            </p>
            {componentStack && (
              <pre className="font-mono text-[10px] text-slate-400 mt-3 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                {componentStack.trim()}
              </pre>
            )}
          </div>

          <p className="text-xs text-slate-400">
            {isAr
              ? 'انسخ الرسالة أعلاه عند الإبلاغ عن المشكلة — فهي تحدد مكان الخطأ بالضبط.'
              : 'Copy the message above when reporting this — it pinpoints exactly where the error is.'}
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {isAr ? 'إعادة المحاولة' : 'Try again'}
            </button>
            <button
              onClick={this.handleGoHome}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              {isAr ? 'العودة إلى لوحة التحكم' : 'Back to Dashboard'}
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(`${error.name}: ${error.message}\n${componentStack ?? ''}`)}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              {isAr ? 'نسخ تفاصيل الخطأ' : 'Copy error details'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
