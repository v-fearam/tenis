import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Repeat, Search, X, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { Toast, type ToastType } from '../components/Toast';
import PaginationControls from '../components/PaginationControls';
import { usePagination } from '../hooks/usePagination';
import DateInputDDMMYYYY from '../components/DateInputDDMMYYYY';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7];

function generateTimeSlots(): string[] {
    const slots: string[] = [];
    for (let h = 6; h <= 22; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
}

function formatDias(dias: number[]): string {
    return dias.sort((a, b) => a - b).map(d => DIAS[d - 1]).join('/');
}

function formatMoney(n: number): string {
    return '$' + Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

function SaldoBadge({ saldo }: { saldo: number }) {
    if (saldo === 0) return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EAFAF1', color: '#1E8449', padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700 }}>
            Al día
        </span>
    );
    if (saldo > 0) return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--brand-blue-pastel)', color: 'var(--brand-blue)', padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700 }}>
            +{formatMoney(saldo)} a favor
        </span>
    );
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FDEDEC', color: '#C0392B', padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700 }}>
            {formatMoney(saldo)} debe
        </span>
    );
}

interface Recurrencia {
    id: string;
    nombre: string;
    cancha_nombre: string;
    socio_nombre: string;
    dias_semana: number[];
    hora_inicio: string;
    hora_fin: string;
    fecha_desde: string;
    fecha_hasta: string;
    precio_unitario_original: number;
    estado: string;
    deuda: number;
    comprometido: number;
    pagado: number;
    saldo: number;
}

interface Court { id: number; nombre: string; }
interface Socio { id: string; nombre: string; email: string; }

interface AvailabilityResult {
    hora_fin: string;
    fechas_disponibles: string[];
    conflictos: { fecha: string; motivo: string }[];
    cantidad_disponibles: number;
    cantidad_conflictos: number;
    precio_sugerido: number;
    precio_unitario_base: number;
    descuento_aplicado: number;
}

