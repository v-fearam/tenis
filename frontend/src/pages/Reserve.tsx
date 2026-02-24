import Calendar from '../components/Calendar';
import './index.css';

export default function Reserve() {
    return (
        <div className="container">
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ color: 'var(--brand-blue)', fontSize: '2rem', fontWeight: '800' }}>CLUB BELGRANO</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Tenis Management System</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="card-value" style={{ fontSize: '1.2rem' }}>Hola, Socio!</div>
                    <p style={{ color: 'var(--brand-blue)', fontWeight: '600', cursor: 'pointer' }}>Cerrar Sesión</p>
                </div>
            </header>

            {/* Header Metrics - Inspired by "Your Account" in reference */}
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
                {/* Main Booking Area */}
                <section>
                    <div className="card glass" style={{ minHeight: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Reservar Cancha</h2>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn-secondary" style={{ padding: '8px 16px' }}>Anterior</button>
                                <button className="btn-secondary" style={{ padding: '8px 16px' }}>Siguiente</button>
                            </div>
                        </div>

                        <Calendar />

                        <div style={{ marginTop: '24px', display: 'flex', gap: '15px' }}>
                            <button className="btn-primary" style={{ flex: 1 }}>Confirmar Reserva</button>
                            <button className="btn-secondary" style={{ flex: 1 }}>Ver Disponibilidad Semanal</button>
                        </div>
                    </div>
                </section>

                {/* Sidebar - Inspired by "Quick Links" */}
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
