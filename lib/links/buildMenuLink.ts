export function buildMenuLink(origin: string, restaurantId: string, table: number): string {
  if (!Number.isInteger(table) || table < 1) {
    throw new Error('table must be a positive integer');
  }
  const trimmedOrigin = origin.replace(/\/+$/, '');
  return `${trimmedOrigin}/menu-preview/${restaurantId}?table=${table}`;
}
