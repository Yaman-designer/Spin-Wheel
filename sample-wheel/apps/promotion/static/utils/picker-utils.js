import { getPromotionColorPickerPopupDirection, containerStyleValue } from './dom-utils.js';
import { preserveBackgroundImage, getGradientLastColor, updateGradientLastColor } from './color-utils.js';

/** Renk kutusu (Picker) boş tema için; DOM hedefine yazılmaz. */
const PICKER_NEUTRAL_UI_COLOR = '#9ca3af';

export function isGradient(value) {
  return typeof value === 'string' && /gradient/i.test(value);
}

export function isCssPaintNone(value) {
  const s = String(value ?? '')
    .trim()
    .toLowerCase();
  return s === '' || s === 'none' || s === 'initial' || s === 'inherit' || s === 'unset';
}

export function getButtonBackground(submitStyles, fallback = '') {
  if (!submitStyles) return fallback;
  const bgImageRaw = containerStyleValue(submitStyles, 'background-image');
  const bgRaw = containerStyleValue(submitStyles, 'background');

  const bgImage = !isCssPaintNone(bgImageRaw) ? String(bgImageRaw).trim() : '';
  const bg = !isCssPaintNone(bgRaw) ? String(bgRaw).trim() : '';

  if (bgImage && isGradient(bgImage)) return bgImage;
  if (bg && isGradient(bg)) return bg;

  if (bg && !/url\(/i.test(bg)) return bg;
  if (bgImage) return bgImage;

  return fallback;
}

function normalizeHex6(val) {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(s)) {
    return s.toLowerCase();
  }
  if (/^#[0-9A-Fa-f]{3}$/i.test(s)) {
    return (
      '#' +
      s[1].toLowerCase() +
      s[1].toLowerCase() +
      s[2].toLowerCase() +
      s[2].toLowerCase() +
      s[3].toLowerCase() +
      s[3].toLowerCase()
    );
  }
  if (/^#[0-9A-Fa-f]{8}$/i.test(s)) {
    return s.slice(0, 7).toLowerCase();
  }
  return null;
}

/** Oyun alanı: `transparent` veya tam şeffaf rgba — hex picker ile ifade edilemez. */
function isTransparentGameAreaSeed(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return false;
  if (s === 'transparent') return true;
  const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (!m) return false;
  if (m[4] == null) return false;
  const a = parseFloat(m[4]);
  return Number.isFinite(a) && a <= 0;
}

