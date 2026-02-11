// Paleta de 12 cores distintas e vibrantes para avatares de usuários
const USER_COLOR_PALETTE = [
  { bg: '#3B82F6', text: '#FFFFFF' }, // blue
  { bg: '#EF4444', text: '#FFFFFF' }, // red
  { bg: '#10B981', text: '#FFFFFF' }, // emerald
  { bg: '#F59E0B', text: '#FFFFFF' }, // amber
  { bg: '#8B5CF6', text: '#FFFFFF' }, // violet
  { bg: '#EC4899', text: '#FFFFFF' }, // pink
  { bg: '#06B6D4', text: '#FFFFFF' }, // cyan
  { bg: '#F97316', text: '#FFFFFF' }, // orange
  { bg: '#6366F1', text: '#FFFFFF' }, // indigo
  { bg: '#14B8A6', text: '#FFFFFF' }, // teal
  { bg: '#D946EF', text: '#FFFFFF' }, // fuchsia
  { bg: '#84CC16', text: '#FFFFFF' }, // lime
];

/**
 * Gera um índice determinístico a partir de uma string (user_id).
 * Mesmo user_id → mesma cor sempre.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getUserColor(userId: string): { bg: string; text: string } {
  const idx = hashString(userId) % USER_COLOR_PALETTE.length;
  return USER_COLOR_PALETTE[idx];
}

export function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
