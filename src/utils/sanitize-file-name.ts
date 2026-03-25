export function sanitizeFileName(fileName: string): string {
  const sanitized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w.-]/g, "")
    .replace(/-+/g, "-") // evita vários "-"
    .replace(/^\.+/, "") // remove "." no início
    .toLowerCase()
    .slice(0, 100); // limite de tamanho

  if (!sanitized) {
    return "file";
  }

  return sanitized;
}