export function setupPicker(boxId, inputId, defaultColor, targetSelector, cssProp, onChangeCallback) {
  var box = document.getElementById(boxId);
  var input = document.getElementById(inputId);
  var target = targetSelector ? document.querySelector(targetSelector) : null;

  if (!box || !input) return;

  if (box._colorPickerPlacementAbort) {
    try {
      box._colorPickerPlacementAbort.abort();
    } catch (e) {
    }
    box._colorPickerPlacementAbort = null;
  }

  if (box.picker && box.picker.destroy) {
    try {
      box.picker.destroy();
    } catch (e) {
    }
    box.picker = null;
  }

  var inputValue = input.value || '';

  if (!inputValue) {
    if (isGradient(defaultColor)) {
      inputValue = defaultColor;
      input.value = defaultColor;
    } else if (defaultColor && defaultColor.trim() !== '') {
      inputValue = defaultColor;
      input.value = defaultColor;
    } else if (target && cssProp === 'background') {
      var targetBg = target.style.background || window.getComputedStyle(target).background;
      if (isGradient(targetBg)) {
        inputValue = targetBg;
        input.value = targetBg;
      }
    }
  }

  var hasGradient = isGradient(inputValue);
  var gradientValue = hasGradient ? inputValue : null;

  var resolvedHex = null;
  if (!hasGradient) {
    resolvedHex = normalizeHex6(inputValue) || normalizeHex6(defaultColor);
  }

  var rawPaint = String(input.value || inputValue || '').trim();
  if (!rawPaint) rawPaint = String(defaultColor || '').trim();
  var gameAreaTransparent =
    inputId === 'game_area_bg_color' && isTransparentGameAreaSeed(rawPaint);

  var gradientState = { value: gradientValue, isGradient: hasGradient };

  var pickerSeedColor = PICKER_NEUTRAL_UI_COLOR;
  if (hasGradient && gradientValue) {
    pickerSeedColor = getGradientLastColor(gradientValue) || PICKER_NEUTRAL_UI_COLOR;
  } else if (resolvedHex) {
    pickerSeedColor = resolvedHex;
  } else if (gameAreaTransparent) {
    pickerSeedColor = '#ffffff';
  }

  if (hasGradient && gradientValue) {
    input.value = gradientValue;
    box.style.setProperty('background', gradientValue, 'important');
    if (target && cssProp) {
      if (cssProp === 'background' || cssProp === 'backgroundColor') {
        target.style.setProperty('background', gradientValue, 'important');
      } else if (cssProp.startsWith('--')) {
        target.style.setProperty(cssProp, pickerSeedColor, 'important');
      }
    }
  } else if (resolvedHex) {
    input.value = resolvedHex;
    box.style.setProperty('background', resolvedHex, 'important');
    if (target && cssProp) {
      if (cssProp.startsWith('--')) {
        target.style.setProperty(cssProp, resolvedHex, 'important');
      } else if (cssProp === 'background' || cssProp === 'backgroundColor') {
        preserveBackgroundImage(target, resolvedHex, cssProp);
      } else {
        target.style[cssProp] = resolvedHex;
      }
    }
  } else if (gameAreaTransparent && target && (cssProp === 'background' || cssProp === 'backgroundColor')) {
    input.value = 'transparent';
    box.style.removeProperty('background-image');
    box.style.removeProperty('background-size');
    box.style.removeProperty('background-position');
    box.style.setProperty(
      'background',
      'repeating-conic-gradient(from 0deg, #e5e5e5 0deg 90deg, #fff 90deg 180deg) 0 0 / 12px 12px',
      'important'
    );
    target.style.setProperty('background', 'transparent', 'important');
  } else {
    input.value = '';
    box.style.removeProperty('background');
    box.style.removeProperty('background-image');
    box.style.removeProperty('background-size');
    box.style.removeProperty('background-position');
  }

  var picker = new Picker({
    parent: box,
    popup: getPromotionColorPickerPopupDirection(box),
    color: pickerSeedColor,
    alpha: false,
            onChange: function (color) {
              var colorHex = color.hex || color;

      var finalColorValue = colorHex;

      if (gradientState.isGradient && gradientState.value) {
        var updatedGradient = updateGradientLastColor(gradientState.value, colorHex);
        input.value = updatedGradient;
        gradientState.value = updatedGradient;
        finalColorValue = updatedGradient;
        box.style.setProperty('background', updatedGradient, 'important');

        if (target && cssProp === 'background') {
          target.style.setProperty('background', updatedGradient, 'important');
        }

        if (onChangeCallback) {
          onChangeCallback(updatedGradient);
        }
      } else {
        box.style.setProperty('background', colorHex, 'important');
         input.value = colorHex;
        if (target && cssProp) {
          if (cssProp.startsWith('--')) {
            target.style.setProperty(cssProp, colorHex, 'important');
          } else if (cssProp === 'background' || cssProp === 'backgroundColor') {
            preserveBackgroundImage(target, colorHex, cssProp);
          } else {
            target.style[cssProp] = colorHex;
          }
        }
        if (onChangeCallback) {
          onChangeCallback(colorHex);
        }
      }

      if (window.themeManager && window.themeManager.theme) {
        if (inputId === 'container_bg_color') {
          if (!window.themeManager.theme.containerStyle) window.themeManager.theme.containerStyle = {};
          const cs = window.themeManager.theme.containerStyle;
          cs.background = finalColorValue;
          delete cs['background-color'];
        }
      }

      if (window.themeManager && typeof window.themeManager.applyCurrentColors === 'function') {
        window.themeManager.applyCurrentColors();
      }
    }
  });

  var placementAbort = new AbortController();
  box._colorPickerPlacementAbort = placementAbort;
  var syncPickerPopupSide = function () {
    if (!picker || typeof picker.setOptions !== 'function') return;
    var next = getPromotionColorPickerPopupDirection(box);
    try {
      picker.setOptions({ popup: next });
    } catch (e) {
    }
  };
  box.addEventListener('mousedown', syncPickerPopupSide, {
    capture: true,
    signal: placementAbort.signal,
  });
  box.addEventListener(
    'touchstart',
    syncPickerPopupSide,
    { capture: true, passive: true, signal: placementAbort.signal }
  );

  box.picker = picker;
}

