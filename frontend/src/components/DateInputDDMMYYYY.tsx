import React from 'react';

interface DateInputProps {
  value: string; // YYYY-MM-DD format internally
  onChange: (value: string) => void; // outputs YYYY-MM-DD format
  label?: string;
  required?: boolean;
  min?: string;
  compact?: boolean; // compact mode for inline filters
  style?: React.CSSProperties;
}

export default function DateInputDDMMYYYY({
  value,
  onChange,
  label,
  required = false,
  min,
  compact = false,
  style
}: DateInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value); // native date input already uses YYYY-MM-DD
  };

  if (compact) {
    return (
      <input
        type="date"
        value={value}
        onChange={handleChange}
        min={min}
        style={{
          padding: '6px 10px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'var(--bg-main)',
          color: 'var(--text-main)',
          fontSize: '0.85rem',
          fontWeight: '500',
          cursor: 'pointer',
          ...style
        }}
      />
    );
  }

  return (
    <div>
      {label && <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '600' }}>{label}</label>}
      <input
        type="date"
        value={value}
        onChange={handleChange}
        required={required}
        min={min}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          fontSize: '0.95rem',
          cursor: 'pointer',
          ...style
        }}
      />
    </div>
  );
}
