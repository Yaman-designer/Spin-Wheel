export function preserveBackgroundImage(element, newColor, colorProperty = 'backgroundColor') {
  const currentBackgroundImage = element.style.backgroundImage;
  const currentBackgroundSize = element.style.backgroundSize;
  const currentBackgroundPosition = element.style.backgroundPosition;
  const currentBackgroundRepeat = element.style.backgroundRepeat;
  const pt = window.themeManager?.theme?.popup_type || window.theme?.popup_type;
  const isUnifiedShellButton =
    element.id === 'submit_button' && pt === 'gaming';

  if (
    newColor &&
    (newColor.includes('linear-gradient') ||
      newColor.includes('radial-gradient') ||
      newColor.includes('url('))
  ) {
    element.style.setProperty('background', newColor, 'important');
  } else if (isUnifiedShellButton) {
    element.style.setProperty('background', newColor, 'important');
  } else {
    // `background` shorthand sıfırlar: background-size, background-position, …
    // Düz renk için backgroundColor kullan; böylece tema background_image.style korunur.
    const isSolidFill =
      colorProperty === 'background' &&
      typeof newColor === 'string' &&
      newColor.trim() !== '' &&
      !newColor.includes('gradient') &&
      !newColor.includes('url(');
    if (isSolidFill) {
      element.style.backgroundColor = newColor;
    } else {
      element.style[colorProperty] = newColor;
    }
  }

  if (currentBackgroundImage && currentBackgroundImage !== 'none') {
    element.style.backgroundImage = currentBackgroundImage;
  }
  if (currentBackgroundSize) {
    element.style.backgroundSize = currentBackgroundSize;
  }
  if (currentBackgroundPosition) {
    element.style.backgroundPosition = currentBackgroundPosition;
  }
  if (currentBackgroundRepeat) {
    element.style.backgroundRepeat = currentBackgroundRepeat;
  }
}

export function preserveBackgroundColor(element, newImageUrl) {
  const currentBackgroundColor = element.style.backgroundColor;
  element.style.backgroundImage = newImageUrl;
  if (currentBackgroundColor) {
    element.style.backgroundColor = currentBackgroundColor;
  }
}

function parseGradient(gradientString) {
  if (!gradientString || !gradientString.includes('gradient')) {
    return null;
  }

  const typeMatch = gradientString.match(/(linear|radial)-gradient\s*\(/i);
  if (!typeMatch) return null;

  const type = typeMatch[1].toLowerCase();
  const openParenIndex = gradientString.indexOf('(', typeMatch.index);
  if (openParenIndex === -1) return null;

  let depth = 0;
  let closeParenIndex = -1;
  for (let i = openParenIndex; i < gradientString.length; i++) {
    const ch = gradientString[i];
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) {
        closeParenIndex = i;
        break;
      }
    }
  }

  if (closeParenIndex === -1) return null;
  const content = gradientString.substring(openParenIndex + 1, closeParenIndex).trim();

  const parts = [];
  let currentPart = '';
  let parenDepth = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;
    else if (char === ',' && parenDepth === 0) {
      parts.push(currentPart.trim());
      currentPart = '';
      continue;
    }
    currentPart += char;
  }
  if (currentPart) parts.push(currentPart.trim());

  let direction = '';
  const colors = [];
  let colorStartIndex = 0;

  if (parts.length > 0) {
    const firstPart = parts[0];
    if (
      firstPart.match(
        /^-?\d*\.?\d+deg$|^to\s+(top|bottom|left|right|top\s+left|top\s+right|bottom\s+left|bottom\s+right|left\s+top|right\s+top|left\s+bottom|right\s+bottom)$/i
      )
    ) {
      direction = firstPart;
      colorStartIndex = 1;
    }
  }

  for (let i = colorStartIndex; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    const colorMatch = part.match(/^(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9A-Fa-f]{3,8}|[a-zA-Z]+)\s*(.*)$/);
    if (colorMatch) {
      const stopValue = colorMatch[2] ? colorMatch[2].trim() : '';
      colors.push({
        color: colorMatch[1],
        stop: stopValue,
      });
    }
  }

  return {
    type: type,
    direction: direction,
    colors: colors,
  };
}

