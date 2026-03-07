import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Toast, type ToastType } from '../components/Toast';
import { Save, Clock, Calendar as CalendarIcon, History, CreditCard, Banknote, Phone } from 'lucide-react';

interface ConfigItem {
    id: string;
    clave: string;
    valor: string;
    descripcion: string;
    updated_at: string;
}

export default function AdminConfig() {
    const [configs, setConfigs] = useState<ConfigItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            const data = await api.get<ConfigItem[]>('/config');
            setConfigs(data);
        } catch (err: any) {
            setToast({ message: 'Error al cargar configuración', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (clave: string, valor: string) => {
        setSaving(clave);
        try {
            await api.patch(`/config/${clave}`, { valor });
            setToast({ message: 'Configuración actualizada correctamente', type: 'success' });
            await fetchConfigs();
        } catch (err: any) {
            setToast({ message: err.message || 'Error al actualizar', type: 'error' });
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div className="container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
                <p style={{ color: 'var(--text-muted)' }}>Cargando parámetros...</p>
            </div>
        );
    }

    return (
        <div className="container">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ color: 'var(--brand-blue)', fontSize: '1.5rem', fontWeight: '800' }}>
                        Parámetros del Sistema
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Configuración global de la aplicación
                    </p>
                </div>
            </header>

            <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
                {configs.map((cfg) => (
                    <div key={cfg.id} className="card glass" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{
                                background: 'var(--brand-blue-pastel)',
                                color: 'var(--brand-blue)',
                                padding: '10px',
                                borderRadius: '50%'
                            }}>
                                {cfg.clave.includes('hora') ? (
                                    <Clock size={20} />
                                ) : cfg.clave.includes('precio') ? (
                                    <CreditCard size={20} />
                                ) : cfg.clave.includes('alias') ? (
                                    <Banknote size={20} />
                                ) : cfg.clave.includes('telefono') ? (
                                    <Phone size={20} />
                                ) : (
                                    <CalendarIcon size={20} />
                                )}
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', textTransform: 'capitalize' }}>
                                    {cfg.clave.replace(/_/g, ' ')}
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cfg.descripcion}</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    color: 'var(--text-muted)',
                                    marginBottom: '6px',
                                    textTransform: 'uppercase'
                                }}>Valor Actual</label>
                                <input
                                    type="text"
                                    defaultValue={cfg.valor}
                                    onBlur={(e) => {
                                        if (e.target.value !== cfg.valor) {
                                            handleUpdate(cfg.clave, e.target.value);
                                        }
                                    }}
                                    placeholder={cfg.clave.includes('precio') ? '0' : ''}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--border)',
                                        fontSize: '1.1rem',
                                        fontWeight: '700',
                                        outline: 'none',
                                        textAlign: 'center',
                                        background: 'white'
                                    }}
                                />
                            </div>
                            <button
                                className="btn-primary"
                                disabled={saving === cfg.clave}
                                style={{ height: '48px', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                {saving === cfg.clave ? <History className="spin" size={20} /> : <Save size={20} />}
                            </button>
                        </div>

                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Última actualización:</span>
                            <span>{new Date(cfg.updated_at).toLocaleString()}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card" style={{ marginTop: '40px', background: 'var(--brand-blue-pastel)', borderColor: 'transparent' }}>
                <h4 style={{ color: 'var(--brand-blue)', marginBottom: '8px', fontWeight: '800' }}>Información de Bloques</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                    Los cambios en los horarios de apertura y cierre afectarán inmediatamente a la disponibilidad de bloques en el calendario.
                    La duración del bloque y la cantidad de bloques por turno determinan el tiempo total de cada reserva (ej: 3 bloques de 30 min = 90 min).
                </p>
            </div>
        </div>
    );
}
