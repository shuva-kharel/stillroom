export function examDays(date: string) {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const today = new Date();
  return Math.round(
    (Date.UTC(y, m - 1, d) -
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
      86400000,
  );
}
