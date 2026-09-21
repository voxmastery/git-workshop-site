import { CLASS_YEARS, DEPARTMENTS } from '../data/event';

export type RegistrationInput = {
  name: string;
  email: string;
  department: string;
  classYear: string;
  phone: string;
  githubUsername: string;
  noGithubYet: boolean;
};

export type FieldErrors = Partial<Record<keyof RegistrationInput, string>>;

export const EMPTY_REGISTRATION: RegistrationInput = {
  name: '',
  email: '',
  department: '',
  classYear: '',
  phone: '',
  githubUsername: '',
  noGithubYet: false,
};

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateRegistration(input: RegistrationInput): FieldErrors {
  const errors: FieldErrors = {};
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) errors.name = 'Enter your full name (2–60 characters).';

  const email = normaliseEmail(input.email);
  if (!/^[^\s@]+@gmail\.com$/.test(email)) errors.email = 'Use a personal Gmail address ending in @gmail.com.';

  if (!(DEPARTMENTS as readonly string[]).includes(input.department)) errors.department = 'Pick your department.';
  if (!(CLASS_YEARS as readonly string[]).includes(input.classYear)) errors.classYear = 'Pick your year.';

  const phone = input.phone.replace(/\s+/g, '');
  if (!/^[0-9]{10}$/.test(phone)) errors.phone = 'Enter a 10-digit WhatsApp number.';

  if (!input.noGithubYet && input.githubUsername.trim() && !/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(input.githubUsername.trim())) {
    errors.githubUsername = 'That doesn’t look like a GitHub username.';
  }

  return errors;
}

export function formatTicketNo(n: number): string {
  return `CYN-GIT-${String(n).padStart(4, '0')}`;
}
