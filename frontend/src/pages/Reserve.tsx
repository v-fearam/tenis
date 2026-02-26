import { useState, useEffect } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
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
    const { executeRecaptcha } = useGoogleReCaptcha();
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

    const handleSubmitBooking = async (details: { type: MatchType; players: Player[]; organizer_name?: string; organizer_email?: string; organizer_phone?: string }) => {
        if (!bookingData) return;

        try {
            // Generate reCAPTCHA token
            if (!executeRecaptcha) {
                setToast({
                    message: 'reCAPTCHA no está disponible. Por favor, recargue la página.',
                    type: 'error'
                });
                return;
            }

            const recaptchaToken = await executeRecaptcha('booking_submit');

            const startTime = new Date(bookingData.slot);
            const endTime = new Date(startTime.getTime() + (config.blockDuration * config.blocksPerTurn) * 60 * 1000);

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
                // Include organizer contact info if not authenticated
                ...(details.organizer_name && {
                    organizer_name: details.organizer_name,
                    organizer_email: details.organizer_email,
                    organizer_phone: details.organizer_phone,
                }),
                // Include reCAPTCHA token
                recaptcha_token: recaptchaToken,
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

            {/* Ultra-Compact Header for Mobile */}
            <header className="reserve-header">
                {/* Logo + Title */}
                <div className="reserve-header-branding">
                    <img
                        src={logo}
                        alt="Club Belgrano"
                        className="reserve-logo"
                    />
                    <div className="reserve-title-wrapper">
                        <h1 className="reserve-title">CLUB BELGRANO</h1>
                        <p className="reserve-subtitle">Gestión de Canchas</p>
                    </div>
                </div>

                {/* User Actions */}
                <div className="reserve-header-actions">
                    {user ? (
                        <>
                            {isAdmin && (
                                <button
                                    onClick={() => window.location.href = '/admin'}
                                    className="reserve-btn reserve-btn-admin"
                                >
                                    Admin
                                </button>
                            )}
                            <div className="reserve-user-info">
                                <span className="reserve-user-name">
                                    {user.nombre || user.email?.split('@')[0] || 'Socio'}
                                </span>
                                <button onClick={handleLogout} className="reserve-btn-logout">
                                    Salir
                                </button>
                            </div>
                        </>
                    ) : (
                        <a href="/login" className="reserve-btn reserve-btn-login">
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
                    <div className="card glass reserve-calendar-card">
                        <h2 className="reserve-calendar-title">
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