export function updateGradientLastColor(gradientString, newColor) {
  if (!gradientString) return gradientString;

  const parsed = parseGradient(gradientString);
  if (!parsed || parsed.colors.length === 0) {
    return gradientString;
  }

  const lastColor = parsed.colors[parsed.colors.length - 1];
  lastColor.color = newColor;

  const colorStrings = parsed.colors
    .map((c) => (c.stop && c.stop.trim() ? `${c.color} ${c.stop}` : c.color))
    .join(', ');

  const directionPart = parsed.direction ? `${parsed.direction}, ` : '';

  return `${parsed.type}-gradient(${directionPart}${colorStrings})`;
}

function rgbStringToHex(rgb) {
  const rgbMatch = rgb.match(/\d+/g);
  if (!rgbMatch || rgbMatch.length < 3) return null;
  const r = parseInt(rgbMatch[0], 10);
  const g = parseInt(rgbMatch[1], 10);
  const b = parseInt(rgbMatch[2], 10);
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}

export function getGradientLastColor(gradientString) {
  const parsed = parseGradient(gradientString);
  if (!parsed || parsed.colors.length === 0) {
    return null;
  }

  const lastColor = parsed.colors[parsed.colors.length - 1].color;

  if (lastColor.startsWith('rgb')) {
    return rgbStringToHex(lastColor);
  }
  if (lastColor.startsWith('#')) {
    return lastColor;
  }

  return null;
}

/** #RRGGBBAA → #RRGGBB; diğer değerleri olduğu gibi döndürür. */
export function stripHexAlphaChannel(color) {
  if (color && typeof color === 'string' && color.startsWith('#') && color.length === 9) {
    return color.substring(0, 7);
  }
  return color || '';
}

/** `game_styles.gameOpacity` veya eski kök `gameBackgroundOpacity`: 0–100; eksik / geçersiz → 100. */
export function normalizeGameBackgroundOpacityPercent(raw) {
  if (raw === undefined || raw === null || raw === '') return 100;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).trim());
  if (!Number.isFinite(n)) return 100;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function expandShortHex6(hex) {
  const h = String(hex || '').trim();
  if (/^#[0-9A-Fa-f]{3}$/i.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h;
}

/**
 * Düz renk + opaklık → `rgba(...)` veya `transparent` / orijinal (gradient, url).
 * %100’e yakınsa orijinal renk dizgesini döndürür (gereksiz rgba yazmaz).
 */
export function solidColorToRgbaForGameBackground(color, opacityPercent) {
  const opPct = normalizeGameBackgroundOpacityPercent(opacityPercent);
  const s = String(color || '').trim();
  if (!s) return opPct <= 0 ? 'transparent' : '';

  if (/linear-gradient|radial-gradient|url\(/i.test(s)) {
    return s;
  }

  if (/^transparent$/i.test(s)) {
    return 'transparent';
  }

  if (opPct <= 0) {
    return 'transparent';
  }
  if (opPct >= 100) {
    return s;
  }

  const alpha = Math.round((opPct / 100) * 1000) / 1000;

  const rgbMatch = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)));
    const prevA = rgbMatch[4] != null ? parseFloat(rgbMatch[4]) : 1;
    const a = Math.min(1, Math.max(0, prevA * alpha));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  const hex = expandShortHex6(stripHexAlphaChannel(s));
  if (/^#[0-9A-Fa-f]{6}$/i.test(hex)) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const pct = normalizeGameBackgroundOpacityPercent(opacityPercent);
  return `color-mix(in srgb, ${s} ${pct}%, transparent)`;
}

