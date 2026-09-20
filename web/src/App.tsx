import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { ForgotPasswordPage } from '@/routes/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/routes/auth/ResetPasswordPage'
import { SignInPage } from '@/routes/auth/SignInPage'
import { SignUpPage } from '@/routes/auth/SignUpPage'
import { AppShell } from '@/routes/AppShell'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DanceCuesPage } from '@/routes/dances/DanceCuesPage'
import { DanceDetailPage } from '@/routes/dances/DanceDetailPage'
import { DanceWalkthroughPage } from '@/routes/dances/DanceWalkthroughPage'
import { DancesPage } from '@/routes/dances/DancesPage'
import { ProgramChoreographyPage } from '@/routes/programs/ProgramChoreographyPage'
import { ProgramDetailPage } from '@/routes/programs/ProgramDetailPage'
import { ProgramsPage } from '@/routes/programs/ProgramsPage'
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
          { path: 'dances/:id', element: <DanceDetailPage /> },
          { path: 'dances/:id/versions/:versionId', element: <DanceDetailPage /> },
          { path: 'dances/:id/walkthrough', element: <DanceWalkthroughPage /> },
          { path: 'dances/:id/versions/:versionId/walkthrough', element: <DanceWalkthroughPage /> },
          { path: 'dances/:id/cues', element: <DanceCuesPage /> },
          { path: 'dances/:id/versions/:versionId/cues', element: <DanceCuesPage /> },
          { path: 'programs', element: <ProgramsPage /> },
          { path: 'programs/:id', element: <ProgramDetailPage /> },
          { path: 'programs/:id/choreography', element: <ProgramChoreographyPage /> },
        ],
      },
    ],
  },
])

function App() {
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  )
}

export default App
