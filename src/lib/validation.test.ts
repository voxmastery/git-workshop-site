import { describe, expect, it } from 'vitest';
import { EMPTY_REGISTRATION, formatTicketNo, normaliseEmail, validateRegistration } from './validation';

const valid = {
  ...EMPTY_REGISTRATION,
  name: 'Asha Rao',
  email: 'Asha.Rao@gmail.com',
  department: 'CSE',
  classYear: '2nd',
  phone: '9876543210',
  laptop: true,
};

describe('validateRegistration', () => {
  it('accepts a complete valid registration', () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it('requires a gmail address', () => {
    expect(validateRegistration({ ...valid, email: 'asha@ruas.ac.in' }).email).toBeDefined();
  });

  it('requires a 10 digit phone', () => {
    expect(validateRegistration({ ...valid, phone: '12345' }).phone).toBeDefined();
    expect(validateRegistration({ ...valid, phone: '98765 43210' }).phone).toBeUndefined();
  });

  it('requires the laptop answer', () => {
    expect(validateRegistration({ ...valid, laptop: null }).laptop).toBeDefined();
  });

  it('ignores the github username when the student has none yet', () => {
    expect(validateRegistration({ ...valid, noGithubYet: true, githubUsername: '!!bad' }).githubUsername).toBeUndefined();
    expect(validateRegistration({ ...valid, githubUsername: '!!bad' }).githubUsername).toBeDefined();
  });
});

describe('helpers', () => {
  it('lowercases and trims emails', () => {
    expect(normaliseEmail('  Asha@GMAIL.com ')).toBe('asha@gmail.com');
  });
  it('formats sequential ticket numbers', () => {
    expect(formatTicketNo(1)).toBe('CYN-GIT-0001');
    expect(formatTicketNo(123)).toBe('CYN-GIT-0123');
  });
});
