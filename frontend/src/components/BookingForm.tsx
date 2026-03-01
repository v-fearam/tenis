import { useState, useRef, useCallback, useEffect } from 'react';
import { MatchType } from '../types/booking';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Usuario } from '../types/user';
import { Search, X, UserCheck, UserPlus, DollarSign } from 'lucide-react';

interface Player {
  user_id?: string;
  guest_name?: string;
  is_organizer: boolean;
  display_name: string;
  is_socio: boolean;
}

interface BookingFormProps {
  courtId: number;
  slot: string;
  onCancel: () => void;
  onSubmit: (data: { type: MatchType; players: Player[]; organizer_name?: string; organizer_email?: string; organizer_phone?: string }) => void;
}

export default function BookingForm({ courtId, slot, onCancel, onSubmit }: BookingFormProps) {
  const { user, isAdmin } = useAuth();
  const [matchType, setMatchType] = useState<MatchType | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);

  // Contact info for non-authenticated organizers
  const [organizerName, setOrganizerName] = useState('');
  const [organizerEmail, setOrganizerEmail] = useState('');
  const [organizerPhone, setOrganizerPhone] = useState('');

  const maxPlayers = matchType === MatchType.SINGLE ? 2 : 4;

  // Cost preview
  const [costPreview, setCostPreview] = useState<{
    costo_total: number;
    jugadores: { nombre: string; tipo: string; usa_abono: boolean; monto: number }[];
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const allPlayersFilled = players.length > 0 && players.every((p) => p.display_name.trim() !== '');

  useEffect(() => {
    if (!allPlayersFilled) {
      setCostPreview(null);
      return;
    }

    const fetchPreview = async () => {
      setLoadingPreview(true);
      try {
        const result = await api.post<typeof costPreview>('/bookings/preview', {
          players: players.map((p) => ({
            user_id: p.user_id || undefined,
            guest_name: p.guest_name || undefined,
          })),
        });
        setCostPreview(result);
      } catch {
        setCostPreview(null);
      } finally {
        setLoadingPreview(false);
      }
    };

    fetchPreview();
  }, [players.map(p => `${p.user_id || ''}|${p.guest_name || ''}`).join(',')]);


  const handleSelectType = (type: MatchType) => {
    setMatchType(type);
    const count = type === MatchType.SINGLE ? 2 : 4;
    const slots: Player[] = Array.from({ length: count }, (_, i) => ({
      is_organizer: i === 0,
      display_name: '',
      is_socio: true,
      // Pre-fill first slot with logged-in user (skip for admins so they can choose)
      ...(i === 0 && user && !isAdmin
        ? { user_id: user.id, display_name: user.nombre || user.email, is_socio: true }
        : {}),
    }));
    setPlayers(slots);
  };

  const updatePlayer = (index: number, data: Partial<Player>) => {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, ...data } : p)));
    setEditingSlot(null);
  };

  const clearPlayer = (index: number) => {
    if (index === 0 && user && !isAdmin) return; // Can't clear organizer if logged in (admins can)
    setPlayers((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, user_id: undefined, guest_name: undefined, display_name: '', is_socio: true } : p
      )
    );
  };

  const organizerContactFilled = user || (organizerName.trim() !== '' && organizerEmail.trim() !== '' && organizerPhone.trim() !== '');
  const canSubmit = allPlayersFilled && organizerContactFilled;

  // Step 1: Select match type
  if (!matchType) {
    return (
      <Overlay>
        <div className="card animate-slide-up" style={{ width: '100%', maxWidth: '460px' }}>
          <h2 style={{ marginBottom: '8px', color: 'var(--brand-blue)' }}>Nueva Reserva</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
            Cancha {courtId} &bull; {slot} hs
          </p>

          <label className="form-label" style={{ marginBottom: '10px' }}>Tipo de Partido</label>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <TypeCard
              selected={false}
              onClick={() => handleSelectType(MatchType.SINGLE)}
              icon="1v1"
              title="Individual"
              subtitle="2 jugadores"
            />
            <TypeCard
              selected={false}
              onClick={() => handleSelectType(MatchType.DOUBLE)}
              icon="2v2"
              title="Dobles"
              subtitle="4 jugadores"
            />
          </div>

          <button className="btn-secondary" onClick={onCancel} style={{ width: '100%' }}>
            Cancelar
          </button>
        </div>
      </Overlay>
    );
  }

  // Step 2: Fill players
  return (
    <Overlay>
      <div className="card animate-slide-up" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 style={{ color: 'var(--brand-blue)' }}>Jugadores</h2>
          <span style={{
            background: matchType === MatchType.SINGLE ? 'var(--brand-blue-pastel)' : 'var(--clay-orange-pastel)',
            color: matchType === MatchType.SINGLE ? 'var(--brand-blue)' : 'var(--clay-orange)',
            padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700',
          }}>
            {matchType === MatchType.SINGLE ? 'Individual' : 'Dobles'}
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
          Cancha {courtId} &bull; {slot} hs &bull; {maxPlayers} jugadores
        </p>

        {/* Organizer Contact Info (only if not logged in) */}
        {!user && (
          <div style={{
            padding: '16px',
            background: 'var(--brand-blue-pastel)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '20px',
            border: '1px solid var(--border)'
          }}>
            <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Datos de Contacto del Organizador</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder="Nombre completo *"
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                className="form-input"
                required
              />
              <input
                type="email"
                placeholder="Email *"
                value={organizerEmail}
                onChange={(e) => setOrganizerEmail(e.target.value)}
                className="form-input"
                required
              />
              <input
                type="tel"
                placeholder="Teléfono *"
                value={organizerPhone}
                onChange={(e) => setOrganizerPhone(e.target.value)}
                className="form-input"
                required
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {players.map((player, index) => (
            <div key={index}>
              {editingSlot === index ? (
                <PlayerEditor
                  index={index}
                  onSelect={(data) => updatePlayer(index, data)}
                  onCancel={() => setEditingSlot(null)}
                />
              ) : (
                <PlayerSlot
                  index={index}
                  player={player}
                  isOrganizer={index === 0 && !!user}
                  canEditOrganizer={isAdmin}
                  onEdit={() => setEditingSlot(index)}
                  onClear={() => clearPlayer(index)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Cost preview */}
        {loadingPreview && (
          <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Calculando costo...
          </div>
        )}
        {costPreview && !loadingPreview && (
          <div style={{
            padding: '14px 16px',
            marginBottom: '16px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--brand-blue-pastel)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <DollarSign size={18} style={{ color: 'var(--brand-blue)' }} />
              <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--brand-blue)' }}>
                Costo estimado del turno
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
              {costPreview.jugadores.map((j, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-main)' }}>
                    {j.nombre}
                    {j.usa_abono && (
                      <span style={{ color: '#27AE60', fontWeight: '600', marginLeft: '6px', fontSize: '0.75rem' }}>
                        (usa abono)
                      </span>
                    )}
                  </span>
                  <span style={{ fontWeight: '600', color: j.monto > 0 ? 'var(--text-main)' : '#27AE60' }}>
                    {j.monto > 0 ? `$${j.monto.toLocaleString('es-AR')}` : '$0'}
                  </span>
                </div>
              ))}
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              borderTop: '1px solid var(--border)', paddingTop: '8px',
              fontWeight: '800', fontSize: '1rem',
            }}>
              <span>Total a pagar</span>
              <span style={{ color: 'var(--brand-blue)' }}>
                ${costPreview.costo_total.toLocaleString('es-AR')}
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn-secondary"
            onClick={() => { setMatchType(null); setPlayers([]); setEditingSlot(null); setCostPreview(null); }}
            style={{ flex: 1 }}
          >
            Volver
          </button>
          <button
            className="btn-primary"
            onClick={() => onSubmit({
              type: matchType,
              players,
              ...(organizerName && {
                organizer_name: organizerName,
                organizer_email: organizerEmail,
                organizer_phone: organizerPhone,
              })
            })}
            disabled={!canSubmit}
            style={{ flex: 1, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
          >
            Solicitar Reserva
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ─── Sub-components ─── */

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="overlay">
      {children}
    </div>
  );
}

function TypeCard({ selected, onClick, icon, title, subtitle }: {
  selected: boolean; onClick: () => void; icon: string; title: string; subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '24px 20px',
        minHeight: '120px',
        borderRadius: 'var(--radius-md)',
        border: selected ? '3px solid var(--brand-blue)' : '2px solid var(--border)',
        background: selected ? 'var(--brand-blue-pastel)' : 'var(--bg-card)',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.2s',
        WebkitTapHighlightColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: selected ? 'var(--shadow-md)' : 'none'
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '8px', fontWeight: '800' }}>{icon}</div>
      <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{title}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>{subtitle}</div>
    </button>
  );
}

function PlayerSlot({ index, player, isOrganizer, canEditOrganizer, onEdit, onClear }: {
  index: number; player: Player; isOrganizer: boolean; canEditOrganizer?: boolean; onEdit: () => void; onClear: () => void;
}) {
  const filled = player.display_name.trim() !== '';
  const locked = isOrganizer && !canEditOrganizer;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '14px 16px',
      minHeight: 'var(--touch-optimal)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      background: filled ? 'var(--bg-main)' : 'var(--bg-card)',
      cursor: filled && locked ? 'default' : 'pointer',
      WebkitTapHighlightColor: 'transparent',
      transition: 'all 0.2s'
    }} onClick={!filled ? onEdit : undefined}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        background: filled
          ? (player.is_socio ? '#D4EFDF' : 'var(--clay-orange-pastel)')
          : 'var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: '700', flexShrink: 0,
        color: filled ? (player.is_socio ? '#1E8449' : '#A04000') : 'var(--text-muted)',
      }}>
        {filled ? (index + 1) : '?'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {filled ? (
          <>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {player.display_name}
              {isOrganizer && <span style={{ color: 'var(--text-muted)', fontWeight: '400', marginLeft: '6px', fontSize: '0.8rem' }}>(organizador)</span>}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {player.is_socio ? 'Socio' : 'Invitado'}
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Jugador {index + 1} — Toca para agregar</div>
        )}
      </div>

      {filled && !locked && (
        <button onClick={(e) => { e.stopPropagation(); onClear(); }} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px',
        }}>
          <X size={16} />
        </button>
      )}
      {filled && !locked && (
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-blue)', padding: '4px', fontSize: '0.75rem', fontWeight: '600',
        }}>
          Cambiar
        </button>
      )}
    </div>
  );
}

