import React from 'react'
import type { Dish, DishDraft, ConflictState } from '../types/dish'
import { ImageWithFallback } from './ImageWithFallback'
import { ConflictBanner } from './ConflictBanner'

interface DishCardProps {
  dish: Dish
  draft: DishDraft
  isSaving: boolean
  error: string | null
  conflict: ConflictState | null
  onNameChange: (dishId: string, newName: string) => void
  onPublishChange: (dishId: string, isPublished: boolean) => void
  onSave: (dishId: string) => void
  onDiscard: (dishId: string) => void
  onReloadLatest: (dishId: string) => void
  onDismissConflict: (dishId: string) => void
}

export const DishCard: React.FC<DishCardProps> = ({
  dish,
  draft,
  isSaving,
  error,
  conflict,
  onNameChange,
  onPublishChange,
  onSave,
  onDiscard,
  onReloadLatest,
  onDismissConflict,
}) => {
  const hasNameChange = draft.dishName !== dish.dishName
  const hasPublishChange = draft.isPublished !== dish.isPublished
  const hasUnsavedChanges = hasNameChange || hasPublishChange

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (hasUnsavedChanges && !isSaving) {
      onSave(dish.dishId)
    }
  }

  return (
    <div
      data-testid={`dish-card-${dish.dishId}`}
      className={`flex flex-col rounded-2xl bg-slate-900 border transition-all duration-200 overflow-hidden shadow-md hover:shadow-xl ${
        hasUnsavedChanges
          ? 'border-amber-500/60 ring-1 ring-amber-500/20'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top Image Section */}
      <div className="relative aspect-video w-full bg-slate-950">
        <ImageWithFallback
          src={dish.imageUrl}
          alt={dish.dishName}
          className="w-full h-full"
        />

        {/* Badges on Top of Image */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 items-center">
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-950/80 backdrop-blur text-slate-300 border border-slate-700/60 font-mono">
            ID: {dish.dishId}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-950/80 backdrop-blur text-indigo-300 border border-indigo-700/50 font-mono">
            v{dish.version}
          </span>
        </div>

        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {hasUnsavedChanges && (
            <span
              data-testid="unsaved-badge"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/90 text-slate-950 shadow animate-pulse"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-slate-950"></span>
              Unsaved draft
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold backdrop-blur border ${
              dish.isPublished
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60'
                : 'bg-slate-950/80 text-slate-400 border-slate-700/60'
            }`}
          >
            {dish.isPublished ? 'Live' : 'Draft'}
          </span>
        </div>
      </div>

      {/* Card Content & Controls */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
        {/* Conflict Notification Banner */}
        {conflict && (
          <ConflictBanner
            currentDish={conflict.currentDish}
            message={conflict.message}
            onReloadLatest={() => onReloadLatest(dish.dishId)}
            onKeepDraft={() => onDismissConflict(dish.dishId)}
          />
        )}

        {/* Standard API / Validation Error Banner */}
        {error && !conflict && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-950/50 border border-red-700/50 text-red-300 text-xs flex items-start gap-2"
          >
            <span className="text-red-400 font-bold shrink-0">Error:</span>
            <span className="flex-1 break-words">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            {/* Dish Name Field */}
            <div>
              <label
                htmlFor={`dish-name-${dish.dishId}`}
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Dish Name
              </label>
              <input
                id={`dish-name-${dish.dishId}`}
                type="text"
                value={draft.dishName}
                onChange={(e) => onNameChange(dish.dishId, e.target.value)}
                disabled={isSaving}
                placeholder="Enter dish name..."
                className={`w-full px-3.5 py-2 text-sm rounded-xl bg-slate-950 text-slate-100 border transition outline-none focus:ring-2 focus:ring-orange-500/40 ${
                  hasNameChange
                    ? 'border-amber-500/70 focus:border-amber-500'
                    : 'border-slate-800 focus:border-slate-600'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              />
              {hasNameChange ? (
                <span className="text-[11px] text-amber-400/90 mt-1 block truncate" title={`Original: "${dish.dishName}"`}>
                  Original: &ldquo;{dish.dishName}&rdquo;
                </span>
              ) : (
                <span className="text-[11px] text-transparent mt-1 block select-none" aria-hidden="true">
                  &nbsp;
                </span>
              )}
            </div>

            {/* Publication Status Toggle Control */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-slate-300 block">
                  Publication Status
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  {draft.isPublished
                    ? 'Visible on public menu'
                    : 'Hidden from public menu'}
                </span>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={draft.isPublished}
                  onChange={(e) => onPublishChange(dish.dishId, e.target.checked)}
                  disabled={isSaving}
                  className="sr-only peer"
                  aria-label={`Toggle publication for ${dish.dishName}`}
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-disabled:opacity-50"></div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={!hasUnsavedChanges || isSaving || Boolean(conflict?.isConflicted)}
              className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                hasUnsavedChanges && !isSaving && !conflict?.isConflicted
                  ? 'bg-orange-500 hover:bg-orange-600 active:scale-98 text-white shadow-md shadow-orange-500/20 cursor-pointer'
                  : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Saving...</span>
                </>
              ) : conflict?.isConflicted ? (
                'Resolve conflict to save'
              ) : (
                'Save'
              )}
            </button>

            <button
              type="button"
              onClick={() => onDiscard(dish.dishId)}
              disabled={!hasUnsavedChanges || isSaving}
              className={`py-2 px-3.5 rounded-xl text-xs font-semibold transition ${
                hasUnsavedChanges && !isSaving
                  ? 'bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-300 border border-slate-700 cursor-pointer'
                  : 'bg-transparent text-slate-600 border border-slate-800/50 cursor-not-allowed'
              }`}
            >
              Discard
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