export default function TurnosRecurrentes() {
    const navigate = useNavigate();
    const [recurrencias, setRecurrencias] = useState<Recurrencia[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [filterEstado, setFilterEstado] = useState<'activa' | 'cancelada' | ''>('activa');
    const [deudaTotal, setDeudaTotal] = useState({ deuda: 0, comprometido: 0 });
    const pagination = usePagination();

    // New modal state
    const [showModal, setShowModal] = useState(false);
    const [courts, setCourts] = useState<Court[]>([]);
    const [creating, setCreating] = useState(false);
    const [step, setStep] = useState<'form' | 'availability'>('form');
    const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
    const [montoTotal, setMontoTotal] = useState('');
    const [checkingAvailability, setCheckingAvailability] = useState(false);

    // Form fields
    const [form, setForm] = useState({
        nombre: '',
        id_cancha: '',
        id_usuario_responsable: '',
        socio_nombre_display: '',
        dias_semana: [] as number[],
        hora_inicio: '08:00',
        fecha_desde: '',
        fecha_hasta: '',
        observacion: '',
    });

    // Socio typeahead
    const [socioQuery, setSocioQuery] = useState('');
    const [socioResults, setSocioResults] = useState<Socio[]>([]);
    const [showSocioDropdown, setShowSocioDropdown] = useState(false);
    const socioRef = useRef<HTMLDivElement>(null);
    const socioDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        api.get<Court[]>('/canchas').then(setCourts).catch(() => { });
        fetchDeudaTotal();
    }, []);

    useEffect(() => {
        fetchRecurrencias();
    }, [pagination.page, pagination.pageSize, filterEstado]);

    async function fetchDeudaTotal() {
        try {
            const data = await api.get<{ deuda: number; comprometido: number }>('/turnos-recurrentes/deuda-total');
            setDeudaTotal(data);
        } catch { }
    }

    async function fetchRecurrencias() {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(pagination.page),
                pageSize: String(pagination.pageSize),
            });
            if (filterEstado) params.set('estado', filterEstado);
            const data = await api.get<{ data: Recurrencia[]; total: number; page: number; pageSize: number }>(`/turnos-recurrentes?${params}`);
            setRecurrencias(data.data);
            const totalPages = Math.ceil(data.total / pagination.pageSize) || 1;
            pagination.setMeta({
                currentPage: data.page,
                pageSize: pagination.pageSize,
                totalItems: data.total,
                totalPages,
                hasNextPage: data.page < totalPages,
                hasPreviousPage: data.page > 1,
            });
        } catch {
            setToast({ message: 'Error al cargar recurrencias', type: 'error' });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (socioDebounce.current) clearTimeout(socioDebounce.current);
        if (!socioQuery || socioQuery.length < 2) {
            setSocioResults([]);
            return;
        }
        socioDebounce.current = setTimeout(async () => {
            try {
                const data = await api.get<Socio[]>(`/users/search-socios?q=${encodeURIComponent(socioQuery)}`);
                setSocioResults(data || []);
                setShowSocioDropdown(true);
            } catch { }
        }, 300);
    }, [socioQuery]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (socioRef.current && !socioRef.current.contains(e.target as Node)) {
                setShowSocioDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    function resetModal() {
        setStep('form');
        setAvailability(null);
        setMontoTotal('');
        setForm({ nombre: '', id_cancha: '', id_usuario_responsable: '', socio_nombre_display: '', dias_semana: [], hora_inicio: '08:00', fecha_desde: '', fecha_hasta: '', observacion: '' });
        setSocioQuery('');
        setSocioResults([]);
        setShowSocioDropdown(false);
    }

    function toggleDia(isoDay: number) {
        setForm(f => ({
            ...f,
            dias_semana: f.dias_semana.includes(isoDay)
                ? f.dias_semana.filter(d => d !== isoDay)
                : [...f.dias_semana, isoDay]
        }));
    }

    async function handleCheckAvailability() {
        if (!form.nombre || !form.id_cancha || !form.id_usuario_responsable || form.dias_semana.length === 0 || !form.fecha_desde || !form.fecha_hasta) {
            setToast({ message: 'Completá todos los campos obligatorios', type: 'error' });
            return;
        }
        setCheckingAvailability(true);
        try {
            const result = await api.post<AvailabilityResult>('/turnos-recurrentes/check-availability', {
                id_cancha: Number(form.id_cancha),
                dias_semana: form.dias_semana,
                hora_inicio: form.hora_inicio,
                fecha_desde: form.fecha_desde,
                fecha_hasta: form.fecha_hasta,
            });
            setAvailability(result);
            setMontoTotal(String(result.precio_sugerido));
            setStep('availability');
        } catch (e: any) {
            setToast({ message: e.message || 'Error al verificar disponibilidad', type: 'error' });
        } finally {
            setCheckingAvailability(false);
        }
    }

    async function handleCreate() {
        if (!availability || availability.cantidad_disponibles === 0) return;
        const monto = parseFloat(montoTotal);
        if (isNaN(monto) || monto <= 0) {
            setToast({ message: 'Ingresá un monto total válido', type: 'error' });
            return;
        }
        setCreating(true);
        try {
            await api.post('/turnos-recurrentes', {
                nombre: form.nombre,
                id_cancha: Number(form.id_cancha),
                id_usuario_responsable: form.id_usuario_responsable,
                dias_semana: form.dias_semana,
                hora_inicio: form.hora_inicio,
                fecha_desde: form.fecha_desde,
                fecha_hasta: form.fecha_hasta,
                monto_total: monto,
                observacion: form.observacion || undefined,
            });
            setToast({ message: 'Recurrencia creada correctamente', type: 'success' });
            setShowModal(false);
            resetModal();
            fetchRecurrencias();
            fetchDeudaTotal();
        } catch (e: any) {
            setToast({ message: e.message || 'Error al crear la recurrencia', type: 'error' });
        } finally {
            setCreating(false);
        }
    }

    const timeSlots = generateTimeSlots();

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Repeat size={22} color="var(--brand-blue)" />
                    <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Turnos Recurrentes</h1>
                </div>
                <button className="btn-primary" onClick={() => { resetModal(); setShowModal(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 18px', fontSize: '0.9rem', minHeight: 40 }}>
                    <Plus size={15} /> Nueva recurrencia
                </button>
            </div>

            {/* Summary strip */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 20px', marginBottom: '18px', display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <div>
                    <div style={summaryLabelStyle}>Deuda total</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: deudaTotal.deuda > 0 ? '#C0392B' : 'var(--text-main)', letterSpacing: '-0.02em' }}>
                        {formatMoney(deudaTotal.deuda)}
                    </div>
                </div>
                <div>
                    <div style={summaryLabelStyle}>Comprometido</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '-0.02em' }}>
                        {formatMoney(deudaTotal.comprometido)}
                    </div>
                </div>
                <button onClick={fetchRecurrencias}
                    style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', padding: '6px 12px', fontWeight: 600 }}>
                    <RefreshCw size={13} /> Actualizar
                </button>
            </div>

            {/* Filter */}
            <div style={{ marginBottom: '16px', display: 'flex', gap: '6px' }}>
                {(['activa', 'cancelada', ''] as const).map(e => (
                    <button key={e} onClick={() => { setFilterEstado(e); pagination.firstPage(); }}
                        style={{
                            fontSize: '0.83rem', padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
                            borderColor: filterEstado === e ? 'var(--brand-blue)' : 'var(--border)',
                            background: filterEstado === e ? 'var(--brand-blue)' : 'white',
                            color: filterEstado === e ? 'white' : 'var(--text-muted)',
                            fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                        }}>
                        {e === 'activa' ? 'Activas' : e === 'cancelada' ? 'Canceladas' : 'Todas'}
                    </button>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando...</div>
            ) : recurrencias.length === 0 ? (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '40px', textAlign: 'center', color: 'var(--text-muted)', boxShadow: 'var(--shadow-sm)' }}>
                    No hay recurrencias {filterEstado === 'activa' ? 'activas' : filterEstado === 'cancelada' ? 'canceladas' : ''}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {recurrencias.map(r => (
                        <div key={r.id}
                            onClick={() => navigate(`/admin/turnos-recurrentes/${r.id}`)}
                            style={{
                                background: 'white', border: '1px solid var(--border)', borderRadius: 14,
                                padding: '14px 18px', cursor: 'pointer',
                                borderLeft: `3px solid ${r.estado === 'activa' ? 'var(--brand-blue)' : '#D5DBDB'}`,
                                display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center',
                                boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.15s, transform 0.15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.nombre}</span>
                                    {r.estado === 'cancelada' && (
                                        <span style={{ fontSize: '0.68rem', background: '#F2F3F4', color: '#95A5A6', padding: '2px 7px', borderRadius: 6, fontWeight: 700, letterSpacing: '0.03em' }}>CANCELADA</span>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                                    <span>{r.cancha_nombre}</span>
                                    <span>{formatDias(r.dias_semana)} · {r.hora_inicio.slice(0, 5)}</span>
                                    <span>{r.socio_nombre}</span>
                                    <span>{formatMoney(r.precio_unitario_original)}/turno</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                                    {new Date(r.fecha_desde + 'T12:00:00').toLocaleDateString('es-AR')} → {new Date(r.fecha_hasta + 'T12:00:00').toLocaleDateString('es-AR')}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                <SaldoBadge saldo={r.saldo} />
                                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                                    Comp. {formatMoney(r.comprometido)}
                                </div>
                                <ChevronRight size={14} color="var(--text-muted)" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ marginTop: '16px' }}>
                <PaginationControls
                    meta={pagination.meta}
                    onPageChange={pagination.goToPage}
                    onNext={pagination.nextPage}
                    onPrevious={pagination.previousPage}
                    onFirst={pagination.firstPage}
                    onLast={pagination.lastPage}
                />
            </div>

            {/* MODAL */}
            {showModal && (
                <div className="overlay">
                    <div style={modalCardStyle}>
                        {/* Header */}
                        <div style={modalHeaderStyle}>
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-blue)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>
                                    {step === 'form' ? 'Paso 1 de 2' : 'Paso 2 de 2'}
                                </div>
                                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                                    {step === 'form' ? 'Nueva recurrencia' : 'Disponibilidad'}
                                </h2>
                            </div>
                            <button onClick={() => { setShowModal(false); resetModal(); }} style={closeButtonStyle}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '24px 28px 28px', overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' }}>

                            {step === 'form' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                    <div>
                                        <label className="form-label">Nombre del grupo *</label>
                                        <input className="form-input" value={form.nombre}
                                            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                                            placeholder="Ej: Grupo de Pablo" />
                                    </div>

                                    {/* Socio typeahead */}
                                    <div ref={socioRef}>
                                        <label className="form-label">Socio responsable *</label>
                                        {form.id_usuario_responsable ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'var(--brand-blue-pastel)', borderRadius: 10, border: '1px solid rgba(10,132,255,0.2)' }}>
                                                <span style={{ fontWeight: 600, flex: 1, fontSize: '0.95rem' }}>{form.socio_nombre_display}</span>
                                                <button onClick={() => setForm(f => ({ ...f, id_usuario_responsable: '', socio_nombre_display: '' }))}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px' }}>
                                                    <X size={15} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                                <input className="form-input" value={socioQuery}
                                                    onChange={e => setSocioQuery(e.target.value)}
                                                    onFocus={() => socioResults.length > 0 && setShowSocioDropdown(true)}
                                                    placeholder="Buscar socio por nombre..."
                                                    style={{ paddingLeft: 40 }} />
                                                {showSocioDropdown && socioResults.length > 0 && (
                                                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 12, zIndex: 100, maxHeight: 200, overflowY: 'auto', boxShadow: 'var(--shadow-md)' }}>
                                                        {socioResults.map(s => (
                                                            <div key={s.id}
                                                                onClick={() => { setForm(f => ({ ...f, id_usuario_responsable: s.id, socio_nombre_display: s.nombre })); setSocioQuery(''); setShowSocioDropdown(false); }}
                                                                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                                                                onMouseEnter={e => (e.currentTarget.style.background = '#F8F9FA')}
                                                                onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.nombre}</div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.email}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="form-label">Cancha *</label>
                                        <select className="form-input" value={form.id_cancha}
                                            onChange={e => setForm(f => ({ ...f, id_cancha: e.target.value }))}>
                                            <option value="">Seleccioná una cancha</option>
                                            {courts.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="form-label">Días de la semana *</label>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {DIAS.map((d, i) => {
                                                const active = form.dias_semana.includes(ISO_DAYS[i]);
                                                return (
                                                    <button key={i} type="button" onClick={() => toggleDia(ISO_DAYS[i])}
                                                        style={{
                                                            padding: '7px 14px', borderRadius: 20,
                                                            border: `1.5px solid ${active ? 'var(--brand-blue)' : 'var(--border)'}`,
                                                            background: active ? 'var(--brand-blue)' : 'transparent',
                                                            color: active ? 'white' : 'var(--text-muted)',
                                                            fontWeight: 600, cursor: 'pointer', fontSize: '0.83rem',
                                                            transition: 'all 0.15s cubic-bezier(0.4,0,0.2,1)',
                                                        }}>
                                                        {d}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="form-label">Hora de inicio *</label>
                                        <select className="form-input" value={form.hora_inicio}
                                            onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}>
                                            {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label className="form-label">Desde *</label>
                                            <DateInputDDMMYYYY value={form.fecha_desde} onChange={v => setForm(f => ({ ...f, fecha_desde: v }))} />
                                        </div>
                                        <div>
                                            <label className="form-label">Hasta *</label>
                                            <DateInputDDMMYYYY value={form.fecha_hasta} onChange={v => setForm(f => ({ ...f, fecha_hasta: v }))} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="form-label">Observación (opcional)</label>
                                        <textarea className="form-input" value={form.observacion}
                                            onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))}
                                            rows={2} style={{ resize: 'vertical' }} placeholder="Notas internas..." />
                                    </div>

                                    <div className="modal-footer">
                                        <button className="btn-secondary" onClick={() => { setShowModal(false); resetModal(); }}
                                            style={{ padding: '10px 20px', minHeight: 40, fontSize: '0.9rem' }}>
                                            Cancelar
                                        </button>
                                        <button className="btn-primary" onClick={handleCheckAvailability} disabled={checkingAvailability}
                                            style={{ padding: '10px 20px', minHeight: 40, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                                            {checkingAvailability && <RefreshCw size={13} style={{ animation: 'historial-spin 1s linear infinite' }} />}
                                            Verificar disponibilidad
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 'availability' && availability && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* Status card */}
                                    <div style={{
                                        padding: '16px', borderRadius: 12,
                                        background: availability.cantidad_disponibles > 0 ? '#EAFAF1' : '#FDEDEC',
                                        border: `1px solid ${availability.cantidad_disponibles > 0 ? '#A9DFBF' : '#F1948A'}`,
                                        display: 'flex', gap: 12, alignItems: 'flex-start',
                                    }}>
                                        {availability.cantidad_disponibles > 0
                                            ? <CheckCircle size={20} color="#1E8449" style={{ flexShrink: 0, marginTop: 1 }} />
                                            : <AlertCircle size={20} color="#C0392B" style={{ flexShrink: 0, marginTop: 1 }} />}
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: availability.cantidad_disponibles > 0 ? '#1E8449' : '#C0392B', marginBottom: 4 }}>
                                                {availability.cantidad_disponibles > 0
                                                    ? `${availability.cantidad_disponibles} turnos disponibles`
                                                    : 'Sin turnos disponibles'}
                                            </div>
                                            {availability.cantidad_disponibles > 0 && (
                                                <div style={{ fontSize: '0.83rem', color: '#1E8449' }}>
                                                    Precio sugerido: <strong>{formatMoney(availability.precio_sugerido)}</strong>
                                                    <span style={{ opacity: 0.7 }}> ({availability.cantidad_disponibles} × {formatMoney(availability.precio_sugerido / (availability.cantidad_disponibles || 1))} · {availability.descuento_aplicado}% dto.)</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Conflicts */}
                                    {availability.conflictos.length > 0 && (
                                        <div style={{ padding: '14px', borderRadius: 12, background: '#FEFBF0', border: '1px solid #F0C040' }}>
                                            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.85rem', color: '#7D6608' }}>
                                                {availability.conflictos.length} fecha{availability.conflictos.length > 1 ? 's' : ''} con conflicto (no se crearán)
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {availability.conflictos.map(c => (
                                                    <span key={c.fecha} style={{ background: '#FEF9E7', border: '1px solid #F7DC6F', borderRadius: 8, padding: '3px 9px', fontSize: '0.78rem', color: '#7D6608' }}>
                                                        {new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Monto total */}
                                    {availability.cantidad_disponibles > 0 && (
                                        <div>
                                            <label className="form-label">Monto total *</label>
                                            <input className="form-input" type="number" value={montoTotal}
                                                onChange={e => setMontoTotal(e.target.value)} min="0" step="100" />
                                            {montoTotal && !isNaN(parseFloat(montoTotal)) && availability.cantidad_disponibles > 0 && (
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                                                    = {formatMoney(parseFloat(montoTotal) / availability.cantidad_disponibles)} por turno
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="modal-footer">
                                        <button className="btn-secondary" onClick={() => setStep('form')}
                                            style={{ padding: '10px 20px', minHeight: 40, fontSize: '0.9rem' }}>
                                            Volver
                                        </button>
                                        {availability.cantidad_disponibles > 0 && (
                                            <button className="btn-primary" onClick={handleCreate} disabled={creating}
                                                style={{ padding: '10px 20px', minHeight: 40, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                                                {creating && <RefreshCw size={13} style={{ animation: 'historial-spin 1s linear infinite' }} />}
                                                Crear recurrencia
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const summaryLabelStyle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 };

const modalCardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: 20,
    width: '100%',
    maxWidth: 560,
    maxHeight: '90vh',
    boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideUp 0.22s cubic-bezier(0.4,0,0.2,1)',
    overflow: 'hidden',
};

const modalHeaderStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '22px 28px 20px', borderBottom: '1px solid var(--border)',
    flexShrink: 0,
};

const closeButtonStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
    padding: 6, borderRadius: 8, transition: 'background 0.15s', flexShrink: 0,
};
