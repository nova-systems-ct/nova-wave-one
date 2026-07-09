import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function useAuthGuard() {
  const navigate = useNavigate()
  useEffect(() => {
    if (localStorage.getItem('nova_wave_authenticated') !== 'true') {
      navigate('/login')
    }
  }, [])
}
