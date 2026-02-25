import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Users, CreditCard, Settings, LayoutGrid, ShieldAlert,
    ChevronLeft, Pin, PinOff, Home, Ticket
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.jpg';

interface SidebarLinkProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    count?: number;
    collapsed: boolean;
}

function SidebarLink({ to, icon, label, count, collapsed }: SidebarLinkProps) {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <Link to={to} style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: collapsed ? '0' : '12px',
            padding: '12px',
            borderRadius: '12px',
            color: isActive ? 'var(--brand-blue)' : 'var(--text-main)',
            background: isActive ? 'var(--brand-blue-pastel)' : 'transparent',
            fontWeight: isActive ? '700' : '600',
            fontSize: '0.95rem',
            transition: 'all 0.3s ease',
            justifyContent: collapsed ? 'center' : 'flex-start',
            overflow: 'hidden'
        }} title={collapsed ? label : ''}>
            <span style={{
                opacity: isActive ? 1 : 0.6,
                minWidth: '20px',
                display: 'flex',
                justifyContent: 'center'
            }}>{icon}</span>
            {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
            {!collapsed && count !== undefined && count > 0 && (
                <span style={{
                    background: 'var(--clay-orange)', color: 'white',
                    fontSize: '0.7rem', padding: '2px 6px', borderRadius: '6px',
                    marginLeft: 'auto'
                }}>{count}</span>
            )}
        </Link>
    );
}

export default function AdminSidebar({ isPinned, onPinChange }: { isPinned: boolean, onPinChange: (pinned: boolean) => void }) {
    const { logout, user } = useAuth();
    const [isHovered, setIsHovered] = useState(false);

    const collapsed = !isPinned && !isHovered;
    const width = collapsed ? '80px' : '280px';

    return (
        <aside
            className="glass"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                width: width,
                padding: collapsed ? '30px 10px' : '30px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                borderRight: '1px solid var(--border)',
                position: 'fixed',
                left: 0,
                top: 0,
                height: '100vh',
                zIndex: 1000,
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden'
            }}
        >
            {/* Header / Pin */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                marginBottom: '40px',
                padding: '0 10px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={logo} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }} />
                    {!collapsed && (
                        <span style={{ fontWeight: '900', fontSize: '1.2rem', color: 'var(--brand-blue)', letterSpacing: '-0.5px' }}>
                            BELGRANO<span style={{ color: 'var(--text-main)', opacity: 0.5 }}>ADMIN</span>
                        </span>
                    )}
                </div>
                {!collapsed && (
                    <button
                        onClick={() => onPinChange(!isPinned)}
                        style={{
                            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        {isPinned ? <Pin size={18} /> : <PinOff size={18} />}
                    </button>
                )}
            </div>

            <SidebarLink to="/" icon={<Home size={20} />} label="Vista Socio" collapsed={collapsed} />

            <div style={{ margin: '10px 0' }} />

            <div style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--text-muted)', letterSpacing: '1px', padding: '0 10px 5px', textAlign: collapsed ? 'center' : 'left' }}>
                {collapsed ? '•' : 'OPERACIONES'}
            </div>
            <SidebarLink to="/admin/bloqueos" icon={<ShieldAlert size={20} />} label="Bloqueos" collapsed={collapsed} />
            <SidebarLink to="/admin" icon={<LayoutGrid size={20} />} label="Turnos" collapsed={collapsed} />

            <div style={{ margin: '10px 0' }} />

            <div style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--text-muted)', letterSpacing: '1px', padding: '0 10px 5px', textAlign: collapsed ? 'center' : 'left' }}>
                {collapsed ? '•' : 'SOCIOS'}
            </div>
            <SidebarLink to="/admin/canchas" icon={<LayoutGrid size={20} />} label="Canchas" collapsed={collapsed} />
            <SidebarLink to="/admin/users" icon={<Users size={20} />} label="Usuarios" collapsed={collapsed} />
            <SidebarLink to="/admin/abonos" icon={<Ticket size={20} />} label="Abonos" collapsed={collapsed} />
            <SidebarLink to="/admin/finanzas" icon={<CreditCard size={20} />} label="Finanzas" collapsed={collapsed} />

            <div style={{ margin: '10px 0' }} />

            <div style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--text-muted)', letterSpacing: '1px', padding: '0 10px 5px', textAlign: collapsed ? 'center' : 'left' }}>
                {collapsed ? '•' : 'SISTEMA'}
            </div>
            <SidebarLink to="/admin/config" icon={<Settings size={20} />} label="Configuración" collapsed={collapsed} />

            {/* Profile Section */}
            <div style={{
                marginTop: 'auto',
                padding: collapsed ? '20px 0 0' : '20px 10px 0',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: collapsed ? 'center' : 'stretch',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '50%', background: 'var(--brand-blue-pastel)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-blue)', fontWeight: '800',
                        flexShrink: 0
                    }}>
                        {user?.nombre?.charAt(0) || 'A'}
                    </div>
                    {!collapsed && (
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: '700', fontSize: '0.9rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.nombre || 'Admin'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Administrador</div>
                        </div>
                    )}
                </div>
                {!collapsed ? (
                    <button onClick={logout} className="btn-secondary" style={{ width: '100%', color: '#E74C3C', border: 'none', padding: '10px', fontSize: '0.85rem' }}>
                        Cerrar Sesión
                    </button>
                ) : (
                    <button onClick={logout} className="btn-secondary" style={{ border: 'none', padding: '10px', color: '#E74C3C' }} title="Cerrar Sesión">
                        <ChevronLeft size={16} />
                    </button>
                )}
            </div>
        </aside>
    );
}
