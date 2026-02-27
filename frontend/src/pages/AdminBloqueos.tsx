import { useState, useEffect } from 'react';
import {
    Clock, Trash2, Plus, Copy,
    Info, ShieldAlert,
    Save, X
} from 'lucide-react';
import { api } from '../lib/api';
import { Toast, type ToastType } from '../components/Toast';
import { formatDateToDDMMYYYY } from '../lib/dateUtils';
import DateInputDDMMYYYY from '../components/DateInputDDMMYYYY';
import { usePagination } from '../hooks/usePagination';
import type { PaginatedResponse } from '../types/pagination';
import PaginationControls from '../components/PaginationControls';

interface Bloqueo {
    id: string;
    id_cancha: number;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    tipo: 'torneo' | 'clase' | 'mantenimiento' | 'otro';
    descripcion?: string;
    canchas?: { nombre: string };
}

export default function AdminBloqueos() {
    const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [isExplaining, setIsExplaining] = useState(false);

    const pagination = usePagination();

    const [dateFrom, setDateFrom] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(() => {
        const in30Days = new Date();
        in30Days.setDate(in30Days.getDate() + 30);
        return in30Days.toISOString().split('T')[0];
    });

    const filterBloqueosByDate = (bloqueos: Bloqueo[]) => {
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        return bloqueos.filter(b => {
            const bloqueoDate = new Date(b.fecha + 'T12:00:00');
            return bloqueoDate >= from && bloqueoDate <= to;
        });
    };

    const filteredBloqueos = filterBloqueosByDate(bloqueos);

    // Form State
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        id_cancha: 1,
        tipo: 'mantenimiento',
        fecha: new Date().toISOString().split('T')[0],
        fecha_fin: '',
        hora_inicio: '08:00',
        hora_fin: '22:00',
        descripcion: ''
    });

    const fetchBloqueos = async () => {
        try {
            const params = pagination.getQueryParams();
            const response = await api.get<PaginatedResponse<Bloqueo>>(
                `/bloqueos?page=${params.page}&pageSize=${params.pageSize}`
            );
            setBloqueos(response.data);
            pagination.setMeta(response.meta);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching bloqueos:', err);
            setToast({ message: 'Error al cargar bloqueos', type: 'error' });
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBloqueos();
    }, [pagination.page]);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este bloqueo?')) return;
        try {
            await api.delete(`/bloqueos/${id}`);
            setBloqueos(bloqueos.filter(b => b.id !== id));
            setToast({ message: 'Bloqueo eliminado', type: 'success' });
        } catch (err) {
            setToast({ message: 'Error al eliminar', type: 'error' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/bloqueos', formData);
            setToast({ message: formData.fecha_fin ? 'Bloqueos creados en el período' : 'Bloqueo creado con éxito', type: 'success' });
            setIsCreating(false);
            fetchBloqueos();
            // Reset form
            setFormData({
                id_cancha: 1,
                tipo: 'mantenimiento',
                fecha: new Date().toISOString().split('T')[0],
                fecha_fin: '',
                hora_inicio: '08:00',
                hora_fin: '22:00',
                descripcion: ''
            });
        } catch (err) {
            setToast({ message: 'Error al crear bloqueo', type: 'error' });
        }
    };

    const handleDuplicate = (b: Bloqueo) => {
        setFormData({
            ...formData,
            id_cancha: b.id_cancha,
            tipo: b.tipo,
            hora_inicio: b.hora_inicio.substring(0, 5),
            hora_fin: b.hora_fin.substring(0, 5),
            descripcion: b.descripcion || '',
            fecha: new Date().toISOString().split('T')[0],
            fecha_fin: ''
        });
        setIsCreating(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="container">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div>
                        <h1 style={{ color: 'var(--brand-blue)', fontSize: '2rem', fontWeight: '800' }}>GESTIÓN DE BLOQUEOS</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Cierre de canchas por mantenimiento, torneos o clases.</p>
                    </div>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => setIsCreating(!isCreating)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    {isCreating ? <X size={20} /> : <Plus size={20} />}
                    {isCreating ? 'Cancelar' : 'Nuevo Bloqueo'}
                </button>
            </header>

            {isCreating && (
                <section className="animate-slide-up" style={{ marginBottom: '40px' }}>
                    <div className="card glass" style={{ padding: '30px', border: '1px solid var(--brand-blue-pastel)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--brand-blue)' }}>Configurar Bloqueo</h2>
                            <button
                                onClick={() => setIsExplaining(!isExplaining)}
                                style={{ background: 'none', border: 'none', color: 'var(--brand-blue)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                            >
                                <Info size={16} /> {isExplaining ? 'Ocultar ayuda' : '¿Cómo funciona el periodo?'}
                            </button>
                        </div>

                        {isExplaining && (
                            <div className="badge" style={{ padding: '12px', background: 'var(--brand-blue-pastel)', color: 'var(--brand-blue)', marginBottom: '20px', borderRadius: 'var(--radius-sm)', lineHeight: '1.5' }}>
                                <ShieldAlert size={16} style={{ marginBottom: '4px' }} /> <br />
                                Si completas el campo <strong>Fecha Hasta</strong>, el sistema creará un bloqueo individual para cada día entre la fecha inicial y la final, respetando el mismo horario en cada día. Esto te permite editar o borrar días específicos del periodo más tarde si lo necesitas.
                            </div>
                        )}

                        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                            <div className="form-group">
                                <label>Cancha</label>
                                <select
                                    value={formData.id_cancha}
                                    onChange={e => setFormData({ ...formData, id_cancha: parseInt(e.target.value) })}
                                    style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                                >
                                    <option value={1}>Cancha 1</option>
                                    <option value={2}>Cancha 2</option>
                                    <option value={3}>Cancha 3</option>
                                    <option value={4}>Cancha 4</option>
                                    <option value={5}>Cancha 5</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Tipo de Bloqueo</label>
                                <select
                                    value={formData.tipo}
                                    onChange={e => setFormData({ ...formData, tipo: e.target.value as any })}
                                    style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                                >
                                    <option value="mantenimiento">Mantenimiento</option>
                                    <option value="torneo">Torneo</option>
                                    <option value="clase">Clase</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <DateInputDDMMYYYY
                                    value={formData.fecha}
                                    onChange={fecha => setFormData({ ...formData, fecha })}
                                    label="Fecha Inicio (o única)"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <DateInputDDMMYYYY
                                    value={formData.fecha_fin}
                                    onChange={fecha_fin => setFormData({ ...formData, fecha_fin })}
                                    label="Fecha Hasta (Opcional)"
                                    min={formData.fecha}
                                />
                            </div>

                            <div className="form-group">
                                <label>Desde (Hora)</label>
                                <input
                                    type="time"
                                    value={formData.hora_inicio}
                                    onChange={e => setFormData({ ...formData, hora_inicio: e.target.value })}
                                    required
                                    style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                                />
                            </div>

                            <div className="form-group">
                                <label>Hasta (Hora)</label>
                                <input
                                    type="time"
                                    value={formData.hora_fin}
                                    onChange={e => setFormData({ ...formData, hora_fin: e.target.value })}
                                    required
                                    style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                                />
                            </div>

                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Descripción / Motivo</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Pintura de líneas, Torneo Nacional Sub-14"
                                    value={formData.descripcion}
                                    onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                                />
                            </div>

                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 24px' }}>
                                    <Save size={20} />
                                    Guardar Bloqueo(s)
                                </button>
                            </div>
                        </form>
                    </div>
                </section>
            )}

            <main>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
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

                <div className="card" style={{ minHeight: '400px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--brand-blue)' }}>Bloqueos Registrados</h2>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{filteredBloqueos.length} de {bloqueos.length}</span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--brand-blue-pastel)' }}>
                                    <th style={{ textAlign: 'left', padding: '15px', color: 'var(--brand-blue)' }}>Cancha</th>
                                    <th style={{ textAlign: 'left', padding: '15px', color: 'var(--brand-blue)' }}>Fecha</th>
                                    <th style={{ textAlign: 'left', padding: '15px', color: 'var(--brand-blue)' }}>Horario</th>
                                    <th style={{ textAlign: 'left', padding: '15px', color: 'var(--brand-blue)' }}>Tipo</th>
                                    <th style={{ textAlign: 'left', padding: '15px', color: 'var(--brand-blue)' }}>Descripción</th>
                                    <th style={{ textAlign: 'center', padding: '15px', color: 'var(--brand-blue)' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>Cargando bloqueos...</td></tr>
                                ) : filteredBloqueos.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No hay bloqueos en este período.</td></tr>
                                ) : (
                                    filteredBloqueos.map(b => (
                                        <tr key={b.id} className="hover-scale" style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '15px', fontWeight: '700' }}>{b.canchas?.nombre || `Cancha ${b.id_cancha}`}</td>
                                            <td style={{ padding: '15px' }}>
                                                {formatDateToDDMMYYYY(b.fecha)}
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={14} style={{ opacity: 0.6 }} />
                                                    {b.hora_inicio.substring(0, 5)} - {b.hora_fin.substring(0, 5)}
                                                </div>
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <span className="badge" style={{
                                                    background: b.tipo === 'torneo' ? '#D4EFDF' : b.tipo === 'mantenimiento' ? '#FADBD8' : 'var(--bg-main)',
                                                    color: b.tipo === 'torneo' ? '#1E8449' : b.tipo === 'mantenimiento' ? '#A93226' : 'var(--text-muted)',
                                                    fontSize: '0.75rem',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {b.tipo}
                                                </span>
                                            </td>
                                            <td style={{ padding: '15px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{b.descripcion || '-'}</td>
                                            <td style={{ padding: '15px' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                    <button
                                                        onClick={() => handleDuplicate(b)}
                                                        className="btn-secondary"
                                                        style={{ padding: '8px', color: 'var(--brand-blue)' }}
                                                        title="Duplicar"
                                                    >
                                                        <Copy size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(b.id)}
                                                        className="btn-secondary"
                                                        style={{ padding: '8px', color: '#E74C3C' }}
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <PaginationControls
                        meta={pagination.meta}
                        onPageChange={pagination.goToPage}
                        onNext={pagination.nextPage}
                        onPrevious={pagination.previousPage}
                        onFirst={pagination.firstPage}
                        onLast={pagination.lastPage}
                    />
                </div>
            </main>
        </div>
    );
}
