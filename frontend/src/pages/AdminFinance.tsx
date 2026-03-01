import { useState, useEffect, useMemo } from 'react';
import {
    Calendar, Search
} from 'lucide-react';
import { api } from '../lib/api';
import { Toast, type ToastType } from '../components/Toast';
import { formatDateToDDMMYYYY, formatTimeToAR } from '../lib/dateUtils';
import { usePagination } from '../hooks/usePagination';
import PaginationControls from '../components/PaginationControls';

interface Booking {
    id: string;
    court_id: number;
    start_time: string;
    status: string;
    type: string;
    solicitante_nombre: string;
    booking_players: any[];
}

export default function AdminFinance() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'confirmed' | 'pending' | 'cancelled'>('all');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const pagination = usePagination();

    useEffect(() => {
        const fetchBookings = async () => {
            try {
                // Endpoint now returns paginated response: { data: [], meta: {} }
                // Use large pageSize to get all results for filtering
                const response = await api.get<{ data: Booking[] }>('/bookings?pageSize=1000');
                const data = response.data || [];
                setBookings(data);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching bookings:', err);
                setLoading(false);
            }
        };
        fetchBookings();
    }, []);

    const filteredBookings = bookings.filter(b => {
        const matchesSearch = b.solicitante_nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || b.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    // Update pagination meta when filtered data changes (must be in useEffect, not useMemo)
    useEffect(() => {
        const totalPages = Math.ceil(filteredBookings.length / pagination.pageSize) || 1;
        pagination.setMeta({
            currentPage: pagination.page,
            pageSize: pagination.pageSize,
            totalItems: filteredBookings.length,
            totalPages,
            hasNextPage: pagination.page < totalPages,
            hasPreviousPage: pagination.page > 1,
        });
    }, [filteredBookings.length, pagination.page, pagination.pageSize]);

    // Client-side pagination
    const paginatedBookings = useMemo(() => {
        const startIndex = (pagination.page - 1) * pagination.pageSize;
        const endIndex = startIndex + pagination.pageSize;
        return filteredBookings.slice(startIndex, endIndex);
    }, [filteredBookings, pagination.page, pagination.pageSize]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'confirmed':
                return <span className="badge" style={{ background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7' }}>Pagado / Confirmado</span>;
            case 'pending':
                return <span className="badge" style={{ background: '#FFF3E0', color: '#EF6C00', border: '1px solid #FFCC80' }}>Pendiente</span>;
            case 'cancelled':
                return <span className="badge" style={{ background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2' }}>Cancelado</span>;
            default:
                return <span className="badge">{status}</span>;
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <main style={{ padding: '40px' }}>
                <header style={{ marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-1px', marginBottom: '4px' }}>Finanzas</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Control de pagos y estado financiero de turnos</p>
                </header>

                <div className="card glass" style={{ padding: '24px', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Buscar por socio..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%', padding: '12px 12px 12px 48px', borderRadius: '14px',
                                    border: '1px solid var(--border)', background: 'var(--bg-main)',
                                    fontSize: '0.95rem'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}
                                style={{ borderRadius: '12px', padding: '10px 16px' }}
                            >
                                Todos
                            </button>
                            <button
                                onClick={() => setFilterStatus('confirmed')}
                                className={filterStatus === 'confirmed' ? 'btn-primary' : 'btn-secondary'}
                                style={{ borderRadius: '12px', padding: '10px 16px' }}
                            >
                                Confirmados
                            </button>
                            <button
                                onClick={() => setFilterStatus('pending')}
                                className={filterStatus === 'pending' ? 'btn-primary' : 'btn-secondary'}
                                style={{ borderRadius: '12px', padding: '10px 16px' }}
                            >
                                Pendientes
                            </button>
                        </div>
                    </div>
                </div>

                <div className="card glass" style={{ overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)' }}>
                                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '700' }}>FECHA Y HORA</th>
                                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '700' }}>SOCIO / SOLICITANTE</th>
                                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '700' }}>ESTADO</th>
                                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '700' }}>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando datos...</td>
                                </tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron registros.</td>
                                </tr>
                            ) : (
                                paginatedBookings.map((booking) => (
                                    <tr key={booking.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-highlight">
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Calendar size={16} color="var(--brand-blue)" />
                                                <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                                                    {formatDateToDDMMYYYY(booking.start_time)}
                                                </span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    {formatTimeToAR(booking.start_time)} hs
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '28px', height: '28px', borderRadius: '50%', background: 'var(--brand-blue-pastel)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-blue)', fontSize: '0.75rem', fontWeight: '800'
                                                }}>
                                                    {booking.solicitante_nombre.charAt(0)}
                                                </div>
                                                <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{booking.solicitante_nombre}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            {getStatusBadge(booking.status)}
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}>
                                                Ver Detalles
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredBookings.length > 0 && (
                    <PaginationControls
                        meta={pagination.meta}
                        onPageChange={pagination.goToPage}
                        onNext={pagination.nextPage}
                        onPrevious={pagination.previousPage}
                        onFirst={pagination.firstPage}
                        onLast={pagination.lastPage}
                    />
                )}
            </main>
        </div>
    );
}
