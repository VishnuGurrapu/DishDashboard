export interface Dish {
  dishId: string
  dishName: string
  imageUrl: string
  isPublished: boolean
  version: number
}

export interface DishDraft {
  dishName: string
  isPublished: boolean
}

export interface DishPatchPayload {
  expectedVersion: number
  dishName: string
  isPublished: boolean
}

export interface ConflictState {
  isConflicted: boolean
  currentDish: Dish
  message: string
}

export interface DishesApiResponse {
  dishes: Dish[]
  total: number
}

export interface DishUpdateSuccessResponse {
  message: string
  dish: Dish
}

export interface DishUpdateConflictResponse {
  error: string
  message: string
  currentDish: Dish
}

export interface ApiErrorResponse {
  error: string
  message: string
  details?: string[]
}
