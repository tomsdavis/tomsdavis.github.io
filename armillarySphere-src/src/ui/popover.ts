// Drawer-local popover primitive. Only one popover is open at a time across
// the whole app — opening one closes any other registered popover. Dismissed
// by outside-click, Escape, or another popover opening. The trigger is a
// caller-styled button; the panel is a bare <div> the caller fills with
// grouped controls.

export interface PopoverOptions {
  label: string;
  title?: string;
}

export interface PopoverHandle {
  trigger: HTMLButtonElement;
  panel: HTMLDivElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

const openPopovers = new Set<PopoverHandle>();

let documentListenersAttached = false;
function ensureDocumentListeners(): void {
  if (documentListenersAttached) return;
  documentListenersAttached = true;
  document.addEventListener('pointerdown', (e) => {
    if (openPopovers.size === 0) return;
    const target = e.target as Node | null;
    for (const p of [...openPopovers]) {
      if (target && (p.trigger.contains(target) || p.panel.contains(target))) continue;
      p.close();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || openPopovers.size === 0) return;
    for (const p of [...openPopovers]) p.close();
  });
}

export function createPopover(opts: PopoverOptions): PopoverHandle {
  ensureDocumentListeners();

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'popover-trigger';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  if (opts.title) trigger.title = opts.title;

  const labelText = document.createElement('span');
  labelText.textContent = opts.label;
  const chevron = document.createElement('span');
  chevron.className = 'popover-chevron';
  chevron.textContent = '▾';
  trigger.append(labelText, chevron);

  const panel = document.createElement('div');
  panel.className = 'popover-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');

  const handle: PopoverHandle = {
    trigger,
    panel,
    open() {
      if (panel.hidden === false) return;
      // Close any siblings first so only one panel is on screen.
      for (const p of [...openPopovers]) if (p !== handle) p.close();
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      trigger.classList.add('open');
      openPopovers.add(handle);
    },
    close() {
      if (panel.hidden) return;
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.classList.remove('open');
      openPopovers.delete(handle);
    },
    isOpen() {
      return !panel.hidden;
    },
    destroy() {
      handle.close();
      trigger.removeEventListener('click', onTriggerClick);
      trigger.remove();
      panel.remove();
    },
  };

  const onTriggerClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (handle.isOpen()) handle.close();
    else handle.open();
  };
  trigger.addEventListener('click', onTriggerClick);

  return handle;
}
