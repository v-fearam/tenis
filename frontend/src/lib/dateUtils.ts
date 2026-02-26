/**
 * Format a date string or Date object to dd/MM/yyyy format
 * @param date - Date string (YYYY-MM-DD) or Date object
 * @returns Formatted date string (dd/MM/yyyy)
 */
export function formatDateToDDMMYYYY(date: string | Date): string {
    let dateObj: Date;

    if (typeof date === 'string') {
        // Handle YYYY-MM-DD format
        if (date.includes('T')) {
            // ISO format with time
            dateObj = new Date(date);
        } else {
            // YYYY-MM-DD format
            dateObj = new Date(date + 'T12:00:00');
        }
    } else {
        dateObj = date;
    }

    if (isNaN(dateObj.getTime())) {
        return 'Fecha inválida';
    }

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();

    return `${day}/${month}/${year}`;
}

/**
 * Format a date string or Date object to dd/MM/yyyy HH:mm format
 * @param date - Date string or Date object
 * @returns Formatted date string (dd/MM/yyyy HH:mm)
 */
export function formatDateTimeToDD_MM_YYYY_HH_MM(date: string | Date): string {
    const dateFormatted = formatDateToDDMMYYYY(date);
    if (dateFormatted === 'Fecha inválida') return dateFormatted;

    let dateObj: Date;
    if (typeof date === 'string') {
        dateObj = date.includes('T') ? new Date(date) : new Date(date + 'T12:00:00');
    } else {
        dateObj = date;
    }

    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    return `${dateFormatted} ${hours}:${minutes}`;
}

/**
 * Convert YYYY-MM-DD to dd/MM/yyyy display format
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Formatted date string (dd/MM/yyyy)
 */
export function formatYYYYMMDDtoDDMMYYYY(dateString: string): string {
    const [year, month, day] = dateString.split('-');
    if (!year || !month || !day) return 'Fecha inválida';
    return `${day}/${month}/${year}`;
}
