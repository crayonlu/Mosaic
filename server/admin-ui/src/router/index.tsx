import { Navigate, createBrowserRouter } from 'react-router-dom'
import AdminLayout from '../layouts/AdminLayout'
import Bots from '../views/Bots'
import Dashboard from '../views/Dashboard'
import Login from '../views/Login'
import ProtectedRoute from './ProtectedRoute'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'bots', element: <Bots /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
], {
  basename: '/admin',
})
