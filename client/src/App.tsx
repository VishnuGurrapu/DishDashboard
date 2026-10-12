import { useState, useEffect } from 'react'

interface HealthResponse {
  status: string
  message: string
  timestamp?: string
}

export default function App() {
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const checkHealth = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('http://localhost:5000/health')
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`)
      }
      const data: HealthResponse = await response.json()
      setHealthStatus(data)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to reach backend')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Attempt non-blocking check on load
    checkHealth()
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl font-black bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
              NOSH
            </span>
            <span className="text-xs uppercase tracking-widest font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Dish Dashboard
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Phase 1: Project Foundation</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col items-center justify-center text-center">
        <div className="max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Foundation Initialized
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            Dish Dashboard — Draft Editing &amp; Safe Updates
          </h1>

          <p className="text-slate-400 text-base leading-relaxed">
            Project foundation is set up with Vite, React, TypeScript, and Tailwind CSS on the client,
            paired with Express, TypeScript, and local MongoDB on the backend.
          </p>

          {/* Backend Health Check Card */}
          <div className="mt-8 p-6 rounded-xl bg-slate-800/60 border border-slate-700/60 text-left space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Backend Health Status</h3>
                <p className="text-xs text-slate-400">Endpoint: <code className="text-orange-300">GET http://localhost:5000/health</code></p>
              </div>
              <button
                onClick={checkHealth}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-95 text-white transition disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Check Status'}
              </button>
            </div>

            {loading && <div className="text-xs text-slate-400">Pinging backend...</div>}
            {error && (
              <div className="text-xs p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300">
                Backend connection failed: {error} (Ensure backend server is running on port 5000)
              </div>
            )}
            {healthStatus && (
              <div className="text-xs p-3 rounded-lg bg-emerald-900/30 border border-emerald-700/50 text-emerald-300 font-mono space-y-1">
                <div>Status: <span className="font-bold">{healthStatus.status}</span></div>
                <div>Message: {healthStatus.message}</div>
                {healthStatus.timestamp && <div>Timestamp: {healthStatus.timestamp}</div>}
              </div>
            )}
          </div>

          {/* Tech Stack Pills */}
          <div className="pt-4 flex flex-wrap justify-center gap-2">
            {['React 19', 'TypeScript', 'Vite', 'Tailwind CSS', 'Node.js', 'Express', 'Zod', 'MongoDB / Mongoose'].map((tech) => (
              <span
                key={tech}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 text-slate-300 border border-slate-700"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        Nosh Full Stack Intern Assignment &bull; Phase 1 Foundation
      </footer>
    </div>
  )
}
