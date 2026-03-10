/**
 * Export utilities — no third-party xlsx dependency.
 * Uses CSV format (opens in Excel/Sheets) to avoid the xlsx ReDoS/prototype-pollution CVEs.
 */

const toCSVString = (data: any[]): string => {
  if (!data || data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = data.map(row => headers.map(h => escape(row[h])).join(","));
  return [headers.map(escape).join(","), ...rows].join("\n");
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Downloads as .csv (opens natively in Excel & Google Sheets) */
export const exportToExcel = (data: any[], filename: string) => {
  const csv = toCSVString(data);
  // UTF-8 BOM so Excel opens Arabic/special chars correctly
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
};

export const exportToCSV = (data: any[], filename: string) => {
  const csv = toCSVString(data);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
};
