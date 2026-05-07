import { useState, useRef } from 'react'

export type ToastType = 'success' | 'warning' | 'error'

export type Toast = {
  id: number
  type: ToastType
  title: string
  message: string
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const activeMessages = useRef<Set<string>>(new Set())

  const showToast = (type: ToastType, title: string, message: string) => {
    if (activeMessages.current.has(message)) return
    
    const id = Date.now() + Math.random()
    activeMessages.current.add(message)
    
    setToasts(prev => [...prev, { id, type, title, message }])
    
    setTimeout(() => {
      activeMessages.current.delete(message)
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }

  const dismissToast = (id: number) => {
    setToasts(prev => {
      const toast = prev.find(t => t.id === id)
      if (toast) activeMessages.current.delete(toast.message)
      return prev.filter(t => t.id !== id)
    })
  }

  return { toasts, showToast, dismissToast }
}
