export const TIMEZONE = "America/Sao_Paulo";

export function formatCpf(value: string) {
  return value.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatDate(date: Date | string) {
  const value = typeof date === "string" ? new Date(`${date}T12:00:00`) : date;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE }).format(value);
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
