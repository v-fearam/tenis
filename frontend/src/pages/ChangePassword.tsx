import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import logo from '../assets/logo.jpg';

export default function ChangePassword() {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);
        try {
            await api.patch('/auth/change-password', { newPassword });
            setSuccess(true);
            // Automatically logout and redirect after a few seconds
            setTimeout(() => {
                logout();
                navigate('/login', { replace: true });
            }, 3000);
        } catch (err: any) {
            setError(err.message || 'Error al cambiar la contraseña');
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="login-page">
                <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '40px', textAlign: 'center' }}>
                    <div style={{ color: '#27AE60', marginBottom: '16px' }}>
                        <CheckCircle2 size={64} style={{ margin: '0 auto' }} />
                    </div>
                    <h2 style={{ color: 'var(--brand-blue)', fontSize: '1.5rem', fontWeight: '800', marginBottom: '16px' }}>
                        ¡Contraseña Actualizada!
                    </h2>
                    <p style={{ color: 'var(--text-main)', marginBottom: '24px' }}>
                        Tu contraseña ha sido cambiada correctamente. Serás redirigido a la pantalla de inicio de sesión en unos instantes.
                    </p>
                    <button
                        onClick={() => { logout(); navigate('/login'); }}
                        className="btn-primary"
                        style={{ width: '100%', padding: '14px' }}
                    >
                        Ir al Login ahora
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '40px', textAlign: 'center' }}>
                <img
                    src={logo}
                    alt="Club Belgrano"
                    style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        objectFit: 'cover', border: '3px solid var(--brand-blue-pastel)',
                        margin: '0 auto 20px', display: 'block',
                    }}
                />
                <h1 style={{ color: 'var(--brand-blue)', fontSize: '1.5rem', fontWeight: '800', marginBottom: '8px' }}>
                    Cambiar Contraseña
                </h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '0.9rem' }}>
                    Por seguridad, debes establecer una nueva contraseña para continuar.
                </p>

                <form onSubmit={handleSubmit}>
                    {error && <div className="alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

                    <div style={{ marginBottom: '16px', textAlign: 'left' }}>
                        <label className="form-label">Nueva Contraseña</label>
                        <div className="input-with-icon">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                placeholder="Mínimo 6 caracteres"
                                className="form-input"
                                style={{ paddingRight: '45px' }}
                            />
                            <button
                                type="button"
                                className="input-icon-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                        <label className="form-label">Confirmar Nueva Contraseña</label>
                        <div className="input-with-icon">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                placeholder="Repite la contraseña"
                                className="form-input"
                                style={{ paddingRight: '45px' }}
                            />
                            <button
                                type="button"
                                className="input-icon-btn"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                aria-label={showConfirmPassword ? "Ocultar contraseña" : "Ver contraseña"}
                            >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
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
                        {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                    </button>
                </form>

                <button
                    onClick={() => { logout(); navigate('/login'); }}
                    style={{ background: 'none', border: 'none', marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                    Cancelar y salir
                </button>
            </div>
        </div>
    );
}