function PlayerEditor({ index, onSelect, onCancel }: {
  index: number;
  onSelect: (data: Partial<Player>) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'socio' | 'guest' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Usuario[]>([]);
  const [searching, setSearching] = useState(false);
  const [guestName, setGuestName] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (q.trim().length < 2) {
      setResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.get<Usuario[]>(`/users/search-socios?q=${encodeURIComponent(q)}`);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  // Choose socio or guest
  if (!mode) {
    return (
      <div style={{
        padding: '14px', borderRadius: 'var(--radius-sm)',
        border: '2px solid var(--brand-blue)', background: 'var(--brand-blue-pastel)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>Jugador {index + 1}</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setMode('socio')}
            style={{
              flex: 1,
              padding: '16px 12px',
              minHeight: 'var(--touch-optimal)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
              transition: 'all 0.2s'
            }}
          >
            <UserCheck size={20} style={{ color: '#1E8449' }} />
            <span style={{ fontWeight: '600', fontSize: '1rem' }}>Socio</span>
          </button>
          <button
            onClick={() => setMode('guest')}
            style={{
              flex: 1,
              padding: '16px 12px',
              minHeight: 'var(--touch-optimal)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
              transition: 'all 0.2s'
            }}
          >
            <UserPlus size={20} style={{ color: 'var(--clay-orange)' }} />
            <span style={{ fontWeight: '600', fontSize: '1rem' }}>Invitado</span>
          </button>
        </div>
      </div>
    );
  }

  // Guest: just type name
  if (mode === 'guest') {
    return (
      <div style={{
        padding: '14px', borderRadius: 'var(--radius-sm)',
        border: '2px solid var(--clay-orange)', background: 'var(--clay-orange-pastel)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#A04000' }}>Invitado — Jugador {index + 1}</span>
          <button onClick={() => setMode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            autoFocus
            placeholder="Nombre del invitado..."
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && guestName.trim()) {
                onSelect({ guest_name: guestName.trim(), display_name: guestName.trim(), is_socio: false, user_id: undefined });
              }
            }}
            className="form-input"
            style={{
              flex: '1 1 200px',
              minHeight: 'var(--touch-min)'
            }}
          />
          <button
            className="btn-primary"
            disabled={!guestName.trim()}
            onClick={() => onSelect({ guest_name: guestName.trim(), display_name: guestName.trim(), is_socio: false, user_id: undefined })}
            style={{ opacity: guestName.trim() ? 1 : 0.5, flex: '0 0 auto' }}
          >
            Agregar
          </button>
        </div>
      </div>
    );
  }

  // Socio: search
  return (
    <div style={{
      padding: '14px', borderRadius: 'var(--radius-sm)',
      border: '2px solid #27AE60', background: '#D4EFDF',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1E8449' }}>Buscar Socio — Jugador {index + 1}</span>
        <button onClick={() => setMode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: results.length > 0 || searching ? '8px' : 0 }}>
        <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
        <input
          type="text"
          autoFocus
          placeholder="Buscar por nombre, DNI o email..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="form-input"
          style={{
            paddingLeft: '42px',
            background: 'white',
            minHeight: 'var(--touch-min)'
          }}
        />
      </div>

      {searching && (
        <p style={{ color: '#1E8449', fontSize: '0.8rem', padding: '8px 0' }}>Buscando...</p>
      )}

      {results.length > 0 && (
        <div style={{
          maxHeight: '240px',
          overflowY: 'auto',
          borderRadius: 'var(--radius-sm)',
          background: 'white',
          border: '1px solid var(--border)',
          WebkitOverflowScrolling: 'touch'
        }}>
          {results.map((u) => (
            <div
              key={u.id}
              onClick={() => onSelect({
                user_id: u.id,
                display_name: u.nombre || u.email,
                guest_name: undefined,
                is_socio: true,
              })}
              style={{
                padding: '14px 16px',
                minHeight: 'var(--touch-optimal)',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                transition: 'background 0.15s',
                WebkitTapHighlightColor: 'transparent',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#E8F8F5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
            >
              <div style={{ fontWeight: '600', fontSize: '1rem' }}>{u.nombre || '—'}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {u.email} {u.dni ? `• DNI ${u.dni}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {searchQuery.length >= 2 && !searching && results.length === 0 && (
        <p style={{ color: '#A04000', fontSize: '0.8rem', padding: '8px 0' }}>No se encontraron socios.</p>
      )}
    </div>
  );
}

