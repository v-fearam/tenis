import { useState, useEffect } from 'react';
import Calendar from '../components/Calendar';
import BookingForm from '../components/BookingForm';
import { MatchType } from '../types/booking';
import { supabase } from '../lib/supabase';
import '../index.css';
import logo from '../assets/logo.jpg';

export default function Reserve() {
    const [bookingData, setBookingData] = useState<{ courtId: number; slot: string } | null>(null);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        fetchUser();
    }, []);

    const handleSubmitBooking = async (details: { type: MatchType; players: any[] }) => {
        if (!bookingData) return;

        try {
            console.log('Submitting booking...', { ...bookingData, ...details });
            alert('Reserva enviada exitosamente. Pendiente de confirmación por el administrador.');
            setBookingData(null);
        } catch (error) {
            console.error('Error submitting booking:', error);
            alert('Error al procesar la reserva. Intente nuevamente.');
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    return (
        <div className="container">
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
                <div style={{ textAlign: 'right' }}>
                    <div className="card-value" style={{ fontSize: '1.2rem' }}>
                        Hola, {user?.email?.split('@')[0] || 'Socio'}!
                    </div>
                    <p
                        style={{ color: 'var(--brand-blue)', fontWeight: '600', cursor: 'pointer' }}
                        onClick={handleLogout}
                    >
                        Cerrar Sesión
                    </p>
                </div>
            </header>

            {/* Header Metrics */}
            <div className="header-grid">
                <div className="card card-accent-blue">
                    <div className="card-title">Próximo Partido</div>
                    <div className="card-value">Hoy 18:30</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Cancha 2 • Dobles</p>
                </div>
                <div className="card card-accent-orange">
                    <div className="card-title">Cuenta Corriente</div>
                    <div className="card-value" style={{ color: '#E74C3C' }}>$2.500 SAR</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Deuda pendiente</p>
                </div>
                <div className="card card-accent-blue">
                    <div className="card-title">Abono Restante</div>
                    <div className="card-value">5 / 10</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Partidos mens. disponibles</p>
                </div>
                <div className="card card-accent-orange">
                    <div className="card-title">Canchas Libres</div>
                    <div className="card-value">3 / 5</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Disponibles ahora</p>
                </div>
            </div>

            <main style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
                <section>
                    <div className="card glass" style={{ minHeight: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Reservar Cancha</h2>
                        </div>

                        <Calendar onConfirm={(courtId, slot) => setBookingData({ courtId, slot })} />
                    </div>
                </section>

                <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="card">
                        <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Accesos Rápidos</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '500' }}>→ Mis Facturas</div>
                            <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '500' }}>→ Cargar Créditos</div>
                            <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '500' }}>→ Reglamento del Club</div>
                        </div>
                    </div>

                    <div className="card" style={{ background: 'var(--clay-orange-pastel)', borderColor: 'transparent' }}>
                        <h3 style={{ color: '#A04000', marginBottom: '8px' }}>Estado del Polvo</h3>
                        <p style={{ color: '#BA4A00', fontSize: '0.9rem' }}>Las canchas 1 y 2 se encuentran en mantenimiento por riego hasta las 17:00 hs.</p>
                    </div>
                </aside>
            </main>
        </div>
    );
}
