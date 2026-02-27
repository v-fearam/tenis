import { Clock, Lightbulb } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import '../calendar-mobile.css';

interface Court {
    id: number;
    nombre: string;
    hora_apertura?: string;
    hora_cierre?: string;
}

interface Booking {
    id: string;
    court_id: number;
    start_time: string;
    end_time: string;
    status: 'pending' | 'confirmed' | 'cancelled';
}

interface Bloqueo {
    id: string;
    id_cancha: number;
    tipo: 'torneo' | 'clase' | 'mantenimiento' | 'otro';
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    descripcion: string;
}

interface CalendarProps {
    onConfirm: (courtId: number, slot: string) => void;
    refreshKey?: number;
}

export default function Calendar({ onConfirm, refreshKey }: CalendarProps) {
    const [selectedCourt, setSelectedCourt] = useState<number | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [timeSlots, setTimeSlots] = useState<string[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
    const [config, setConfig] = useState<{ blockDuration: number; blocksPerTurn: number }>({
        blockDuration: 30,
        blocksPerTurn: 3
    });

    // Initial courts ordered by light availability (with light first)
    const [courts, setCourts] = useState<Court[]>([
        { id: 4, nombre: 'Cancha 4', hora_apertura: '08:00', hora_cierre: '23:30' },
        { id: 5, nombre: 'Cancha 5', hora_apertura: '08:00', hora_cierre: '23:30' },
        { id: 1, nombre: 'Cancha 1', hora_apertura: '08:00', hora_cierre: '18:00' },
        { id: 2, nombre: 'Cancha 2', hora_apertura: '08:00', hora_cierre: '18:00' },
        { id: 3, nombre: 'Cancha 3', hora_apertura: '08:00', hora_cierre: '18:00' },
    ]);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // Fetch Courts from DB
                const courtsData = await api.get<Court[]>('/canchas').catch(async () => {
                    // Fallback if /canchas endpoint doesn't exist yet
                    return api.get<Court[]>('/bookings/courts');
                });
                if (courtsData && courtsData.length > 0) {
                    // Sort courts: with light (later closing time) first, then without light
                    const sortedCourts = courtsData.sort((a, b) => {
                        const aClose = a.hora_cierre || '18:00';
                        const bClose = b.hora_cierre || '18:00';
                        // Sort descending (later closing time first)
                        return bClose.localeCompare(aClose);
                    });
                    setCourts(sortedCourts);
                }

                const cfg = await api.get<{ clave: string; valor: string }[]>('/config');
                const apertura = cfg.find(c => c.clave === 'hora_apertura')?.valor || '08:00';
                const cierre = cfg.find(c => c.clave === 'hora_cierre')?.valor || '23:30';
                const duracion_bloque = parseInt(cfg.find(c => c.clave === 'duracion_bloque')?.valor || '30');
                const bloques_por_turno = parseInt(cfg.find(c => c.clave === 'bloques_por_turno')?.valor || '3');

                setConfig({ blockDuration: duracion_bloque, blocksPerTurn: bloques_por_turno });

                const slots: string[] = [];
                let [h, m] = apertura.split(':').map(Number);
                const [hEnd, mEnd] = cierre.split(':').map(Number);

                while (h < hEnd || (h === hEnd && m < mEnd)) {
                    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    slots.push(timeStr);

                    m += duracion_bloque;
                    while (m >= 60) {
                        m -= 60;
                        h += 1;
                    }
                }
                setTimeSlots(slots);
            } catch (err) {
                console.error('Error fetching calendar config:', err);
                // Fallback slots if API fails (08:00 to 23:30 in 30min blocks)
                const fallbackSlots = [];
                for (let h = 8; h <= 23; h++) {
                    fallbackSlots.push(`${h.toString().padStart(2, '0')}:00`);
                    if (h < 23 || (h === 23 && 0 < 30)) {
                        fallbackSlots.push(`${h.toString().padStart(2, '0')}:30`);
                    }
                }
                setTimeSlots(fallbackSlots);
            }
        };
        fetchConfig();
    }, []);

    useEffect(() => {
        const fetchCalendarData = async () => {
            try {
                const selectedDateStr = selectedDate.toISOString().split('T')[0];

                // Fetch all bookings with large pageSize to get all results
                // The response is now paginated: { data: [], meta: {} }
                const bookingsResponse = await api.get<{ data: any[] }>('/bookings?pageSize=1000');
                const bookingsData = bookingsResponse.data || [];

                const filteredBookings = bookingsData
                    .filter(b => b.start_time.split('T')[0] === selectedDateStr && b.status !== 'cancelled')
                    .map(b => ({
                        id: b.id,
                        court_id: b.court_id,
                        start_time: b.start_time,
                        end_time: b.end_time || new Date(new Date(b.start_time).getTime() + 90 * 60000).toISOString(),
                        status: b.status
                    }));
                setBookings(filteredBookings);

                // Fetch bloqueos for the selected date (this endpoint still returns array when fecha param is provided)
                const bloqueosData = await api.get<any[]>(`/bloqueos?fecha=${selectedDateStr}`);
                setBloqueos(bloqueosData);

            } catch (err) {
                console.error('Error fetching calendar data:', err);
            }
        };
        fetchCalendarData();
        // Reset local selection when refreshing or changing date
        setSelectedSlot(null);
        setSelectedCourt(null);
    }, [selectedDate, refreshKey]);

    const isSlotSelected = (courtId: number, time: string) => {
        if (!selectedSlot || selectedCourt !== courtId) return false;
        const slots = [];
        const [h, m] = selectedSlot.split(':').map(Number);
        for (let i = 0; i < config.blocksPerTurn; i++) {
            const currentM = m + (i * config.blockDuration);
            const totalM = h * 60 + currentM;
            const curH = Math.floor(totalM / 60);
            const curM = totalM % 60;
            slots.push(`${curH.toString().padStart(2, '0')}:${curM.toString().padStart(2, '0')}`);
        }
        return slots.includes(time);
    };

    // Performance Optimization: Pre-calculate maps
    const slotMap = React.useMemo(() => {
        const now = new Date();
        const map: Record<string, { occupied?: Booking, blocked?: Bloqueo, past: boolean, closed: boolean }> = {};

        timeSlots.forEach(time => {
            const [h, m] = time.split(':').map(Number);
            const checkTime = new Date(selectedDate);
            checkTime.setHours(h, m, 0, 0);
            const isPast = checkTime < now;

            courts.forEach(court => {
                const key = `${court.id}-${time}`;

                // Closed check
                const checkTimeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
                const open = court.hora_apertura || '08:00';
                const close = court.hora_cierre || '23:30';
                const closed = checkTimeStr < open || checkTimeStr >= close;

                // Occupied check
                const occupied = bookings.find(b => {
                    if (b.court_id !== court.id) return false;
                    const bStart = new Date(b.start_time);
                    const bEnd = new Date(b.end_time);
                    return checkTime >= bStart && checkTime < bEnd;
                });

                // Blocked check
                const blocked = bloqueos.find(b => {
                    if (b.id_cancha !== court.id) return false;
                    const bStart = new Date(`${b.fecha}T${b.hora_inicio}`);
                    const bEnd = new Date(`${b.fecha}T${b.hora_fin}`);
                    return checkTime >= bStart && checkTime < bEnd;
                });

                map[key] = { occupied, blocked, past: isPast, closed };
            });
        });
        return map;
    }, [courts, timeSlots, bookings, bloqueos, selectedDate]);

    const handleSlotClick = (courtId: number, slot: string) => {
        const state = slotMap[`${courtId}-${slot}`];
        if (!state || state.occupied || state.blocked || state.closed || state.past) return;
        setSelectedCourt(courtId);
        setSelectedSlot(slot);
    };

    // Generate next 7 days
    const nextSevenDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
    });


    const handleConfirmAction = () => {
        if (selectedCourt && selectedSlot) {
            // Combine date and time for the confirmation
            const [hours, minutes] = selectedSlot.split(':');
            const fullDate = new Date(selectedDate);
            fullDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            onConfirm(selectedCourt, fullDate.toISOString());

            // Clear internal selection after calling onConfirm
            setSelectedSlot(null);
            setSelectedCourt(null);
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
            {/* Header: Date Selector + Selected Slot Info */}
            <div className="calendar-header-wrapper">
                <div className="date-selector">
                    {nextSevenDays.map((date, i) => {
                        const { dayName, dayNum } = formatDate(date);
                        const isSelected = isSameDay(date, selectedDate);
                        return (
                            <div
                                key={i}
                                onClick={() => setSelectedDate(date)}
                                className={`date-selector-item ${isSelected ? 'date-selected' : ''}`}
                            >
                                <div className="date-day-name">{dayName}</div>
                                <div className="date-day-num">{dayNum}</div>
                            </div>
                        );
                    })}
                </div>

                {selectedSlot && (
                    <div className="glass animate-slide-up selected-slot-panel">
                        <div className="selected-slot-info">
                            <div className="selected-slot-title">
                                Cancha {selectedCourt} • {selectedSlot} hs
                            </div>
                            <div className="selected-slot-date">
                                {formatDate(selectedDate).dayName} {formatDate(selectedDate).dayNum}
                            </div>
                        </div>
                        <div className="selected-slot-actions">
                            <button className="btn-secondary" onClick={() => { setSelectedCourt(null); setSelectedSlot(null); }}>Cancelar</button>
                            <button className="btn-primary" onClick={handleConfirmAction}>Continuar</button>
                        </div>
                    </div>
                )}
            </div>

            <div style={{
                maxHeight: '70vh',
                overflowY: 'auto',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                position: 'relative'
            }}>
                <div className="calendar-grid">
                {/* Header: Courts (Sticky Top) */}
                <div className="court-header-corner"></div>
                {courts.map(court => {
                    // Check if court has lighting (closes after 20:00)
                    const hasLight = court.hora_cierre && court.hora_cierre >= '20:00';

                    return (
                        <div key={court.id} className="court-header">
                            <span className="court-name">{court.nombre}</span>
                            {hasLight && (
                                <Lightbulb
                                    className="court-light-icon"
                                    title="Cancha con luz"
                                />
                            )}
                        </div>
                    );
                })}

                {/* Rows: Time Slots */}
                {timeSlots.map(time => {
                    const label = (
                        <div key={`${time}-label`} className="time-label">
                            {time}
                        </div>
                    );

                    const rowSlots = courts.map(court => {
                        const key = `${court.id}-${time}`;
                        const state = slotMap[key];

                        const isSelected = isSlotSelected(court.id, time);
                        const isSlotBlocked = !!state.blocked;
                        const isSlotOccupied = !!state.occupied;
                        const isSlotClosed = state.closed;
                        const isSlotPast = state.past;
                        const isStart = selectedCourt === court.id && selectedSlot === time;

                        let bgColor = 'rgba(255,255,255,0.5)';
                        let labelContent = <div style={{ color: 'var(--text-muted)', opacity: 0.2 }}><Clock size={14} /></div>;
                        let opacity = 1;
                        let tooltip = "";

                        if (isSlotClosed) {
                            bgColor = '#E5E7E9';
                            opacity = 0.5;
                            labelContent = <div style={{ color: 'var(--text-muted)', fontSize: '0.6rem', fontWeight: '800' }}>Sin Luz</div>;
                            tooltip = "Cancha cerrada por falta de iluminación";
                        } else if (isSlotPast) {
                            bgColor = '#F2F3F4';
                            opacity = 0.4;
                            labelContent = <></>;
                            tooltip = "Este horario ya ha pasado";
                        } else if (isSlotOccupied || isSlotBlocked) {
                            if (isSlotBlocked) {
                                bgColor = '#FFE0B2'; // Naranjita pastel
                                opacity = 0.9;
                                labelContent = <div style={{ color: '#E67E22', fontSize: '0.66rem', fontWeight: '800' }}>{state.blocked!.tipo.toUpperCase()}</div>;
                                tooltip = state.blocked!.descripcion || `Canchas bloqueada por ${state.blocked!.tipo}`;
                            } else {
                                bgColor = '#E3F2FD'; // Celeste pastel
                                opacity = 0.8;
                                labelContent = <div style={{ color: 'var(--brand-blue)', fontSize: '0.66rem', fontWeight: '600' }}>Reservado</div>;
                                if (state.occupied) {
                                    tooltip = `Estado: ${state.occupied.status === 'pending' ? 'Pendiente' : 'Confirmado'}`;
                                }
                            }
                        }

                        if (isSelected) {
                            bgColor = 'var(--brand-blue-pastel)';
                            labelContent = isStart
                                ? <div style={{ color: 'var(--brand-blue)', fontWeight: '800', fontSize: '0.7rem' }}>INICIO</div>
                                : <div style={{ color: 'var(--brand-blue)', fontWeight: '600', fontSize: '0.65rem', opacity: 0.6 }}>Ocupado</div>;
                        }

                        return (
                            <div
                                key={`${court.id}-${time}`}
                                onClick={() => handleSlotClick(court.id, time)}
                                className="glass court-slot"
                                title={tooltip}
                                style={{
                                    cursor: isSlotOccupied ? 'not-allowed' : 'pointer',
                                    background: bgColor,
                                    border: isSelected ? '2px solid var(--brand-blue)' : '1px solid var(--border)',
                                    opacity: opacity,
                                    borderTop: isSelected && !isStart ? 'none' : (isSelected ? '2px solid var(--brand-blue)' : '1px solid var(--border)'),
                                    borderBottom: isSelected && timeSlots.indexOf(time) < timeSlots.indexOf(selectedSlot!) + config.blocksPerTurn - 1 ? 'none' : (isSelected ? '2px solid var(--brand-blue)' : '1px solid var(--border)'),
                                    zIndex: isSelected ? 2 : 1,
                                    boxShadow: isSelected ? 'var(--shadow-md)' : 'none'
                                }}
                            >
                                {labelContent}
                            </div>
                        );
                    });

                    return (
                        <React.Fragment key={time}>
                            {label}
                            {rowSlots}
                        </React.Fragment>
                    );
                })}
                </div>
            </div>


            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}
