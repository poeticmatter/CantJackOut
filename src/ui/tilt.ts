/** Cards lean toward the pointer and catch a sheen of light where it rests. */
const MAX_TILT_DEGREES = 7;

export function withTilt<T extends HTMLElement>(card: T): T {
  card.classList.add('has-tilt');
  card.addEventListener('pointermove', (event) => {
    const rect = card.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    card.style.setProperty('--tilt-x', `${(x - 0.5) * MAX_TILT_DEGREES * 2}deg`);
    card.style.setProperty('--tilt-y', `${(0.5 - y) * MAX_TILT_DEGREES * 2}deg`);
    card.style.setProperty('--sheen-x', `${x * 100}%`);
  });
  card.addEventListener('pointerleave', () => {
    card.style.removeProperty('--tilt-x');
    card.style.removeProperty('--tilt-y');
    card.style.removeProperty('--sheen-x');
  });
  return card;
}
