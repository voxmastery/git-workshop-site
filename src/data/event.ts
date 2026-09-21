export const EVENT = {
  name: 'Git & GitHub Workshop',
  chapter: 'The First Commit',
  series: 'Part 1 of 2 · Next chapter in October',
  organiser: 'Cynergy Coding Club · Dept. of CSE · RUAS',
  kicker: 'CYNERGY CODING CLUB · CSE · RUAS',
  dateLabel: 'Tue 22 Sep 2026',
  dateDay: '22',
  dateMonth: 'SEP',
  checkIn: '2:00 PM',
  session: '2:00 PM – 5:00 PM',
  venue: 'Room A206, RUAS Peenya Campus, Bengaluru',
  venueShort: 'Room A206 · RUAS Peenya',
  cost: 'Free',
  bring: 'Laptop + charger. GitHub account created beforehand.',
  subhead:
    'Save your projects. Build with friends. Put your work online — in one afternoon, no experience needed.',
  hosts: [
    { name: 'Ganesh', bio: '5th Sem AI/ML · Cynergy · CSE, RUAS' },
    { name: 'Aman', bio: '5th Sem AI/ML · Cynergy · CSE, RUAS' },
  ],
} as const;

export const TAKEAWAYS = [
  { icon: 'repo', title: 'Your first repository', text: 'Pushed from your own laptop.' },
  { icon: 'pull-request', title: 'A merged pull request', text: 'Opened, reviewed and merged with a partner.' },
  { icon: 'globe', title: 'A live website', text: 'Deployed from your repo with GitHub Pages.' },
  { icon: 'star', title: 'A developer profile', text: 'Profile README, take-home challenge.' },
  { icon: 'fork', title: 'The workshop kit', text: 'Cheat sheet, troubleshooting guide, starter files.' },
  { icon: 'merge', title: 'A certificate', text: 'Emailed the same evening, plus the Student Developer Pack walkthrough.' },
] as const;

export const AGENDA = [
  { time: '2:00', title: 'Check-in + setup desk', text: 'Install Git, sign in to GitHub' },
  { time: '2:30', title: 'Why version control', text: 'Git vs GitHub' },
  { time: '2:50', title: 'Your first repo', text: 'clone, commit, push' },
  { time: '3:20', title: 'Branches', text: '' },
  { time: '3:40', title: 'Break', text: '' },
  { time: '3:50', title: 'Pull requests', text: 'Reviewing a partner’s code' },
  { time: '4:15', title: 'Pair build', text: 'Ship one site together' },
  { time: '4:40', title: 'Deploy live', text: 'GitHub Pages' },
  { time: '4:50', title: 'Profile README demo', text: 'Take-home challenge · photo' },
] as const;

export const FAQ = [
  ['Do I need to know coding?', 'No. If you can install an app and follow along, you’re set.'],
  ['Windows / Mac / Linux?', 'All fine. Git installs on everything; we’ll have a fallback in the browser if it doesn’t.'],
  ['Do I need a laptop?', 'Yes, with a charger. Phones won’t work for this one.'],
  ['Is it free?', 'Yes.'],
  ['What should I do before coming?', 'Create a GitHub account and install Git (link in the confirmation message).'],
  ['Certificate?', 'Yes, emailed the same evening to everyone who attends.'],
] as const;

export const DEPARTMENTS = ['CSE', 'AI/ML', 'ISE', 'ECE', 'EEE', 'ME', 'Civil', 'Other'] as const;
export const CLASS_YEARS = ['1st', '2nd', '3rd', '4th'] as const;
