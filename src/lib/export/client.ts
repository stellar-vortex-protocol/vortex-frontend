export type { ExportJob } from "./runner";
export { startExport } from "./runner";
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoke after the click has been dispatched so Safari can start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
