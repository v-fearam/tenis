import { useState } from 'react';
import { MatchType } from '../types/booking';

interface Player {
    user_id?: string;
    guest_name?: string;
    is_organizer: boolean;
}

interface BookingFormProps {
    courtId: number;
    slot: string;
    onCancel: () => void;
    onSubmit: (data: { type: MatchType; players: Player[] }) => void;
}

export default function BookingForm({ courtId, slot, onCancel, onSubmit }: BookingFormProps) {
    const [matchType, setMatchType] = useState<MatchType>(MatchType.SINGLE);
    const [players, setPlayers] = useState<Player[]>([
        { is_organizer: true, guest_name: 'Yo (Socio)' }
    ]);
    const [guestName, setGuestName] = useState('');

    const maxPlayers = matchType === MatchType.SINGLE ? 2 : 4;

    const addGuest = () => {
        if (players.length < maxPlayers && guestName.trim()) {
            setPlayers([...players, { is_organizer: false, guest_name: guestName.trim() }]);
            setGuestName('');
        }
    };

    const removePlayer = (index: number) => {
        if (index === 0) return; // Cannot remove organizer
        setPlayers(players.filter((_, i) => i !== index));
    };

    return (
        <div className="booking-form-overlay" style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', animation: 'slideUp 0.3s ease-out' }}>
                <h2 style={{ marginBottom: '20px', color: 'var(--brand-blue)' }}>Completar Reserva</h2>
                <p style={{ marginBottom: '24px', fontWeight: '600' }}>Cancha {courtId} • {slot} hs</p>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Tipo de Partido</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            className={matchType === MatchType.SINGLE ? 'btn-primary' : 'btn-secondary'}
                            onClick={() => { setMatchType(MatchType.SINGLE); setPlayers(players.slice(0, 2)); }}
                            style={{ flex: 1 }}
                        >Individual</button>
                        <button
                            className={matchType === MatchType.DOUBLE ? 'btn-primary' : 'btn-secondary'}
                            onClick={() => setMatchType(MatchType.DOUBLE)}
                            style={{ flex: 1 }}
                        >Dobles</button>
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Jugadores ({players.length}/{maxPlayers})</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {players.map((p, i) => (
                            <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', padding: '10px',
                                background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)'
                            }}>
                                <span>{p.guest_name || 'Socio'}</span>
                                {i > 0 && <span onClick={() => removePlayer(i)} style={{ color: '#E74C3C', cursor: 'pointer', fontWeight: 'bold' }}>✕</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {players.length < maxPlayers && (
                    <div style={{ marginBottom: '24px', display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            placeholder="Nombre del invitado..."
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                        />
                        <button className="btn-secondary" onClick={addGuest} style={{ padding: '10px' }}>Agregar</button>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '15px' }}>
                    <button className="btn-secondary" onClick={onCancel} style={{ flex: 1 }}>Volver</button>
                    <button
                        className="btn-primary"
                        onClick={() => onSubmit({ type: matchType, players })}
                        disabled={players.length < (matchType === MatchType.SINGLE ? 2 : 2)} // Min 2 players to start
                        style={{ flex: 1 }}
                    >Solicitar Reserva</button>
                </div>
            </div>

            <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}
