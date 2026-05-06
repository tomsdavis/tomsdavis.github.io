// Spec pass 7b: floating year readout in the top-right of the viewport.
// Visible only when the drawer's <input type="datetime-local"> can't represent
// the current year (outside 0001–9999) or when 'sidereal-lock' rotation mode
// is engaged. Hidden in the everyday case.
//
// Pure logic lives in year-readout-logic.ts; this module is the DOM shell.

import type { AppState, Store, Unsubscribe } from '../state';
import { formatYear, shouldShowYearReadout } from './year-readout-logic';

export interface YearReadout {
  detach(): void;
}

export function attachYearReadout(opts: {
  container: HTMLElement;
  store: Store<AppState>;
}): YearReadout {
  const { container, store } = opts;

  const el = document.createElement('div');
  el.id = 'year-readout';
  container.appendChild(el);

  const sync = () => {
    const s = store.get();
    const visible = shouldShowYearReadout(s);
    el.hidden = !visible;
    if (visible) el.textContent = formatYear(s.instant);
  };
  sync();

  const unsubs: Unsubscribe[] = [
    store.subscribe('instant', sync),
    store.subscribe('rotationMode', sync),
  ];

  return {
    detach() {
      for (const u of unsubs) u();
      el.remove();
    },
  };
}
