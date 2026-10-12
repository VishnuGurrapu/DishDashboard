import { useState, useEffect, useCallback } from 'react'
import type { Dish, DishDraft, ConflictState, DishPatchPayload } from '../types/dish'
import { fetchDishes, updateDish } from '../services/api'

export const useDishDashboard = () => {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [drafts, setDrafts] = useState<Record<string, DishDraft>>({})
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({})
  const [conflictMap, setConflictMap] = useState<Record<string, ConflictState | null>>({})
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const loadDishes = useCallback(async () => {
    setIsLoading(true)
    setGlobalError(null)
    try {
      const fetchedDishes = await fetchDishes()
      setDishes(fetchedDishes)

      // Initialize drafts for each dish without overwriting ongoing unsaved edits
      setDrafts((prevDrafts) => {
        const nextDrafts: Record<string, DishDraft> = { ...prevDrafts }
        fetchedDishes.forEach((dish) => {
          // If no draft exists yet, initialize from server dish
          if (!nextDrafts[dish.dishId]) {
            nextDrafts[dish.dishId] = {
              dishName: dish.dishName,
              isPublished: dish.isPublished,
            }
          }
        })
        return nextDrafts
      })
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
    if (!original) return

    setDrafts((prev) => ({
      ...prev,
      [dishId]: {
        dishName: original.dishName,
        isPublished: original.isPublished,
      },
    }))
    setErrorMap((prev) => ({ ...prev, [dishId]: null }))
    setConflictMap((prev) => ({ ...prev, [dishId]: null }))
  }

  const saveDraft = async (dishId: string) => {
    const original = dishes.find((d) => d.dishId === dishId)
    const draft = drafts[dishId]
    if (!original || !draft) return
    if (savingMap[dishId]) return // Prevent duplicate submissions

    // Check if there are changes
    const hasNameChange = draft.dishName !== original.dishName
    const hasPublishChange = draft.isPublished !== original.isPublished
    if (!hasNameChange && !hasPublishChange) return

    // Prepare payload sending only changed fields and expectedVersion
    const payload: DishPatchPayload = {
      expectedVersion: original.version,
    }
    if (hasNameChange) payload.dishName = draft.dishName
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

  // Count unsaved drafts across all dishes
  const unsavedCount = dishes.reduce((count, dish) => {
    const draft = drafts[dish.dishId]
    if (!draft) return count
    if (
      draft.dishName !== dish.dishName ||
      draft.isPublished !== dish.isPublished
    ) {
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
