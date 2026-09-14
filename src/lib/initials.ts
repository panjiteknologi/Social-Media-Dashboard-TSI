/** Up to two initials from a display name, falling back to the email's local part. */
export function initials(user: { name: string | null; email: string }): string {
  const source = user.name?.trim() || user.email.split('@')[0];
  const words = source.split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}
