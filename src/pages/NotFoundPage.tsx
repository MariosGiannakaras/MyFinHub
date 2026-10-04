import { useEffect, useRef } from 'react';
import { ArrowLeft, House, Route, ShieldCheck } from 'lucide-react';
import { Button } from '../components/Button';

export function NotFoundPage({ onHome, onBack }: { onHome: () => void; onBack?: () => void }) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return <main className="not-found-screen">
    <section className="not-found-card surface-raised" aria-labelledby="not-found-title">
      <div className="not-found-visual" aria-hidden="true">
        <div className="not-found-grid" />
        <div className="not-found-route-line" />
        <span className="not-found-route-node is-start"><Route size={16} /></span>
        <span className="not-found-route-node is-missing">?</span>
        <span className="not-found-route-node is-end"><House size={16} /></span>
        <div className="not-found-code"><span>4</span><b>0</b><span>4</span></div>
        <div className="not-found-caption">ROUTE NOT FOUND</div>
      </div>

      <div className="not-found-copy">
        <span className="eyebrow">404 · PRIVATE ROUTE</span>
        <h1 id="not-found-title" ref={titleRef} tabIndex={-1}>Χάσαμε τη διαδρομή, όχι τα δεδομένα σου.</h1>
        <p>Η διεύθυνση δεν αντιστοιχεί σε ενότητα του MyFinHub. Η εφαρμογή δεν εμφανίζει οικονομικά στοιχεία σε αυτή την οθόνη και μπορείς να επιστρέψεις με ασφάλεια.</p>
        <div className="not-found-safety">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Τα οικονομικά δεδομένα παραμένουν κρυφά όσο βρίσκεσαι εκτός έγκυρης ενότητας.</span>
        </div>
        <div className="not-found-actions">
          <Button type="button" variant="primary" onClick={onHome}><House size={16} aria-hidden="true" />Dashboard</Button>
          {onBack ? <Button type="button" variant="secondary" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Πίσω</Button> : null}
        </div>
      </div>
    </section>
  </main>;
}
