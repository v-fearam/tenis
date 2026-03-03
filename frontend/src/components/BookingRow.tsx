import { Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDateToDDMMYYYY, formatTimeToAR } from '../lib/dateUtils';
import '../pages/AdminDashboard.css';

interface BookingRowProps {
    booking: {
        id: string;
        court_id: number;
        court_name?: string;
        start_time: string;
        type: string;
        costo: number;
        booking_players: any[];
        solicitante_nombre?: string;
    };
    variant: 'pending' | 'active' | 'cobrados';
    isExpanded: boolean;
    onToggleExpand: () => void;
    onConfirm?: (id: string, label: string) => void;
    onCancel?: (id: string, label: string) => void;
    isProcessing?: boolean;
}

const tipoPersonaLabel = (tipo: string) => {
    switch (tipo) {
        case 'socio': return 'Socio';
        case 'no_socio': return 'No Socio';
        case 'invitado': return 'Invitado';
        default: return tipo;
    }
};

export default function BookingRow({
    booking, variant, isExpanded, onToggleExpand,
    onConfirm, onCancel, isProcessing
}: BookingRowProps) {
    const players: any[] = booking.booking_players || [];
    const matchLabel = booking.type === 'double' ? 'Dobles' : 'Single';
    const bookingLabel = `${booking.solicitante_nombre} - ${formatDateToDDMMYYYY(booking.start_time)}`;

    if (variant === 'cobrados') {
        const allAbono = players.every((p: any) => (p.monto_generado || 0) === 0);
        const jugadores = players.map((p: any) => p.nombre || p.guest_name || 'Invitado').join(', ');
        return (
            <div className="booking-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <div className="court-badge court-badge--green">
                        <span className="court-badge-label">CANCHA</span>
                        <span className="court-badge-number">{booking.court_id}</span>
                    </div>
                    <div className="booking-row-info">
                        <div className="booking-row-datetime">
                            {formatDateToDDMMYYYY(booking.start_time)} • {formatTimeToAR(booking.start_time)} hs
                        </div>
                        <div className="cobrado-players-text">
                            {jugadores || booking.solicitante_nombre}
                        </div>
                    </div>
                </div>
                <div className="booking-row-actions">
                    {allAbono ? (
                        <span className="cobrado-abono-badge">Abono</span>
                    ) : (
                        <span className="cobrado-paid-badge">
                            ${booking.costo.toLocaleString('es-AR')}
                        </span>
                    )}
                    <span className="cobrado-status-badge">
                        <Check size={13} /> Cobrado
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="booking-row">
            <div
                onClick={onToggleExpand}
                className="booking-row-header hover-scale"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
            >
                <div className="booking-row-left">
                    <div className="booking-row-chevron">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                    <div className="court-badge court-badge--blue">
                        <span className="court-badge-label">CANCHA</span>
                        <span className="court-badge-number">{booking.court_id}</span>
                    </div>
                    <div className="booking-row-info">
                        <div className="booking-row-datetime">
                            {formatDateToDDMMYYYY(booking.start_time)} • {formatTimeToAR(booking.start_time)} hs
                            <span className={`match-type-badge ${booking.type === 'double' ? 'match-type-badge--double' : 'match-type-badge--single'}`}>
                                {matchLabel}
                            </span>
                        </div>
                        <div className="booking-row-requester">
                            Solicita: {booking.solicitante_nombre}
                            <span className="booking-row-player-count">
                                ({players.length} jugador{players.length !== 1 ? 'es' : ''})
                            </span>
                        </div>
                    </div>
                </div>

                <div className="booking-row-actions">
                    {booking.costo > 0 && (
                        <span className="cost-badge">
                            ${booking.costo.toLocaleString('es-AR')}
                        </span>
                    )}
                    {onCancel && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onCancel(booking.id, bookingLabel); }}
                            disabled={isProcessing}
                            className="btn-secondary action-btn action-btn--cancel"
                            title={variant === 'pending' ? 'Rechazar' : 'Cancelar'}
                        >
                            <X size={18} />
                        </button>
                    )}
                    {onConfirm && variant === 'pending' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onConfirm(booking.id, bookingLabel); }}
                            disabled={isProcessing}
                            className="action-btn action-btn--confirm"
                            title="Aprobar"
                        >
                            <Check size={18} />
                        </button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="booking-row-details">
                    {players.map((p: any, i: number) => (
                        <div key={p.id || i} className="player-detail-row">
                            <span className="player-detail-name">
                                {p.nombre || p.guest_name || 'Invitado'}
                            </span>
                            <div className="player-detail-badges">
                                <span className={`tipo-persona-badge ${p.tipo_persona === 'socio' ? 'tipo-persona-badge--socio' : 'tipo-persona-badge--other'}`}>
                                    {tipoPersonaLabel(p.tipo_persona)}
                                </span>
                                {p.uso_abono && (
                                    <span className="abono-badge">Abono</span>
                                )}
                                <span className="player-cost">
                                    ${(p.monto_generado || 0).toLocaleString('es-AR')}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
