import { Clock } from 'lucide-react';

interface Court {
    id: number;
    name: string;
}

export default function Calendar() {
    const [selectedCourt, setSelectedCourt] = useState<number | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

    const courts: Court[] = [
        { id: 1, name: 'Cancha 1' },
        { id: 2, name: 'Cancha 2' },
        { id: 3, name: 'Cancha 3' },
        { id: 4, name: 'Cancha 4' },
        { id: 5, name: 'Cancha 5' },
    ];

    const timeSlots = [
        '08:00', '09:30', '11:00', '12:30', '14:00', '15:30', '17:00', '18:30', '20:00'
    ];

    const handleSlotClick = (courtId: number, slot: string) => {
        setSelectedCourt(courtId);
        setSelectedSlot(slot);
    };

    return (
        <div className="calendar-container">
            <div className="calendar-grid" style={{
                display: 'grid',
                gridTemplateColumns: '80px repeat(5, 1fr)',
                gap: '10px',
                overflowX: 'auto'
            }}>
                {/* Header: Courts */}
                <div style={{ background: 'transparent' }}></div>
                {courts.map(court => (
                    <div key={court.id} style={{
                        textAlign: 'center',
                        padding: '10px',
                        fontWeight: '700',
                        color: 'var(--brand-blue)',
                        borderBottom: '2px solid var(--brand-blue-pastel)'
                    }}>
                        {court.name}
                    </div>
                ))}

                {/* Rows: Time Slots */}
                {timeSlots.map(time => (
                    <>
                        <div key={`${time}-label`} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)',
                            fontWeight: '600'
                        }}>
                            {time}
                        </div>
                        {courts.map(court => {
                            const isSelected = selectedCourt === court.id && selectedSlot === time;
                            return (
                                <div
                                    key={`${court.id}-${time}`}
                                    onClick={() => handleSlotClick(court.id, time)}
                                    className="glass"
                                    style={{
                                        height: '60px',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        background: isSelected ? 'var(--brand-blue-pastel)' : 'rgba(255,255,255,0.5)',
                                        border: isSelected ? '2px solid var(--brand-blue)' : '1px solid var(--border)',
                                        boxShadow: isSelected ? 'var(--shadow-md)' : 'none'
                                    }}
                                >
                                    {isSelected ? (
                                        <div style={{ color: 'var(--brand-blue)', fontWeight: '700', fontSize: '0.8rem' }}>SELECCIONADO</div>
                                    ) : (
                                        <div style={{ color: 'var(--text-muted)', opacity: 0.3 }}><Clock size={16} /></div>
                                    )}
                                </div>
                            );
                        })}
                    </>
                ))}
            </div>

            {selectedSlot && (
                <div className="glass" style={{
                    marginTop: '30px',
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--brand-blue-pastel)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    animation: 'fadeIn 0.3s ease-in-out'
                }}>
                    <div>
                        <h4 style={{ color: 'var(--brand-blue)', marginBottom: '4px' }}>Detalles de la Reserva</h4>
                        <p style={{ fontWeight: '600' }}>Cancha {selectedCourt} • {selectedSlot} hs (90 min)</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-secondary" onClick={() => { setSelectedCourt(null); setSelectedSlot(null); }}>Cancelar</button>
                        <button className="btn-primary">Continuar</button>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}
