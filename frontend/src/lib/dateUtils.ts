const AR_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Format a date string or Date object to dd/MM/yyyy format
 * Uses Argentina timezone to extract date parts correctly.
 * @param date - Date string (YYYY-MM-DD or ISO) or Date object
 * @returns Formatted date string (dd/MM/yyyy)
 */
export function formatDateToDDMMYYYY(date: string | Date): string {
    let dateObj: Date;

    if (typeof date === 'string') {
        if (date.includes('T')) {
            dateObj = new Date(date);
        } else {
            // Plain date without time — add noon to avoid rollover
            dateObj = new Date(date + 'T12:00:00');
        }
    } else {
        dateObj = date;
    }

    if (isNaN(dateObj.getTime())) {
        return 'Fecha inválida';
    }

    // Use Argentina timezone to get correct day/month/year
    const day = dateObj.toLocaleDateString('en-GB', { day: '2-digit', timeZone: AR_TIMEZONE });
    const month = dateObj.toLocaleDateString('en-GB', { month: '2-digit', timeZone: AR_TIMEZONE });
    const year = dateObj.toLocaleDateString('en-GB', { year: 'numeric', timeZone: AR_TIMEZONE });

    return `${day}/${month}/${year}`;
}

/**
 * Format a date string or Date object to dd/MM/yyyy HH:mm format
 * Uses Argentina timezone for both date and time parts.
 * @param date - Date string or Date object
 * @returns Formatted date string (dd/MM/yyyy HH:mm)
 */
export function formatDateTimeToDD_MM_YYYY_HH_MM(date: string | Date): string {
    const dateFormatted = formatDateToDDMMYYYY(date);
    if (dateFormatted === 'Fecha inválida') return dateFormatted;

    const timeFormatted = formatTimeToAR(date);
    return `${dateFormatted} ${timeFormatted}`;
}

/**
 * Format a time string in Argentina timezone (HH:mm, 24h).
 * Replaces all usages of `new Date(x).toLocaleTimeString()` to ensure
 * consistent display regardless of browser/server timezone.
 * @param date - Date string (ISO) or Date object
 * @returns Formatted time string (HH:mm)
 */
export function formatTimeToAR(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: AR_TIMEZONE,
        hour12: false,
    });
}

/**
 * Get today's date as YYYY-MM-DD in Argentina timezone.
 * Replaces `new Date().toISOString().split('T')[0]` which can shift
 * dates near midnight (23:30 AR = 02:30 UTC next day).
 */
export function todayAR(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: AR_TIMEZONE });
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
