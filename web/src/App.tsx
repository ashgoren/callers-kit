import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { ForgotPasswordPage } from '@/routes/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/routes/auth/ResetPasswordPage'
import { SignInPage } from '@/routes/auth/SignInPage'
import { SignUpPage } from '@/routes/auth/SignUpPage'
import { AppShell } from '@/routes/AppShell'
import { DancesPage } from '@/routes/DancesPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'

const router = createBrowserRouter([
  { path: '/signin', element: <SignInPage /> },
  { path: '/signup', element: <SignUpPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dances" replace /> },
          { path: 'dances', element: <DancesPage /> },
        ],
      },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
