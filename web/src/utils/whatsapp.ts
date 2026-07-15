/** Monta link wa.me a partir de telefone livre digitado pelo admin. */
export function whatsappLink(phone: string, text?: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  const base = `https://wa.me/${withCountry}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
