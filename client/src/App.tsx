import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { authService } from "./lib/auth";
import LoginPage from "./pages/LoginPage";
import TenantSelectPage from "./pages/TenantSelectPage";
import DashboardPage from "./pages/DashboardPage";
function App() {
  const isTenantDomain = authService.isTenantDomain();

  return (
    <Router>
      <AuthProvider>
        <Routes>
          {!isTenantDomain ? (
            // Login domain routes
            <>
              <Route
                path="/login"
                element={<LoginPage />}
              />
              <Route
                path="/select-tenant"
                element={
                  <ProtectedRoute
                    requireLogin={true}
                    requireTenant={false}
                  >
                    <TenantSelectPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute
                    requireLogin={true}
                    requireTenant={false}
                  >
                    <TenantSelectPage />
                  </ProtectedRoute>
                }
              />
            </>
          ) : (
            // Tenant domain routes
            <>
              <Route
                path="/"
                element={
                  <ProtectedRoute
                    requireLogin={true}
                    requireTenant={true}
                  >
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              {/* Add more tenant-specific routes here */}
            </>
          )}
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
