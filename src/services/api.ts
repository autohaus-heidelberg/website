import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://content.hopfner.cc/'

class ApiClient {
  private client: AxiosInstance

  constructor(baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor - add auth token to requests
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('access_token')
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor - handle token refresh on 401
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error) => {
        const originalRequest = error.config

        // If error is 401 and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            const refreshToken = localStorage.getItem('refresh_token')
            if (!refreshToken) {
              throw new Error('No refresh token available')
            }

            // Try to refresh the token
            const response = await axios.post(`${API_BASE_URL}/api/token/refresh/`, {
              refresh: refreshToken,
            })

            const { access, refresh } = response.data

            // Save new tokens
            localStorage.setItem('access_token', access)
            if (refresh) {
              localStorage.setItem('refresh_token', refresh)
            }

            // Retry the original request with new token
            originalRequest.headers.Authorization = `Bearer ${access}`
            return this.client(originalRequest)
          } catch (refreshError) {
            // Refresh failed, clear tokens and redirect to login
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            window.location.href = '/login'
            return Promise.reject(refreshError)
          }
        }

        return Promise.reject(error)
      }
    )
  }

  // GET request
  async get<T>(url: string): Promise<T> {
    const response = await this.client.get<T>(url)
    return response.data
  }

  // POST request
  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data)
    return response.data
  }

  // PUT request
  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data)
    return response.data
  }

  // PATCH request
  async patch<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.patch<T>(url, data)
    return response.data
  }

  // DELETE request
  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url)
    return response.data
  }

  // File upload
  async uploadFile<T>(url: string, file: File, fieldName: string = 'image'): Promise<T> {
    const formData = new FormData()
    formData.append(fieldName, file)

    const response = await this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  // Public request (no auth token)
  async publicPost<T>(url: string, data?: any): Promise<T> {
    const response = await axios.post<T>(`${API_BASE_URL}${url}`, data, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return response.data
  }
}

export const api = new ApiClient(API_BASE_URL)
