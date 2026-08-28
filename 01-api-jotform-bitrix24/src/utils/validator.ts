import { z } from 'zod';
import { ContactData } from '../interfaces/contact.interface';

// Zod schema for validating normalized contact data
const contactSchema = z.object({
  fullName: z
    .string({ required_error: 'Full Name is required' })
    .trim()
    .min(1, 'Full Name cannot be empty'),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(5, 'Phone number must have at least 5 digits'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address format'),
  submissionId: z.string().optional(),
  formId: z.string().optional(),
});

// Normalize phone number by removing extra spaces and formatting characters
export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return '';
  return rawPhone.replace(/[^\d+]/g, '').trim();
}

// Sanitize and validate incoming contact information
export function validateContactData(data: Partial<ContactData>): ContactData {
  const normalized = {
    fullName: (data.fullName || '').trim(),
    phone: normalizePhone(data.phone || ''),
    email: (data.email || '').trim().toLowerCase(),
    submissionId: data.submissionId,
    formId: data.formId,
  };

  return contactSchema.parse(normalized);
}
