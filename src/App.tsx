import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout, AuthLayout } from '@/components/Layout'
import { ProtectedRoute, PublicOnly } from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import LandingPage from '@/pages/LandingPage'

const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ReviewerPage = lazy(() => import('@/pages/ReviewerPage'))
const PracticePage = lazy(() => import('@/pages/PracticePage'))
const MockExamPage = lazy(() => import('@/pages/MockExamPage'))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))
const SideBySideReader = lazy(() => import('@/pages/SideBySideReader'))

export default function App() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Public routes with AuthLayout (centered card, no sidebar) */}
      <Route
        path="/login"
        element={
          <AuthLayout>
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          </AuthLayout>
        }
      />
      <Route
        path="/register"
        element={
          <AuthLayout>
            <PublicOnly>
              <RegisterPage />
            </PublicOnly>
          </AuthLayout>
        }
      />

      {/* Protected routes with Layout (sidebar + main content) */}
      <Route
        element={
          <Layout>
            <ProtectedRoute requireProfile={false}>
              <OnboardingPage />
            </ProtectedRoute>
          </Layout>
        }
      >
        <Route path="/onboarding" />
      </Route>
      <Route
        element={
          <Layout>
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          </Layout>
        }
      >
        <Route path="/dashboard" />
      </Route>
      <Route
        element={
          <Layout>
            <ProtectedRoute>
              <ReviewerPage />
            </ProtectedRoute>
          </Layout>
        }
      >
        <Route path="/reviewer" />
      </Route>
      <Route
        element={
          <Layout>
            <ProtectedRoute>
              <PracticePage />
            </ProtectedRoute>
          </Layout>
        }
      >
        <Route path="/practice" />
      </Route>
      <Route
        element={
          <Layout>
            <ProtectedRoute>
              <MockExamPage />
            </ProtectedRoute>
          </Layout>
        }
      >
        <Route path="/mock" />
      </Route>
      <Route
        element={
          <Layout>
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          </Layout>
        }
      >
        <Route path="/analytics" />
      </Route>
      <Route
        element={
          <Layout>
            <ProtectedRoute>
              <SideBySideReader />
            </ProtectedRoute>
          </Layout>
        }
      >
        <Route path="/side-by-side/:materialId" />
      </Route>

      {/* 404 */}
      <Route
        path="*"
        element={
          <Layout>
            <div className="container">
              <div className="card" style={{ textAlign: 'center', padding: 64 }}>
                Page not found.
              </div>
            </div>
          </Layout>
        }
      />
    </Routes>
  )
}
