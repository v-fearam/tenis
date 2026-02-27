import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, Plus, Search, Edit2, Trash2, X, UserMinus,
  TrendingUp, CheckCircle2, RefreshCw, AlertTriangle, BarChart3,
} from 'lucide-react';
import { api } from '../lib/api';
import { Toast, type ToastType } from '../components/Toast';
import { usePagination } from '../hooks/usePagination';
import type { PaginatedResponse } from '../types/pagination';
import PaginationControls from '../components/PaginationControls';
import type { TipoAbono } from '../types/abono';

interface Socio {
  id: string;
  nro_socio: number;
  id_tipo_abono: string | null;
  creditos_disponibles: number;
  tipo_abono: TipoAbono | null;
}

interface UsuarioConSocio {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  socios: Socio[] | Socio | null;
}

interface SocioConUsuario {
  socio: Socio;
  usuario: { id: string; nombre: string; email: string };
}

type TypeModalMode = 'create' | 'edit' | null;

export default function AdminAbonos() {
  // --- Types state ---
  const [tipos, setTipos] = useState<TipoAbono[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(true);
  const [typeModal, setTypeModal] = useState<TypeModalMode>(null);
  const [editingType, setEditingType] = useState<TipoAbono | null>(null);
  const [typeForm, setTypeForm] = useState({ nombre: '', creditos: '', precio: '', color: '#3498DB' });
  const [typeFormError, setTypeFormError] = useState('');
  const [savingType, setSavingType] = useState(false);

  // --- Socios state ---
  const [sociosList, setSociosList] = useState<SocioConUsuario[]>([]);
  const [loadingSocios, setLoadingSocios] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [assigningTo, setAssigningTo] = useState<string | null>(null); // socio id

  // --- Stats state ---
  const [abonoStats, setAbonoStats] = useState<{
    por_tipo: Array<{ tipo_abono_id: string; nombre: string; color: string; count: number }>;
    sin_abono: number;
  } | null>(null);

  // --- Cierre mensual state ---
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [ejecutandoCierre, setEjecutandoCierre] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const pagination = usePagination();

  // --- Fetch Stats ---
  const fetchStats = useCallback(async () => {
    try {
      const data = await api.get<{
        por_tipo: Array<{ tipo_abono_id: string; nombre: string; color: string; count: number }>;
        sin_abono: number;
      }>('/abonos/stats');
      setAbonoStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // --- Fetch Types ---
  const fetchTipos = useCallback(async () => {
    try {
      const data = await api.get<TipoAbono[]>('/abonos/types');
      setTipos(data);
    } catch (err) {
      console.error('Error fetching tipos:', err);
    } finally {
      setLoadingTipos(false);
    }
  }, []);

  // --- Fetch Socios ---
  const fetchSocios = useCallback(async () => {
    try {
      const params = pagination.getQueryParams();
      const response = await api.get<PaginatedResponse<UsuarioConSocio>>(
        `/users?page=${params.page}&pageSize=${params.pageSize}`
      );
      // Normalize: socios can be array, object, or null depending on Supabase
      const mapped: SocioConUsuario[] = [];
      for (const u of response.data) {
        const socioArr = Array.isArray(u.socios) ? u.socios : u.socios ? [u.socios] : [];
        if (socioArr.length > 0) {
          mapped.push({
            socio: socioArr[0],
            usuario: { id: u.id, nombre: u.nombre, email: u.email },
          });
        }
      }
      setSociosList(mapped);
      pagination.setMeta(response.meta);
    } catch (err) {
      console.error('Error fetching socios:', err);
    } finally {
      setLoadingSocios(false);
    }
  }, [pagination.page, pagination.pageSize]);

  useEffect(() => { fetchTipos(); fetchStats(); }, [fetchTipos, fetchStats]);
  useEffect(() => { fetchSocios(); }, [fetchSocios]);

  // --- Type CRUD Handlers ---
  const openCreateType = () => {
    setTypeForm({ nombre: '', creditos: '', precio: '', color: '#3498DB' });
    setEditingType(null);
    setTypeFormError('');
    setTypeModal('create');
  };

  const openEditType = (tipo: TipoAbono) => {
    setTypeForm({
      nombre: tipo.nombre,
      creditos: String(tipo.creditos),
      precio: String(tipo.precio),
      color: tipo.color || '#3498DB',
    });
    setEditingType(tipo);
    setTypeFormError('');
    setTypeModal('edit');
  };

  const closeTypeModal = () => {
    setTypeModal(null);
    setEditingType(null);
    setTypeFormError('');
  };

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    setTypeFormError('');
    setSavingType(true);

    const payload = {
      nombre: typeForm.nombre,
      creditos: Number(typeForm.creditos),
      precio: Number(typeForm.precio),
      color: typeForm.color,
    };

    try {
      if (typeModal === 'create') {
        await api.post('/abonos/types', payload);
        setToast({ message: 'Tipo de abono creado', type: 'success' });
      } else if (typeModal === 'edit' && editingType) {
        await api.patch(`/abonos/types/${editingType.id}`, payload);
        setToast({ message: 'Tipo de abono actualizado', type: 'success' });
      }
      closeTypeModal();
      await fetchTipos();
    } catch (err: any) {
      setTypeFormError(err.message || 'Error al guardar');
    } finally {
      setSavingType(false);
    }
  };

  const handleDeleteType = async (tipo: TipoAbono) => {
    if (!confirm(`¿Eliminar el tipo de abono "${tipo.nombre}"?`)) return;
    try {
      await api.delete(`/abonos/types/${tipo.id}`);
      setToast({ message: 'Tipo de abono eliminado', type: 'success' });
      await fetchTipos();
    } catch (err: any) {
      setToast({ message: err.message || 'Error al eliminar', type: 'error' });
    }
  };

  // --- Assignment Handlers ---
  const handleAssign = async (socioId: string, tipoAbonoId: string) => {
    try {
      await api.post('/abonos/assign', { socio_id: socioId, tipo_abono_id: tipoAbonoId });
      setToast({ message: 'Abono asignado correctamente', type: 'success' });
      setAssigningTo(null);
      await fetchSocios();
      await fetchStats();
    } catch (err: any) {
      setToast({ message: err.message || 'Error al asignar abono', type: 'error' });
    }
  };

  const handleRemoveAbono = async (socioId: string) => {
    if (!confirm('¿Quitar el abono de este socio?')) return;
    try {
      await api.delete(`/abonos/assign/${socioId}`);
      setToast({ message: 'Abono removido', type: 'success' });
      await fetchSocios();
      await fetchStats();
    } catch (err: any) {
      setToast({ message: err.message || 'Error al quitar abono', type: 'error' });
    }
  };

  // --- Cierre Mensual Handler ---
  const handleCierreMensual = async () => {
    setEjecutandoCierre(true);
    try {
      await api.post('/abonos/cierre-mensual', {});
      setToast({ message: 'Cambio de mes ejecutado correctamente. Todos los abonos fueron limpiados.', type: 'success' });
      setShowCierreModal(false);
      setConfirmText('');
      await fetchSocios();
      await fetchStats();
    } catch (err: any) {
      setToast({ message: err.message || 'Error al ejecutar el cambio de mes', type: 'error' });
    } finally {
      setEjecutandoCierre(false);
    }
  };

  // --- Filtered socios ---
  const filteredSocios = searchTerm
    ? sociosList.filter(s =>
      s.usuario.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.usuario.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.socio.nro_socio.toString().includes(searchTerm)
    )
    : sociosList;

  const loading = loadingTipos || loadingSocios;

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Cargando abonos...</p>
      </div>
    );
  }

  return (
    <div className="container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header + Tipos inline */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h1 style={{ color: 'var(--brand-blue)', fontSize: '1.3rem', fontWeight: '800', lineHeight: 1.2 }}>
              Gestión de Abonos
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Tipos de abono y asignación a socios
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowCierreModal(true)}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.85rem', minHeight: 'auto', background: 'var(--clay-orange, #E67E22)' }}
            >
              <RefreshCw size={16} /> Cambio de Mes
            </button>
            <button className="btn-primary" onClick={openCreateType} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.85rem', minHeight: 'auto' }}>
              <Plus size={16} /> Nuevo Tipo
            </button>
          </div>
        </div>

        {tipos.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No hay tipos de abono creados.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {tipos.map(tipo => (
              <div key={tipo.id} className="card" style={{ padding: '10px 14px', position: 'relative', overflow: 'hidden', flex: '1 1 180px', maxWidth: '260px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{
                    padding: '5px', borderRadius: '8px',
                    background: (tipo.color || '#3498DB') + '22',
                    color: tipo.color || '#3498DB', display: 'flex',
                  }}>
                    <TrendingUp size={15} />
                  </div>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: '800', flex: 1 }}>{tipo.nombre}</h3>
                  <button onClick={() => openEditType(tipo)} title="Editar" style={iconBtnStyle}>
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => handleDeleteType(tipo)} title="Eliminar" style={{ ...iconBtnStyle, color: '#E74C3C' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: '900' }}>
                    ${tipo.precio.toLocaleString()}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>/mes</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <CheckCircle2 size={12} style={{ color: 'var(--brand-green, #27AE60)' }} />
                    <span><strong style={{ color: 'var(--text-main)' }}>{tipo.creditos}</strong> créd.</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === Bar Chart: Abonos por Tipo === */}
      {abonoStats && (abonoStats.por_tipo.length > 0 || abonoStats.sin_abono > 0) && (() => {
        const allBars = [
          ...abonoStats.por_tipo.map(t => ({ label: t.nombre, count: t.count, color: t.color })),
          ...(abonoStats.sin_abono > 0 ? [{ label: 'Sin abono', count: abonoStats.sin_abono, color: '#BDC3C7' }] : []),
        ];
        const maxCount = Math.max(...allBars.map(b => b.count), 1);
        return (
          <div className="card" style={{ padding: '16px 20px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <BarChart3 size={16} style={{ color: 'var(--brand-blue)' }} />
              <h2 style={{ fontSize: '0.9rem', fontWeight: '700', margin: 0 }}>Abonos Asignados por Tipo</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {allBars.map((bar) => (
                <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '100px', fontSize: '0.8rem', fontWeight: '600', textAlign: 'right', flexShrink: 0, color: 'var(--text-main)' }}>
                    {bar.label}
                  </div>
                  <div style={{ flex: 1, height: '28px', background: 'var(--bg-main, #F8F9FA)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      height: '100%',
                      width: `${(bar.count / maxCount) * 100}%`,
                      background: bar.color,
                      borderRadius: '6px',
                      transition: 'width 0.6s ease',
                      minWidth: bar.count > 0 ? '24px' : '0',
                    }} />
                    <span style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-main)',
                    }}>
                      {bar.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* === SECTION 2: Socios y Asignación === */}
      <div>
        <h2 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px' }}>Asignación de Abonos</h2>

        {/* Search */}
        <div className="card" style={{ marginBottom: '10px', padding: '10px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por nombre, email o nro de socio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '12px 12px 12px 40px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Socios Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                <th style={thStyle}>Socio</th>
                <th style={thStyle}>Abono</th>
                <th style={thStyle}>Créditos</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredSocios.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {searchTerm ? 'No se encontraron socios.' : 'No hay socios registrados.'}
                  </td>
                </tr>
              ) : (
                filteredSocios.map(({ socio, usuario }) => {
                  const tipoAbono = socio.tipo_abono;
                  return (
                    <tr key={socio.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: 'var(--brand-blue-pastel, #D6EAF8)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--brand-blue)', fontWeight: '800', fontSize: '0.85rem',
                          }}>
                            {usuario.nombre.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{usuario.nombre}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Socio #{socio.nro_socio}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        {tipoAbono ? (
                          <span style={{
                            padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700',
                            background: (tipoAbono.color || '#3498DB') + '22',
                            color: tipoAbono.color || '#3498DB',
                            border: `1px solid ${(tipoAbono.color || '#3498DB')}44`,
                          }}>
                            {tipoAbono.nombre}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin abono</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {tipoAbono ? (
                          <div style={{ width: '120px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                              <span>Disponibles</span>
                              <span style={{ fontWeight: '700' }}>
                                {socio.creditos_disponibles}/{tipoAbono.creditos}
                              </span>
                            </div>
                            <div style={{ height: '6px', background: 'var(--border, #eee)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${tipoAbono.creditos > 0 ? (socio.creditos_disponibles / tipoAbono.creditos) * 100 : 0}%`,
                                background: tipoAbono.color || 'var(--brand-blue)',
                                transition: 'width 0.5s ease',
                              }} />
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {assigningTo === socio.id ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {tipos.map(tipo => (
                              <button
                                key={tipo.id}
                                onClick={() => handleAssign(socio.id, tipo.id)}
                                className="btn-primary"
                                style={{
                                  padding: '4px 10px', fontSize: '0.75rem',
                                  background: tipo.color || '#3498DB',
                                }}
                                title={`${tipo.creditos} créditos - $${tipo.precio}`}
                              >
                                {tipo.nombre}
                              </button>
                            ))}
                            <button
                              onClick={() => setAssigningTo(null)}
                              style={{ ...iconBtnStyle, padding: '4px 8px' }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                            <button
                              onClick={() => setAssigningTo(socio.id)}
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <CreditCard size={14} />
                              {tipoAbono ? 'Cambiar' : 'Asignar'}
                            </button>
                            {tipoAbono && (
                              <button
                                onClick={() => handleRemoveAbono(socio.id)}
                                title="Quitar abono"
                                style={{ ...iconBtnStyle, color: '#E74C3C' }}
                              >
                                <UserMinus size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <PaginationControls
          meta={pagination.meta}
          onPageChange={pagination.goToPage}
          onNext={pagination.nextPage}
          onPrevious={pagination.previousPage}
          onFirst={pagination.firstPage}
          onLast={pagination.lastPage}
        />
      </div>

      {/* === Type Modal === */}
      {typeModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={closeTypeModal}>
          <div
            className="card"
            style={{ width: '100%', maxWidth: '450px', padding: '32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>
                {typeModal === 'create' ? 'Nuevo Tipo de Abono' : 'Editar Tipo de Abono'}
              </h2>
              <button onClick={closeTypeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {typeFormError && (
              <div style={{
                background: '#FADBD8', color: '#E74C3C',
                padding: '12px', borderRadius: 'var(--radius-sm)',
                marginBottom: '16px', fontSize: '0.875rem',
              }}>
                {typeFormError}
              </div>
            )}

            <form onSubmit={handleSaveType}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <FormField label="Nombre" required>
                  <input
                    type="text"
                    value={typeForm.nombre}
                    onChange={(e) => setTypeForm({ ...typeForm, nombre: e.target.value })}
                    required
                    style={inputStyle}
                    placeholder="Ej: Básico, Premium..."
                  />
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <FormField label="Créditos" required>
                    <input
                      type="number"
                      value={typeForm.creditos}
                      onChange={(e) => setTypeForm({ ...typeForm, creditos: e.target.value })}
                      required
                      min="1"
                      style={inputStyle}
                      placeholder="Ej: 10"
                    />
                  </FormField>
                  <FormField label="Precio ($)" required>
                    <input
                      type="number"
                      value={typeForm.precio}
                      onChange={(e) => setTypeForm({ ...typeForm, precio: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                      style={inputStyle}
                      placeholder="Ej: 15000"
                    />
                  </FormField>
                </div>

                <FormField label="Color">
                  <input
                    type="color"
                    value={typeForm.color}
                    onChange={(e) => setTypeForm({ ...typeForm, color: e.target.value })}
                    style={{ ...inputStyle, height: '42px', padding: '4px', cursor: 'pointer' }}
                  />
                </FormField>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '28px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={closeTypeModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={savingType} style={{ opacity: savingType ? 0.7 : 1 }}>
                  {savingType ? 'Guardando...' : typeModal === 'create' ? 'Crear Tipo' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === Cierre Mensual Confirmation Modal === */}
      {showCierreModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => { setShowCierreModal(false); setConfirmText(''); }}>
          <div
            className="card"
            style={{ width: '100%', maxWidth: '500px', padding: '32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                padding: '10px', borderRadius: '12px',
                background: '#FDEDEC', color: '#E74C3C', display: 'flex',
              }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#E74C3C', margin: 0 }}>
                  Cambio de Mes
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Cierre mensual de abonos
                </p>
              </div>
            </div>

            <div style={{
              background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 'var(--radius-sm)',
              padding: '16px', marginBottom: '20px', fontSize: '0.88rem', lineHeight: 1.7,
            }}>
              <p style={{ fontWeight: '700', marginBottom: '8px', color: '#E65100' }}>
                Esta accion es irreversible. Se realizaran los siguientes cambios:
              </p>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                <li>Se guardara un resumen financiero del mes actual (abonos y turnos) para reportes</li>
                <li>Se eliminaran <strong>TODOS</strong> los abonos asignados a socios</li>
                <li>Los creditos disponibles de todos los socios se pondran en <strong>0</strong></li>
                <li>Los tipos de abono <strong>NO</strong> se eliminan (solo las asignaciones)</li>
              </ul>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Socios con abono actualmente: <strong style={{ color: 'var(--text-main)' }}>
                {sociosList.filter(s => s.socio.id_tipo_abono).length}
              </strong> (en esta pagina)
            </p>

            <FormField label='Escribi "CONFIRMAR" para continuar' required>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                style={inputStyle}
                placeholder="CONFIRMAR"
                autoComplete="off"
              />
            </FormField>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => { setShowCierreModal(false); setConfirmText(''); }}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                disabled={confirmText !== 'CONFIRMAR' || ejecutandoCierre}
                onClick={handleCierreMensual}
                style={{
                  background: '#E74C3C',
                  opacity: confirmText !== 'CONFIRMAR' || ejecutandoCierre ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {ejecutandoCierre ? 'Ejecutando...' : 'Ejecutar Cambio de Mes'}
              </button>
            </div>
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
        display: 'block', fontSize: '0.8rem', fontWeight: '600',
        color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px',
      }}>
        {label} {required && <span style={{ color: '#E74C3C' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem',
  fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px', fontSize: '0.875rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  padding: '6px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
};
