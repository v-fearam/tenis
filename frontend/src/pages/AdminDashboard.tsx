import { useState, useEffect } from 'react';
import {
    Check, Clock, Users, Calendar,
    X
} from 'lucide-react';
import { api } from '../lib/api';
import { Toast, type ToastType } from '../components/Toast';
import { formatDateToDDMMYYYY } from '../lib/dateUtils';
import DateInputDDMMYYYY from '../components/DateInputDDMMYYYY';
import { usePagination } from '../hooks/usePagination';
import type { PaginatedResponse } from '../types/pagination';
import PaginationControls from '../components/PaginationControls';

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
    const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [activeView, setActiveView] = useState<'pending' | 'active'>('pending');

    const paginationPending = usePagination();
    const paginationActive = usePagination();

    const [dateFrom, setDateFrom] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(() => {
        const in30Days = new Date();
        in30Days.setDate(in30Days.getDate() + 30);
        return in30Days.toISOString().split('T')[0];
    });

    const filteredPending = bookings;
    const filteredActive = activeBookings;

    const isActiveBooking = (booking: Booking) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(booking.start_time) >= today;
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const pendingParams = paginationPending.getQueryParams();
                const activeParams = paginationActive.getQueryParams();

                const [bookingsResponse, activeResponse, usersCount] = await Promise.all([
                    api.get<PaginatedResponse<Booking>>(
                        `/bookings?status=pending&page=${pendingParams.page}&pageSize=${pendingParams.pageSize}&fecha_desde=${dateFrom}&fecha_hasta=${dateTo}`
                    ),
                    api.get<PaginatedResponse<Booking>>(
                        `/bookings/active?page=${activeParams.page}&pageSize=${activeParams.pageSize}`
                    ),
                    api.get<{ count: number }>('/users/count').catch(() => ({ count: 120 }))
                ]);

                setBookings(bookingsResponse.data);
                paginationPending.setMeta(bookingsResponse.meta);

                setActiveBookings(activeResponse.data);
                paginationActive.setMeta(activeResponse.meta);

                setTotalUsers(usersCount.count);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [paginationPending.page, paginationActive.page, dateFrom, dateTo]);

    const handleConfirm = async (id: string) => {
        try {
            await api.patch(`/bookings/${id}/confirm`, {});
            const updatedBookings = bookings.map(b => b.id === id ? { ...b, status: 'confirmed' } : b);
            setBookings(updatedBookings);

            const confirmed = updatedBookings.find(b => b.id === id);
            if (confirmed && isActiveBooking(confirmed)) {
                setActiveBookings(prev => prev.some(b => b.id === id) ? prev : [confirmed, ...prev]);
            }
            setToast({ message: 'Reserva confirmada.', type: 'success' });
        } catch (err) {
            setToast({ message: 'Error al confirmar reserva', type: 'error' });
        }
    };

    const handleCancel = async (id: string) => {
        try {
            await api.patch(`/bookings/${id}/cancel`, {});
            setBookings(prev => prev.filter(b => b.id !== id));
            setActiveBookings(prev => prev.filter(b => b.id !== id));
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
            <main style={{ padding: '20px' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '2px' }}>Gestión de Turnos</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Reservas y aprobaciones</p>
                    </div>
                    <button onClick={() => window.location.href = '/'} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.85rem' }}>
                        Vista Socios
                    </button>
                </header>

                {/* Grid of Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <StatCard
                        title="Reservas Activas"
                        value={paginationActive.meta?.totalItems || 0}
                        icon={<Calendar size={22} />}
                        color="blue"
                    />
                    <StatCard
                        title="Por Aprobar"
                        value={paginationPending.meta?.totalItems || 0}
                        icon={<Clock size={22} />}
                        color="orange"
                        pulse
                    />
                    <StatCard
                        title="Socios Club"
                        value={totalUsers}
                        icon={<Users size={22} />}
                        color="blue"
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => setActiveView('pending')}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '12px',
                                background: activeView === 'pending' ? 'var(--text-main)' : 'var(--bg-main)',
                                color: activeView === 'pending' ? 'white' : 'var(--text-main)',
                                border: activeView === 'pending' ? 'none' : '1px solid var(--border)',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Pendientes
                        </button>
                        <button
                            onClick={() => setActiveView('active')}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '12px',
                                background: activeView === 'active' ? 'var(--text-main)' : 'var(--bg-main)',
                                color: activeView === 'active' ? 'white' : 'var(--text-main)',
                                border: activeView === 'active' ? 'none' : '1px solid var(--border)',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Activos
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Desde:</label>
                        <DateInputDDMMYYYY
                            value={dateFrom}
                            onChange={setDateFrom}
                            compact
                        />
                        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Hasta:</label>
                        <DateInputDDMMYYYY
                            value={dateTo}
                            onChange={setDateTo}
                            compact
                        />
                    </div>
                </div>

                <section>
                    <div className="card glass" style={{ padding: '22px', minHeight: '480px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)' }}>
                                {activeView === 'pending' ? 'Centro de Aprobaciones' : 'Turnos Activos'}
                            </h2>
                            <span
                                className="badge"
                                style={{
                                    background: activeView === 'pending' ? 'var(--clay-orange-pastel)' : 'var(--brand-blue-pastel)',
                                    color: activeView === 'pending' ? 'var(--clay-orange)' : 'var(--brand-blue)',
                                    fontWeight: '800'
                                }}
                            >
                                {activeView === 'pending'
                                    ? `${paginationPending.meta?.totalItems || 0} PENDIENTES`
                                    : `${paginationActive.meta?.totalItems || 0} ACTIVOS`
                                }
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {activeView === 'pending' && filteredPending.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '80px 20px', opacity: 0.6 }}>
                                    <div style={{ background: '#D4EFDF', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#27AE60' }}>
                                        <Check size={30} />
                                    </div>
                                    <p style={{ fontWeight: '700', color: 'var(--text-main)' }}>Bandeja despejada</p>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No hay reservas aguardando confirmación.</p>
                                </div>
                            )}

                            {activeView === 'active' && filteredActive.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '80px 20px', opacity: 0.6 }}>
                                    <div style={{ background: 'var(--brand-blue-pastel)', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--brand-blue)' }}>
                                        <Calendar size={30} />
                                    </div>
                                    <p style={{ fontWeight: '700', color: 'var(--text-main)' }}>No hay turnos activos</p>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Las reservas confirmadas futuras aparecerán aquí.</p>
                                </div>
                            )}

                            {activeView === 'pending' && filteredPending.map(booking => (
                                <div key={booking.id} className="hover-scale" style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'rgba(255,255,255,0.4)',
                                    padding: '10px 16px',
                                    borderRadius: '14px',
                                    border: '1px solid var(--border)'
                                }}>
                                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                        <div style={{
                                            width: '48px', height: '48px', borderRadius: '12px',
                                            background: 'var(--brand-blue)', color: 'white',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: '900', opacity: 0.8 }}>COURT</span>
                                            <span style={{ fontSize: '1.05rem', fontWeight: '900' }}>{booking.court_id}</span>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '800', fontSize: '0.98rem', color: 'var(--text-main)' }}>
                                            {formatDateToDDMMYYYY(booking.start_time)} • {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--brand-blue)', fontWeight: '700', marginTop: '2px' }}>
                                                Solicita: {booking.solicitante_nombre}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => handleCancel(booking.id)}
                                            className="btn-secondary"
                                            style={{ width: '38px', height: '38px', borderRadius: '10px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E74C3C' }}
                                            title="Rechazar"
                                        >
                                            <X size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleConfirm(booking.id)}
                                            className="btn-primary"
                                            style={{ width: '38px', height: '38px', borderRadius: '10px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#27AE60', color: 'white', border: 'none' }}
                                            title="Aprobar"
                                        >
                                            <Check size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {activeView === 'active' && filteredActive.map(booking => (
                                <div key={booking.id} className="hover-scale" style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'rgba(255,255,255,0.4)',
                                    padding: '10px 16px',
                                    borderRadius: '14px',
                                    border: '1px solid var(--border)'
                                }}>
                                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                        <div style={{
                                            width: '48px', height: '48px', borderRadius: '12px',
                                            background: 'var(--brand-blue)', color: 'white',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: '900', opacity: 0.8 }}>COURT</span>
                                            <span style={{ fontSize: '1.05rem', fontWeight: '900' }}>{booking.court_id}</span>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '800', fontSize: '0.98rem', color: 'var(--text-main)' }}>
                                                {formatDateToDDMMYYYY(booking.start_time)} • {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--brand-blue)', fontWeight: '700', marginTop: '2px' }}>
                                                Solicita: {booking.solicitante_nombre}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => handleCancel(booking.id)}
                                            className="btn-secondary"
                                            style={{ width: '38px', height: '38px', borderRadius: '10px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E74C3C' }}
                                            title="Cancelar"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        {activeView === 'pending' && filteredPending.length > 0 && (
                            <PaginationControls
                                meta={paginationPending.meta}
                                onPageChange={paginationPending.goToPage}
                                onNext={paginationPending.nextPage}
                                onPrevious={paginationPending.previousPage}
                                onFirst={paginationPending.firstPage}
                                onLast={paginationPending.lastPage}
                            />
                        )}

                        {activeView === 'active' && filteredActive.length > 0 && (
                            <PaginationControls
                                meta={paginationActive.meta}
                                onPageChange={paginationActive.goToPage}
                                onNext={paginationActive.nextPage}
                                onPrevious={paginationActive.previousPage}
                                onFirst={paginationActive.firstPage}
                                onLast={paginationActive.lastPage}
                            />
                        )}
                    </div>
                </section>
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
        <div className="card glass hover-scale" style={{ padding: '14px 16px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
            {pulse && (
                <div style={{
                    position: 'absolute', top: '10px', right: '10px',
                    width: '7px', height: '7px', borderRadius: '50%', background: accent.main,
                    boxShadow: `0 0 0 3px ${accent.pastel}`,
                    animation: 'pulse 2s infinite'
                }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ color: accent.main, background: accent.pastel, padding: '8px', borderRadius: '10px' }}>
                    {icon}
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600' }}>{title}</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>{value}</div>
                        {trend && <div style={{ fontSize: '0.75rem', fontWeight: '700', color: accent.main }}>{trend}</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}


