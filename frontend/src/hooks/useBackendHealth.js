import { useState, useCallback, useEffect } from 'react'
import { apiService, BACKEND_URL } from '../services/api'

export function useBackendHealth() {
  const [status, setStatus] = useState('idle') // 'idle' | 'checking' | 'connected' | 'error'
  const [details, setDetails] = useState(null)
  const [error, setError] = useState(null)
  const [lastChecked, setLastChecked] = useState(null)

  const checkHealth = useCallback(async () => {
    setStatus('checking')
    setError(null)
    try {
      const json = await apiService.checkHealth()
      setDetails(json)
      setStatus('connected')
      setLastChecked(new Date())
      return { success: true, data: json }
    } catch (err) {
      setError(err.message || 'Unable to reach backend')
      setStatus('error')
      setLastChecked(new Date())
      return { success: false, error: err.message }
    }
  }, [])

  // Check connectivity on initial app mount
  useEffect(() => {
    checkHealth()
  }, [checkHealth])

  return {
    status,
    details,
    error,
    lastChecked,
    backendUrl: BACKEND_URL,
    checkHealth,
  }
}
