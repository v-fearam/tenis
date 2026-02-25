import { useState, useRef, useCallback } from 'react';
import { MatchType } from '../types/booking';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Usuario } from '../types/user';
import { Search, X, UserCheck, UserPlus } from 'lucide-react';

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
  onSubmit: (data: { type: MatchType; players: Player[] }) => void;
}

export default function BookingForm({ courtId, slot, onCancel, onSubmit }: BookingFormProps) {
  const { user } = useAuth();
  const [matchType, setMatchType] = useState<MatchType | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);

  const maxPlayers = matchType === MatchType.SINGLE ? 2 : 4;

  const handleSelectType = (type: MatchType) => {
    setMatchType(type);
    const count = type === MatchType.SINGLE ? 2 : 4;
    const slots: Player[] = Array.from({ length: count }, (_, i) => ({
      is_organizer: i === 0,
      display_name: '',
      is_socio: true,
      // Pre-fill first slot with logged-in user
      ...(i === 0 && user
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
    if (index === 0 && user) return; // Can't clear organizer if logged in
    setPlayers((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, user_id: undefined, guest_name: undefined, display_name: '', is_socio: true } : p
      )
    );
  };

  const allPlayersFilled = players.length > 0 && players.every((p) => p.display_name.trim() !== '');

  // Step 1: Select match type
  if (!matchType) {
    return (
      <Overlay>
        <div className="card" style={{ width: '100%', maxWidth: '460px', animation: 'slideUp 0.3s ease-out' }}>
          <h2 style={{ marginBottom: '8px', color: 'var(--brand-blue)' }}>Nueva Reserva</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
            Cancha {courtId} &bull; {slot} hs
          </p>

          <label style={labelStyle}>Tipo de Partido</label>
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
        <SlideUpKeyframes />
      </Overlay>
    );
  }

  // Step 2: Fill players
  return (
    <Overlay>
      <div className="card" style={{ width: '100%', maxWidth: '520px', animation: 'slideUp 0.3s ease-out' }}>
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
                  onEdit={() => setEditingSlot(index)}
                  onClear={() => clearPlayer(index)}
                />
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn-secondary"
            onClick={() => { setMatchType(null); setPlayers([]); setEditingSlot(null); }}
            style={{ flex: 1 }}
          >
            Volver
          </button>
          <button
            className="btn-primary"
            onClick={() => onSubmit({ type: matchType, players })}
            disabled={!allPlayersFilled}
            style={{ flex: 1, opacity: allPlayersFilled ? 1 : 0.5, cursor: allPlayersFilled ? 'pointer' : 'not-allowed' }}
          >
            Solicitar Reserva
          </button>
        </div>
      </div>
      <SlideUpKeyframes />
    </Overlay>
  );
}

/* ─── Sub-components ─── */

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px',
    }}>
      {children}
    </div>
  );
}

function SlideUpKeyframes() {
  return (
    <style>{`
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  );
}

function TypeCard({ selected, onClick, icon, title, subtitle }: {
  selected: boolean; onClick: () => void; icon: string; title: string; subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '20px', borderRadius: 'var(--radius-md)',
        border: selected ? '2px solid var(--brand-blue)' : '2px solid var(--border)',
        background: selected ? 'var(--brand-blue-pastel)' : 'var(--bg-card)',
        cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
      }}
    >
      <div style={{ fontSize: '1.5rem', marginBottom: '8px', fontWeight: '800' }}>{icon}</div>
      <div style={{ fontWeight: '700', fontSize: '1rem' }}>{title}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>{subtitle}</div>
    </button>
  );
}

function PlayerSlot({ index, player, isOrganizer, onEdit, onClear }: {
  index: number; player: Player; isOrganizer: boolean; onEdit: () => void; onClear: () => void;
}) {
  const filled = player.display_name.trim() !== '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 14px', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      background: filled ? 'var(--bg-main)' : 'var(--bg-card)',
      cursor: filled && isOrganizer ? 'default' : 'pointer',
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

      {filled && !isOrganizer && (
        <button onClick={(e) => { e.stopPropagation(); onClear(); }} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px',
        }}>
          <X size={16} />
        </button>
      )}
      {filled && !isOrganizer && (
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
              flex: 1, padding: '14px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
            }}
          >
            <UserCheck size={18} style={{ color: '#1E8449' }} />
            <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Socio</span>
          </button>
          <button
            onClick={() => setMode('guest')}
            style={{
              flex: 1, padding: '14px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
            }}
          >
            <UserPlus size={18} style={{ color: 'var(--clay-orange)' }} />
            <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Invitado</span>
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
        <div style={{ display: 'flex', gap: '10px' }}>
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
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', fontSize: '0.95rem', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            className="btn-primary"
            disabled={!guestName.trim()}
            onClick={() => onSelect({ guest_name: guestName.trim(), display_name: guestName.trim(), is_socio: false, user_id: undefined })}
            style={{ padding: '10px 16px', opacity: guestName.trim() ? 1 : 0.5 }}
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
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          autoFocus
          placeholder="Buscar por nombre, DNI o email..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 10px 10px 36px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', fontSize: '0.95rem', outline: 'none',
            boxSizing: 'border-box', background: 'white',
          }}
        />
      </div>

      {searching && (
        <p style={{ color: '#1E8449', fontSize: '0.8rem', padding: '8px 0' }}>Buscando...</p>
      )}

      {results.length > 0 && (
        <div style={{
          maxHeight: '180px', overflowY: 'auto',
          borderRadius: 'var(--radius-sm)', background: 'white',
          border: '1px solid var(--border)',
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
                padding: '10px 14px', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#E8F8F5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
            >
              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{u.nombre || '—'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: '600',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  marginBottom: '10px',
};
