import { Outlet } from 'react-router'

export function AppShell() {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center px-6 py-5">
          <span className="text-lg font-semibold tracking-tight text-stone-950">Animal Traceability</span>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
