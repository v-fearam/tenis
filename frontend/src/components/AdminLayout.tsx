import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';

export default function AdminLayout() {
    const [isPinned, setIsPinned] = useState(() => {
        return localStorage.getItem('admin_sidebar_pinned') === 'true';
    });

    // Listen for storage changes in case we want to sync (though not strictly necessary here)
    useEffect(() => {
        const handleStorage = () => {
            setIsPinned(localStorage.getItem('admin_sidebar_pinned') === 'true');
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const handlePinChange = (pinned: boolean) => {
        setIsPinned(pinned);
        localStorage.setItem('admin_sidebar_pinned', String(pinned));
    };

    // We can use a ResizeObserver or just a simple interval/event if we need more precision,
    // but a CSS transition on margin-left should match the sidebar's transition.
    const marginLeft = isPinned ? '280px' : '80px';

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
            <AdminSidebar isPinned={isPinned} onPinChange={handlePinChange} />
            <div style={{
                flex: 1,
                marginLeft: marginLeft,
                transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                minWidth: 0, // Prevent flex items from overflowing
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ flex: 1 }}>
                    <Outlet />
                </div>
                <footer
                    style={{
                        padding: '16px 0 24px',
                        textAlign: 'center',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        opacity: 0.7,
                    }}
                    aria-label="Creator attribution"
                >
                    by Federico Arambarri
                </footer>
            </div>
        </div>
    );
}
