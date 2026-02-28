import { useState, useEffect } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import Calendar from '../components/Calendar';
import BookingForm from '../components/BookingForm';
import { Toast, type ToastType } from '../components/Toast';
import { MatchType } from '../types/booking';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Calendar as CalendarIcon, Wallet, CreditCard } from 'lucide-react';
import { formatYYYYMMDDtoDDMMYYYY } from '../lib/dateUtils';
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
        color: string | null;
    } | null;
    isSocio: boolean;
}

export default function Reserve() {
    const [bookingData, setBookingData] = useState<{ courtId: number; slot: string } | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const { user, isAdmin, logout } = useAuth();
    const { executeRecaptcha } = useGoogleReCaptcha();
    const [isMobile, setIsMobile] = useState(false);
    const [config, setConfig] = useState({ blockDuration: 30, blocksPerTurn: 3 });
    const [refreshKey, setRefreshKey] = useState(0);
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 767px)');
        const handleMediaChange = (event: MediaQueryListEvent) => {
            setIsMobile(event.matches);
        };

        setIsMobile(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleMediaChange);

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

        return () => {
            mediaQuery.removeEventListener('change', handleMediaChange);
        };
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

            const result = await api.post<{ costo: number }>('/bookings', {
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
            const costoMsg = result.costo > 0
                ? ` Costo del turno: $${result.costo.toLocaleString('es-AR')}`
                : '';
            setToast({
                message: `Reserva enviada exitosamente. Pendiente de confirmación.${costoMsg}`,
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
                            {isAdmin && !isMobile && (
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

            {/* Abono / Membership Card */}
            {user && dashboard && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                    padding: '10px 14px', marginBottom: '10px',
                    background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                }}>
                    {/* Next Match pill */}
                    {dashboard.nextMatch && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: 'var(--brand-blue-pastel)', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
                            <CalendarIcon size={15} style={{ color: 'var(--brand-blue)', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--brand-blue)' }}>
                                {formatYYYYMMDDtoDDMMYYYY(dashboard.nextMatch.fecha)} {dashboard.nextMatch.hora_inicio.slice(0, 5)}
                            </span>
                        </div>
                    )}

                    {/* Separator */}
                    <div style={{ flex: 1 }} />

                    {/* Abono info */}
                    {dashboard.abono ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                background: (dashboard.abono.color || 'var(--brand-blue)') + '18',
                                border: `1px solid ${dashboard.abono.color || 'var(--brand-blue)'}33`,
                            }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: dashboard.abono.color || 'var(--brand-blue)' }}>
                                    {dashboard.abono.tipo}
                                </span>
                            </div>
                            {dashboard.abono.tipo.toLowerCase() === 'libre' ? (
                                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#27AE60' }}>Ilimitado</span>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <CreditCard size={15} style={{ color: dashboard.abono.creditos_disponibles > 0 ? '#27AE60' : '#E74C3C', flexShrink: 0 }} />
                                    <span style={{
                                        fontSize: '0.85rem', fontWeight: '700',
                                        color: dashboard.abono.creditos_disponibles > 0 ? 'var(--text-main)' : '#E74C3C',
                                    }}>
                                        {dashboard.abono.creditos_disponibles}/{dashboard.abono.creditos_totales}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>créditos</span>
                                </div>
                            )}
                        </div>
                    ) : dashboard.isSocio ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CreditCard size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin abono asignado</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Wallet size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No socio — Tarifa general</span>
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
            <footer
                style={{
                    marginTop: '20px',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    opacity: 0.7,
                }}
                aria-label="Creator attribution"
            >
                by Federico Arambarri
            </footer>
        </div >
    );
}
