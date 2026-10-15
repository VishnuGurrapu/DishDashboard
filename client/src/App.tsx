import { Header } from './components/Header'
import { DishCard } from './components/DishCard'
import { useDishDashboard } from './hooks/useDishDashboard'

export default function App() {
  const {
    dishes,
    drafts,
    savingMap,
    errorMap,
    conflictMap,
    isLoading,
    globalError,
    unsavedCount,
    publishedCount,
    loadDishes,
    updateDraftName,
    updateDraftPublished,
    discardDraft,
    saveDraft,
    reloadLatest,
    dismissConflict,
  } = useDishDashboard()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Header */}
      <Header
        totalDishes={dishes.length}
        publishedCount={publishedCount}
        unsavedCount={unsavedCount}
        onRefresh={loadDishes}
        isLoading={isLoading}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Loading State */}
        {isLoading && dishes.length === 0 && (
          <div
            data-testid="loading-state"
            className="flex flex-col items-center justify-center py-24 space-y-4 text-center"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin"></div>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-200">
                Loading Menu Dishes
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Fetching catalog records from backend API...
              </p>
            </div>
          </div>
        )}

        {/* Global Error State (Full-page when no dishes loaded) */}
        {globalError && dishes.length === 0 && (
          <div
            data-testid="api-error-state"
            role="alert"
            className="max-w-xl mx-auto my-12 p-6 rounded-2xl bg-red-950/40 border border-red-800/50 text-center space-y-4 shadow-xl"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-red-900/40 text-red-400 flex items-center justify-center">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-red-300">
                Failed to Load Dishes
              </h3>
              <p className="text-xs text-red-200/80 mt-1.5">{globalError}</p>
            </div>
            <button
              type="button"
              onClick={loadDishes}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white transition shadow"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !globalError && dishes.length === 0 && (
          <div
            data-testid="empty-state"
            className="max-w-md mx-auto my-20 p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3"
          >
            <div className="w-10 h-10 mx-auto rounded-full bg-slate-800 text-slate-400 flex items-center justify-center">
              🍽️
            </div>
            <h3 className="text-sm font-semibold text-slate-300">
              No Dishes Found
            </h3>
            <p className="text-xs text-slate-500">
              The database does not contain any dish records yet. Run{' '}
              <code className="text-orange-400 font-mono">npm run seed</code> in
              the server folder to populate initial dishes.
            </p>
            <button
              type="button"
              onClick={loadDishes}
              className="mt-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Check Again
            </button>
          </div>
        )}

        {/* Dishes Grid */}
        {dishes.length > 0 && (
          <div className="space-y-6">
            {/* Compact non-blocking error banner when a refresh fails after dishes are already loaded */}
            {globalError && (
              <div
                data-testid="refresh-error-banner"
                role="alert"
                className="p-3.5 rounded-xl bg-red-950/60 border border-red-700/60 text-red-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow"
              >
                <div className="flex items-center gap-2">
                  <span className="text-red-400 font-bold shrink-0">⚠️ Refresh Failed:</span>
                  <span className="text-red-200/90">{globalError}. Existing dish data and drafts are preserved.</span>
                </div>
                <button
                  type="button"
                  onClick={loadDishes}
                  className="self-start sm:self-auto px-3 py-1 text-xs font-semibold rounded-lg bg-red-700 hover:bg-red-600 active:scale-95 text-white transition shrink-0"
                >
                  Retry Refresh
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-900">
              <div>
                <h2 className="text-lg font-bold text-slate-100">
                  Dish Catalog
                </h2>
                <p className="text-xs text-slate-400">
                  Edit names and publication flags locally as drafts. Click Save
                  to persist changes with version protection.
                </p>
              </div>
              {unsavedCount > 0 && (
                <div className="text-xs text-amber-400/90 font-medium bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20 self-start sm:self-auto">
                  💡 You have {unsavedCount} unsaved {unsavedCount === 1 ? 'draft' : 'drafts'}. Unsaved changes will be lost if you refresh.
                </div>
              )}
            </div>

            <div
              data-testid="dishes-grid"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {dishes.map((dish) => {
                const draft = drafts[dish.dishId] || {
                  dishName: dish.dishName,
                  isPublished: dish.isPublished,
                }
                const isSaving = Boolean(savingMap[dish.dishId])
                const error = errorMap[dish.dishId] || null
                const conflict = conflictMap[dish.dishId] || null

                return (
                  <DishCard
                    key={dish.dishId}
                    dish={dish}
                    draft={draft}
                    isSaving={isSaving}
                    error={error}
                    conflict={conflict}
                    onNameChange={updateDraftName}
                    onPublishChange={updateDraftPublished}
                    onSave={saveDraft}
                    onDiscard={discardDraft}
                    onReloadLatest={reloadLatest}
                    onDismissConflict={dismissConflict}
                  />
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 bg-slate-950/60">
        Nosh Full Stack Intern Assignment &bull; Dish Dashboard
      </footer>
    </div>
  )
}
