import { createBrowserRouter, Navigate } from "react-router-dom"
import AppShell from "../layouts/AppShell"
import ProtectedRoute from "./ProtectedRoute"
import LoginView from "../views/login/LoginView"
import OverviewView from "../views/overview/OverviewView"
import BotsView from "../views/bots/BotsView"
import UsersView from "../views/users/UsersView"
import AiSettingsView from "../views/settings/AiSettingsView"
import AccountView from "../views/account/AccountView"

export const router = createBrowserRouter(
  [
    { path: "/login", element: <LoginView /> },
    {
      path: "/",
      element: (
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      ),
      children: [
        { index: true, element: <Navigate to="/overview" replace /> },
        { path: "overview", element: <OverviewView /> },
        { path: "bots", element: <BotsView /> },
        { path: "users", element: <UsersView /> },
        { path: "settings/ai", element: <AiSettingsView /> },
        { path: "account", element: <AccountView /> },
      ],
    },
    { path: "*", element: <Navigate to="/overview" replace /> },
  ],
  { basename: "/admin" }
)
