import { Navigate, createBrowserRouter } from 'react-router'

import { AppShell } from '../components/layout/AppShell'
import { AnimalProfilePage } from '../features/animals/AnimalProfilePage'
import { AnimalRegistrationPage } from '../features/animals/AnimalRegistrationPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { MicrochipInventoryPage } from '../features/microchips/MicrochipInventoryPage'
import { PublicAnimalPage } from '../features/recovery/PublicAnimalPage'
import { RecoveryInboxPage } from '../features/recovery/RecoveryInboxPage'
import { ScanPage } from '../features/scanner/ScanPage'

function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
      <section>
        <p className="text-sm font-semibold text-emerald-700">404</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-950">Página no encontrada</h1>
      </section>
    </main>
  )
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/public/:chipCode',
    element: <PublicAnimalPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'scan', element: <ScanPage /> },
          { path: 'animals', element: <Navigate replace to="/" /> },
          { path: 'animals/new', element: <AnimalRegistrationPage /> },
          { path: 'animals/:animalId', element: <AnimalProfilePage /> },
          { path: 'microchips', element: <MicrochipInventoryPage /> },
          { path: 'recovery-reports', element: <RecoveryInboxPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
