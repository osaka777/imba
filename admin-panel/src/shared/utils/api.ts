export const apiCall = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('authToken')
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  }
  if (!isFormData && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json'
  }

  return fetch(fullUrl, {
    ...options,
    headers,
  })
}
