interface HeaderProps {
  totalDishes: number
  publishedCount: number
  unsavedCount: number
  onRefresh: () => void
  isLoading: boolean
}

export const Header = ({
  totalDishes,
  publishedCount,
  unsavedCount,
  onRefresh,
  isLoading,
}: HeaderProps) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/20 text-slate-950 font-black text-xl">
            N
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                NOSH
              </span>
              <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                Dish Dashboard
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Draft Editing &amp; Safe Optimistic Concurrency Updates
            </p>
          </div>
        </div>

        {/* Stats & Actions */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-2.5 justify-between sm:justify-end">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400">Total:</span>
            <span className="font-bold text-slate-200">{totalDishes}</span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-medium">
              {publishedCount} Live
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 font-medium">
              {totalDishes - publishedCount} Unpublished
            </span>
          </div>

          {unsavedCount > 0 && (
            <div
              data-testid="global-unsaved-counter"
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 animate-pulse"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
              {unsavedCount} Unsaved {unsavedCount === 1 ? 'Dish' : 'Dishes'}
            </div>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-300 border border-slate-700/80 text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </header>
  )
}
