export function updateSize(popupId, width, height) {
  const el = document.getElementById(popupId);
  if (!el) return;
  el.style.width = width;
  el.style.height = height;
}


