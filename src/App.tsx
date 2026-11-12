import { Routes, Route, Navigate } from 'react-router-dom'
import NavBar from '@/components/NavBar'
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
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
        <Route path="/onboarding" element={<ProtectedRoute requireProfile={false}><OnboardingPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/reviewer" element={<ProtectedRoute><ReviewerPage /></ProtectedRoute>} />
        <Route path="/practice" element={<ProtectedRoute><PracticePage /></ProtectedRoute>} />
        <Route path="/mock" element={<ProtectedRoute><MockExamPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="*" element={<div className="container"><div className="card">Page not found.</div></div>} />
      </Routes>
      <footer>LisenSync AI — PRC licensure exam readiness focused on the 75% passing benchmark.</footer>
    </>
  )
}
