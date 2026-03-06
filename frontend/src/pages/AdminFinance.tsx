import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, Users, Repeat } from 'lucide-react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api';
import { Toast, type ToastType } from '../components/Toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoricalMonth {
    mes: string;
    ingreso_turnos: number;
    ingreso_abonos: number;
    ingreso_recurrentes: number;
    cantidad_socios_con_abono: number;
    total: number;
}

interface MonthSummary {
    cobrado_turnos: number;
    cobrado_abonos: number;
    cobrado_recurrentes: number;
    deuda_pendiente: number;
    total_cobrado: number;
    tendencia_pct: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
    return '$' + Math.round(n).toLocaleString('es-AR');
}

function formatMes(iso: string) {
    // "2025-12-01" → "Dic 25"
    const d = new Date(iso + 'T12:00:00');
    const mes = d.toLocaleDateString('es-AR', { month: 'short' });
    const anio = String(d.getFullYear()).slice(2);
    return mes.charAt(0).toUpperCase() + mes.slice(1).replace('.', '') + ' ' + anio;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ h = 60, w = '100%', r = 12 }: { h?: number; w?: string | number; r?: number }) {
    return (
        <div style={{
            height: h, width: w, borderRadius: r,
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
            backgroundSize: '400% 100%',
            animation: 'shimmer 1.4s ease-in-out infinite',
        }} />
    );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: number;
    bg: string;
    color: string;
    icon: React.ReactNode;
    trend?: number | null;
    loading: boolean;
}

