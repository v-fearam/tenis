import { useState, useEffect } from 'react';
import {
    Check, X, Clock, User, Users, Calendar,
    TrendingUp, CreditCard, LayoutDashboard, Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import logo from '../assets/logo.jpg';
import { Link } from 'react-router-dom';

interface Booking {
    id: string;
    court_id: number;
    start_time: string;
    status: string;
    type: string;
    booking_players: any[];
}

export default function AdminDashboard() {
    const { logout, user } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [stats, setStats] = useState({
        activeBookings: 0,
        pendingConfirmations: 0,
        totalUsers: 0,
        revenue: '$45.200'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [bookingsData, usersCount] = await Promise.all([
                    api.get<Booking[]>('/bookings'),
                    api.get<{ count: number }>('/users/count').catch(() => ({ count: 120 }))
                ]);

                setBookings(bookingsData);
                setStats(prev => ({
                    ...prev,
                    activeBookings: bookingsData.filter(b => b.status === 'confirmed').length,
                    pendingConfirmations: bookingsData.filter(b => b.status === 'pending').length,
                    totalUsers: usersCount.count
                }));
                setLoading(false);
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const handleConfirm = async (id: string) => {
        try {
            await api.patch(`/bookings/${id}/confirm`, {});
            setBookings(bookings.map(b => b.id === id ? { ...b, status: 'confirmed' } : b));
            setStats(prev => ({
                ...prev,
                pendingConfirmations: prev.pendingConfirmations - 1,
                activeBookings: prev.activeBookings + 1
            }));
            alert('Reserva confirmada.');
        } catch (err) {
            alert('Error al confirmar reserva');
        }
    };

    const handleCancel = async (id: string) => {
        try {
            await api.patch(`/bookings/${id}/cancel`, {});
            setBookings(bookings.filter(b => b.id !== id));
            setStats(prev => ({
                ...prev,
                pendingConfirmations: prev.pendingConfirmations - 1
            }));
            alert('Reserva rechazada.');
        } catch (err) {
            alert('Error al cancelar reserva');
        }
    };

    if (loading) return (
        <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <div className="card glass" style={{ padding: '40px', textAlign: 'center' }}>
                <Clock className="spin" size={40} style={{ color: 'var(--brand-blue)', marginBottom: '16px' }} />
                <p style={{ fontWeight: '600', color: 'var(--brand-blue)' }}>Cargando Panel Central...</p>
            </div>
        </div>
    );

    return (
        <div className="container">
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <img
                        src={logo}
                        alt="Club Belgrano Logo"
                        style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--brand-blue-pastel)' }}
                    />
                    <div>
                        <h1 style={{ color: 'var(--brand-blue)', fontSize: '2rem', fontWeight: '800' }}>CENTRAL DE MANDO</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Socio Administrador: {user?.nombre || 'farambarri'}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-secondary" onClick={() => window.location.href = '/'}>Página de Socios</button>
                    <button className="btn-secondary" onClick={logout} style={{ color: '#E74C3C', fontWeight: '700' }}>Cerrar Sesión</button>
                </div>
            </header>

            {/* Stats Overview */}
            <div className="header-grid" style={{ marginBottom: '40px' }}>
                <StatCard
                    title="Reservas Activas"
                    value={stats.activeBookings}
                    icon={<Calendar size={24} />}
                    color="blue"
                    trend="+12% esta semana"
                />
                <StatCard
                    title="Pendientes"
                    value={stats.pendingConfirmations}
                    icon={<Clock size={24} />}
                    color="orange"
                    trend="Acción requerida"
                />
                <StatCard
                    title="Socios Activos"
                    value={stats.totalUsers}
                    icon={<Users size={24} />}
                    color="blue"
                    trend="2 nuevos hoy"
                />
                <StatCard
                    title="Recaudación Mes"
                    value={stats.revenue}
                    icon={<TrendingUp size={24} />}
                    color="orange"
                    trend="En línea con objetivo"
                />
            </div>

            <main style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
                {/* Side Navigation Cards */}
                <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '4px', color: 'var(--brand-blue)' }}>Módulos de Gestión</h2>

                    <NavCard
                        to="/admin/users"
                        title="Gestión de Usuarios"
                        description="Alta de socios, control de deudas y roles."
                        icon={<Users size={32} />}
                        color="var(--brand-blue)"
                    />

                    <NavCard
                        to="/admin"
                        title="Control de Canchas"
                        description="Configuración de horarios y mantenimiento."
                        icon={<LayoutDashboard size={32} />}
                        color="var(--brand-blue)"
                    />

                    <NavCard
                        to="/admin"
                        title="Finanzas y Pagos"
                        description="Facturación y reportes de ingresos."
                        icon={<CreditCard size={32} />}
                        color="var(--clay-orange)"
                    />

                    <div className="card glass" style={{ marginTop: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <Settings size={20} style={{ color: 'var(--text-muted)' }} />
                            <h3 style={{ fontSize: '1rem' }}>Configuración</h3>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ajustes globales del sistema de reservas.</p>
                    </div>
                </aside>

                {/* Main Content Area: Pending Bookings */}
                <section>
                    <div className="card" style={{ minHeight: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--brand-blue)' }}>Aprobación de Reservas</h2>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Mostrando {bookings.filter(b => b.status === 'pending').length} pendientes</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {bookings.filter(b => b.status === 'pending').length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
                                    <Check size={48} style={{ color: '#27AE60', marginBottom: '16px', opacity: 0.5 }} />
                                    <p style={{ fontWeight: '600', color: 'var(--text-muted)' }}>¡Todo al día! No hay reservas pendientes de aprobación.</p>
                                </div>
                            ) : (
                                bookings.filter(b => b.status === 'pending').map(booking => (
                                    <div key={booking.id} className="card glass hover-scale" style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        border: '1px solid var(--border)',
                                        padding: '20px'
                                    }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                                                <span style={{
                                                    background: 'var(--brand-blue)', color: 'white',
                                                    padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: '800'
                                                }}>CANCHA {booking.court_id}</span>
                                                <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                                                    {new Date(booking.start_time).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })} @ {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '15px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <User size={16} /> {booking.type === 'single' ? 'Individual' : 'Dobles'}
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Clock size={16} /> 90 minutos
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button
                                                onClick={() => handleCancel(booking.id)}
                                                className="btn-secondary"
                                                style={{ padding: '12px', background: '#FADBD8', color: '#E74C3C', border: 'none' }}
                                                title="Rechazar"
                                            >
                                                <X size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleConfirm(booking.id)}
                                                className="btn-primary"
                                                style={{ padding: '12px', background: '#D4EFDF', color: '#27AE60', border: 'none' }}
                                                title="Confirmar"
                                            >
                                                <Check size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

function StatCard({ title, value, icon, color, trend }: any) {
    const accent = color === 'orange' ? 'var(--clay-orange)' : 'var(--brand-blue)';
    const bg = color === 'orange' ? 'var(--clay-orange-pastel)' : 'var(--brand-blue-pastel)';

    return (
        <div className="card glass hover-scale" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase' }}>{title}</span>
                <div style={{ color: accent, background: bg, padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    {icon}
                </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '4px' }}>{value}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: color === 'orange' ? 'var(--clay-orange)' : '#27AE60' }}>
                {trend}
            </div>
        </div>
    );
}

function NavCard({ to, title, description, icon, color }: any) {
    return (
        <Link to={to} style={{ textDecoration: 'none' }}>
            <div className="card glass hover-scale" style={{
                padding: '24px',
                borderLeft: `5px solid ${color}`,
                cursor: 'pointer'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ color: color }}>{icon}</div>
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>{title}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{description}</p>
                    </div>
                </div>
            </div>
        </Link>
    );
}
