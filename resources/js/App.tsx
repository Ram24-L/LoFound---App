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
        /* Mobile & PWA standalone: edge-to-edge full screen.
           Desktop/tablet: clean full-height centered mobile-first web app (no phone bezel). */
        <div className="min-h-[100dvh] bg-[#e9f0f4] sm:flex sm:justify-center">
          <div className="relative h-[100dvh] w-full overflow-hidden bg-canvas sm:max-w-[480px] sm:border-x sm:border-line/80 sm:shadow-[0_0_40px_-15px_rgba(15,34,48,0.18)]">
            <ToastProvider>
              <PassengerApp />
            </ToastProvider>
          </div>
        </div>
      )}
    </>
  )
}
