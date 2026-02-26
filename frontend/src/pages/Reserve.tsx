import { useState, useEffect } from 'react';
import Calendar from '../components/Calendar';
import BookingForm from '../components/BookingForm';
import { Toast, type ToastType } from '../components/Toast';
import { MatchType } from '../types/booking';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Calendar as CalendarIcon, Wallet, CreditCard } from 'lucide-react';
import '../index.css';
import logo from '../assets/logo.jpg';

interface Player {
    user_id?: string;
    guest_name?: string;
    is_organizer: boolean;
}

interface DashboardData {
    nextMatch: {
        id: string;
        fecha: string;
        hora_inicio: string;
        type: string;
        canchas: { nombre: string };
    } | null;
    abono: {
        tipo: string;
        creditos_totales: number;
        creditos_disponibles: number;
    } | null;
}

export default function Reserve() {
    const [bookingData, setBookingData] = useState<{ courtId: number; slot: string } | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const { user, isAdmin, logout } = useAuth();
    const [config, setConfig] = useState({ blockDuration: 30, blocksPerTurn: 3 });
    const [refreshKey, setRefreshKey] = useState(0);
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const cfg = await api.get<{ clave: string; valor: string }[]>('/config');
                const duracion_bloque = parseInt(cfg.find(c => c.clave === 'duracion_bloque')?.valor || '30');
                const bloques_por_turno = parseInt(cfg.find(c => c.clave === 'bloques_por_turno')?.valor || '3');
                setConfig({ blockDuration: duracion_bloque, blocksPerTurn: bloques_por_turno });
            } catch (e) {
                console.error('Error fetching config in Reserve');
            }
        };

        const fetchDashboard = async () => {
            if (!user) return;
            try {
                const data = await api.get<DashboardData>('/users/me/dashboard');
                setDashboard(data);
            } catch (e) {
                console.error('Error fetching dashboard data');
            }
        };

        fetchConfig();
        fetchDashboard();
    }, [user, refreshKey]);

    const handleSubmitBooking = async (details: { type: MatchType; players: Player[] }) => {
        if (!bookingData) return;

        const startTime = new Date(bookingData.slot);
        const endTime = new Date(startTime.getTime() + (config.blockDuration * config.blocksPerTurn) * 60 * 1000);

        try {
            await api.post('/bookings', {
                court_id: bookingData.courtId,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                type: details.type,
                players: details.players.map((p) => ({
                    user_id: p.user_id || undefined,
                    guest_name: p.guest_name || undefined,
                    is_organizer: p.is_organizer,
                })),
            });
            setToast({
                message: 'Reserva enviada exitosamente. Pendiente de confirmación.',
                type: 'success'
            });
            setBookingData(null);
            setRefreshKey(prev => prev + 1);
        } catch (error: any) {
            setToast({
                message: error.message || 'Error al procesar la reserva. Intente nuevamente.',
                type: 'error'
            });
        }
    };

    const handleLogout = () => {
        logout();
    };

    return (
        <div className="container">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
            {bookingData && (
                <BookingForm
                    courtId={bookingData.courtId}
                    slot={new Date(bookingData.slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    onCancel={() => setBookingData(null)}
                    onSubmit={handleSubmitBooking}
                />
            )}

            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <img
                        src={logo}
                        alt="Club Belgrano Logo"
                        style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--brand-blue-pastel)' }}
                    />
                    <div>
                        <h1 style={{ color: 'var(--brand-blue)', fontSize: '2rem', fontWeight: '800' }}>CLUB BELGRANO</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Gestión de Canchas</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    {user ? (
                        <>
                            {isAdmin && (
                                <button
                                    className="btn-primary"
                                    onClick={() => window.location.href = '/admin'}
                                    style={{ background: 'var(--brand-blue)', padding: '10px 20px', fontSize: '0.9rem' }}
                                >
                                    Panel Admin
                                </button>
                            )}
                            <div style={{ textAlign: 'right' }}>
                                <div className="card-value" style={{ fontSize: '1.2rem' }}>
                                    Hola, {user.nombre || user.email?.split('@')[0] || 'Socio'}!
                                </div>
                                <p
                                    style={{ color: 'var(--brand-blue)', fontWeight: '600', cursor: 'pointer', margin: 0, fontSize: '0.9rem' }}
                                    onClick={handleLogout}
                                >
                                    Cerrar Sesión
                                </p>
                            </div>
                        </>
                    ) : (
                        <a
                            href="/login"
                            className="btn-primary"
                            style={{ textDecoration: 'none', display: 'inline-block' }}
                        >
                            Iniciar Sesión
                        </a>
                    )}
                </div>
            </header>

            {/* Header Metrics */}
            {/* Dashboard Header Bento Grid */}
            {user && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gridAutoRows: 'minmax(160px, auto)',
                    gap: '20px',
                    marginBottom: '40px'
                }}>
                    {/* Next Match - Larger (2 columns) */}
                    <div className="card card-accent-blue" style={{ gridColumn: 'span 2' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="card-title">Próximo Partido</div>
                            <CalendarIcon size={18} style={{ color: 'var(--brand-blue)' }} />
                        </div>
                        {dashboard?.nextMatch ? (
                            <>
                                <div className="card-value" style={{ fontSize: '2rem' }}>
                                    {(() => {
                                        const [year, month, day] = dashboard.nextMatch.fecha.split('-').map(Number);
                                        const date = new Date(year, month - 1, day);
                                        return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
                                    })()} • {dashboard.nextMatch.hora_inicio.slice(0, 5)} hs
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                    <div className="badge" style={{ background: 'var(--brand-blue-pastel)', color: 'var(--brand-blue)' }}>
                                        {dashboard.nextMatch.canchas.nombre}
                                    </div>
                                    <div className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-muted)' }}>
                                        {dashboard.nextMatch.type === 'single' ? 'Singles' : 'Dobles'}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="card-value" style={{ fontSize: '1.1rem', color: 'var(--text-muted)', paddingTop: '12px' }}>
                                No tienes partidos programados para hoy o el futuro.
                            </div>
                        )}
                    </div>

                    {/* Balance */}
                    <div className="card card-accent-orange">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="card-title">Cuenta Corriente</div>
                            <Wallet size={18} style={{ color: '#27AE60' }} />
                        </div>
                        <div className="card-value" style={{ color: '#27AE60' }}>$0 <span style={{ fontSize: '1rem' }}>SAR</span></div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>Tu cuenta está al día</p>
                    </div>

                    {/* Abono */}
                    <div className="card card-accent-blue">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="card-title">Abono Restante</div>
                            <CreditCard size={18} style={{ color: 'var(--brand-blue)' }} />
                        </div>
                        {dashboard?.abono ? (
                            <>
                                <div className="card-value">
                                    {dashboard.abono.tipo === 'libre' ? '∞' : `${dashboard.abono.creditos_disponibles} / ${dashboard.abono.creditos_totales}`}
                                </div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
                                    Plan {dashboard.abono.tipo.toUpperCase()} activo
                                </p>
                            </>
                        ) : (
                            <div className="card-value" style={{ fontSize: '1.1rem', color: 'var(--text-muted)', paddingTop: '12px' }}>
                                Sin abono activo
                            </div>
                        )}
                    </div>
                </div>
            )}

            <main className="animate-slide-up">
                <section>
                    <div className="card glass" style={{ minHeight: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Reservar Cancha</h2>
                        </div>

                        <Calendar
                            onConfirm={(courtId, slot) => setBookingData({ courtId, slot })}
                            refreshKey={refreshKey}
                        />
                    </div>
                </section>
            </main>
        </div >
    );
}
