import { useState, useEffect } from 'react';
import {
    CreditCard, User, Calendar,
    CheckCircle2, Plus, Search,
    ArrowRight, Info, TrendingUp
} from 'lucide-react';
import { api } from '../lib/api';
import { Toast, type ToastType } from '../components/Toast';

interface Abono {
    id: string;
    id_socio: string;
    tipo: string;
    mes_anio: string;
    creditos_totales: number;
    creditos_disponibles: number;
    precio_lista_mes: number;
    activo: boolean;
}

interface Socio {
    id: string;
    nro_socio: number;
    usuario: {
        id: string;
        nombre: string;
        email: string;
    };
    currentAbono?: Abono;
}

const ABONO_TYPES = [
    { id: 'Basico', label: 'Básico', turns: 4, price: 15000, color: '#3498DB' },
    { id: 'Intermedio', label: 'Intermedio', turns: 6, price: 20000, color: '#9B59B6' },
    { id: 'Avanzado', label: 'Avanzado', turns: 20, price: 30000, color: '#F1C40F' }
];

export default function AdminAbonos() {
    const [socios, setSocios] = useState<Socio[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [assigningTo, setAssigningTo] = useState<Socio | null>(null);

    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

    const fetchData = async () => {
        try {
            const [sociosData, abonosData] = await Promise.all([
                api.get<any[]>('/users'),
                api.get<Abono[]>('/abonos')
            ]);

            // Filter only users with socio role and map them
            const mappedSocios = sociosData
                .filter(u => u.rol === 'socio' && u.socios?.length > 0)
                .map(u => ({
                    id: u.socios[0].id,
                    nro_socio: u.socios[0].nro_socio,
                    usuario: {
                        id: u.id,
                        nombre: u.nombre,
                        email: u.email
                    },
                    currentAbono: abonosData.find(a => a.id_socio === u.socios[0].id && a.mes_anio === currentMonth && a.activo)
                }));

            setSocios(mappedSocios);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAssign = async (socioId: string, type: string) => {
        try {
            await api.post('/abonos/assign', {
                socio_id: socioId,
                tipo: type,
                mes_anio: currentMonth
            });
            setToast({ message: 'Abono asignado correctamente', type: 'success' });
            setAssigningTo(null);
            fetchData();
        } catch (err: any) {
            setToast({ message: err.message || 'Error al asignar abono', type: 'error' });
        }
    };

    const filteredSocios = socios.filter(s =>
        s.usuario.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.usuario.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nro_socio.toString().includes(searchTerm)
    );

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <main style={{ padding: '40px' }}>
                <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-1px', marginBottom: '4px' }}>Gestión de Abonos</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Suscripciones mensuales y control de turnos</p>
                    </div>
                    <div style={{ background: 'var(--brand-blue-pastel)', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--brand-blue-alpha)' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--brand-blue)', textTransform: 'uppercase', marginBottom: '4px' }}>Mes Actual</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={18} />
                            {new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                </header>

                <div className="card glass" style={{ padding: '24px', marginBottom: '32px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, email o nro de socio..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="form-input"
                            style={{ paddingLeft: '48px' }}
                        />
                    </div>
                </div>

                <div className="card glass" style={{ overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Socio</th>
                                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Estado Abono</th>
                                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Créditos</th>
                                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSocios.map(socio => (
                                <tr key={socio.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--brand-blue-pastel)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-blue)', fontWeight: '800' }}>
                                                {socio.usuario.nombre.charAt(0)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '700' }}>{socio.usuario.nombre}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Socio #{socio.nro_socio}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        {socio.currentAbono ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700',
                                                    background: ABONO_TYPES.find(t => t.id === socio.currentAbono?.tipo)?.color + '22',
                                                    color: ABONO_TYPES.find(t => t.id === socio.currentAbono?.tipo)?.color,
                                                    border: `1px solid ${ABONO_TYPES.find(t => t.id === socio.currentAbono?.tipo)?.color}44`
                                                }}>
                                                    {socio.currentAbono.tipo}
                                                </div>
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin abono activo</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        {socio.currentAbono ? (
                                            <div style={{ width: '120px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                                    <span>Uso</span>
                                                    <span style={{ fontWeight: '700' }}>
                                                        {socio.currentAbono.creditos_totales - socio.currentAbono.creditos_disponibles}/{socio.currentAbono.creditos_totales}
                                                    </span>
                                                </div>
                                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: `${((socio.currentAbono.creditos_totales - socio.currentAbono.creditos_disponibles) / socio.currentAbono.creditos_totales) * 100}%`,
                                                        background: 'var(--brand-blue)',
                                                        transition: 'width 0.5s ease'
                                                    }} />
                                                </div>
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        {assigningTo?.id === socio.id ? (
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                {ABONO_TYPES.map(type => (
                                                    <button
                                                        key={type.id}
                                                        onClick={() => handleAssign(socio.id, type.id)}
                                                        className="btn-primary"
                                                        style={{
                                                            padding: '6px 12px',
                                                            fontSize: '0.75rem',
                                                            background: type.color
                                                        }}
                                                        title={`${type.turns} turnos - $${type.price}`}
                                                    >
                                                        {type.label}
                                                    </button>
                                                ))}
                                                <button onClick={() => setAssigningTo(null)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>✕</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setAssigningTo(socio)}
                                                className="btn-primary"
                                                style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                            >
                                                <Plus size={16} />
                                                {socio.currentAbono ? 'Cambiar Plan' : 'Cargar Abono'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredSocios.length === 0 && !loading && (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Search size={40} style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <p>No se encontraron socios con los criterios de búsqueda.</p>
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                    {ABONO_TYPES.map(type => (
                        <div key={type.id} className="card glass" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '80px', height: '80px', background: type.color, opacity: 0.1, borderRadius: '50%' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                <div style={{ padding: '10px', borderRadius: '12px', background: type.color + '22', color: type.color }}>
                                    <TrendingUp size={24} />
                                </div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Abono {type.label}</h3>
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)' }}>
                                    ${type.price.toLocaleString()}
                                    <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: '500' }}>/mes</span>
                                </div>
                            </div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)', marginBottom: '12px' }}>
                                    <CheckCircle2 size={18} style={{ color: 'var(--brand-green)' }} />
                                    <span><strong>{type.turns}</strong> turnos incluidos por mes</span>
                                </li>
                                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)', marginBottom: '12px' }}>
                                    <CheckCircle2 size={18} style={{ color: 'var(--brand-green)' }} />
                                    <span>Acceso a todas las canchas</span>
                                </li>
                                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)' }}>
                                    <CheckCircle2 size={18} style={{ color: 'var(--brand-green)' }} />
                                    <span>Prioridad en reservas</span>
                                </li>
                            </ul>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
