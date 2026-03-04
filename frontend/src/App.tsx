import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Reserve from './pages/Reserve';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminConfig from './pages/AdminConfig';
import AdminCanchas from './pages/AdminCanchas';
import AdminLayout from './components/AdminLayout';
import AdminBloqueos from './pages/AdminBloqueos';
import AdminFinance from './pages/AdminFinance';
import AdminAbonos from './pages/AdminAbonos';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

function App() {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            } />
            <Route path="/" element={<Reserve />} />
            {/* ADMIN ROUTES WITH PERSISTENT SIDEBAR */}
            <Route element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/config" element={<AdminConfig />} />
              <Route path="/admin/canchas" element={<AdminCanchas />} />
              <Route path="/admin/bloqueos" element={<AdminBloqueos />} />
              <Route path="/admin/finanzas" element={<AdminFinance />} />
              <Route path="/admin/abonos" element={<AdminAbonos />} />
            </Route>
          </Routes>
        </AuthProvider>
      </Router>
    </GoogleReCaptchaProvider>
  );
}

export default App;
