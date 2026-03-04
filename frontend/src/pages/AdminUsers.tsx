import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { Usuario, CreateUserPayload, UpdateUserPayload, UserRole } from '../types/user';
import { Search, Plus, Edit2, X, UserCheck, UserX, Eye, EyeOff } from 'lucide-react';
import { Toast, type ToastType } from '../components/Toast';
import { usePagination } from '../hooks/usePagination';
import type { PaginatedResponse } from '../types/pagination';
import PaginationControls from '../components/PaginationControls';

type ModalMode = 'create' | 'edit' | null;

export default function AdminUsers() {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const pagination = usePagination();

  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    dni: '',
    telefono: '',
    rol: 'socio' as UserRole,
    force_password_change: false,
  });

  const fetchUsers = useCallback(async () => {
    try {
      const params = pagination.getQueryParams();
      const response = await api.get<PaginatedResponse<Usuario>>(
        `/users?page=${params.page}&pageSize=${params.pageSize}`
      );
      setUsers(response.data);
      pagination.setMeta(response.meta);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = searchQuery
    ? users.filter((u) =>
      [u.nombre, u.email, u.dni, u.telefono]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    : users;

  const openCreateModal = () => {
    setFormData({ nombre: '', email: '', password: '', dni: '', telefono: '', rol: 'socio', force_password_change: false });
    setShowPassword(false);
    setEditingUser(null);
    setFormError('');
    setModalMode('create');
  };

  const openEditModal = (user: Usuario) => {
    setFormData({
      nombre: user.nombre || '',
      email: user.email,
      password: '',
      dni: user.dni || '',
      telefono: user.telefono || '',
      rol: user.rol,
      force_password_change: user.force_password_change || false,
    });
    setEditingUser(user);
    setFormError('');
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingUser(null);
    setFormError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    try {
      if (modalMode === 'create') {
        const payload: CreateUserPayload = {
          email: formData.email,
          password: formData.password,
          rol: formData.rol,
          force_password_change: formData.force_password_change,
        };
        if (formData.dni) payload.dni = formData.dni;
        if (formData.telefono) payload.telefono = formData.telefono;
        await api.post('/users', payload);
      } else if (modalMode === 'edit' && editingUser) {
        const payload: UpdateUserPayload = {};
        if (formData.nombre !== editingUser.nombre) payload.nombre = formData.nombre;
        if (formData.dni !== (editingUser.dni || '')) payload.dni = formData.dni;
        if (formData.telefono !== (editingUser.telefono || '')) payload.telefono = formData.telefono;
        if (formData.rol !== editingUser.rol) payload.rol = formData.rol;
        if (formData.force_password_change !== editingUser.force_password_change) {
          payload.force_password_change = formData.force_password_change;
        }
        if (formData.password) payload.password = formData.password;
        await api.patch(`/users/${editingUser.id}`, payload);
      }
      closeModal();
      await fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (user: Usuario) => {
    if (!confirm(`¿Desactivar a ${user.nombre || user.email}?`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      await fetchUsers();
    } catch (err: any) {
      setToast({ message: err.message || 'Error al desactivar usuario', type: 'error' });
    }
  };

  const handleReactivate = async (user: Usuario) => {
    try {
      await api.patch(`/users/${user.id}`, { estado: 'activo' });
      await fetchUsers();
    } catch (err: any) {
      setToast({ message: err.message || 'Error al reactivar usuario', type: 'error' });
    }
  };

  const rolLabel: Record<UserRole, string> = {
    admin: 'Administrador',
    socio: 'Socio',
    'no-socio': 'No Socio',
  };

  const rolBadgeStyle: Record<UserRole, React.CSSProperties> = {
    admin: { background: '#E8DAEF', color: '#6C3483' },
    socio: { background: '#D4EFDF', color: '#1E8449' },
    'no-socio': { background: '#FADBD8', color: '#CB4335' },
  };

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Cargando usuarios...</p>
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
              Gestión de Usuarios
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {pagination.meta?.totalItems || 0} usuarios registrados
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-primary" onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> Nuevo Usuario
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nombre, email, DNI o teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 12px 12px 40px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              fontSize: '0.95rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
              <th style={thStyle}>Nombre</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>DNI</th>
              <th style={thStyle}>Teléfono</th>
              <th style={thStyle}>Rol</th>
              <th style={thStyle}>Estado</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  {searchQuery ? 'No se encontraron usuarios.' : 'No hay usuarios registrados.'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>{user.nombre || '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.875rem' }}>{user.email}</td>
                  <td style={tdStyle}>{user.dni || '—'}</td>
                  <td style={tdStyle}>{user.telefono || '—'}</td>
                  <td style={tdStyle}>
                    <span style={{
                      ...rolBadgeStyle[user.rol],
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                    }}>
                      {rolLabel[user.rol]}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      color: user.estado === 'activo' ? '#27AE60' : '#E74C3C',
                      fontWeight: '600',
                      fontSize: '0.85rem',
                    }}>
                      {user.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button
                        onClick={() => openEditModal(user)}
                        title="Editar"
                        style={iconBtnStyle}
                      >
                        <Edit2 size={15} />
                      </button>
                      {user.estado === 'activo' ? (
                        <button
                          onClick={() => handleDeactivate(user)}
                          title="Desactivar"
                          style={{ ...iconBtnStyle, color: '#E74C3C' }}
                        >
                          <UserX size={15} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(user)}
                          title="Reactivar"
                          style={{ ...iconBtnStyle, color: '#27AE60' }}
                        >
                          <UserCheck size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
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
                {modalMode === 'create' ? 'Nuevo Usuario' : 'Editar Usuario'}
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
                    placeholder="Nombre completo"
                  />
                </FormField>

                {modalMode === 'create' && (
                  <FormField label="Email" required>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      style={inputStyle}
                      placeholder="usuario@email.com"
                    />
                  </FormField>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <FormField label={modalMode === 'create' ? 'Contraseña' : 'Nueva Contraseña (opcional)'} required={modalMode === 'create'}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required={modalMode === 'create'}
                        minLength={6}
                        style={{ ...inputStyle, paddingRight: '40px' }}
                        placeholder={modalMode === 'create' ? 'Mínimo 6 caracteres' : 'Dejar vacío para no cambiar'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px'
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </FormField>

                  <FormField label="Rol" required>
                    <select
                      value={formData.rol}
                      onChange={(e) => setFormData({ ...formData, rol: e.target.value as UserRole })}
                      style={inputStyle}
                    >
                      <option value="socio">Socio</option>
                      <option value="no-socio">No Socio</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </FormField>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <FormField label="DNI">
                    <input
                      type="text"
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                      style={inputStyle}
                      placeholder="12345678"
                    />
                  </FormField>
                  <FormField label="Teléfono">
                    <input
                      type="text"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      style={inputStyle}
                      placeholder="2226-XXXXXX"
                    />
                  </FormField>
                </div>

                <FormField label="Rol" required>
                  <select
                    value={formData.rol}
                    onChange={(e) => setFormData({ ...formData, rol: e.target.value as UserRole })}
                    style={inputStyle}
                  >
                    <option value="socio">Socio</option>
                    <option value="no-socio">No Socio</option>
                    <option value="admin">Administrador</option>
                  </select>
                </FormField>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
                  <input
                    type="checkbox"
                    id="force_password_change"
                    checked={formData.force_password_change}
                    onChange={(e) => setFormData({ ...formData, force_password_change: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="force_password_change" style={{ fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                    Forzar cambio de contraseña al próximo ingreso
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '28px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Guardando...' : modalMode === 'create' ? 'Crear Usuario' : 'Guardar Cambios'}
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
