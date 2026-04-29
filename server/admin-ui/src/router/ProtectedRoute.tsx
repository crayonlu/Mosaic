import { Navigate } from 'react-router-dom'
import { getToken } from '../api'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!getToken()) return <Navigate to="/login" replace />
  return <>{children}</>
}