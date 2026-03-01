import { useState, useEffect } from 'react';
import {
    Clock, Trash2, Plus, Copy,
    Info, ShieldAlert, AlertTriangle,
    Save, X
} from 'lucide-react';
import { api } from '../lib/api';
import { Toast, type ToastType } from '../components/Toast';
import { formatDateToDDMMYYYY, todayAR } from '../lib/dateUtils';
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
        return todayAR();
    });
    const [dateTo, setDateTo] = useState(() => {
        const in30Days = new Date();
        in30Days.setDate(in30Days.getDate() + 30);
        return new Date(in30Days.getTime()).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    });

    const filteredBloqueos = bloqueos;

    // Purge state
    const [showPurgeModal, setShowPurgeModal] = useState(false);
    const [purgeMonth, setPurgeMonth] = useState(new Date().getMonth());
    const [purgeYear, setPurgeYear] = useState(new Date().getFullYear() - 1);
    const [purgeConfirmText, setPurgeConfirmText] = useState('');
    const [purgingBloqueos, setPurgingBloqueos] = useState(false);

    // Courts from API
    const [courts, setCourts] = useState<{ id: number; nombre: string }[]>([]);

    // Form State
    const [isCreating, setIsCreating] = useState(false);
    const [allDay, setAllDay] = useState(false);
    const [allCourts, setAllCourts] = useState(false);
    const [formData, setFormData] = useState({
        id_cancha: 1,
        tipo: 'mantenimiento',
        fecha: todayAR(),
        fecha_fin: '',
        hora_inicio: '08:00',
        hora_fin: '22:00',
        descripcion: ''
    });

    const fetchBloqueos = async () => {
        try {
            const params = pagination.getQueryParams();
            const response = await api.get<PaginatedResponse<Bloqueo>>(
                `/bloqueos?page=${params.page}&pageSize=${params.pageSize}&fecha_desde=${dateFrom}&fecha_hasta=${dateTo}`
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
    }, [pagination.page, dateFrom, dateTo]);

    useEffect(() => {
        api.get<{ id: number; nombre: string }[]>('/canchas')
            .then(data => setCourts(data))
            .catch(() => setCourts([
                { id: 1, nombre: 'Cancha 1' }, { id: 2, nombre: 'Cancha 2' },
                { id: 3, nombre: 'Cancha 3' }, { id: 4, nombre: 'Cancha 4' },
                { id: 5, nombre: 'Cancha 5' }
            ]));
    }, []);

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
            const payload = {
                ...formData,
                hora_inicio: allDay ? '00:00' : formData.hora_inicio,
                hora_fin: allDay ? '23:59' : formData.hora_fin,
            };

            const courtIds = allCourts
                ? courts.map(c => c.id)
                : [formData.id_cancha];

            await Promise.all(
                courtIds.map(id =>
                    api.post('/bloqueos', { ...payload, id_cancha: id })
                )
            );

            const msg = allCourts
                ? `Bloqueos creados para ${courtIds.length} canchas`
                : formData.fecha_fin
                    ? 'Bloqueos creados en el período'
                    : 'Bloqueo creado con éxito';
            setToast({ message: msg, type: 'success' });
            setIsCreating(false);
            setAllDay(false);
            setAllCourts(false);
            fetchBloqueos();
            setFormData({
                id_cancha: 1,
                tipo: 'mantenimiento',
                fecha: todayAR(),
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
        const isFullDay = b.hora_inicio.startsWith('00:00') && (b.hora_fin.startsWith('23:59') || b.hora_fin.startsWith('23:30'));
        setAllDay(isFullDay);
        setAllCourts(false);
        setFormData({
            ...formData,
            id_cancha: b.id_cancha,
            tipo: b.tipo,
            hora_inicio: b.hora_inicio.substring(0, 5),
            hora_fin: b.hora_fin.substring(0, 5),
            descripcion: b.descripcion || '',
            fecha: todayAR(),
            fecha_fin: ''
        });
        setIsCreating(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePurgeBloqueos = async () => {
        setPurgingBloqueos(true);
        try {
            const mes = purgeMonth + 1;
            const result = await api.delete<{ bloqueos_eliminados: number }>(
                `/bloqueos/purge?mes=${mes}&anio=${purgeYear}`
            );
            setToast({
                message: `Depuración completada: ${result.bloqueos_eliminados} bloqueos eliminados`,
                type: 'success'
            });
            setShowPurgeModal(false);
            setPurgeConfirmText('');
            fetchBloqueos();
        } catch (err) {
            setToast({ message: 'Error al depurar bloqueos', type: 'error' });
        } finally {
            setPurgingBloqueos(false);
        }
    };

    const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentYear = new Date().getFullYear();
    const purgeYears = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);

    return (
        <div className="container">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Purge Modal */}
            {showPurgeModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }} onClick={() => setShowPurgeModal(false)}>
                    <div className="card glass animate-slide-up" style={{ maxWidth: '460px', width: '100%', padding: '28px' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#E74C3C', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={22} /> Depurar Bloqueos
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
                                Esta acción eliminará <strong>todos los bloqueos</strong> de {MONTH_NAMES[purgeMonth]} {purgeYear}. Esta operación es irreversible.
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
                                onClick={handlePurgeBloqueos}
                                disabled={purgeConfirmText !== 'DEPURAR' || purgingBloqueos}
                                style={{
                                    padding: '10px 18px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '700',
                                    background: purgeConfirmText === 'DEPURAR' ? '#E74C3C' : '#ccc',
                                    color: 'white', border: 'none', cursor: purgeConfirmText === 'DEPURAR' ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                <Trash2 size={16} />
                                {purgingBloqueos ? 'Depurando...' : 'Ejecutar Depuración'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ color: 'var(--brand-blue)', fontSize: '1.4rem', fontWeight: '800' }}>Gestión de Bloqueos</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cierre de canchas por mantenimiento, torneos o clases</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={() => setShowPurgeModal(true)}
                        className="btn-secondary"
                        style={{ width: '38px', height: '38px', borderRadius: '10px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E74C3C' }}
                        title="Depurar bloqueos"
                    >
                        <Trash2 size={16} />
                    </button>
                    <button
                        className="btn-primary"
                        onClick={() => setIsCreating(!isCreating)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {isCreating ? <X size={20} /> : <Plus size={20} />}
                        {isCreating ? 'Cancelar' : 'Nuevo Bloqueo'}
                    </button>
                </div>
            </header>

            {isCreating && (
                <section className="animate-slide-up" style={{ marginBottom: '16px' }}>
                    <div className="card glass" style={{ padding: '20px', border: '1px solid var(--brand-blue-pastel)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--brand-blue)' }}>Configurar Bloqueo</h2>
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

                        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                            {/* Row 1: Cancha + Tipo + checkboxes */}
                            <div className="form-group">
                                <label>Cancha</label>
                                <select
                                    value={formData.id_cancha}
                                    onChange={e => setFormData({ ...formData, id_cancha: parseInt(e.target.value) })}
                                    disabled={allCourts}
                                    style={{
                                        width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--border)',
                                        opacity: allCourts ? 0.5 : 1,
                                        cursor: allCourts ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {courts.length > 0 ? courts.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    )) : (
                                        <>
                                            <option value={1}>Cancha 1</option>
                                            <option value={2}>Cancha 2</option>
                                            <option value={3}>Cancha 3</option>
                                            <option value={4}>Cancha 4</option>
                                            <option value={5}>Cancha 5</option>
                                        </>
                                    )}
                                </select>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600', color: allCourts ? 'var(--brand-blue)' : 'var(--text-muted)' }}>
                                    <input
                                        type="checkbox"
                                        checked={allCourts}
                                        onChange={e => setAllCourts(e.target.checked)}
                                        style={{ width: '16px', height: '16px', accentColor: 'var(--brand-blue)', cursor: 'pointer' }}
                                    />
                                    Todas las canchas
                                </label>
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

                            {/* Row 2: Fechas */}
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

                            {/* Row 3: Horarios (hidden when allDay) */}
                            {!allDay && (
                                <>
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
                                </>
                            )}

                            {/* Todo el día checkbox — shown inline where time inputs would be */}
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', ...(allDay ? {} : { gridColumn: '1 / -1' }) }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600', color: allDay ? 'var(--brand-blue)' : 'var(--text-muted)', margin: 0 }}>
                                    <input
                                        type="checkbox"
                                        checked={allDay}
                                        onChange={e => setAllDay(e.target.checked)}
                                        style={{ width: '16px', height: '16px', accentColor: 'var(--brand-blue)', cursor: 'pointer' }}
                                    />
                                    Todo el día (00:00 - 23:59)
                                </label>
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

                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.9rem' }}>
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

                <div className="card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--brand-blue)' }}>Bloqueos Registrados</h2>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{pagination.meta?.totalItems || 0} resultado(s)</span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--brand-blue-pastel)' }}>
                                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--brand-blue)', fontSize: '0.8rem' }}>Cancha</th>
                                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--brand-blue)', fontSize: '0.8rem' }}>Fecha</th>
                                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--brand-blue)', fontSize: '0.8rem' }}>Horario</th>
                                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--brand-blue)', fontSize: '0.8rem' }}>Tipo</th>
                                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--brand-blue)', fontSize: '0.8rem' }}>Descripción</th>
                                    <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--brand-blue)', fontSize: '0.8rem' }}>Acciones</th>
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
                                            <td style={{ padding: '10px 12px', fontWeight: '700', fontSize: '0.9rem' }}>{b.canchas?.nombre || `Cancha ${b.id_cancha}`}</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                {formatDateToDDMMYYYY(b.fecha)}
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={14} style={{ opacity: 0.6 }} />
                                                    {b.hora_inicio.substring(0, 5)} - {b.hora_fin.substring(0, 5)}
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
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
                                            <td style={{ padding: '10px 12px' }}>
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
