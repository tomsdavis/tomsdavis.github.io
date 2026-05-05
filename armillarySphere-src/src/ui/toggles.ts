// Spec §4.6, §4.7: native checkbox wrapper used by the drawer for layer
// visibility (equator, ecliptic, prime meridian, constellation lines /
// boundaries / labels, star labels, terminator, planets). Layer state is
// not persisted across sessions (§5.4); only the in-memory store flips.

export interface ToggleOptions {
  id: string;
  label: string;
  initial: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
}

export interface ToggleHandle {
  el: HTMLLabelElement;
  set(checked: boolean): void;
  destroy(): void;
}

export function createToggle(opts: ToggleOptions): ToggleHandle {
  const label = document.createElement('label');
  label.className = 'toggle';
  label.htmlFor = opts.id;
  if (opts.title) label.title = opts.title;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = opts.id;
  input.checked = opts.initial;

  const text = document.createElement('span');
  text.textContent = opts.label;

  label.append(input, text);

  const onChange = () => opts.onChange(input.checked);
  input.addEventListener('change', onChange);

  return {
    el: label,
    set(checked: boolean) {
      input.checked = checked;
    },
    destroy() {
      input.removeEventListener('change', onChange);
      label.remove();
    },
  };
}
