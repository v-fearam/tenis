import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '!',
    info: 'i',
};

const styles: Record<ToastType, { border: string; icon: string; bg: string; text: string }> = {
    success: {
        border: '#27AE60',
        icon: '#27AE60',
        bg: 'linear-gradient(135deg, #d4edda, #c3e6cb)',
        text: '#155724',
    },
    error: {
        border: '#E74C3C',
        icon: '#E74C3C',
        bg: 'linear-gradient(135deg, #f8d7da, #f5c6cb)',
        text: '#721c24',
    },
    warning: {
        border: '#F39C12',
        icon: '#F39C12',
        bg: 'linear-gradient(135deg, #fff3cd, #ffeeba)',
        text: '#856404',
    },
    info: {
        border: '#3498DB',
        icon: '#3498DB',
        bg: 'linear-gradient(135deg, #d1ecf1, #bee5eb)',
        text: '#0c5460',
    },
};

export function Toast({ message, type, onClose, duration = 4000 }: ToastProps) {
    const [visible, setVisible] = useState(false);
    const s = styles[type];

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setVisible(true));

        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 350);
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '32px',
                right: '32px',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                padding: '18px 22px',
                borderRadius: '14px',
                background: s.bg,
                border: `2px solid ${s.border}`,
                boxShadow: `0 10px 40px rgba(0,0,0,0.18), 0 0 0 1px ${s.border}30`,
                minWidth: '280px',
                maxWidth: '420px',
                transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.95)',
            }}
            role="alert"
        >
            {/* Icon circle */}
            <div
                style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: s.icon,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '1rem',
                    flexShrink: 0,
                    boxShadow: `0 3px 10px ${s.icon}50`,
                }}
            >
                {icons[type]}
            </div>

            {/* Message */}
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '0.85rem', color: s.text, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {type === 'success' ? 'Éxito' : type === 'error' ? 'Error' : type === 'warning' ? 'Atención' : 'Info'}
                </div>
                <div style={{ color: s.text, fontSize: '0.9rem', lineHeight: '1.45', fontWeight: '500' }}>
                    {message}
                </div>
            </div>

            {/* Close button */}
            <button
                onClick={() => { setVisible(false); setTimeout(onClose, 350); }}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: s.text,
                    fontSize: '1.2rem',
                    lineHeight: '1',
                    padding: '0 2px',
                    opacity: 0.7,
                    flexShrink: 0,
                }}
                aria-label="Cerrar notificación"
            >
                ×
            </button>

            {/* Progress bar */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: '4px',
                    borderRadius: '0 0 12px 12px',
                    background: s.border,
                    animation: `toast-progress ${duration}ms linear forwards`,
                }}
            />

            <style>{`
                @keyframes toast-progress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </div>
    );
}
