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

            {/* Compact Header - Saves Vertical Space */}
            <header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                gap: '16px',
                flexWrap: 'wrap'
            }}>
                {/* Logo + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '200px' }}>
                    <img
                        src={logo}
                        alt="Club Belgrano Logo"
                        style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid var(--brand-blue-pastel)'
                        }}
                    />
                    <div>
                        <h1 style={{
                            color: 'var(--brand-blue)',
                            fontSize: '1.5rem',
                            fontWeight: '800',
                            lineHeight: '1.2',
                            margin: 0
                        }}>
                            CLUB BELGRANO
                        </h1>
                        <p style={{
                            color: 'var(--text-muted)',
                            fontSize: '0.8rem',
                            margin: 0,
                            lineHeight: '1.2'
                        }}>
                            Gestión de Canchas
                        </p>
                    </div>
                </div>

                {/* Compact User Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    {user ? (
                        <>
                            {isAdmin && (
                                <button
                                    onClick={() => window.location.href = '/admin'}
                                    style={{
                                        background: 'var(--brand-blue-pastel)',
                                        color: 'var(--brand-blue)',
                                        border: 'none',
                                        padding: '8px 14px',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    Admin
                                </button>
                            )}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 12px',
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)'
                            }}>
                                <span style={{
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    color: 'var(--text-main)',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {user.nombre || user.email?.split('@')[0] || 'Socio'}
                                </span>
                                <button
                                    onClick={handleLogout}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--brand-blue)',
                                        fontSize: '0.8rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        padding: 0,
                                        textDecoration: 'underline',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    Salir
                                </button>
                            </div>
                        </>
                    ) : (
                        <a
                            href="/login"
                            style={{
                                background: 'var(--brand-blue)',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                textDecoration: 'none',
                                display: 'inline-block',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Iniciar Sesión
                        </a>
                    )}
                </div>
            </header>

            {/* Compact Dashboard Summary - Single Line (hidden on small mobile) */}
            {user && dashboard && (
                <div className="dashboard-compact">
                    {/* Next Match */}
                    {dashboard.nextMatch && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--brand-blue-pastel)', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
                            <CalendarIcon size={16} style={{ color: 'var(--brand-blue)', flexShrink: 0 }} />
                            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--brand-blue)' }}>
                                {(() => {
                                    const [year, month, day] = dashboard.nextMatch.fecha.split('-').map(Number);
                                    const date = new Date(year, month - 1, day);
                                    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
                                })()} {dashboard.nextMatch.hora_inicio.slice(0, 5)}
                            </div>
                        </div>
                    )}

                    {/* Balance */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(39, 174, 96, 0.1)', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
                        <Wallet size={16} style={{ color: '#27AE60', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#27AE60' }}>$0</span>
                    </div>

                    {/* Abono */}
                    {dashboard.abono && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--brand-blue-pastel)', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
                            <CreditCard size={16} style={{ color: 'var(--brand-blue)', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--brand-blue)' }}>
                                {dashboard.abono.tipo === 'libre' ? 'Libre' : `${dashboard.abono.creditos_disponibles}/${dashboard.abono.creditos_totales}`}
                            </span>
                        </div>
                    )}
                </div>
            )}

            <main className="animate-slide-up">
                <section>
                    <div className="card glass" style={{ minHeight: '500px', padding: '20px' }}>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '16px', color: 'var(--brand-blue)' }}>
                            Reservar Cancha
                        </h2>

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
