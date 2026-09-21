import { EVENT } from '../data/event';

export function Footer() {
  return (
    <footer>
      <div>{EVENT.series}</div>
      <div>{EVENT.organiser}</div>
    </footer>
  );
}
