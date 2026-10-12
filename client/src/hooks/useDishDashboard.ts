import { useState, useEffect, useCallback, useRef } from 'react'
import type { Dish, DishDraft, ConflictState, DishPatchPayload } from '../types/dish'
import { fetchDishes, updateDish } from '../services/api'
import { hasMeaningfulDraftChanges, normalizeDishName } from '../utils/dish'

export const useDishDashboard = () => {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [drafts, setDrafts] = useState<Record<string, DishDraft>>({})
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({})
  const [conflictMap, setConflictMap] = useState<Record<string, ConflictState | null>>({})
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Keep live refs to avoid stale closures during asynchronous refresh operations
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts

  const dishesRef = useRef(dishes)
  dishesRef.current = dishes

  const conflictMapRef = useRef(conflictMap)
  conflictMapRef.current = conflictMap

  const loadDishes = useCallback(async () => {
    setIsLoading(true)
    setGlobalError(null)
    try {
      const fetchedDishes = await fetchDishes()
      const currentDrafts = draftsRef.current
      const currentDishes = dishesRef.current
      const isInitialLoad = currentDishes.length === 0

      if (isInitialLoad) {
        // Initial load: initialize both dishes and drafts directly
        const initialDrafts: Record<string, DishDraft> = {}
        fetchedDishes.forEach((dish) => {
          initialDrafts[dish.dishId] = {
            dishName: dish.dishName,
            isPublished: dish.isPublished,
          }
        })
        setDishes(fetchedDishes)
        setDrafts(initialDrafts)
      } else {
        // Refresh with existing data:
        // Safely evaluate each dish to ensure existing dirty drafts are never combined
        // with newly fetched versions in a way that silently permits overwriting remote changes.
        const nextDishes: Dish[] = []
        const nextDrafts: Record<string, DishDraft> = { ...currentDrafts }
        const newConflicts: Record<string, ConflictState | null> = {}

        fetchedDishes.forEach((fetchedDish) => {
          const prevBase = currentDishes.find((d) => d.dishId === fetchedDish.dishId)
          const draft = currentDrafts[fetchedDish.dishId]

          // Check if user currently has an unsaved dirty draft for this dish using normalized comparison
          const isDirty = hasMeaningfulDraftChanges(draft, prevBase)

          if (!isDirty) {
            // Clean dish: safely adopt fetched dish and sync clean draft
            nextDishes.push(fetchedDish)
            nextDrafts[fetchedDish.dishId] = {
              dishName: fetchedDish.dishName,
              isPublished: fetchedDish.isPublished,
            }
            newConflicts[fetchedDish.dishId] = null
          } else {
            // Dirty draft: check if remote server record changed
            const serverChanged =
              !prevBase ||
              fetchedDish.version !== prevBase.version ||
              fetchedDish.dishName !== prevBase.dishName ||
              fetchedDish.imageUrl !== prevBase.imageUrl ||
              fetchedDish.isPublished !== prevBase.isPublished

            if (serverChanged && prevBase) {
              // Remote changes occurred while user has unsaved edits!
              // 1. Preserve the user's draft in nextDrafts
              // 2. Retain the original base dish (prevBase) so expectedVersion remains original
              // 3. Mark the dish in conflict state requiring explicit resolution
              nextDishes.push(prevBase)
              newConflicts[fetchedDish.dishId] = {
                isConflicted: true,
                currentDish: fetchedDish,
                message: `Server updated to v${fetchedDish.version} while you had unsaved edits. Please reload latest or discard changes to sync.`,
              }
            } else {
              // Server did not change: retain existing base dish and dirty draft
              nextDishes.push(prevBase || fetchedDish)
            }
          }
        })

        setDishes(nextDishes)
        setDrafts(nextDrafts)
        setConflictMap((prev) => ({ ...prev, ...newConflicts }))
      }
    } catch (err) {
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to connect to dishes API.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDishes()
  }, [loadDishes])

  const updateDraftName = (dishId: string, newName: string) => {
    setDrafts((prev) => ({
      ...prev,
      [dishId]: {
        ...prev[dishId],
        dishName: newName,
      },
    }))
    // Clear any previous error when user edits
    setErrorMap((prev) => ({ ...prev, [dishId]: null }))
  }

  const updateDraftPublished = (dishId: string, isPublished: boolean) => {
    setDrafts((prev) => ({
      ...prev,
      [dishId]: {
        ...prev[dishId],
        isPublished,
      },
    }))
    setErrorMap((prev) => ({ ...prev, [dishId]: null }))
  }

  const discardDraft = (dishId: string) => {
    const original = dishes.find((d) => d.dishId === dishId)
    const conflict = conflictMap[dishId]
    // If a conflict existed, user discarding accepts the latest server record
    const target = conflict?.currentDish || original
    if (!target) return

    if (conflict?.currentDish) {
      // Update loaded dish to latest server record
      setDishes((prev) =>
        prev.map((d) => (d.dishId === dishId ? conflict.currentDish : d))
      )
    }

    setDrafts((prev) => ({
      ...prev,
      [dishId]: {
        dishName: target.dishName,
        isPublished: target.isPublished,
      },
    }))
    setErrorMap((prev) => ({ ...prev, [dishId]: null }))
    setConflictMap((prev) => ({ ...prev, [dishId]: null }))
  }

  const saveDraft = async (dishId: string) => {
    // Prevent saving if there is an unresolved conflict
    if (conflictMap[dishId]?.isConflicted) {
      setErrorMap((prev) => ({
        ...prev,
        [dishId]:
          'Cannot save: This dish has a pending version conflict. Please resolve it by reloading latest or discarding changes.',
      }))
      return
    }

    const original = dishes.find((d) => d.dishId === dishId)
    const draft = drafts[dishId]
    if (!original || !draft) return
    if (savingMap[dishId]) return // Prevent duplicate submissions

    // Check if there are meaningful changes
    const hasNameChange =
      normalizeDishName(draft.dishName) !== normalizeDishName(original.dishName)
    const hasPublishChange = draft.isPublished !== original.isPublished
    if (!hasNameChange && !hasPublishChange) return

    // Prepare payload sending only changed fields (with trimmed name) and expectedVersion
    const payload: DishPatchPayload = {
      expectedVersion: original.version,
    }
    if (hasNameChange) payload.dishName = normalizeDishName(draft.dishName)
    if (hasPublishChange) payload.isPublished = draft.isPublished

    // Mark dish as currently saving
    setSavingMap((prev) => ({ ...prev, [dishId]: true }))
    setErrorMap((prev) => ({ ...prev, [dishId]: null }))
    setConflictMap((prev) => ({ ...prev, [dishId]: null }))

    try {
      const result = await updateDish(dishId, payload)

      if (result.success) {
        // Update loaded dish with server response
        setDishes((prev) =>
          prev.map((d) => (d.dishId === dishId ? result.dish : d))
        )
        // Reset draft to match newly saved server record
        setDrafts((prev) => ({
          ...prev,
          [dishId]: {
            dishName: result.dish.dishName,
            isPublished: result.dish.isPublished,
          },
        }))
        setConflictMap((prev) => ({ ...prev, [dishId]: null }))
        setErrorMap((prev) => ({ ...prev, [dishId]: null }))
      } else if (result.conflict) {
        // On 409 conflict, PRESERVE draft and record conflict state
        setConflictMap((prev) => ({
          ...prev,
          [dishId]: {
            isConflicted: true,
            currentDish: result.currentDish,
            message: result.message,
          },
        }))
      } else {
        // Validation or other API error: PRESERVE draft and display error
        setErrorMap((prev) => ({ ...prev, [dishId]: result.message }))
      }
    } finally {
      setSavingMap((prev) => ({ ...prev, [dishId]: false }))
    }
  }

  const reloadLatest = (dishId: string) => {
    const conflict = conflictMap[dishId]
    if (!conflict) return

    const latest = conflict.currentDish

    // Replace loaded dish and reset draft to latest
    setDishes((prev) =>
      prev.map((d) => (d.dishId === dishId ? latest : d))
    )
    setDrafts((prev) => ({
      ...prev,
      [dishId]: {
        dishName: latest.dishName,
        isPublished: latest.isPublished,
      },
    }))
    setConflictMap((prev) => ({ ...prev, [dishId]: null }))
    setErrorMap((prev) => ({ ...prev, [dishId]: null }))
  }

  const dismissConflict = (dishId: string) => {
    setConflictMap((prev) => ({ ...prev, [dishId]: null }))
  }

  // Count unsaved drafts across all dishes using normalized comparison
  const unsavedCount = dishes.reduce((count, dish) => {
    const draft = drafts[dish.dishId]
    if (hasMeaningfulDraftChanges(draft, dish)) {
      return count + 1
    }
    return count
  }, 0)

  const publishedCount = dishes.filter((d) => d.isPublished).length

  return {
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
  }
}
