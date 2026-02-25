import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { Cancha, CreateCanchaPayload, UpdateCanchaPayload } from '../types/cancha';
import { Plus, Edit2, X, CheckCircle, XCircle } from 'lucide-react';
import { Toast, type ToastType } from '../components/Toast';

type ModalMode = 'create' | 'edit' | null;

export default function AdminCanchas() {
    const [canchas, setCanchas] = useState<Cancha[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalMode, setModalMode] = useState<ModalMode>(null);
    const [editingCancha, setEditingCancha] = useState<Cancha | null>(null);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        nombre: '',
        superficie: 'polvo',
        hora_apertura: '08:00:00',
        hora_cierre: '22:30:00',
        activa: true,
    });

    const fetchCanchas = useCallback(async () => {
        try {
            const data = await api.get<Cancha[]>('/canchas');
            setCanchas(data);
        } catch (err) {
            console.error('Error fetching canchas:', err);
            setToast({ message: 'Error al cargar las canchas', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCanchas();
    }, [fetchCanchas]);

    const openCreateModal = () => {
        setFormData({
            nombre: '',
            superficie: 'polvo',
            hora_apertura: '08:00:00',
            hora_cierre: '22:30:00',
            activa: true,
        });
        setEditingCancha(null);
        setFormError('');
        setModalMode('create');
    };

    const openEditModal = (cancha: Cancha) => {
        setFormData({
            nombre: cancha.nombre,
            superficie: cancha.superficie,
            hora_apertura: cancha.hora_apertura,
            hora_cierre: cancha.hora_cierre,
            activa: cancha.activa,
        });
        setEditingCancha(cancha);
        setFormError('');
        setModalMode('edit');
    };

    const closeModal = () => {
        setModalMode(null);
        setEditingCancha(null);
        setFormError('');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        setSaving(true);

        try {
            if (modalMode === 'create') {
                const payload: CreateCanchaPayload = { ...formData };
                await api.post('/canchas', payload);
                setToast({ message: 'Cancha creada con éxito', type: 'success' });
            } else if (modalMode === 'edit' && editingCancha) {
                const payload: UpdateCanchaPayload = { ...formData };
                await api.patch(`/canchas/${editingCancha.id}`, payload);
                setToast({ message: 'Cancha actualizada con éxito', type: 'success' });
            }
            closeModal();
            await fetchCanchas();
        } catch (err: any) {
            setFormError(err.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (cancha: Cancha) => {
        try {
            await api.patch(`/canchas/${cancha.id}`, { activa: !cancha.activa });
            setToast({
                message: `Cancha ${cancha.activa ? 'desactivada' : 'activada'} correctamente`,
                type: 'success'
            });
            await fetchCanchas();
        } catch (err: any) {
            setToast({ message: err.message || 'Error al modificar estado', type: 'error' });
        }
    };

    if (loading) {
        return (
            <div className="container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
                <p style={{ color: 'var(--text-muted)' }}>Cargando canchas...</p>
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
            {/* Header */}
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div>
                        <h1 style={{ color: 'var(--brand-blue)', fontSize: '1.5rem', fontWeight: '800' }}>
                            Gestión de Canchas
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            {canchas.length} canchas registradas
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-primary" onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={18} /> Nueva Cancha
                    </button>
                </div>
            </header>

            {/* Canchas Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                            <th style={thStyle}>ID</th>
                            <th style={thStyle}>Nombre</th>
                            <th style={thStyle}>Superficie</th>
                            <th style={thStyle}>Apertura</th>
                            <th style={thStyle}>Cierre</th>
                            <th style={thStyle}>Estado</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {canchas.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    No hay canchas registradas.
                                </td>
                            </tr>
                        ) : (
                            canchas.map((cancha) => (
                                <tr key={cancha.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{cancha.id}</td>
                                    <td style={{ ...tdStyle, fontWeight: '600' }}>{cancha.nombre}</td>
                                    <td style={tdStyle}>{cancha.superficie}</td>
                                    <td style={tdStyle}>{cancha.hora_apertura}</td>
                                    <td style={tdStyle}>{cancha.hora_cierre}</td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            color: cancha.activa ? '#27AE60' : '#E74C3C',
                                            fontWeight: '600',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            {cancha.activa ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                            {cancha.activa ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                            <button
                                                onClick={() => openEditModal(cancha)}
                                                title="Editar"
                                                style={iconBtnStyle}
                                            >
                                                <Edit2 size={15} />
                                            </button>
                                            <button
                                                onClick={() => handleToggleActive(cancha)}
                                                title={cancha.activa ? 'Desactivar' : 'Activar'}
                                                style={{ ...iconBtnStyle, color: cancha.activa ? '#E74C3C' : '#27AE60' }}
                                            >
                                                {cancha.activa ? <XCircle size={15} /> : <CheckCircle size={15} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {modalMode && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000,
                }} onClick={closeModal}>
                    <div
                        className="card"
                        style={{ width: '100%', maxWidth: '500px', padding: '32px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>
                                {modalMode === 'create' ? 'Nueva Cancha' : 'Editar Cancha'}
                            </h2>
                            <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {formError && (
                            <div style={{
                                background: '#FADBD8', color: '#E74C3C',
                                padding: '12px', borderRadius: 'var(--radius-sm)',
                                marginBottom: '16px', fontSize: '0.875rem',
                            }}>
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleSave}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <FormField label="Nombre" required>
                                    <input
                                        type="text"
                                        value={formData.nombre}
                                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                        required
                                        style={inputStyle}
                                        placeholder="Ej: Cancha 1"
                                    />
                                </FormField>

                                <FormField label="Superficie">
                                    <input
                                        type="text"
                                        value={formData.superficie}
                                        onChange={(e) => setFormData({ ...formData, superficie: e.target.value })}
                                        style={inputStyle}
                                        placeholder="Ej: Polvo de ladrillo"
                                    />
                                </FormField>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <FormField label="Hora Apertura" required>
                                        <input
                                            type="text"
                                            value={formData.hora_apertura}
                                            onChange={(e) => setFormData({ ...formData, hora_apertura: e.target.value })}
                                            required
                                            style={inputStyle}
                                            placeholder="08:00:00"
                                        />
                                    </FormField>
                                    <FormField label="Hora Cierre" required>
                                        <input
                                            type="text"
                                            value={formData.hora_cierre}
                                            onChange={(e) => setFormData({ ...formData, hora_cierre: e.target.value })}
                                            required
                                            style={inputStyle}
                                            placeholder="22:30:00"
                                        />
                                    </FormField>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                                    <input
                                        type="checkbox"
                                        id="activa"
                                        checked={formData.activa}
                                        onChange={(e) => setFormData({ ...formData, activa: e.target.checked })}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    <label htmlFor="activa" style={{ fontSize: '0.95rem', cursor: 'pointer' }}>Cancha activa</label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '28px', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
                                    {saving ? 'Guardando...' : modalMode === 'create' ? 'Crear Cancha' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: '600',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: '6px',
            }}>
                {label} {required && <span style={{ color: '#E74C3C' }}>*</span>}
            </label>
            {children}
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '14px 16px',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
};

const tdStyle: React.CSSProperties = {
    padding: '14px 16px',
    fontSize: '0.9rem',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
};

const iconBtnStyle: React.CSSProperties = {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
};
