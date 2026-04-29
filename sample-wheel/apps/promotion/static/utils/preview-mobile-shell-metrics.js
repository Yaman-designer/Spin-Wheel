/**
 * Promotion “Mobile” ve /preview/promotion/… dar görünümü ortak ölçüler.
 * Özdeş: apps/preview/static/utils/preview-mobile-shell-metrics.js
 */
export const PREVIEW_MOBILE_FIT_PAD = 24;

export function getPreviewMobileAvailWidth(wrapEl) {
  if (!wrapEl) return 480;
  const w = wrapEl.clientWidth || 0;
  return Math.max(80, w - PREVIEW_MOBILE_FIT_PAD * 2);
}

export function getPreviewMobileAvailHeight(wrapEl) {
  if (!wrapEl) return 580;
  const h = wrapEl.clientHeight || 0;
  return Math.max(80, h - PREVIEW_MOBILE_FIT_PAD * 2);
}

export function computePreviewMobileShellDimensions(availW) {
  const inner = Math.max(0, Math.floor(availW));
  const capW = Math.max(260, Math.min(480, inner));
  const capH = Math.max(400, Math.round((capW / 480) * 580));
  return { capW, capH };
}

/**
 * /preview dar görünüm: promotion mobil editördeki gibi her zaman 480×580 mantıksal kabuk;
 * viewport sığdırması --wheelluck-container-scale ile (dar alanda 342×413’e düşmez).
 */
export function computePreviewMobileShellDimensionsParity(availW) {
  return computePreviewMobileShellDimensions(Math.max(availW, 480));
}

/**
 * @param {{ fitPad?: number, scaleBoost?: number }} [opts]
 * fitPad: varsayılan PREVIEW_MOBILE_FIT_PAD; daha küçük = daha az dış boşluk (preview dar gaming).
 * scaleBoost: viewportFit ≤ 1 iken çarpan (taşmayı önlemek için sonuç yine min 1 ile sınırlanır).
 */
export function computePreviewMobileContainerScale(wrapEl, offsetWidth, offsetHeight, opts = {}) {
  if (!wrapEl || offsetWidth <= 0 || offsetHeight <= 0) return null;
  const pad = opts.fitPad != null ? opts.fitPad : PREVIEW_MOBILE_FIT_PAD;
  const cw = wrapEl.clientWidth || 0;
  const ch = wrapEl.clientHeight || 0;
  const aw = Math.max(80, cw - pad * 2);
  const ah = Math.max(80, ch - pad * 2);
  let viewportFit = Math.min(1, aw / offsetWidth, ah / offsetHeight);
  if (opts.scaleBoost != null && Number.isFinite(opts.scaleBoost) && opts.scaleBoost > 0) {
    viewportFit = Math.min(1, viewportFit * opts.scaleBoost);
  }
  return Math.max(0.12, Math.min(3, viewportFit));
}

