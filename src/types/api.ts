/**
 * Django REST Framework Paginated Response
 * Used by all list endpoints that return paginated data
 */
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/**
 * Generic API error response
 */
export interface ApiError {
  detail?: string
  [key: string]: any
}
