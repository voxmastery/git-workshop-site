import { Hero } from './components/Hero';
import { Problem } from './components/Problem';
import { Timeline } from './components/Timeline';
import { Takeaways } from './components/Takeaways';
import { Agenda } from './components/Agenda';
import { Hosts } from './components/Hosts';
import { RegisterTicket } from './components/RegisterTicket';
import { Faq } from './components/Faq';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <>
      <Hero />
      <main>
        <Problem />
        <Timeline />
        <Takeaways />
        <Agenda />
        <Hosts />
        <RegisterTicket />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
