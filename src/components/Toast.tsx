import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

export interface ToastOptions {
  type?: ToastType
  // 「取り消す」等のアクション。指定時は表示時間を長めにとる
  action?: { label: string; onClick: () => void }
  durationMs?: number
}

interface ToastItem {
  id: number
  message: string
  type: ToastType
  action?: { label: string; onClick: () => void }
}

export type ShowToast = (message: string, options?: ToastOptions) => void

const ToastContext = createContext<ShowToast>(() => {})

export function useToast(): ShowToast {
  return useContext(ToastContext)
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-[#CE9C68]/50',
  error:   'border-red-500/60',
  info:    'border-[#3e3020]',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback<ShowToast>((message, options) => {
    const id = nextId.current++
    setToasts(prev => [
      ...prev.slice(-1), // 同時表示は最大2件
      { id, message, type: options?.type ?? 'info', action: options?.action },
    ])
    const duration = options?.durationMs ?? (options?.action ? 5000 : 2500)
    setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto w-full max-w-lg bg-[#2E2018] border ${TYPE_STYLES[t.type]} rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3`}
              style={{ animation: 'fade-up 0.2s ease-out' }}
            >
              <p className={`flex-1 text-sm ${t.type === 'error' ? 'text-red-300' : 'text-[#F7EFE6]'}`}>
                {t.message}
              </p>
              {t.action && (
                <button
                  type="button"
                  onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                  className="shrink-0 text-sm font-semibold text-[#CE9C68] px-2 py-1 -my-1 active:opacity-70"
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

// 削除アンドゥ後にリストを再読込させるための通知
export const DATA_RESTORED_EVENT = 'megroove:data-restored'

export function notifyDataRestored(): void {
  window.dispatchEvent(new Event(DATA_RESTORED_EVENT))
}
