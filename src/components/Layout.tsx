import React from 'react'
import { NavBar } from './NavBar'
import { ToastProvider } from '@/components/ui'

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <NavBar />
        <main style={{ flex: 1 }}>{children}</main>
        <footer style={{ borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          <div className="container" style={{ padding: '24px 24px' }}>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px', textAlign: 'center' }}>
              LisenSync AI — PRC licensure exam readiness focused on the 75% passing benchmark.
            </p>
          </div>
        </footer>
      </div>
    </ToastProvider>
  )
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <main style={{ width: '100%', maxWidth: 480 }}>{children}</main>
        <footer style={{ marginTop: '48px', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
            LisenSync AI — PRC licensure exam readiness focused on the 75% passing benchmark.
          </p>
        </footer>
      </div>
    </ToastProvider>
  )
}

export default Layout