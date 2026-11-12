import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout, AuthLayout } from '@/components/Layout'
import { ProtectedRoute, PublicOnly } from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import OnboardingPage from '@/pages/OnboardingPage'
import DashboardPage from '@/pages/DashboardPage'
import ReviewerPage from '@/pages/ReviewerPage'
import PracticePage from '@/pages/PracticePage'
import MockExamPage from '@/pages/MockExamPage'
import AnalyticsPage from '@/pages/AnalyticsPage'

export default function App() {
  return (
    <Routes>
      {/* Public routes with AuthLayout (centered card, no sidebar) */}
      <Route path="/login" element={<AuthLayout><PublicOnly><LoginPage /></PublicOnly></AuthLayout>} />
      <Route path="/register" element={<AuthLayout><PublicOnly><RegisterPage /></PublicOnly></AuthLayout>} />

      {/* Protected routes with Layout (sidebar + main content) */}
      <Route element={<Layout><ProtectedRoute requireProfile={false}><OnboardingPage /></ProtectedRoute></Layout>}>
        <Route path="/onboarding" />
      </Route>
      <Route element={<Layout><ProtectedRoute><DashboardPage /></ProtectedRoute></Layout>}>
        <Route path="/dashboard" />
      </Route>
      <Route element={<Layout><ProtectedRoute><ReviewerPage /></ProtectedRoute></Layout>}>
        <Route path="/reviewer" />
      </Route>
      <Route element={<Layout><ProtectedRoute><PracticePage /></ProtectedRoute></Layout>}>
        <Route path="/practice" />
      </Route>
      <Route element={<Layout><ProtectedRoute><MockExamPage /></ProtectedRoute></Layout>}>
        <Route path="/mock" />
      </Route>
      <Route element={<Layout><ProtectedRoute><AnalyticsPage /></ProtectedRoute></Layout>}>
        <Route path="/analytics" />
      </Route>

      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* 404 */}
      <Route path="*" element={<Layout><div className="container"><div className="card" style={{ textAlign: 'center', padding: 64 }}>Page not found.</div></div></Layout>} />
    </Routes>
  )
}