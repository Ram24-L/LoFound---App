import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'lofound_pwa_dismissed'

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((fn) => fn())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    notifyListeners()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notifyListeners()
  })
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent || ''
  const isIosDevice = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return isIosDevice && isSafari
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  if (window.location.pathname.startsWith('/staff')) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  })
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState<boolean>(() => Boolean(deferredPrompt))
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandaloneMode())
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const sync = () => {
      setCanInstall(Boolean(deferredPrompt))
      setIsInstalled(isStandaloneMode())
    }
    listeners.add(sync)
    const mq = window.matchMedia('(display-mode: standalone)')
    mq.addEventListener?.('change', sync)
    return () => {
      listeners.delete(sync)
      mq.removeEventListener?.('change', sync)
    }
  }, [])

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable'
    const evt = deferredPrompt
    deferredPrompt = null
    setCanInstall(false)
    await evt.prompt()
    const choice = await evt.userChoice
    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
    }
    return choice.outcome
  }

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {}
  }

  const isIosPromptable = !isInstalled && !canInstall && isIosSafari()

  return {
    canInstall,
    isIosPromptable,
    isInstalled,
    dismissed,
    promptInstall,
    dismiss,
  }
}
