import type {
  Dish,
  DishPatchPayload,
  DishesApiResponse,
  DishUpdateSuccessResponse,
  DishUpdateConflictResponse,
  ApiErrorResponse,
} from '../types/dish'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export type UpdateResult =
  | { success: true; dish: Dish }
  | { success: false; conflict: true; currentDish: Dish; message: string }
  | { success: false; conflict: false; message: string }

export const fetchDishes = async (): Promise<Dish[]> => {
  const response = await fetch(`${API_BASE_URL}/dishes`)
  if (!response.ok) {
    let errorMessage = `Failed to fetch dishes (HTTP ${response.status})`
    try {
      const errData: ApiErrorResponse = await response.json()
      if (errData.message) errorMessage = errData.message
    } catch {
      // Ignore JSON parse failure on error response
    }
    throw new Error(errorMessage)
  }

  const data: DishesApiResponse = await response.json()
  return data.dishes
}

export const updateDish = async (
  dishId: string,
  payload: DishPatchPayload
): Promise<UpdateResult> => {
  try {
    const response = await fetch(`${API_BASE_URL}/dishes/${dishId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (response.status === 200) {
      const data: DishUpdateSuccessResponse = await response.json()
      return { success: true, dish: data.dish }
    }

    if (response.status === 409) {
      const conflictData: DishUpdateConflictResponse = await response.json()
      return {
        success: false,
        conflict: true,
        currentDish: conflictData.currentDish,
        message:
          conflictData.message ||
          'Another user or process has updated this dish. Please review before overwriting.',
      }
    }

    let errorMessage = `Update failed (HTTP ${response.status})`
    try {
      const errorData: ApiErrorResponse = await response.json()
      if (errorData.message) {
        errorMessage = errorData.message
        if (errorData.details && errorData.details.length > 0) {
          errorMessage += `: ${errorData.details.join(', ')}`
        }
      }
    } catch {
      // Ignore JSON parse failure
    }

    return {
      success: false,
      conflict: false,
      message: errorMessage,
    }
  } catch (err) {
    return {
      success: false,
      conflict: false,
      message:
        err instanceof Error ? err.message : 'Network error connecting to backend.',
    }
  }
}
