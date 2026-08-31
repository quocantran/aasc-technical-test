import { ContactData } from '../interfaces/contact.interface';

// Mask email address to protect privacy in log streams (e.g. j***e@example.com)
export function maskEmail(email?: string): string {
  if (!email) return '';
  const [localPart, domain] = email.split('@');
  if (!domain) return '***';
  const visibleLength = Math.min(2, Math.floor(localPart.length / 2));
  return `${localPart.slice(0, visibleLength)}***@${domain}`;
}

// Mask phone number showing only first and last few digits (e.g. 091****678)
export function maskPhone(phone?: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return '****';
  return `${trimmed.slice(0, 3)}****${trimmed.slice(-3)}`;
}

// Mask full name by masking trailing characters of surname and given name
export function maskName(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) {
    return parts[0].slice(0, 1) + '***';
  }
  return parts.map((part, index) => (index === 0 ? part : `${part.slice(0, 1)}***`)).join(' ');
}

// Mask canonical ContactData object for secure audit logging
export function maskContact(contact: Partial<ContactData>): Partial<ContactData> {
  return {
    fullName: maskName(contact.fullName),
    phone: maskPhone(contact.phone),
    email: maskEmail(contact.email),
    submissionId: contact.submissionId,
    formId: contact.formId,
  };
}
