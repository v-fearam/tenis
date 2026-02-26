import React from 'react';
import { formatDateToDDMMYYYY } from '../lib/dateUtils';

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
  const [displayValue, setDisplayValue] = React.useState('');

  // Initialize display value when value prop changes
  React.useEffect(() => {
    if (value) {
      setDisplayValue(formatDateToDDMMYYYY(value));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setDisplayValue(input);

    // Try to parse dd/MM/yyyy format
    if (input === '') {
      onChange('');
      return;
    }

    const parts = input.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      
      // Validate the date
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);

      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 2000) {
        const isoDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        onChange(isoDate);
      }
    }
  };

  if (compact) {
    return (
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder="dd/MM/yyyy"
        pattern="\d{2}/\d{2}/\d{4}"
        title="Formato: dd/MM/yyyy (ej: 26/02/2026)"
        style={{
          padding: '6px 10px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'var(--bg-main)',
          color: 'var(--text-main)',
          fontSize: '0.85rem',
          fontWeight: '500',
          ...style
        }}
      />
    );
  }

  return (
    <div>
      {label && <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '600' }}>{label}</label>}
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder="dd/MM/yyyy"
        required={required}
        pattern="\d{2}/\d{2}/\d{4}"
        title="Formato: dd/MM/yyyy (ej: 26/02/2026)"
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          fontSize: '0.95rem',
          ...style
        }}
      />
    </div>
  );
}
