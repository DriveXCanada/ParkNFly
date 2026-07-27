import { useEffect, useState } from 'react'

/**
 * Simulates an async API fetch delay so loading states are demonstrable.
 *
 * BACKEND: replace with a real data-fetching hook (e.g. SWR / react-query)
 * hitting the backend REST API. The `loading` flag maps to request state.
 */
export function useFakeLoad(delay = 800, deps = []) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    const id = setTimeout(() => setLoading(false), delay)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return loading
}

export default useFakeLoad
