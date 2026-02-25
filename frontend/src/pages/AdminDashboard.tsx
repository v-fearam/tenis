import { useState, useEffect } from 'react';
import {
    Check, Clock, Users, Calendar,
    X
} from 'lucide-react';
import { api } from '../lib/api';
import { Toast, type ToastType } from '../components/Toast';

interface Booking {
    id: string;
    court_id: number;
    start_time: string;
    status: string;
    type: string;
    booking_players: any[];
    solicitante_nombre?: string;
}

export default function AdminDashboard() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [stats, setStats] = useState({
        activeBookings: 0,
        pendingConfirmations: 0,
        totalUsers: 0,
        revenue: '$45.200'
    });
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

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
            setToast({ message: 'Reserva confirmada.', type: 'success' });
        } catch (err) {
            setToast({ message: 'Error al confirmar reserva', type: 'error' });
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
            setToast({ message: 'Reserva rechazada.', type: 'success' });
        } catch (err) {
            setToast({ message: 'Error al cancelar reserva', type: 'error' });
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
        <div style={{ padding: '0px' }}>
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* MAIN CONTENT AREA */}
            <main style={{ padding: '40px' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-1px', marginBottom: '4px' }}>Gestión de Turnos</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Estado de reservas y aprobaciones del Club</p>
                    </div>
                    <button onClick={() => window.location.href = '/'} className="btn-primary" style={{ padding: '12px 24px', borderRadius: '14px', background: 'var(--text-main)', color: 'white' }}>
                        Ir a Vista Socios
                    </button>
                </header>

                {/* Grid of Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                    <StatCard
                        title="Reservas Activas"
                        value={stats.activeBookings}
                        icon={<Calendar size={22} />}
                        color="blue"
                    />
                    <StatCard
                        title="Por Aprobar"
                        value={stats.pendingConfirmations}
                        icon={<Clock size={22} />}
                        color="orange"
                        pulse
                    />
                    <StatCard
                        title="Socios Club"
                        value={stats.totalUsers}
                        icon={<Users size={22} />}
                        color="blue"
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
                    {/* ACTION CENTER: Booking Approval */}
                    <section>
                        <div className="card glass" style={{ padding: '30px', minHeight: '500px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)' }}>Centro de Aprobaciones</h2>
                                <span className="badge" style={{ background: 'var(--clay-orange-pastel)', color: 'var(--clay-orange)', fontWeight: '800' }}>
                                    {bookings.filter(b => b.status === 'pending').length} PENDIENTES
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {bookings.filter(b => b.status === 'pending').length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '100px 20px', opacity: 0.6 }}>
                                        <div style={{ background: '#D4EFDF', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#27AE60' }}>
                                            <Check size={32} />
                                        </div>
                                        <p style={{ fontWeight: '700', color: 'var(--text-main)' }}>Bandeja despejada</p>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No hay reservas aguardando confirmación.</p>
                                    </div>
                                ) : (
                                    bookings.filter(b => b.status === 'pending').map(booking => (
                                        <div key={booking.id} className="hover-scale" style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            background: 'rgba(255,255,255,0.4)',
                                            padding: '16px 20px',
                                            borderRadius: '18px',
                                            border: '1px solid var(--border)'
                                        }}>
                                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                                <div style={{
                                                    width: '56px', height: '56px', borderRadius: '14px',
                                                    background: 'var(--brand-blue)', color: 'white',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: '900', opacity: 0.8 }}>COURT</span>
                                                    <span style={{ fontSize: '1.2rem', fontWeight: '900' }}>{booking.court_id}</span>
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                                                        {new Date(booking.start_time).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} • {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                                                    </div>
                                                    <div style={{ fontSize: '0.9rem', color: 'var(--brand-blue)', fontWeight: '700', marginTop: '2px' }}>
                                                        Solicita: {booking.solicitante_nombre}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                                                        <span className="badge" style={{ fontSize: '0.7rem', background: 'var(--bg-main)' }}>
                                                            {booking.type === 'single' ? 'Singles' : 'Dobles'}
                                                        </span>
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duración: 90m</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button
                                                    onClick={() => handleCancel(booking.id)}
                                                    className="btn-secondary"
                                                    style={{ width: '44px', height: '44px', borderRadius: '12px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E74C3C' }}
                                                    title="Rechazar"
                                                >
                                                    <X size={20} />
                                                </button>
                                                <button
                                                    onClick={() => handleConfirm(booking.id)}
                                                    className="btn-primary"
                                                    style={{ width: '44px', height: '44px', borderRadius: '12px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#27AE60', color: 'white', border: 'none' }}
                                                    title="Aprobar"
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

                </div>
            </main>
        </div>
    );
}


function StatCard({ title, value, icon, color, trend, pulse }: any) {
    const accents: any = {
        blue: { main: '#0A84FF', pastel: 'rgba(10, 132, 255, 0.1)' },
        orange: { main: '#FF9F0A', pastel: 'rgba(255, 159, 10, 0.1)' },
        green: { main: '#27AE60', pastel: 'rgba(39, 174, 96, 0.1)' }
    };
    const accent = accents[color] || accents.blue;

    return (
        <div className="card glass hover-scale" style={{ padding: '24px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
            {pulse && (
                <div style={{
                    position: 'absolute', top: '15px', right: '15px',
                    width: '8px', height: '8px', borderRadius: '50%', background: accent.main,
                    boxShadow: `0 0 0 4px ${accent.pastel}`,
                    animation: 'pulse 2s infinite'
                }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ color: accent.main, background: accent.pastel, padding: '10px', borderRadius: '12px' }}>
                    {icon}
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '700' }}>{title}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-1px' }}>{value}</div>
                {trend && <div style={{ fontSize: '0.8rem', fontWeight: '700', color: accent.main }}>{trend}</div>}
            </div>
        </div>
    );
}


