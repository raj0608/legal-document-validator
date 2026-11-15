// Redrawing part of the page without losing the keyboard's place: the focused control is found again by its data-key.
// If that control is gone (the case moved on), focus goes to `fallback`, so it never drops out of a dialog.
export function redrawKeepingFocus(box, draw, fallback) {
  const a = document.activeElement;
  const key = a && box.contains(a) && a.dataset ? a.dataset.key : null;
  draw();
  if (!key) return;
  const again = [...box.querySelectorAll("[data-key]")].find((e) => e.dataset.key === key);
  if (again) again.focus({ preventScroll: true });
  else if (fallback) fallback.focus({ preventScroll: true });
}
