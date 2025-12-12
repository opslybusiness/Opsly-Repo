import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

function PageTransition({ children }) {
  const location = useLocation()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [transitionKey, setTransitionKey] = useState(location.key)

  useEffect(() => {
    if (location.key !== transitionKey) {
      setTransitionKey(location.key)
      setDisplayChildren(children)
    }
  }, [location.key, transitionKey, children])

  return (
    <div key={transitionKey} className="page-transition">
      {displayChildren}
    </div>
  )
}

export default PageTransition

