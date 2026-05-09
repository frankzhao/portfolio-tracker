import { createContext, useContext, useState, useCallback } from 'react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((msg, duration = 3000) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className="toast">{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
