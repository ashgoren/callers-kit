import { createBrowserRouter, RouterProvider } from 'react-router'
import { ForgotPasswordPage } from '@/routes/ForgotPasswordPage'
import { HomePage } from '@/routes/HomePage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { ResetPasswordPage } from '@/routes/ResetPasswordPage'
import { SignInPage } from '@/routes/SignInPage'
import { SignUpPage } from '@/routes/SignUpPage'

const router = createBrowserRouter([
  { path: '/signin', element: <SignInPage /> },
  { path: '/signup', element: <SignUpPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [{ path: '/', element: <HomePage /> }],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
