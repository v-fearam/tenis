import { useState, useEffect } from 'react';
import { Check, X, Clock, User, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import logo from '../assets/logo.jpg';

interface Booking {
    id: string;
    court_id: number;
    start_time: string;
    status: string;
    type: string;
    booking_players: any[];
}

export default function AdminDashboard() {
    const { logout } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<Booking[]>('/bookings')
            .then(data => {
                setBookings(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching bookings:', err);
                setLoading(false);
            });
    }, []);

    const handleConfirm = async (id: string) => {
        try {
            await api.patch(`/bookings/${id}/confirm`, {});
            setBookings(bookings.map(b => b.id === id ? { ...b, status: 'confirmed' } : b));
            alert('Reserva confirmada. Se ha generado la deuda correspondiente.');
        } catch (err) {
            console.error(err);
            alert('Error al confirmar reserva');
        }
    };

    const handleCancel = async (id: string) => {
        try {
            await api.patch(`/bookings/${id}/cancel`, {});
            setBookings(bookings.filter(b => b.id !== id));
            alert('Reserva rechazada.');
        } catch (err) {
            console.error(err);
            alert('Error al cancelar reserva');
        }
    };

    if (loading) return <div className="container">Cargando dashboard...</div>;

    return (
        <div className="container">
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <img
                        src={logo}
                        alt="Club Belgrano Logo"
                        style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--brand-blue-pastel)' }}
                    />
                    <div>
                        <h1 style={{ color: 'var(--brand-blue)', fontSize: '1.5rem', fontWeight: '800' }}>PANEL DE ADMINISTRACIÓN</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Gestión de Reservas y Canchas</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        className="btn-secondary"
                        onClick={() => window.location.href = '/admin/users'}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Users size={16} /> Usuarios
                    </button>
                    <button className="btn-secondary" onClick={() => window.location.href = '/'}>Volver al Inicio</button>
                    <button className="btn-secondary" onClick={logout} style={{ color: '#E74C3C' }}>Cerrar Sesión</button>
                </div>
            </header>

            <div className="card glass">
                <h2 style={{ marginBottom: '24px', fontSize: '1.25rem' }}>Reservas Pendientes</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {bookings.filter(b => b.status === 'pending').length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No hay reservas pendientes.</p>
                    ) : (
                        bookings.filter(b => b.status === 'pending').map(booking => (
                            <div key={booking.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <span style={{
                                            background: 'var(--brand-blue-pastel)', color: 'var(--brand-blue)',
                                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700'
                                        }}>CANCHA {booking.court_id}</span>
                                        <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>
                                            {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '15px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={14} /> 90 min
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <User size={14} /> {booking.type === 'single' ? 'Individual' : 'Dobles'}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => handleCancel(booking.id)}
                                        className="btn-secondary"
                                        style={{ padding: '8px 12px', background: '#FADBD8', color: '#E74C3C' }}
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleConfirm(booking.id)}
                                        className="btn-primary"
                                        style={{ padding: '8px 12px', background: '#D4EFDF', color: '#27AE60' }}
                                    >
                                        <Check size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
