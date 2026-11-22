const TOAST_MILLISECONDS = 3200;

export function showToast(message: string, tone: 'warning' | 'info' = 'warning'): void {
  const container = document.getElementById('toasts');
  if (container === null) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  container.append(toast);
  window.setTimeout(() => toast.classList.add('is-leaving'), TOAST_MILLISECONDS);
  window.setTimeout(() => toast.remove(), TOAST_MILLISECONDS + 400);
}
