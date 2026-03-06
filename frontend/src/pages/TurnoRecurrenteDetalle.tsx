import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, XCircle, DollarSign, AlertTriangle, X } from 'lucide-react';
import { api } from '../lib/api';
import { Toast, type ToastType } from '../components/Toast';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function formatDias(dias: number[]): string {
    return dias.sort((a, b) => a - b).map(d => DIAS[d - 1]).join(', ');
}

function formatMoney(n: number): string {
    return '$' + Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateShort(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${dias[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

interface Turno {
    id: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    estado: string;
    monto_recurrente: number;
}

interface Movimiento {
    id: string;
    tipo: string;
    monto: number;
    descripcion: string | null;
    medio: string | null;
    fecha: string;
    usuarios?: { nombre: string } | null;
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
    observacion: string | null;
    deuda: number;
    comprometido: number;
    pagado: number;
    saldo: number;
    turnos: Turno[];
    movimientos: Movimiento[];
    cantidad_turnos: number;
    cantidad_activos: number;
    cantidad_cancelados: number;
}

interface RecalcularPreview {
    turnos_afectados: number;
    precio_actual: number;
    precio_nuevo: number;
    comprometido_actual: number;
    comprometido_nuevo: number;
}

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

function TurnoStatusDot({ turno }: { turno: Turno }) {
    if (turno.estado === 'cancelado') return <span style={dotStyle('#BDC3C7')} title="Cancelado" />;
    if (turno.fecha < today) return <span style={dotStyle('#27AE60')} title="Jugado" />;
    return <span style={dotStyle('#F39C12')} title="Futuro" />;
}

function dotStyle(color: string): React.CSSProperties {
    return { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 };
}

export default function TurnoRecurrenteDetalle() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<Recurrencia | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const [showPagoModal, setShowPagoModal] = useState(false);
    const [pagoForm, setPagoForm] = useState({ monto: '', tipo: 'pago', descripcion: '', medio: '' });
    const [savingPago, setSavingPago] = useState(false);

    const [showRecalcModal, setShowRecalcModal] = useState(false);
    const [recalcPreview, setRecalcPreview] = useState<RecalcularPreview | null>(null);
    const [loadingRecalc, setLoadingRecalc] = useState(false);
    const [confirmingRecalc, setConfirmingRecalc] = useState(false);

    const [cancelTurnoModal, setCancelTurnoModal] = useState<Turno | null>(null);
    const [cancelingTurno, setCancelingTurno] = useState(false);

    const [showCancelAllModal, setShowCancelAllModal] = useState(false);
    const [cancelingAll, setCancelingAll] = useState(false);
    const [cancelAllPreview, setCancelAllPreview] = useState<{ count: number; monto: number } | null>(null);

    useEffect(() => {
        fetchData();
    }, [id]);

    async function fetchData() {
        if (!id) return;
        setLoading(true);
        try {
            const result = await api.get<Recurrencia>(`/turnos-recurrentes/${id}`);
            setData(result);
            const futuros = (result.turnos || []).filter(t => t.estado !== 'cancelado' && t.fecha >= today);
            setCancelAllPreview({
                count: futuros.length,
                monto: futuros.reduce((s, t) => s + Number(t.monto_recurrente || 0), 0),
            });
        } catch {
            setToast({ message: 'Error al cargar la recurrencia', type: 'error' });
        } finally {
            setLoading(false);
        }
    }

    async function handleAddPago() {
        const monto = parseFloat(pagoForm.monto);
        if (isNaN(monto) || monto <= 0) {
            setToast({ message: 'Ingresá un monto válido', type: 'error' });
            return;
        }
        setSavingPago(true);
        try {
            await api.post(`/turnos-recurrentes/${id}/pagos`, {
                monto,
                tipo: pagoForm.tipo,
                descripcion: pagoForm.descripcion || undefined,
                medio: pagoForm.medio || undefined,
            });
            setToast({ message: 'Pago registrado', type: 'success' });
            setShowPagoModal(false);
            setPagoForm({ monto: '', tipo: 'pago', descripcion: '', medio: '' });
            fetchData();
        } catch (e: any) {
            setToast({ message: e.message || 'Error al registrar pago', type: 'error' });
        } finally {
            setSavingPago(false);
        }
    }

    async function handleRecalcularPreview() {
        setLoadingRecalc(true);
        try {
            const preview = await api.get<RecalcularPreview>(`/turnos-recurrentes/${id}/recalcular`);
            setRecalcPreview(preview);
            setShowRecalcModal(true);
        } catch (e: any) {
            setToast({ message: e.message || 'Error al obtener preview', type: 'error' });
        } finally {
            setLoadingRecalc(false);
        }
    }

    async function handleRecalcularConfirm() {
        setConfirmingRecalc(true);
        try {
            await api.post(`/turnos-recurrentes/${id}/recalcular`, {});
            setToast({ message: 'Precios actualizados', type: 'success' });
            setShowRecalcModal(false);
            fetchData();
        } catch (e: any) {
            setToast({ message: e.message || 'Error al recalcular', type: 'error' });
        } finally {
            setConfirmingRecalc(false);
        }
    }

    async function handleCancelTurno() {
        if (!cancelTurnoModal) return;
        setCancelingTurno(true);
        try {
            await api.delete(`/turnos-recurrentes/${id}/turnos/${cancelTurnoModal.id}`);
            setToast({ message: 'Turno cancelado', type: 'success' });
            setCancelTurnoModal(null);
            fetchData();
        } catch (e: any) {
            setToast({ message: e.message || 'Error al cancelar el turno', type: 'error' });
        } finally {
            setCancelingTurno(false);
        }
    }

    async function handleCancelAll() {
        setCancelingAll(true);
        try {
            await api.delete(`/turnos-recurrentes/${id}`);
            setToast({ message: 'Recurrencia cancelada', type: 'success' });
            setShowCancelAllModal(false);
            fetchData();
        } catch (e: any) {
            setToast({ message: e.message || 'Error al cancelar la recurrencia', type: 'error' });
        } finally {
            setCancelingAll(false);
        }
    }

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>;
    }

    if (!data) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#E74C3C' }}>Recurrencia no encontrada</div>;
    }

    const saldoColor = data.saldo === 0 ? '#1E8449' : data.saldo > 0 ? 'var(--brand-blue)' : '#C0392B';

    return (
        <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={() => navigate('/admin/turnos-recurrentes')}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontWeight: 600, padding: '6px 12px', fontSize: '0.83rem' }}>
                        <ArrowLeft size={15} /> Volver
                    </button>
                    <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{data.nombre}</h1>
                    {data.estado === 'cancelada' && (
                        <span style={{ background: '#F2F3F4', color: '#95A5A6', fontSize: '0.68rem', padding: '3px 8px', borderRadius: 6, fontWeight: 700, letterSpacing: '0.03em' }}>CANCELADA</span>
                    )}
                </div>
                {data.estado === 'activa' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-secondary" onClick={handleRecalcularPreview} disabled={loadingRecalc}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.83rem', padding: '8px 14px', minHeight: 36 }}>
                            <RefreshCw size={13} style={loadingRecalc ? { animation: 'historial-spin 1s linear infinite' } : undefined} />
                            Recalcular
                        </button>
                        <button onClick={() => setShowCancelAllModal(true)}
                            style={{ background: '#FDEDEC', color: '#C0392B', border: '1px solid #F5B7B1', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, minHeight: 36 }}>
                            <XCircle size={13} /> Cancelar todo
                        </button>
                    </div>
                )}
            </div>

            {/* Info strip */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', marginBottom: '14px', fontSize: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '14px', color: 'var(--text-muted)', boxShadow: 'var(--shadow-sm)' }}>
                <span><strong style={{ color: 'var(--text-main)' }}>{data.cancha_nombre}</strong></span>
                <span>{formatDias(data.dias_semana)} · {data.hora_inicio.slice(0, 5)}–{data.hora_fin.slice(0, 5)}</span>
                <span>{data.socio_nombre}</span>
                <span>{formatDate(data.fecha_desde)} → {formatDate(data.fecha_hasta)}</span>
                <span>{data.cantidad_turnos} turnos · {data.cantidad_activos} activos · {data.cantidad_cancelados} cancelados</span>
                <span>{formatMoney(data.precio_unitario_original)}/turno original</span>
                {data.observacion && <span style={{ fontStyle: 'italic' }}>{data.observacion}</span>}
            </div>

            {/* Saldo summary */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', marginBottom: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
                {[
                    { label: 'Deuda', value: formatMoney(data.deuda), color: data.deuda > 0 ? '#C0392B' : 'var(--text-main)', sub: 'turnos jugados' },
                    { label: 'Comprometido', value: formatMoney(data.comprometido), color: 'var(--text-muted)', sub: 'turnos futuros' },
                    { label: 'Total pagado', value: formatMoney(data.pagado), color: '#1E8449', sub: '' },
                    { label: 'Saldo', value: data.saldo === 0 ? 'Al día' : (data.saldo > 0 ? `+${formatMoney(data.saldo)}` : formatMoney(data.saldo)), color: saldoColor, sub: '', large: true },
                ].map(({ label, value, color, sub, large }) => (
                    <div key={label}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: large ? '1.35rem' : '1.15rem', fontWeight: 800, color, letterSpacing: '-0.02em' }}>{value}</div>
                        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
                    </div>
                ))}
            </div>

            {/* Payments section */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', marginBottom: '14px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>Pagos realizados</h3>
                    {data.estado === 'activa' && (
                        <button className="btn-primary" onClick={() => setShowPagoModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.83rem', padding: '8px 14px', minHeight: 36 }}>
                            <DollarSign size={13} /> Registrar pago
                        </button>
                    )}
                </div>
                {data.movimientos.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '12px 0' }}>Sin pagos registrados</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th style={thStyle}>Fecha</th>
                                <th style={thStyle}>Tipo</th>
                                <th style={thStyle}>Monto</th>
                                <th style={thStyle}>Descripción</th>
                                <th style={thStyle}>Medio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.movimientos.map(m => (
                                <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={tdStyle}>{new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                    <td style={tdStyle}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: m.tipo === 'pago' ? '#1E8449' : '#8E44AD', fontWeight: 700, fontSize: '0.82rem' }}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.tipo === 'pago' ? '#27AE60' : '#9B59B6', display: 'inline-block' }} />
                                            {m.tipo === 'pago' ? 'Pago' : 'Bonificación'}
                                        </span>
                                    </td>
                                    <td style={{ ...tdStyle, fontWeight: 700 }}>{formatMoney(m.monto)}</td>
                                    <td style={tdStyle}>{m.descripcion || '—'}</td>
                                    <td style={tdStyle}>{m.medio || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Turnos section */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ margin: '0 0 14px', fontWeight: 700, fontSize: '0.95rem' }}>Turnos</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '400px', overflowY: 'auto' }}>
                    {data.turnos.map(t => {
                        const isFuture = t.estado !== 'cancelado' && t.fecha >= today;
                        const isCancelled = t.estado === 'cancelado';
                        return (
                            <div key={t.id} style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '9px 10px', borderRadius: 10,
                                background: isCancelled ? '#FAFAFA' : 'transparent',
                                opacity: isCancelled ? 0.5 : 1, fontSize: '0.875rem',
                            }}>
                                <TurnoStatusDot turno={t} />
                                <span style={{ fontWeight: 600, minWidth: 90, color: 'var(--text-main)' }}>{formatDateShort(t.fecha)}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{t.hora_inicio.slice(0, 5)}</span>
                                <span style={{ color: 'var(--text-muted)', flex: 1, fontSize: '0.82rem' }}>{data.cancha_nombre}</span>
                                <span style={{ fontWeight: 700, minWidth: 70, textAlign: 'right' }}>{formatMoney(Number(t.monto_recurrente || 0))}</span>
                                {isCancelled && <span style={{ fontSize: '0.72rem', color: '#95A5A6', minWidth: 60 }}>cancelado</span>}
                                {isFuture && data.estado === 'activa' && (
                                    <button onClick={() => setCancelTurnoModal(t)}
                                        style={{ background: 'none', border: '1px solid #F5B7B1', color: '#C0392B', borderRadius: 7, padding: '3px 9px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', transition: 'background 0.1s' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#FDEDEC')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* PAGO MODAL */}
            {showPagoModal && (
                <Modal title="Registrar pago" onClose={() => { setShowPagoModal(false); setPagoForm({ monto: '', tipo: 'pago', descripcion: '', medio: '' }); }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label className="form-label">Tipo</label>
                            <div style={{ display: 'flex', gap: '7px' }}>
                                {[{ value: 'pago', label: 'Pago' }, { value: 'bonificacion', label: 'Bonificación' }].map(opt => (
                                    <button key={opt.value} type="button" onClick={() => setPagoForm(f => ({ ...f, tipo: opt.value }))}
                                        style={{
                                            padding: '8px 18px', borderRadius: 20,
                                            border: `1.5px solid ${pagoForm.tipo === opt.value ? 'var(--brand-blue)' : 'var(--border)'}`,
                                            background: pagoForm.tipo === opt.value ? 'var(--brand-blue)' : 'transparent',
                                            color: pagoForm.tipo === opt.value ? 'white' : 'var(--text-muted)',
                                            fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
                                            transition: 'all 0.15s cubic-bezier(0.4,0,0.2,1)',
                                        }}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="form-label">Monto *</label>
                            <input className="form-input" type="number" value={pagoForm.monto}
                                onChange={e => setPagoForm(f => ({ ...f, monto: e.target.value }))}
                                placeholder="0" min="0" step="100" />
                        </div>
                        <div>
                            <label className="form-label">Descripción</label>
                            <input className="form-input" value={pagoForm.descripcion}
                                onChange={e => setPagoForm(f => ({ ...f, descripcion: e.target.value }))}
                                placeholder="Ej: Pago efectivo marzo" />
                        </div>
                        <div>
                            <label className="form-label">Medio</label>
                            <select className="form-input" value={pagoForm.medio}
                                onChange={e => setPagoForm(f => ({ ...f, medio: e.target.value }))}>
                                <option value="">— Sin especificar —</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="transferencia">Transferencia</option>
                                <option value="tarjeta">Tarjeta</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => { setShowPagoModal(false); setPagoForm({ monto: '', tipo: 'pago', descripcion: '', medio: '' }); }}
                                style={{ padding: '10px 20px', minHeight: 40, fontSize: '0.9rem' }}>
                                Cancelar
                            </button>
                            <button className="btn-primary" onClick={handleAddPago} disabled={savingPago}
                                style={{ padding: '10px 20px', minHeight: 40, fontSize: '0.9rem' }}>
                                {savingPago ? 'Guardando...' : 'Registrar'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* RECALCULAR MODAL */}
            {showRecalcModal && recalcPreview && (
                <Modal title="Recalcular deuda" onClose={() => setShowRecalcModal(false)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ padding: '16px', borderRadius: 12, background: 'var(--brand-blue-pastel)', border: '1px solid rgba(10,132,255,0.2)' }}>
                            <div style={{ fontSize: '0.88rem', marginBottom: 8, fontWeight: 600 }}>
                                <strong>{recalcPreview.turnos_afectados}</strong> turnos futuros serán actualizados
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
                                <span style={{ background: 'rgba(10,132,255,0.12)', borderRadius: 8, padding: '4px 10px', fontWeight: 700 }}>{formatMoney(recalcPreview.precio_actual)}</span>
                                <span style={{ color: 'var(--text-muted)' }}>→</span>
                                <span style={{ background: 'var(--brand-blue)', color: 'white', borderRadius: 8, padding: '4px 10px', fontWeight: 700 }}>{formatMoney(recalcPreview.precio_nuevo)}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>por turno</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 10 }}>
                                Comprometido: {formatMoney(recalcPreview.comprometido_actual)} → {formatMoney(recalcPreview.comprometido_nuevo)} · La deuda de turnos jugados no cambia.
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowRecalcModal(false)}
                                style={{ padding: '10px 20px', minHeight: 40, fontSize: '0.9rem' }}>
                                Cancelar
                            </button>
                            <button className="btn-primary" onClick={handleRecalcularConfirm} disabled={confirmingRecalc}
                                style={{ padding: '10px 20px', minHeight: 40, fontSize: '0.9rem' }}>
                                {confirmingRecalc ? 'Actualizando...' : 'Confirmar recálculo'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* CANCEL TURNO MODAL */}
            {cancelTurnoModal && (
                <Modal title="Cancelar turno" onClose={() => setCancelTurnoModal(null)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ padding: '16px', borderRadius: 12, background: '#FDEDEC', border: '1px solid #F5B7B1', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <AlertTriangle size={18} color="#C0392B" style={{ flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <div style={{ fontWeight: 700, color: '#C0392B', marginBottom: 5 }}>
                                    Cancelar turno del {formatDateShort(cancelTurnoModal.fecha)}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#C0392B', opacity: 0.85 }}>
                                    {cancelTurnoModal.fecha >= today
                                        ? `${formatMoney(Number(cancelTurnoModal.monto_recurrente || 0))} se descontarán del comprometido.`
                                        : `${formatMoney(Number(cancelTurnoModal.monto_recurrente || 0))} se descontarán de la deuda.`}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setCancelTurnoModal(null)}
                                style={{ padding: '10px 20px', minHeight: 40, fontSize: '0.9rem' }}>
                                No, volver
                            </button>
                            <button onClick={handleCancelTurno} disabled={cancelingTurno}
                                style={{ background: '#C0392B', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, minHeight: 40, fontSize: '0.9rem', opacity: cancelingTurno ? 0.7 : 1 }}>
                                {cancelingTurno ? 'Cancelando...' : 'Sí, cancelar'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* CANCEL ALL MODAL */}
            {showCancelAllModal && cancelAllPreview && (
                <Modal title="Cancelar recurrencia" onClose={() => setShowCancelAllModal(false)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ padding: '16px', borderRadius: 12, background: '#FDEDEC', border: '1px solid #F5B7B1', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <AlertTriangle size={18} color="#C0392B" style={{ flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <div style={{ fontWeight: 700, color: '#C0392B', marginBottom: 6 }}>
                                    Cancelar "{data.nombre}"
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#C0392B', opacity: 0.85, lineHeight: 1.5 }}>
                                    Se cancelarán <strong>{cancelAllPreview.count}</strong> turnos futuros,
                                    liberando <strong>{formatMoney(cancelAllPreview.monto)}</strong> del comprometido.
                                    Los turnos pasados y su deuda quedan sin cambios.
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowCancelAllModal(false)}
                                style={{ padding: '10px 20px', minHeight: 40, fontSize: '0.9rem' }}>
                                No, volver
                            </button>
                            <button onClick={handleCancelAll} disabled={cancelingAll}
                                style={{ background: '#C0392B', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, minHeight: 40, fontSize: '0.9rem', opacity: cancelingAll ? 0.7 : 1 }}>
                                {cancelingAll ? 'Cancelando...' : 'Sí, cancelar todo'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="overlay">
            <div style={{
                background: 'white', borderRadius: 20, width: '100%', maxWidth: 480,
                boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06)',
                animation: 'slideUp 0.22s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>{title}</h3>
                    <button onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 6, borderRadius: 8 }}>
                        <X size={17} />
                    </button>
                </div>
                <div style={{ padding: '20px 24px 24px' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle: React.CSSProperties = { padding: '9px 8px', verticalAlign: 'middle' };
