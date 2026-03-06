import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { usePagination } from '../hooks/usePagination';
import PaginationControls from '../components/PaginationControls';
import { formatYYYYMMDDtoDDMMYYYY, formatDateTimeToDD_MM_YYYY_HH_MM } from '../lib/dateUtils';
import type { HistoryItem, HistoryDetail, HistoryResponse } from '../types/history';
import { ArrowLeft, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface SocioHistorialProps {
  /** If provided, shows history for this user (admin view). Otherwise uses current user. */
  userId?: string;
}

const twoMonthsAgoStr = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
};
const thirtyDaysAheadStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
};

const ESTADO_CHIP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pendiente: { label: 'Pendiente', bg: '#FDEDEC', color: '#C0392B', border: '#E74C3C' },
  pagado: { label: 'Pagado', bg: '#EAFAF1', color: '#1E8449', border: '#27AE60' },
  bonificado: { label: 'Bonificado', bg: '#EBF5FB', color: '#1A5276', border: '#2980B9' },
};

export default function SocioHistorial({ userId: propUserId }: SocioHistorialProps) {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const userId = propUserId || params.id; // undefined → /me endpoints

  const [deudaTotal, setDeudaTotal] = useState<number>(0);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState(twoMonthsAgoStr());
  const [fechaHasta, setFechaHasta] = useState(thirtyDaysAheadStr());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, HistoryDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const pagination = usePagination();

  const baseUrl = userId ? `/users/${userId}/history` : '/users/me/history';
  const detailBaseUrl = (turnoId: string) =>
    userId
      ? `/users/${userId}/history/${turnoId}/detail`
      : `/users/me/history/${turnoId}/detail`;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { page, pageSize } = pagination.getQueryParams();
      const data = await api.get<HistoryResponse>(
        `${baseUrl}?page=${page}&pageSize=${pageSize}&fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`,
      );
      setDeudaTotal(data.deuda_total);
      setItems(data.turnos.data);
      pagination.setMeta(data.turnos.meta);
    } catch (e) {
      console.error('Error fetching history', e);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, fechaDesde, fechaHasta, baseUrl]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const toggleDetail = async (item: HistoryItem) => {
    if (expandedId === item.turno_jugador_id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.turno_jugador_id);
    if (details[item.turno_jugador_id]) return;

    setLoadingDetail(item.turno_jugador_id);
    try {
      const url = `${detailBaseUrl(item.turno_id)}?turnoJugadorId=${item.turno_jugador_id}`;
      const data = await api.get<HistoryDetail>(url);
      setDetails((prev) => ({ ...prev, [item.turno_jugador_id]: data }));
    } catch (e) {
      console.error('Error fetching detail', e);
    } finally {
      setLoadingDetail(null);
    }
  };

  const handleFilterApply = () => {
    pagination.firstPage();
    fetchHistory();
  };

  return (
    <div className="historial-page">
      {/* Header */}
      <header className="historial-header">
        <button className="historial-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
          <span>Volver</span>
        </button>
        <h1 className="historial-title">Mi historial de turnos</h1>
      </header>

      {/* Deuda card — sticky on mobile */}
      <div className={`historial-deuda-card ${deudaTotal > 0 ? 'has-deuda' : 'sin-deuda'}`}>
        {deudaTotal > 0 ? (
          <>
            <span className="historial-deuda-label">Deuda pendiente</span>
            <span className="historial-deuda-amount">${deudaTotal.toLocaleString('es-AR')}</span>
          </>
        ) : (
          <span className="historial-sin-deuda">Sin deuda pendiente</span>
        )}
      </div>

      {/* Date filters */}
      <div className="historial-filters">
        <div className="historial-filter-group">
          <label className="historial-filter-label">Desde</label>
          <input
            type="date"
            className="historial-date-input"
            value={fechaDesde}
            max={fechaHasta}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
        </div>
        <div className="historial-filter-group">
          <label className="historial-filter-label">Hasta</label>
          <input
            type="date"
            className="historial-date-input"
            value={fechaHasta}
            min={fechaDesde}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
        </div>
        <button className="historial-filter-btn" onClick={handleFilterApply}>
          Filtrar
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="historial-loading">
          <Loader2 size={24} className="historial-spinner" />
          <span>Cargando turnos...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="historial-empty">
          No se encontraron turnos en el período seleccionado.
        </div>
      ) : (
        <div className="historial-list">
          {items.map((item) => {
            const chip = ESTADO_CHIP[item.estado_pago] ?? ESTADO_CHIP.pendiente;
            const isExpanded = expandedId === item.turno_jugador_id;
            const detail = details[item.turno_jugador_id];
            const isLoadingThis = loadingDetail === item.turno_jugador_id;

            return (
              <div key={item.turno_jugador_id} className="historial-card">
                {/* Card header — tap to expand */}
                <button
                  className="historial-card-header"
                  onClick={() => toggleDetail(item)}
                  aria-expanded={isExpanded}
                >
                  <div className="historial-card-main">
                    <div className="historial-card-fecha">
                      <span className="historial-card-date">
                        {formatYYYYMMDDtoDDMMYYYY(item.fecha)}
                      </span>
                      <span className="historial-card-time">
                        {item.hora_inicio.slice(0, 5)} – {item.hora_fin.slice(0, 5)}
                      </span>
                    </div>
                    <div className="historial-card-info">
                      <span className="historial-card-cancha">{item.cancha_nombre}</span>
                      <span className="historial-card-tipo">
                        {item.tipo_partido === 'single' ? 'Singles' : 'Dobles'}
                      </span>
                    </div>
                  </div>
                  <div className="historial-card-right">
                    <span className="historial-card-monto">
                      {item.monto_generado > 0
                        ? `$${item.monto_generado.toLocaleString('es-AR')}`
                        : '—'}
                    </span>
                    <span
                      className="historial-estado-chip"
                      style={{ background: chip.bg, color: chip.color, borderColor: chip.border }}
                    >
                      {chip.label}
                    </span>
                    <span className="historial-chevron">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </div>
                </button>

                {/* Expandable detail */}
                {isExpanded && (
                  <div className="historial-card-detail">
                    {isLoadingThis ? (
                      <div className="historial-detail-loading">
                        <Loader2 size={16} className="historial-spinner" />
                        <span>Cargando detalle...</span>
                      </div>
                    ) : detail ? (
                      <>
                        {detail.jugadores.length > 0 && (
                          <div className="historial-detail-row">
                            <span className="historial-detail-key">Con:</span>
                            <span className="historial-detail-val">
                              {detail.jugadores.map((j) => j.nombre).join(', ')}
                            </span>
                          </div>
                        )}
                        <div className="historial-detail-row">
                          <span className="historial-detail-key">Abono:</span>
                          <span className="historial-detail-val">
                            {item.uso_abono ? 'Sí' : 'No'}
                          </span>
                        </div>
                        {detail.pago_info && (
                          <>
                            <div className="historial-detail-row">
                              <span className="historial-detail-key">Fecha pago:</span>
                              <span className="historial-detail-val">
                                {formatDateTimeToDD_MM_YYYY_HH_MM(detail.pago_info.fecha)}
                              </span>
                            </div>
                            {detail.pago_info.medio && (
                              <div className="historial-detail-row">
                                <span className="historial-detail-key">Medio:</span>
                                <span className="historial-detail-val">{detail.pago_info.medio}</span>
                              </div>
                            )}
                            {detail.pago_info.observacion && (
                              <div className="historial-detail-row">
                                <span className="historial-detail-key">Obs.:</span>
                                <span className="historial-detail-val">{detail.pago_info.observacion}</span>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <span className="historial-detail-val" style={{ color: 'var(--text-muted)' }}>
                        No se pudo cargar el detalle.
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <PaginationControls
          meta={pagination.meta}
          onPageChange={pagination.goToPage}
          onNext={pagination.nextPage}
          onPrevious={pagination.previousPage}
          onFirst={pagination.firstPage}
          onLast={pagination.lastPage}
        />
      )}
    </div>
  );
}
