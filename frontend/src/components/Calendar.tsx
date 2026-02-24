import { Clock } from 'lucide-react';
import { useState } from 'react';

interface Court {
    id: number;
    name: string;
}

interface CalendarProps {
    onConfirm: (courtId: number, slot: string) => void;
}

export default function Calendar({ onConfirm }: CalendarProps) {
    const [selectedCourt, setSelectedCourt] = useState<number | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

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

    // Generate next 7 days
    const nextSevenDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
    });

    const handleSlotClick = (courtId: number, slot: string) => {
        setSelectedCourt(courtId);
        setSelectedSlot(slot);
    };

    const handleConfirmAction = () => {
        if (selectedCourt && selectedSlot) {
            // Combine date and time for the confirmation
            const [hours, minutes] = selectedSlot.split(':');
            const fullDate = new Date(selectedDate);
            fullDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            onConfirm(selectedCourt, fullDate.toISOString());
        }
    };

    const formatDate = (date: Date) => {
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        return {
            dayName: days[date.getDay()],
            dayNum: date.getDate()
        };
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    return (
        <div className="calendar-container">
            {/* Date Selector */}
            <div className="date-selector" style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '24px',
                overflowX: 'auto',
                paddingBottom: '10px',
                scrollbarWidth: 'none'
            }}>
                {nextSevenDays.map((date, i) => {
                    const { dayName, dayNum } = formatDate(date);
                    const isSelected = isSameDay(date, selectedDate);
                    return (
                        <div
                            key={i}
                            onClick={() => setSelectedDate(date)}
                            style={{
                                minWidth: '60px',
                                padding: '12px 8px',
                                borderRadius: 'var(--radius-md)',
                                background: isSelected ? 'var(--brand-blue)' : 'var(--brand-blue-pastel)',
                                color: isSelected ? 'white' : 'var(--brand-blue)',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                                transform: isSelected ? 'scale(1.05)' : 'scale(1)'
                            }}
                        >
                            <div style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.8 }}>{dayName}</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800' }}>{dayNum}</div>
                        </div>
                    );
                })}
            </div>

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
                        <p style={{ fontWeight: '600' }}>
                            {formatDate(selectedDate).dayName} {formatDate(selectedDate).dayNum} • Cancha {selectedCourt} • {selectedSlot} hs
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-secondary" onClick={() => { setSelectedCourt(null); setSelectedSlot(null); }}>Cancelar</button>
                        <button className="btn-primary" onClick={handleConfirmAction}>Continuar</button>
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
