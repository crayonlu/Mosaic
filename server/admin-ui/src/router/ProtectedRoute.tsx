import { Navigate, useLocation } from "react-router-dom"
import { getToken } from "../api"
import { useAuthStore } from "../stores/authStore"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword)

  if (!getToken()) return <Navigate to="/login" replace />

  if (mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />
  }

  return <>{children}</>
}
