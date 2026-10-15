import { useState, useEffect, useCallback } from 'react'
import type { Dish, DishDraft, ConflictState, DishPatchPayload } from '../types/dish'
import { fetchDishes, updateDish } from '../services/api'
import { hasMeaningfulDraftChanges, normalizeDishName } from '../utils/dish'

interface CatalogState {
  dishes: Dish[]
  drafts: Record<string, DishDraft>
  conflictMap: Record<string, ConflictState | null>
}

export const useDishDashboard = () => {
  const [catalog, setCatalog] = useState<CatalogState>({
    dishes: [],
    drafts: {},
    conflictMap: {},
  })
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({})
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const applyFetchedDishes = useCallback((fetchedDishes: Dish[]) => {
    setCatalog((prev) => {
      const currentDishes = prev.dishes
      const currentDrafts = prev.drafts
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
        return {
          dishes: fetchedDishes,
          drafts: initialDrafts,
          conflictMap: {},
        }
      }

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

      return {
        dishes: nextDishes,
        drafts: nextDrafts,
        conflictMap: { ...prev.conflictMap, ...newConflicts },
      }
    })
  }, [])

  const loadDishes = useCallback(async () => {
    setIsLoading(true)
    setGlobalError(null)
    try {
      const fetchedDishes = await fetchDishes()
      applyFetchedDishes(fetchedDishes)
    } catch (err) {
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to connect to dishes API.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [applyFetchedDishes])

  useEffect(() => {
    let ignore = false

    fetchDishes()
      .then((fetchedDishes) => {
        if (!ignore) {
          applyFetchedDishes(fetchedDishes)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setGlobalError(
            err instanceof Error ? err.message : 'Failed to connect to dishes API.'
          )
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [applyFetchedDishes])

  const updateDraftName = (dishId: string, newName: string) => {
    setCatalog((prev) => ({
      ...prev,
      drafts: {
        ...prev.drafts,
        [dishId]: {
          ...prev.drafts[dishId],
          dishName: newName,
        },
      },
    }))
    // Clear any previous error when user edits
    setErrorMap((prev) => ({ ...prev, [dishId]: null }))
  }

  const updateDraftPublished = (dishId: string, isPublished: boolean) => {
    setCatalog((prev) => ({
      ...prev,
      drafts: {
        ...prev.drafts,
        [dishId]: {
          ...prev.drafts[dishId],
          isPublished,
        },
      },
    }))
    setErrorMap((prev) => ({ ...prev, [dishId]: null }))
  }

  const discardDraft = (dishId: string) => {
    setCatalog((prev) => {
      const original = prev.dishes.find((d) => d.dishId === dishId)
      if (!original) return prev

      return {
        ...prev,
        drafts: {
          ...prev.drafts,
          [dishId]: {
            dishName: original.dishName,
            isPublished: original.isPublished,
          },
        },
        conflictMap: {
          ...prev.conflictMap,
          [dishId]: null,
        },
      }
    })
    setErrorMap((prev) => ({ ...prev, [dishId]: null }))
  }

  const saveDraft = async (dishId: string) => {
    // Prevent saving if there is an unresolved conflict
    if (catalog.conflictMap[dishId]?.isConflicted) {
      setErrorMap((prev) => ({
        ...prev,
        [dishId]:
          'Cannot save: This dish has a pending version conflict. Please resolve it by reloading latest or discarding changes.',
      }))
      return
    }

    const original = catalog.dishes.find((d) => d.dishId === dishId)
    const draft = catalog.drafts[dishId]
    if (!original || !draft) return
    if (savingMap[dishId]) return // Prevent duplicate submissions

    // Check if there are meaningful changes
    const hasNameChange =
      normalizeDishName(draft.dishName) !== normalizeDishName(original.dishName)
    const hasPublishChange = draft.isPublished !== original.isPublished
    if (!hasNameChange && !hasPublishChange) return

    // Prepare payload sending all three required fields with trimmed name
    const payload: DishPatchPayload = {
      expectedVersion: original.version,
      dishName: normalizeDishName(draft.dishName),
      isPublished: draft.isPublished,
    }

    // Mark dish as currently saving
    setSavingMap((prev) => ({ ...prev, [dishId]: true }))
    setErrorMap((prev) => ({ ...prev, [dishId]: null }))
    setCatalog((prev) => ({
      ...prev,
      conflictMap: { ...prev.conflictMap, [dishId]: null },
    }))

    try {
      const result = await updateDish(dishId, payload)

      if (result.success) {
        // Update loaded dish with server response
        setCatalog((prev) => ({
          ...prev,
          dishes: prev.dishes.map((d) => (d.dishId === dishId ? result.dish : d)),
          drafts: {
            ...prev.drafts,
            [dishId]: {
              dishName: result.dish.dishName,
              isPublished: result.dish.isPublished,
            },
          },
          conflictMap: { ...prev.conflictMap, [dishId]: null },
        }))
        setErrorMap((prev) => ({ ...prev, [dishId]: null }))
      } else if (result.conflict) {
        // On 409 conflict, PRESERVE draft and record conflict state
        setCatalog((prev) => ({
          ...prev,
          conflictMap: {
            ...prev.conflictMap,
            [dishId]: {
              isConflicted: true,
              currentDish: result.currentDish,
              message: result.message,
            },
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
    setCatalog((prev) => {
      const conflict = prev.conflictMap[dishId]
      if (!conflict) return prev

      const latest = conflict.currentDish

      // Replace loaded dish and reset draft to latest
      return {
        ...prev,
        dishes: prev.dishes.map((d) => (d.dishId === dishId ? latest : d)),
        drafts: {
          ...prev.drafts,
          [dishId]: {
            dishName: latest.dishName,
            isPublished: latest.isPublished,
          },
        },
        conflictMap: { ...prev.conflictMap, [dishId]: null },
      }
    })
    setErrorMap((prev) => ({ ...prev, [dishId]: null }))
  }

  const dismissConflict = (dishId: string) => {
    setCatalog((prev) => ({
      ...prev,
      conflictMap: { ...prev.conflictMap, [dishId]: null },
    }))
  }

  // Count unsaved drafts across all dishes using normalized comparison
  const unsavedCount = catalog.dishes.reduce((count, dish) => {
    const draft = catalog.drafts[dish.dishId]
    if (hasMeaningfulDraftChanges(draft, dish)) {
      return count + 1
    }
    return count
  }, 0)

  const publishedCount = catalog.dishes.filter((d) => d.isPublished).length

  return {
    dishes: catalog.dishes,
    drafts: catalog.drafts,
    savingMap,
    errorMap,
    conflictMap: catalog.conflictMap,
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
