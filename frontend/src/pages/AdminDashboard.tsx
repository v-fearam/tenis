import { useState, useEffect } from 'react';
import {
    Check, Clock, Users, Calendar,
    X, RefreshCw, Search, Trash2, AlertTriangle,
    DollarSign, ChevronDown, ChevronRight, Gift
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
    court_name?: string;
    start_time: string;
    status: string;
    type: string;
    costo: number;
    booking_players: any[];
    solicitante_nombre?: string;
}

interface UnpaidPlayer {
    turno_jugador_id: string;
    nombre: string;
    tipo_persona: string;
    uso_abono: boolean;
    monto_generado: number;
    total_pagado: number;
    saldo_pendiente: number;
    estado_pago: string;
}

interface UnpaidTurno {
    turno_id: string;
    fecha: string;
    hora_inicio: string;
    court_name: string;
    players: UnpaidPlayer[];
    total_pendiente: number;
}

export default function AdminDashboard() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [activeView, setActiveView] = useState<'pending' | 'active' | 'payments'>('pending');

    const [refreshKey, setRefreshKey] = useState(0);
    const paginationPending = usePagination();
    const paginationActive = usePagination();
    const paginationPayments = usePagination();

    const [filterCourt, setFilterCourt] = useState('');
    const [filterName, setFilterName] = useState('');
    const [filterDay, setFilterDay] = useState('');

    // Purge state
    const [showPurgeModal, setShowPurgeModal] = useState(false);
    const [purgeMonth, setPurgeMonth] = useState(new Date().getMonth()); // 0-indexed for display, send +1
    const [purgeYear, setPurgeYear] = useState(new Date().getFullYear() - 1);
    const [purgeConfirmText, setPurgeConfirmText] = useState('');
    const [purgingTurnos, setPurgingTurnos] = useState(false);

    // Payments (Cobranzas) state
    const [unpaidTurnos, setUnpaidTurnos] = useState<UnpaidTurno[]>([]);
    const [expandedTurno, setExpandedTurno] = useState<string | null>(null);
    const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
    const [payingPlayer, setPayingPlayer] = useState<string | null>(null);
    const [totalDebt, setTotalDebt] = useState(0);

    const [dateFrom, setDateFrom] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(() => {
        const in30Days = new Date();
        in30Days.setDate(in30Days.getDate() + 30);
        return in30Days.toISOString().split('T')[0];
    });

    const applyFilters = (list: Booking[]) => {
        return list.filter(b => {
            if (filterCourt && String(b.court_id) !== filterCourt) return false;
            if (filterName) {
                const q = filterName.toLowerCase();
                const nameMatch = b.solicitante_nombre?.toLowerCase().includes(q);
                const playerMatch = b.booking_players?.some((p: any) =>
                    p.guest_name?.toLowerCase().includes(q)
                );
                if (!nameMatch && !playerMatch) return false;
            }
            if (filterDay) {
                const bookingDate = b.start_time.split('T')[0];
                if (bookingDate !== filterDay) return false;
            }
            return true;
        });
    };

    const filteredPending = applyFilters(bookings);
    const filteredActive = applyFilters(activeBookings);

    // Extract unique courts from both lists for the filter dropdown
    const allCourts = [...new Set([...bookings, ...activeBookings].map(b => b.court_id))].sort((a, b) => a - b);
    const courtNames = [...new Set([...bookings, ...activeBookings].filter(b => b.court_name).map(b => ({ id: b.court_id, name: b.court_name! })))];
    const getCourtLabel = (courtId: number) => {
        const found = courtNames.find(c => c.id === courtId);
        return found ? found.name : `Cancha ${courtId}`;
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
    }, [paginationPending.page, paginationActive.page, dateFrom, dateTo, refreshKey]);

    // Fetch unpaid turnos when payments tab is active
    useEffect(() => {
        if (activeView !== 'payments') return;
        const fetchUnpaid = async () => {
            try {
                const params = paginationPayments.getQueryParams();
                const response = await api.get<PaginatedResponse<UnpaidTurno>>(
                    `/pagos/unpaid?page=${params.page}&pageSize=${params.pageSize}`
                );
                setUnpaidTurnos(response.data);
                paginationPayments.setMeta(response.meta);

                // Calculate total debt
                const total = response.data.reduce((sum, t) => sum + t.total_pendiente, 0);
                setTotalDebt(total);
            } catch (err) {
                console.error('Error fetching unpaid turnos:', err);
            }
        };
        fetchUnpaid();
    }, [activeView, paginationPayments.page, refreshKey]);

    const handleConfirm = async (id: string) => {
        try {
            await api.patch(`/bookings/${id}/confirm`, {});
            setToast({ message: 'Reserva confirmada.', type: 'success' });
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            setToast({ message: 'Error al confirmar reserva', type: 'error' });
        }
    };

    const handleCancel = async (id: string) => {
        try {
            await api.patch(`/bookings/${id}/cancel`, {});
            setToast({ message: 'Reserva cancelada.', type: 'success' });
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            setToast({ message: 'Error al cancelar reserva', type: 'error' });
        }
    };

    const handlePayPlayer = async (turnoJugadorId: string) => {
        const montoStr = paymentAmounts[turnoJugadorId];
        const monto = parseFloat(montoStr);
        if (!monto || monto <= 0) {
            setToast({ message: 'Ingresá un monto válido', type: 'warning' });
            return;
        }
        setPayingPlayer(turnoJugadorId);
        try {
            const result = await api.post<{ remaining: number; estado_pago: string }>('/pagos/pay', {
                turno_jugador_id: turnoJugadorId,
                monto,
            });
            const msg = result.estado_pago === 'pagado'
                ? `Pago total de $${monto.toLocaleString('es-AR')} registrado`
                : `Pago parcial de $${monto.toLocaleString('es-AR')} registrado. Resta: $${result.remaining.toLocaleString('es-AR')}`;
            setToast({ message: msg, type: 'success' });
            setRefreshKey(prev => prev + 1);
        } catch (err: any) {
            setToast({ message: err?.message || 'Error al registrar pago', type: 'error' });
        } finally {
            setPayingPlayer(null);
        }
    };

    const handleGiftPlayer = async (turnoJugadorId: string, nombre: string) => {
        if (!confirm(`¿Marcar como regalo la deuda de ${nombre}? No sumará a los ingresos.`)) return;
        setPayingPlayer(turnoJugadorId);
        try {
            await api.post('/pagos/gift', { turno_jugador_id: turnoJugadorId });
            setToast({ message: `Deuda de ${nombre} marcada como regalo`, type: 'success' });
            setRefreshKey(prev => prev + 1);
        } catch (err: any) {
            setToast({ message: err?.message || 'Error al registrar regalo', type: 'error' });
        } finally {
            setPayingPlayer(null);
        }
    };

    const handlePayAll = async (turnoId: string) => {
        if (!confirm('¿Registrar pago total de todos los jugadores de este turno?')) return;
        try {
            const result = await api.post<{ players_paid: number; total_paid: number }>('/pagos/pay-all', {
                turno_id: turnoId,
            });
            setToast({
                message: `${result.players_paid} jugador(es) pagados - Total: $${result.total_paid.toLocaleString('es-AR')}`,
                type: 'success'
            });
            setRefreshKey(prev => prev + 1);
        } catch (err: any) {
            setToast({ message: err?.message || 'Error al pagar todo', type: 'error' });
        }
    };

    const handlePurgeTurnos = async () => {
        setPurgingTurnos(true);
        try {
            const mes = purgeMonth + 1; // convert from 0-indexed
            const result = await api.delete<{ turnos_eliminados: number; pagos_eliminados: number }>(
                `/bookings/purge?mes=${mes}&anio=${purgeYear}`
            );
            setToast({
                message: `Depuración completada: ${result.turnos_eliminados} turnos y ${result.pagos_eliminados} pagos eliminados`,
                type: 'success'
            });
            setShowPurgeModal(false);
            setPurgeConfirmText('');
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            setToast({ message: 'Error al depurar turnos', type: 'error' });
        } finally {
            setPurgingTurnos(false);
        }
    };

    const formatFecha = (fecha: string) => {
        const parts = fecha.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const tipoPersonaLabel = (tipo: string) => {
        switch (tipo) {
            case 'socio': return 'Socio';
            case 'no_socio': return 'No Socio';
            case 'invitado': return 'Invitado';
            default: return tipo;
        }
    };

    const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentYear = new Date().getFullYear();
    const purgeYears = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);

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

            {/* Purge Modal */}
            {showPurgeModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }} onClick={() => setShowPurgeModal(false)}>
                    <div className="card glass animate-slide-up" style={{ maxWidth: '460px', width: '100%', padding: '28px' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#E74C3C', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={22} /> Depurar Turnos
                        </h2>

                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Mes</label>
                                <select
                                    value={purgeMonth}
                                    onChange={e => setPurgeMonth(parseInt(e.target.value))}
                                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                                >
                                    {MONTH_NAMES.map((name, i) => (
                                        <option key={i} value={i}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Año</label>
                                <select
                                    value={purgeYear}
                                    onChange={e => setPurgeYear(parseInt(e.target.value))}
                                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                                >
                                    {purgeYears.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{
                            background: 'rgba(243, 156, 18, 0.1)', border: '1px solid rgba(243, 156, 18, 0.3)',
                            borderRadius: '10px', padding: '14px', marginBottom: '16px'
                        }}>
                            <p style={{ fontSize: '0.85rem', color: '#D68910', fontWeight: '600', lineHeight: 1.5 }}>
                                <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                Esta acción eliminará <strong>todos los turnos, jugadores y pagos</strong> de {MONTH_NAMES[purgeMonth]} {purgeYear}. Esta operación es irreversible.
                            </p>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                                Escribí DEPURAR para confirmar
                            </label>
                            <input
                                type="text"
                                value={purgeConfirmText}
                                onChange={e => setPurgeConfirmText(e.target.value)}
                                placeholder="DEPURAR"
                                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { setShowPurgeModal(false); setPurgeConfirmText(''); }}
                                className="btn-secondary"
                                style={{ padding: '10px 18px', borderRadius: '10px', fontSize: '0.9rem' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handlePurgeTurnos}
                                disabled={purgeConfirmText !== 'DEPURAR' || purgingTurnos}
                                style={{
                                    padding: '10px 18px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '700',
                                    background: purgeConfirmText === 'DEPURAR' ? '#E74C3C' : '#ccc',
                                    color: 'white', border: 'none', cursor: purgeConfirmText === 'DEPURAR' ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                <Trash2 size={16} />
                                {purgingTurnos ? 'Depurando...' : 'Ejecutar Depuración'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN CONTENT AREA */}
            <main style={{ padding: '20px' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '2px' }}>Gestión de Turnos</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Reservas y aprobaciones</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            onClick={() => setShowPurgeModal(true)}
                            className="btn-secondary"
                            style={{ width: '38px', height: '38px', borderRadius: '10px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E74C3C' }}
                            title="Depurar turnos"
                        >
                            <Trash2 size={16} />
                        </button>
                        <button
                            onClick={() => setRefreshKey(prev => prev + 1)}
                            className="btn-secondary"
                            style={{ width: '38px', height: '38px', borderRadius: '10px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Refrescar"
                        >
                            <RefreshCw size={16} />
                        </button>
                        <button onClick={() => window.location.href = '/'} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.85rem' }}>
                            Vista Socios
                        </button>
                    </div>
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
                    <StatCard
                        title="Deuda Pendiente"
                        value={`$${totalDebt.toLocaleString('es-AR')}`}
                        icon={<DollarSign size={22} />}
                        color="orange"
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {(['pending', 'active', 'payments'] as const).map(view => (
                            <button
                                key={view}
                                onClick={() => setActiveView(view)}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '12px',
                                    background: activeView === view ? 'var(--text-main)' : 'var(--bg-main)',
                                    color: activeView === view ? 'white' : 'var(--text-main)',
                                    border: activeView === view ? 'none' : '1px solid var(--border)',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                {view === 'pending' ? 'Pendientes' : view === 'active' ? 'Activos' : 'Cobranzas'}
                            </button>
                        ))}
                    </div>
                    {activeView !== 'payments' && (
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
                    )}
                </div>

                {/* Filter Bar - only for pending/active views */}
                {activeView !== 'payments' && (
                    <div style={{
                        display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center'
                    }}>
                        <div style={{ position: 'relative', flex: '1', minWidth: '140px', maxWidth: '220px' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Buscar nombre..."
                                value={filterName}
                                onChange={e => setFilterName(e.target.value)}
                                style={{
                                    width: '100%', padding: '7px 10px 7px 30px', borderRadius: '10px',
                                    border: '1px solid var(--border)', fontSize: '0.85rem',
                                    background: 'rgba(255,255,255,0.6)', outline: 'none'
                                }}
                            />
                        </div>
                        <select
                            value={filterCourt}
                            onChange={e => setFilterCourt(e.target.value)}
                            style={{
                                padding: '7px 12px', borderRadius: '10px', border: '1px solid var(--border)',
                                fontSize: '0.85rem', background: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                                color: filterCourt ? 'var(--text-main)' : 'var(--text-muted)'
                            }}
                        >
                            <option value="">Todas las canchas</option>
                            {allCourts.map(c => (
                                <option key={c} value={String(c)}>{getCourtLabel(c)}</option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={filterDay}
                            onChange={e => setFilterDay(e.target.value)}
                            style={{
                                padding: '7px 12px', borderRadius: '10px', border: '1px solid var(--border)',
                                fontSize: '0.85rem', background: 'rgba(255,255,255,0.6)',
                                color: filterDay ? 'var(--text-main)' : 'var(--text-muted)'
                            }}
                        />
                        {(filterName || filterCourt || filterDay) && (
                            <button
                                onClick={() => { setFilterName(''); setFilterCourt(''); setFilterDay(''); }}
                                style={{
                                    padding: '7px 12px', borderRadius: '10px', border: '1px solid var(--border)',
                                    fontSize: '0.8rem', background: 'rgba(231,76,60,0.08)', color: '#E74C3C',
                                    cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                <X size={13} /> Limpiar
                            </button>
                        )}
                    </div>
                )}

                <section>
                    <div className="card glass" style={{ padding: '22px', minHeight: '480px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)' }}>
                                {activeView === 'pending' ? 'Centro de Aprobaciones' : activeView === 'active' ? 'Turnos Activos' : 'Cobranzas'}
                            </h2>
                            <span
                                className="badge"
                                style={{
                                    background: activeView === 'pending' ? 'var(--clay-orange-pastel)' : activeView === 'payments' ? 'rgba(39, 174, 96, 0.1)' : 'var(--brand-blue-pastel)',
                                    color: activeView === 'pending' ? 'var(--clay-orange)' : activeView === 'payments' ? '#27AE60' : 'var(--brand-blue)',
                                    fontWeight: '800'
                                }}
                            >
                                {activeView === 'pending'
                                    ? `${paginationPending.meta?.totalItems || 0} PENDIENTES`
                                    : activeView === 'active'
                                        ? `${paginationActive.meta?.totalItems || 0} ACTIVOS`
                                        : `${unpaidTurnos.length} CON DEUDA`
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

                            {activeView === 'payments' && unpaidTurnos.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '80px 20px', opacity: 0.6 }}>
                                    <div style={{ background: '#D4EFDF', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#27AE60' }}>
                                        <DollarSign size={30} />
                                    </div>
                                    <p style={{ fontWeight: '700', color: 'var(--text-main)' }}>Sin deudas pendientes</p>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Todos los turnos confirmados están pagados.</p>
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

                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {booking.costo > 0 && (
                                            <span style={{
                                                fontWeight: '800', fontSize: '0.9rem', color: '#27AE60',
                                                background: '#D4EFDF', padding: '4px 10px', borderRadius: '8px',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                ${booking.costo.toLocaleString('es-AR')}
                                            </span>
                                        )}
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

                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {booking.costo > 0 && (
                                            <span style={{
                                                fontWeight: '800', fontSize: '0.9rem', color: '#27AE60',
                                                background: '#D4EFDF', padding: '4px 10px', borderRadius: '8px',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                ${booking.costo.toLocaleString('es-AR')}
                                            </span>
                                        )}
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

                            {/* Cobranzas (Payments) View */}
                            {activeView === 'payments' && unpaidTurnos.map(turno => {
                                const isExpanded = expandedTurno === turno.turno_id;
                                return (
                                    <div key={turno.turno_id} style={{
                                        background: 'rgba(255,255,255,0.4)',
                                        borderRadius: '14px',
                                        border: '1px solid var(--border)',
                                        overflow: 'hidden'
                                    }}>
                                        {/* Turno header row */}
                                        <div
                                            onClick={() => setExpandedTurno(isExpanded ? null : turno.turno_id)}
                                            className="hover-scale"
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '10px 16px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                                <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                                                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                </div>
                                                <div style={{
                                                    width: '48px', height: '48px', borderRadius: '12px',
                                                    background: 'var(--brand-blue)', color: 'white',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <span style={{ fontSize: '0.5rem', fontWeight: '900', opacity: 0.8 }}>CANCHA</span>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: '900' }}>{turno.court_name}</span>
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '800', fontSize: '0.98rem', color: 'var(--text-main)' }}>
                                                        {formatFecha(turno.fecha)} • {turno.hora_inicio} hs
                                                    </div>
                                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                        {turno.players.length} jugador(es) con deuda
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <span style={{
                                                    fontWeight: '800', fontSize: '0.9rem', color: '#E74C3C',
                                                    background: 'rgba(231,76,60,0.1)', padding: '4px 10px', borderRadius: '8px',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    ${turno.total_pendiente.toLocaleString('es-AR')}
                                                </span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handlePayAll(turno.turno_id); }}
                                                    style={{
                                                        padding: '6px 12px', borderRadius: '10px', fontSize: '0.8rem',
                                                        fontWeight: '700', background: '#27AE60', color: 'white',
                                                        border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                                                        display: 'flex', alignItems: 'center', gap: '4px'
                                                    }}
                                                    title="Pagar todo"
                                                >
                                                    <DollarSign size={14} /> Pagar Todo
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded player details */}
                                        {isExpanded && (
                                            <div style={{
                                                borderTop: '1px solid var(--border)',
                                                padding: '12px 16px',
                                                background: 'rgba(0,0,0,0.02)'
                                            }}>
                                                {turno.players.map(player => (
                                                    <div key={player.turno_jugador_id} style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '10px 12px',
                                                        borderRadius: '10px',
                                                        background: 'rgba(255,255,255,0.6)',
                                                        marginBottom: '6px',
                                                        border: '1px solid rgba(0,0,0,0.04)',
                                                        flexWrap: 'wrap',
                                                        gap: '8px'
                                                    }}>
                                                        <div style={{ flex: '1', minWidth: '180px' }}>
                                                            <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-main)' }}>
                                                                {player.nombre}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px' }}>
                                                                <span style={{
                                                                    fontSize: '0.72rem', fontWeight: '600',
                                                                    padding: '2px 8px', borderRadius: '6px',
                                                                    background: player.tipo_persona === 'socio' ? 'var(--brand-blue-pastel)' : 'rgba(243,156,18,0.1)',
                                                                    color: player.tipo_persona === 'socio' ? 'var(--brand-blue)' : '#D68910'
                                                                }}>
                                                                    {tipoPersonaLabel(player.tipo_persona)}
                                                                </span>
                                                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                                    Debe: <strong style={{ color: '#E74C3C' }}>${player.saldo_pendiente.toLocaleString('es-AR')}</strong>
                                                                </span>
                                                                {player.total_pagado > 0 && (
                                                                    <span style={{ fontSize: '0.78rem', color: '#27AE60' }}>
                                                                        (pagó ${player.total_pagado.toLocaleString('es-AR')})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {player.estado_pago === 'pendiente' && (
                                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                <div style={{ position: 'relative' }}>
                                                                    <span style={{
                                                                        position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
                                                                        fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '700'
                                                                    }}>$</span>
                                                                    <input
                                                                        type="number"
                                                                        value={paymentAmounts[player.turno_jugador_id] ?? String(player.saldo_pendiente)}
                                                                        onChange={e => setPaymentAmounts(prev => ({
                                                                            ...prev,
                                                                            [player.turno_jugador_id]: e.target.value
                                                                        }))}
                                                                        style={{
                                                                            width: '100px', padding: '6px 8px 6px 22px', borderRadius: '8px',
                                                                            border: '1px solid var(--border)', fontSize: '0.85rem',
                                                                            background: 'rgba(255,255,255,0.8)', textAlign: 'right'
                                                                        }}
                                                                        min={0}
                                                                        max={player.saldo_pendiente}
                                                                        step={0.01}
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={() => handlePayPlayer(player.turno_jugador_id)}
                                                                    disabled={payingPlayer === player.turno_jugador_id}
                                                                    style={{
                                                                        padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem',
                                                                        fontWeight: '700', background: '#27AE60', color: 'white',
                                                                        border: 'none', cursor: 'pointer',
                                                                        opacity: payingPlayer === player.turno_jugador_id ? 0.6 : 1
                                                                    }}
                                                                >
                                                                    Cobrar
                                                                </button>
                                                                <button
                                                                    onClick={() => handleGiftPlayer(player.turno_jugador_id, player.nombre)}
                                                                    disabled={payingPlayer === player.turno_jugador_id}
                                                                    style={{
                                                                        padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem',
                                                                        fontWeight: '700', background: 'rgba(142, 68, 173, 0.1)', color: '#8E44AD',
                                                                        border: '1px solid rgba(142, 68, 173, 0.2)', cursor: 'pointer',
                                                                        display: 'flex', alignItems: 'center', gap: '4px',
                                                                        opacity: payingPlayer === player.turno_jugador_id ? 0.6 : 1
                                                                    }}
                                                                    title="Marcar como regalo"
                                                                >
                                                                    <Gift size={14} /> Regalo
                                                                </button>
                                                            </div>
                                                        )}

                                                        {player.estado_pago === 'pagado' && (
                                                            <span style={{
                                                                fontSize: '0.8rem', fontWeight: '700', color: '#27AE60',
                                                                background: '#D4EFDF', padding: '4px 10px', borderRadius: '8px'
                                                            }}>
                                                                Pagado
                                                            </span>
                                                        )}

                                                        {player.estado_pago === 'bonificado' && (
                                                            <span style={{
                                                                fontSize: '0.8rem', fontWeight: '700', color: '#8E44AD',
                                                                background: 'rgba(142, 68, 173, 0.1)', padding: '4px 10px', borderRadius: '8px'
                                                            }}>
                                                                Regalo
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
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

                        {activeView === 'payments' && unpaidTurnos.length > 0 && (
                            <PaginationControls
                                meta={paginationPayments.meta}
                                onPageChange={paginationPayments.goToPage}
                                onNext={paginationPayments.nextPage}
                                onPrevious={paginationPayments.previousPage}
                                onFirst={paginationPayments.firstPage}
                                onLast={paginationPayments.lastPage}
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
