type Child = Node | string | null | undefined | false;

export interface ElementOptions {
  readonly className?: string;
  readonly text?: string;
  readonly attrs?: Readonly<Record<string, string>>;
  readonly style?: Readonly<Record<string, string>>;
  readonly onClick?: () => void;
  readonly isDisabled?: boolean;
}

/** Small element factory so view code reads as structure rather than DOM plumbing. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  for (const [name, value] of Object.entries(options.attrs ?? {})) element.setAttribute(name, value);
  for (const [name, value] of Object.entries(options.style ?? {})) element.style.setProperty(name, value);
  const { onClick } = options;
  if (onClick) element.addEventListener('click', () => onClick());
  if (options.isDisabled && element instanceof HTMLButtonElement) element.disabled = true;
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child);
  }
  return element;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg(markup: string, className: string, viewBox = '0 0 100 100'): SVGSVGElement {
  const element = document.createElementNS(SVG_NS, 'svg');
  element.setAttribute('viewBox', viewBox);
  element.setAttribute('class', className);
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = markup;
  return element;
}

export function money(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

export function percent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, prefersReducedMotion() ? 0 : milliseconds));
}
