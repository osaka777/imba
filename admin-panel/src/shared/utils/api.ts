export const apiCall = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('authToken')
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  }

  return fetch(fullUrl, {
    ...options,
    headers,
  })
}
