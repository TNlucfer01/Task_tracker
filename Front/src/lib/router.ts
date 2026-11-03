import { useEffect, useState } from 'react'

// Minimal hash router: #/people/6 -> ['people', '6']. Keeps the back button working
// without adding a routing dependency.
function read() {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

export function useRoute() {
  const [parts, setParts] = useState(read)
  useEffect(() => {
    const onChange = () => {
      setParts(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return parts
}

export function href(...parts: (string | number)[]) {
  return `#/${parts.join('/')}`
}
