import type { Dish } from '../types/dish'

interface ConflictBannerProps {
  currentDish: Dish
  message: string
  onReloadLatest: () => void
  onKeepDraft: () => void
}

export const ConflictBanner = ({
  currentDish,
  message,
  onReloadLatest,
  onKeepDraft,
}: ConflictBannerProps) => {
  return (
    <div
      role="alert"
      className="p-4 rounded-xl bg-amber-950/60 border border-amber-600/50 text-amber-200 space-y-3 shadow-lg"
    >
      <div className="flex items-start gap-2.5">
        <svg
          className="w-5 h-5 text-amber-400 mt-0.5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="text-xs space-y-1">
          <p className="font-semibold text-amber-300">
            Version Conflict Detected
          </p>
          <p className="text-amber-200/90">{message}</p>
          <div className="p-2 rounded bg-amber-900/40 border border-amber-700/40 font-mono text-[11px] text-amber-200">
            Server version: <span className="font-bold">v{currentDish.version}</span> | Server name: &ldquo;{currentDish.dishName}&rdquo; | Status:{' '}
            {currentDish.isPublished ? 'Published' : 'Draft'}
          </div>
          <p className="text-[11px] text-amber-400 font-medium">
            ⚠️ Warning: Reloading replaces your current draft with the server version.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onReloadLatest}
          className="flex-1 min-w-[140px] px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 transition shadow text-center cursor-pointer"
        >
          Reload latest (discard draft)
        </button>
        <button
          type="button"
          onClick={onKeepDraft}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-900/40 hover:bg-amber-900/60 text-amber-300 border border-amber-700/40 transition cursor-pointer"
        >
          Keep editing draft
        </button>
      </div>
    </div>
  )
}
