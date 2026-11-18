import { ToastProvider } from './lib/ui'
import { PassengerApp } from './passenger/PassengerApp'
import { StaffApp } from './staff/StaffApp'

export default function App() {
  // Simple path-based routing: /staff → StaffApp, everything else → PassengerApp
  const isStaff = window.location.pathname.startsWith('/staff')

  return (
    <>
      {isStaff ? (
        <ToastProvider fixed>
          <StaffApp />
        </ToastProvider>
      ) : (
        /* On real phones (< md): full-screen, no frame, no centering padding.
           On desktop (≥ md): centered phone mockup with border frame. */
        <div className="min-h-[100dvh] bg-canvas md:flex md:items-center md:justify-center md:p-6">
          <div className="relative h-[100dvh] w-full overflow-hidden bg-canvas md:h-[844px] md:max-w-[390px] md:rounded-[44px] md:border-[10px] md:border-[#0f2230] md:shadow-[0_40px_80px_-30px_rgba(15,34,48,0.55)]">
            <ToastProvider>
              <PassengerApp />
            </ToastProvider>
          </div>
        </div>
      )}
    </>
  )
}
