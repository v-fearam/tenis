import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.jpg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the intended destination from ProtectedRoute's state, or default to '/'
  const from = (location.state as any)?.from || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // Redirect to the page they originally tried to access
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '40px', textAlign: 'center' }}>
        <img
          src={logo}
          alt="Club Belgrano"
          style={{
            width: '100px', height: '100px', borderRadius: '50%',
            objectFit: 'cover', border: '4px solid var(--brand-blue-pastel)',
            margin: '0 auto 20px', display: 'block',
          }}
        />
        <h1 style={{ color: 'var(--brand-blue)', fontSize: '1.5rem', fontWeight: '800', marginBottom: '4px' }}>
          CLUB BELGRANO
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '0.9rem' }}>
          Gestión de Canchas de Tenis
        </p>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert-error">{error}</div>}

          <div style={{ marginBottom: '16px', textAlign: 'left' }}>
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              className="form-input"
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: '24px', textAlign: 'left' }}>
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••"
              className="form-input"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', fontSize: '1rem',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <a
          href="/"
          style={{ display: 'inline-block', marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.9rem', textDecoration: 'none' }}
        >
          ← Volver a Reservas
        </a>
      </div>
    </div>
  );
}
