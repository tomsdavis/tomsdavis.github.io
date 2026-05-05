// Spec §4.3, §4.4, §4.1: native <input type="range"> wrapper used by the
// drawer for magnitude limit, celestial-sphere shell opacity, and any future
// scrub bar. Returns a small handle so subscribers can sync the slider when
// state changes elsewhere (URL fragment, persistence restore).

export interface SliderOptions {
  id: string;
  caption: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  format: (value: number) => string;
  onInput: (value: number) => void;
  title?: string;
}

export interface SliderHandle {
  el: HTMLLabelElement;
  set(value: number): void;
  destroy(): void;
}

export function createSlider(opts: SliderOptions): SliderHandle {
  const label = document.createElement('label');
  label.className = 'slider';
  label.htmlFor = opts.id;
  if (opts.title) label.title = opts.title;

  const caption = document.createElement('span');
  caption.className = 'slider-caption';
  caption.textContent = `${opts.caption} `;

  const out = document.createElement('output');
  out.htmlFor = opts.id;
  out.value = opts.format(opts.initial);
  caption.appendChild(out);

  const range = document.createElement('input');
  range.type = 'range';
  range.id = opts.id;
  range.min = String(opts.min);
  range.max = String(opts.max);
  range.step = String(opts.step);
  range.value = String(opts.initial);

  label.append(caption, range);

  const onInput = () => {
    const v = Number(range.value);
    if (!Number.isFinite(v)) return;
    out.value = opts.format(v);
    opts.onInput(v);
  };
  range.addEventListener('input', onInput);

  return {
    el: label,
    set(value: number) {
      range.value = String(value);
      out.value = opts.format(value);
    },
    destroy() {
      range.removeEventListener('input', onInput);
      label.remove();
    },
  };
}
