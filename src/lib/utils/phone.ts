export function formatE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export function isValidIndianPhone(phone: string): boolean {
  const e164 = formatE164(phone);
  return /^\+91[6-9]\d{9}$/.test(e164);
}

/**
 * Format phone number as Green API chatId: "919876543210@c.us"
 * Works for Indian numbers (10-digit or with +91 prefix).
 */
export function toGreenApiChatId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `${digits}@c.us`;
  if (digits.length === 10) return `91${digits}@c.us`;
  return `${digits}@c.us`;
}

export function displayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
}
