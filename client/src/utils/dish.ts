import type { Dish, DishDraft } from '../types/dish'

/**
 * Normalizes a dish name string for comparison and persistence:
 * Trims leading and trailing whitespace.
 */
export const normalizeDishName = (name: string): string => {
  return name.trim()
}

/**
 * Determines whether a draft dish has meaningful changes compared to the saved base dish:
 * 1. Checks if the trimmed dish name differs from the saved dish name.
 * 2. Checks if the publication flag differs.
 */
export const hasMeaningfulDraftChanges = (
  draft?: DishDraft,
  base?: Dish
): boolean => {
  if (!draft || !base) return false
  const hasNameDiff = normalizeDishName(draft.dishName) !== normalizeDishName(base.dishName)
  const hasPublishDiff = draft.isPublished !== base.isPublished
  return hasNameDiff || hasPublishDiff
}