function StatCard({ label, value, bg, color, icon, trend, loading }: StatCardProps) {
    return (
        <div style={{
            flex: 1, minWidth: 180,
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 12,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {icon}
                </div>
                {trend !== null && trend !== undefined && !loading && (
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: '0.75rem', fontWeight: 700,
                        color: trend >= 0 ? '#1E8449' : '#C0392B',
                        background: trend >= 0 ? '#EAFAF1' : '#FDEDEC',
                        padding: '3px 8px', borderRadius: 20,
                    }}>
                        {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(trend).toFixed(1)}%
                    </span>
                )}
            </div>
            {loading ? (
                <>
                    <Skeleton h={32} w="60%" />
                    <Skeleton h={14} w="50%" r={6} />
                </>
            ) : (
                <>
                    <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1px', lineHeight: 1 }}>
                        {fmt(value)}
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {label}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const SERIES_DESC: Record<string, string> = {
    'Turnos': 'Cobros de turnos registrados en efectivo',
    'Abonos': 'Abonos activos al momento del cierre',
    'Recurrentes': 'Pagos de turnos recurrentes cobrados',
    'Socios c/abono': 'Cantidad de socios con abono asignado (eje derecho)',
};

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null;
    const bars = payload.filter((p: any) => p.type !== 'line');
    const line = payload.find((p: any) => p.type === 'line');
    const total = bars.reduce((s: number, p: any) => s + (Number(p.value) || 0), 0);
    return (
        <div style={{
            background: 'white', border: '1px solid var(--border)', borderRadius: 12,
            padding: '12px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', minWidth: 220,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>{label}</div>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#7E57C2', background: '#EDE7F6', padding: '2px 7px', borderRadius: 20 }}>
                    Cierre ejecutado
                </span>
            </div>
            {bars.map((p: any) => (
                <div key={p.name} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: '0.82rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, display: 'inline-block', flexShrink: 0 }} />
                            {p.name}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{fmt(p.value)}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: 14, marginTop: 1 }}>
                        {SERIES_DESC[p.name]}
                    </div>
                </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Total ingresado</span>
                <span style={{ fontWeight: 900, color: 'var(--text-main)' }}>{fmt(total)}</span>
            </div>
            {line && (
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#7E57C2' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 14, height: 2, background: '#9C27B0', display: 'inline-block', borderRadius: 2 }} />
                        {line.name}
                    </span>
                    <span style={{ fontWeight: 700 }}>{line.value} socios</span>
                </div>
            )}
        </div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminFinance() {
    const [historical, setHistorical] = useState<HistoricalMonth[]>([]);
    const [summary, setSummary] = useState<MonthSummary | null>(null);
    const [loadingHist, setLoadingHist] = useState(true);
    const [loadingSum, setLoadingSum] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    useEffect(() => {
        Promise.all([
            api.get<HistoricalMonth[]>('/pagos/historical-revenue'),
            api.get<MonthSummary>('/pagos/current-month-summary'),
        ]).then(([hist, sum]) => {
            setHistorical(hist);
            setSummary(sum);
        }).catch(() => {
            setToast({ message: 'Error al cargar datos financieros', type: 'error' });
        }).finally(() => {
            setLoadingHist(false);
            setLoadingSum(false);
        });
    }, []);

    // Chart data — format mes for X axis
    const chartData = useMemo(() =>
        historical.map(m => ({
            ...m,
            label: formatMes(m.mes),
        })),
        [historical]
    );

    // Composition metrics from historical averages
    const composition = useMemo(() => {
        if (!historical.length) return null;
        const totT = historical.reduce((s, m) => s + m.ingreso_turnos, 0);
        const totA = historical.reduce((s, m) => s + m.ingreso_abonos, 0);
        const totR = historical.reduce((s, m) => s + m.ingreso_recurrentes, 0);
        const grand = totT + totA + totR;
        if (grand === 0) return null;
        return {
            turnos: Math.round(totT / grand * 100),
            abonos: Math.round(totA / grand * 100),
            recurrentes: Math.round(totR / grand * 100),
        };
    }, [historical]);

    const loading = loadingHist || loadingSum;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
            <style>{`
                @keyframes shimmer {
                    0% { background-position: -400% 0; }
                    100% { background-position: 400% 0; }
                }
            `}</style>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <main style={{ padding: '40px', maxWidth: 1200, margin: '0 auto' }}>
                {/* Header */}
                <header style={{ marginBottom: 32 }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1px', marginBottom: 4 }}>
                        Finanzas
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
                        Ingresos del mes actual y evolución histórica por cierre mensual
                    </p>
                </header>

                {/* Stat Cards Row — MES ACTUAL */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: '0.72rem', fontWeight: 800, color: '#1E8449',
                        background: '#EAFAF1', border: '1px solid #A9DFBF',
                        padding: '4px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#27AE60', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                        Mes en curso
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Datos en tiempo real — aún no cerrado
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
                    <StatCard
                        label="Cobrado — Turnos"
                        value={summary?.cobrado_turnos ?? 0}
                        bg="var(--brand-blue-pastel)"
                        color="var(--brand-blue)"
                        icon={<DollarSign size={18} />}
                        trend={summary?.tendencia_pct ?? null}
                        loading={loadingSum}
                    />
                    <StatCard
                        label="Cobrado — Abonos"
                        value={summary?.cobrado_abonos ?? 0}
                        bg="#EAFAF1"
                        color="#1E8449"
                        icon={<Users size={18} />}
                        trend={null}
                        loading={loadingSum}
                    />
                    <StatCard
                        label="Cobrado — Recurrentes"
                        value={summary?.cobrado_recurrentes ?? 0}
                        bg="#EDE7F6"
                        color="#7E57C2"
                        icon={<Repeat size={18} />}
                        trend={null}
                        loading={loadingSum}
                    />
                    <StatCard
                        label="Deuda pendiente"
                        value={summary?.deuda_pendiente ?? 0}
                        bg="#FDEDEC"
                        color="#C0392B"
                        icon={<AlertCircle size={18} />}
                        trend={null}
                        loading={loadingSum}
                    />
                </div>

                {/* Chart Card — HISTORIAL */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: '0.72rem', fontWeight: 800, color: '#7E57C2',
                        background: '#EDE7F6', border: '1px solid #CE93D8',
                        padding: '4px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                        Historial de cierres
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Solo meses con cierre ejecutado — el mes actual no aparece aquí
                    </span>
                </div>
                <div style={{
                    background: 'white', border: '1px solid var(--border)',
                    borderRadius: 16, padding: '28px 28px 20px', marginBottom: 20,
                }}>
                    <div style={{ marginBottom: 20 }}>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                            Ingresos por cierre mensual
                        </h2>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            Cada barra = un mes ya cerrado y archivado · Pasá el mouse sobre una barra para ver el detalle
                        </p>
                    </div>

                    {loadingHist ? (
                        <Skeleton h={360} r={12} />
                    ) : historical.length === 0 ? (
                        <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text-muted)' }}>
                            <DollarSign size={40} style={{ opacity: 0.2 }} />
                            <p style={{ margin: 0, fontWeight: 600 }}>Sin cierres mensuales ejecutados</p>
                            <p style={{ margin: 0, fontSize: '0.82rem' }}>Ejecutá el primer cierre para ver el gráfico</p>
                        </div>
                    ) : (
                        <div style={{ width: '100%', height: 360 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 4, right: 50, left: 10, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 12, fill: 'var(--text-muted)', fontWeight: 600 }}
                                        axisLine={false} tickLine={false}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                                        axisLine={false} tickLine={false}
                                        tickFormatter={(v) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        tick={{ fontSize: 11, fill: '#9C27B0' }}
                                        axisLine={false} tickLine={false}
                                        label={{ value: 'Socios c/abono', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 10, fill: '#9C27B0' } }}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        wrapperStyle={{ fontSize: '0.82rem', fontWeight: 600, paddingTop: 12 }}
                                        formatter={(value) => <span style={{ color: 'var(--text-muted)' }}>{value}</span>}
                                    />
                                    <Bar yAxisId="left" dataKey="ingreso_turnos" name="Turnos" stackId="a" fill="#4A90D9" radius={[0, 0, 0, 0]} />
                                    <Bar yAxisId="left" dataKey="ingreso_abonos" name="Abonos" stackId="a" fill="#66BB6A" radius={[0, 0, 0, 0]} />
                                    <Bar yAxisId="left" dataKey="ingreso_recurrentes" name="Recurrentes" stackId="a" fill="#9C27B0" radius={[4, 4, 0, 0]} />
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="cantidad_socios_con_abono"
                                        name="Socios c/abono"
                                        stroke="#9C27B0"
                                        strokeWidth={2}
                                        strokeDasharray="5 3"
                                        dot={{ fill: '#9C27B0', r: 4, strokeWidth: 0 }}
                                        activeDot={{ r: 6 }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                        Los valores se fijan al ejecutar el cierre mensual y no cambian retroactivamente.
                    </p>
                </div>

                {/* Metrics Strip */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {/* Composición */}
                    <div style={{
                        flex: 1, minWidth: 220,
                        background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px',
                    }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                            % Composición (histórico)
                        </div>
                        {loading || !composition ? (
                            <Skeleton h={20} w="80%" r={6} />
                        ) : (
                            <>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                                    {[
                                        { label: 'Turnos', pct: composition.turnos, color: '#4A90D9', bg: 'var(--brand-blue-pastel)' },
                                        { label: 'Abonos', pct: composition.abonos, color: '#1E8449', bg: '#EAFAF1' },
                                        { label: 'Recurrentes', pct: composition.recurrentes, color: '#7E57C2', bg: '#EDE7F6' },
                                    ].map(({ label, pct, color, bg }) => (
                                        <span key={label} style={{ fontSize: '0.78rem', fontWeight: 700, color, background: bg, padding: '3px 9px', borderRadius: 20 }}>
                                            {label} {pct}%
                                        </span>
                                    ))}
                                </div>
                                {/* Mini bar */}
                                <div style={{ display: 'flex', height: 6, borderRadius: 6, overflow: 'hidden', gap: 1 }}>
                                    <div style={{ flex: composition.turnos, background: '#4A90D9' }} />
                                    <div style={{ flex: composition.abonos, background: '#66BB6A' }} />
                                    <div style={{ flex: composition.recurrentes, background: '#9C27B0' }} />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Tendencia */}
                    <div style={{
                        flex: 1, minWidth: 220,
                        background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px',
                    }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                            Tendencia vs último cierre
                        </div>
                        {loadingSum ? (
                            <Skeleton h={28} w="40%" />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {(summary?.tendencia_pct ?? 0) >= 0
                                    ? <TrendingUp size={24} color="#1E8449" />
                                    : <TrendingDown size={24} color="#C0392B" />
                                }
                                <span style={{
                                    fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.5px',
                                    color: (summary?.tendencia_pct ?? 0) >= 0 ? '#1E8449' : '#C0392B',
                                }}>
                                    {(summary?.tendencia_pct ?? 0) >= 0 ? '+' : ''}{summary?.tendencia_pct ?? 0}%
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
