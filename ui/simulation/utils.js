// utils.js - Utility functions
export function excelToDate(serial) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + serial * 86400 * 1000);
    return date.toISOString().split("T")[0];
}