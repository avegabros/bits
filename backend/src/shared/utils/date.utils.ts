/**
 * Converts a UTC Date to a date string in Philippine Time (PHT, UTC+8)
 * in YYYY-MM-DD format.
 */
export const getPhtDateStr = (d: Date): string => {
    const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
    return pht.toISOString().slice(0, 10);
};
