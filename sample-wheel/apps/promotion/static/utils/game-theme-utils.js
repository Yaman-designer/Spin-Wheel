/**
 * Kalıcı temada oyun: gameID + gameColors. gameSVG DB’ye yazılmaz; render’da gameID ile motor (game-svgs.js) yüklenir.
 * Bellekte theme.gameSVG, editör anlık gövdesi (slice metinleri vb.) için kullanılabilir.
 * Eski kayıtlar `game_svg` (string veya { svg, style }) ile gelir; normalizeGameTheme tek seferde dönüştürür.
 * Gaming popup'ta oyun yok: gameID === null.
 * Yükseklik (height: N%) theme.game_styles.game_svg_area içinde tutulur.
 * Oyun alanı zemini: game_styles.gameBackground + game_styles.gameOpacity (normalize kök gameBackground / gameBackgroundOpacity taşır).
 */

import { getGameRecordById } from './game-svgs.js';
import { getTemplateById } from '../templates.js';

const LEGACY_DEFAULT_GAME_ID = {
  wheel: 1,
  slot: 2,
  slotmachine: 2,
  scratchcard: 3,
  silverwheel: 4,
};

function toGameId(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return null;
}

export function resolveTemplateDefaultGameId(template) {
  const dg = template?.defaultGame;
  if (dg == null || dg === '') return null;
  const n = toGameId(dg);
  if (n != null) return n;
  const key = String(dg).toLowerCase().trim();
  return LEGACY_DEFAULT_GAME_ID[key] ?? null;
}

function resolveInitialGamePosition(theme, template) {
  const layout = theme?.layout || template?.layout;
  return String(layout?.position || '').trim().toLowerCase();
}

/**
 * Kalıcı kök alanlar: gameID, gameColors. Eski wheel/slot/scratch anahtarları kayıtta tutulmamalı.
 */
export const LEGACY_THEME_ROOT_KEYS = new Set([
  'game_svg',
  'scratchcard',
  'slotmachine',
  'wheel',
]);

export function purgeLegacyThemeRootKeys(theme) {
  if (!theme || typeof theme !== 'object') return;
  LEGACY_THEME_ROOT_KEYS.forEach((k) => {
    if (k in theme) {
      delete theme[k];
    }
  });
}

/**
 * Oyun seçimi / oyun stilleri akışı şablonda açık mı.
 * hasGame yalnızca başlangıç seçimini etkiler; accordion görünürlüğü hasGame ile yönetilir.
 */
export function resolveAllowedGame(template) {
  if (!template) return false;
  if (template.hasGame === false) return false;
  if (template.hasGame === true) return true;
  return true;
}

/** Şablon `defaultGame`: sayı, sayısal string veya (eski) isim → oyun id. */
export function templateDefaultGameToId(template) {
  if (!template || typeof template !== 'object') return null;
  let gid = toGameId(template.defaultGame);
  if (gid != null) return gid;
  if (template.wheel) return 1;
  if (template.slotmachine) return 2;
  if (template.scratchcard) return 3;
  return resolveTemplateDefaultGameId(template);
}

/** Select / changeGameType için isim (yalnızca UI sınırı). */
export function templateDefaultGameToTypeName(template) {
  const id = templateDefaultGameToId(template);
  if (id == null) return '';
  return getGameRecordById(id)?.name || '';
}

/**
 * Light: gerçek oyun içeriği yoksa (boş SVG + boş gameColors) gameID sızıntısını kaldırır.
 * Şablon seçimi sonrası veya eski kayıtlar için normalize sonunda çağrılır.
 */
export function clearLightGameIfEmpty(theme) {
  if (!theme || theme.popup_type !== 'gaming') return;
  const svg = String(getGameSvgString(theme) || '').trim();
  const gc = theme.gameColors;
  const hasColors = gc && typeof gc === 'object' && Object.keys(gc).length > 0;
  if (svg || hasColors) return;

  theme.gameID = null;
  theme.gameSVG = '';
  theme.gameColors = {};
  if (theme.game_styles && typeof theme.game_styles === 'object') {
    delete theme.game_styles.game_svg_area;
  }
}

/** Light: editörde oyun seçilmedi (dropdown boş) — tüm oyun alanlarını kaldırır. */
export function resetLightGameThemeCompletely(theme) {
  if (!theme || theme.popup_type !== 'gaming') return;
  theme.gameID = null;
  theme.gameSVG = '';
  theme.gameColors = {};
  theme.hasGame = false;
  if (theme.game_styles && typeof theme.game_styles === 'object') {
    delete theme.game_styles.game_svg_area;
    delete theme.game_styles.gameBackground;
    delete theme.game_styles.gameOpacity;
  }
  delete theme.gameBackground;
  delete theme.gameBackgroundOpacity;
}

/**
 * Gaming popup: gerçekten seçili/geçerli bir oyun var mı (DB `hasGame` ile uyumlu).
 */
export function hasActiveLightGame(theme) {
  if (!theme || theme.popup_type !== 'gaming') return false;
  if (theme.gameID == null || theme.gameID === '') return false;
  const rec = getGameRecordById(theme.gameID);
  return Boolean(rec);
}

/**
 * Gaming şablonda oyun alanları bazen DB'ye gitmemeli:
 * - Şablon `hasGame: false` ve isteğe bağlı oyun yok (`hasGame` değil) veya kayıtta oyun yok.
 * - Şablon oyunlu ama editörde oyun kaldırıldı (yalnızca görsel vb.).
 * İstisna: `gaming-default` (id:1) gibi katalogda `hasGame: false` + `hasGame: true` — kullanıcı oyun eklediyse silinmez.
 * İstisna: katalog `hasGame !== false` iken `gameID` henüz atanmamış tema — strip etme (`normalizeGameTheme` / kayıt öncesi).
 */
export function stripGameFieldsIfLightTemplateHasNoGame(theme) {
  if (!theme || typeof theme !== 'object' || theme.popup_type !== 'gaming') {
    return;
  }
  if (theme.hasGame === false) {
    delete theme.gameID;
    delete theme.gameSVG;
    delete theme.gameColors;
    delete theme.gameBackground;
    delete theme.gameBackgroundOpacity;
    if (theme.game_styles && typeof theme.game_styles === 'object') {
      delete theme.game_styles.game_svg_area;
      delete theme.game_styles.gameBackground;
      delete theme.game_styles.gameOpacity;
    }
    return;
  }
  const rawId = theme.template;
  const tid = typeof rawId === 'number' ? rawId : parseInt(String(rawId), 10);
  if (Number.isNaN(tid)) {
    return;
  }
  const tpl = getTemplateById(tid);
  const templateSaysNoGame = tpl && tpl.hasGame === false;
  const hasGameInTheme = hasActiveLightGame(theme);
  /**
   * Katalog şablonu oyunludur (`hasGame !== false`) ama `theme.gameID` henüz yok
   * (yeni promosyon, şablon seçimi sonrası normalize sırası) — oyun alanlarını silme;
   * aksi halde gaming-elegant gibi şablonlarda oyun hiç gelmez.
   */
  if (tpl && tpl.hasGame !== false && !hasGameInTheme) {
    return;
  }
  if (!templateSaysNoGame && hasGameInTheme) {
    return;
  }
  /* gaming-default gibi: katalogda hasGame:false (başlangıçta oyun yok) ama hasGame:true — eklenen oyun kaydı korunur */
  if (
    templateSaysNoGame &&
    tpl &&
    tpl.popup_type === 'gaming' &&
    tpl.hasGame === true &&
    (hasGameInTheme || theme.hasGame === true)
  ) {
    return;
  }
  delete theme.gameID;
  delete theme.gameSVG;
  delete theme.gameColors;
  delete theme.gameBackground;
  delete theme.gameBackgroundOpacity;
  if (theme.game_styles && typeof theme.game_styles === 'object') {
    delete theme.game_styles.game_svg_area;
    delete theme.game_styles.gameBackground;
    delete theme.game_styles.gameOpacity;
  }
}

/**
 * Tema gameColors ile oyun kaydı varsayılan paletinin aynı olup olmadığı (şablon paletini seçmek için).
 */
export function gameColorsMatchRecord(themeColors, recordGameColors) {
  if (!themeColors || !recordGameColors || typeof themeColors !== 'object') return false;
  const keys = Object.keys(recordGameColors);
  if (keys.length === 0) return false;
  for (const k of keys) {
    const a = String(themeColors[k] ?? '')
      .trim()
      .toLowerCase();
    const b = String(recordGameColors[k] ?? '')
      .trim()
      .toLowerCase();
    if (a !== b) return false;
  }
  return true;
}

/**
 * Tema `gameColors` doluysa onu döndürür; yoksa şablon değil — seçili `gameID` / oyun türüne göre
 * motor kaydındaki varsayılan palet (`game-svgs.js`).
 */
export function getEffectiveGameColors(theme) {
  if (!theme || typeof theme !== 'object') return null;
  const gc = theme.gameColors;
  if (gc && typeof gc === 'object' && Object.keys(gc).length > 0) {
    return gc;
  }
  if (theme.gameID != null && theme.gameID !== '') {
    const rec = getGameRecordById(theme.gameID);
    if (
      rec?.gameColors &&
      typeof rec.gameColors === 'object' &&
      Object.keys(rec.gameColors).length > 0
    ) {
      return { ...rec.gameColors };
    }
  }
  const typeName = getGameTypeName(theme);
  if (typeName) {
    const id = gameTypeNameToId(typeName);
    if (id != null) {
      const rec = getGameRecordById(id);
      if (
        rec?.gameColors &&
        typeof rec.gameColors === 'object' &&
        Object.keys(rec.gameColors).length > 0
      ) {
        return { ...rec.gameColors };
      }
    }
  }
  return null;
}

/**
 * Kayıtlı SVG hangi oyuna ait — viewBox / karakteristik id ile (DB'de type≠içerik hataları için).
 */
export function inferMarkupGameType(svg) {
  const lower = String(svg || '').toLowerCase();
  if (!lower.includes('<svg')) return null;
  if (lower.includes('path-26-inside-1_108_1379')) return 'scratchcard';
  if (lower.includes('0 0 3128') && lower.includes('3128.05')) return 'silverwheel';
  if (lower.includes('3400') && lower.includes('3128')) return 'wheel';
  if (lower.includes('0 0 954') && lower.includes('559')) return 'slot';
  if (lower.includes('0 0 874') && lower.includes('659')) return 'scratchcard';
  return null;
}

/**
 * gameID ile gameSVG içeriği uyuşmuyorsa (ör. type scratch ama gövde wheel) SVG'yi boşalt;
 * render tarafı DefaultGameSvgs ile doğru varlığı yükler.
 */
export function reconcilePersistedGameSvgWithGameId(theme) {
  if (!theme || typeof theme !== 'object') return;
  if (theme.gameID == null || theme.gameID === '') return;
  const raw = String(theme.gameSVG || '').trim();
  if (!raw || raw.length < 40) return;
  const rec = getGameRecordById(theme.gameID);
  if (!rec) return;
  const inferred = inferMarkupGameType(raw);
  if (!inferred) return;
  if (inferred !== rec.name) {
    theme.gameSVG = '';
  }
}

/** Eski kök `gameBackground` / `gameBackgroundOpacity` → `game_styles.gameBackground` / `game_styles.gameOpacity`. */
export function migrateLegacyGameBackgroundToGameStyles(theme) {
  if (!theme || typeof theme !== 'object') return;
  const hasRootBg = Object.prototype.hasOwnProperty.call(theme, 'gameBackground');
  const hasRootOp = Object.prototype.hasOwnProperty.call(theme, 'gameBackgroundOpacity');
  if (!hasRootBg && !hasRootOp) return;
  if (!theme.game_styles || typeof theme.game_styles !== 'object') {
    theme.game_styles = {};
  }
  const gs = theme.game_styles;
  if (hasRootBg && !Object.prototype.hasOwnProperty.call(gs, 'gameBackground')) {
    gs.gameBackground = theme.gameBackground;
  }
  if (hasRootOp && !Object.prototype.hasOwnProperty.call(gs, 'gameOpacity')) {
    gs.gameOpacity = theme.gameBackgroundOpacity;
  }
  delete theme.gameBackground;
  delete theme.gameBackgroundOpacity;
}

export function normalizeGameTheme(theme) {
  if (!theme || typeof theme !== 'object') return;
  // Legacy: desktop_style artik desteklenmiyor.
  if (theme.desktop_style) {
    delete theme.desktop_style;
  }

  migrateLegacyGameBackgroundToGameStyles(theme);
  theme.popup_type = 'gaming';

  const lightPersistedNoGame =
    theme.popup_type === 'gaming' && theme.hasGame === false;

  if (lightPersistedNoGame) {
    purgeLegacyThemeRootKeys(theme);
    if (theme.game_svg != null) {
      delete theme.game_svg;
    }
    theme.gameID = null;
    theme.gameSVG = '';
    theme.gameColors = {};
    delete theme.gameBackground;
    delete theme.gameBackgroundOpacity;
    if (theme.game_styles && typeof theme.game_styles === 'object') {
      delete theme.game_styles.game_svg_area;
      delete theme.game_styles.gameBackground;
      delete theme.game_styles.gameOpacity;
    }
  }

  if (!lightPersistedNoGame && theme.game_svg != null) {
    const leg = theme.game_svg;
    if (typeof leg === 'string') {
      theme.gameSVG = leg;
      if (theme.gameID === undefined) {
        theme.gameID = theme.popup_type === 'gaming' ? null : 1;
      }
    } else {
      const svg = leg.svg || '';
      const style = leg.style || '';
      const hasSvg = String(svg).trim().length > 0;
      if (theme.popup_type === 'gaming' && !hasSvg) {
        theme.gameID = null;
        theme.gameSVG = svg;
      } else {
        const rec = getGameRecordById(theme.gameID ?? 1);
        theme.gameID = rec.id;
        theme.gameSVG = svg;
        if (!theme.gameColors || Object.keys(theme.gameColors).length === 0) {
          theme.gameColors = { ...rec.gameColors };
        }
      }
      if (style) {
        theme.game_styles = theme.game_styles || {};
        theme.game_styles.game_svg_area = style;
      }
    }
    delete theme.game_svg;
  }

  const svgTooShort = !theme.gameSVG || String(theme.gameSVG).trim().length < 40;
  if (!lightPersistedNoGame && svgTooShort) {
    const recForId =
      theme.gameID != null && theme.gameID !== ''
        ? getGameRecordById(theme.gameID)
        : null;
    const lockedName = recForId ? recForId.name : '';

    const allowWheelLegacy =
      !lockedName || lockedName === 'wheel' || lockedName === 'silverwheel';
    const allowScratchLegacy = !lockedName || lockedName === 'scratchcard';
    const allowSlotLegacy = !lockedName || lockedName === 'slot';

    if (
      allowWheelLegacy &&
      typeof theme.wheel === 'string' &&
      theme.wheel.includes('<svg')
    ) {
      theme.gameSVG = theme.wheel;
      if (theme.gameID === undefined) {
        theme.gameID = theme.popup_type === 'gaming' ? null : 1;
      }
    } else if (
      allowScratchLegacy &&
      typeof theme.scratchcard === 'string' &&
      theme.scratchcard.includes('viewBox')
    ) {
      theme.gameSVG = theme.scratchcard;
   
    } else if (
      allowSlotLegacy &&
      typeof theme.slotmachine === 'string' &&
      theme.slotmachine.includes('viewBox')
    ) {
      theme.gameSVG = theme.slotmachine;
      
    }
  }

  purgeLegacyThemeRootKeys(theme);

  if (theme.gameID === undefined) {
    theme.gameID = theme.popup_type === 'gaming' ? null : 1;
  }
  if (typeof theme.gameSVG !== 'string') {
    theme.gameSVG = theme.gameSVG == null ? '' : String(theme.gameSVG);
  }

  const svgStillShort = !theme.gameSVG || String(theme.gameSVG).trim().length < 40;
  if (!lightPersistedNoGame && svgStillShort && theme.gameID != null && theme.gameID !== '') {
    const recHydrate = getGameRecordById(theme.gameID);
    if (recHydrate?.game && String(recHydrate.game).trim().length >= 40) {
      theme.gameSVG = recHydrate.game;
    }
  }

  if (!theme.gameColors || typeof theme.gameColors !== 'object') {
    theme.gameColors = {};
  }

  const lightPopupTemplate =
    theme.popup_type === 'gaming' && theme.template != null
      ? getTemplateById(theme.template)
      : null;
  const lightTplGameColors =
    lightPopupTemplate?.gameColors && Object.keys(lightPopupTemplate.gameColors).length > 0
      ? lightPopupTemplate.gameColors
      : null;

  if (!lightPersistedNoGame && lightTplGameColors) {
    const cur = theme.gameColors;
    const empty = Object.keys(cur).length === 0;
    const gidForRec =
      theme.gameID != null && theme.gameID !== '' ? theme.gameID : null;
    const rec =
      gidForRec != null ? getGameRecordById(gidForRec) : getGameRecordById(1);
    const sameAsEngineDefault =
      rec?.gameColors && gameColorsMatchRecord(cur, rec.gameColors);

    if (sameAsEngineDefault) {
      theme.gameColors = { ...rec.gameColors };
    } else if (empty) {
      const recForEmpty = gidForRec != null ? getGameRecordById(gidForRec) : null;
      if (recForEmpty?.gameColors && Object.keys(recForEmpty.gameColors).length > 0) {
        theme.gameColors = { ...recForEmpty.gameColors };
      } else {
        theme.gameColors = { ...lightTplGameColors };
      }
    }
  }

  if (!lightPersistedNoGame) {
    reconcilePersistedGameSvgWithGameId(theme);
  }

  theme.game_styles = theme.game_styles || {};
  if (
    theme.popup_type === 'gaming' &&
    theme.gameID != null &&
    !String(theme.game_styles.game_svg_area || '').trim()
  ) {
    theme.game_styles.game_svg_area = 'height: 70%';
  }

  if (theme.gameID != null && theme.gameID !== '') {
    const rawTid = theme.template;
    const tid = typeof rawTid === 'number' ? rawTid : parseInt(String(rawTid), 10);
    const tpl = !Number.isNaN(tid) ? getTemplateById(tid) : null;
    mergeGameSvgAreaFromTemplate(theme, tpl);
  }

  // Oyun yok (hasGame: false) gaming popup: bucket stilleri şablon kataloğundan (templates.js).
  if (theme.popup_type === 'gaming' && theme.template != null) {
    const rawNoGame = theme.template;
    const tidNoGame = typeof rawNoGame === 'number' ? rawNoGame : parseInt(String(rawNoGame), 10);
    const tplNoGame = !Number.isNaN(tidNoGame) ? getTemplateById(tidNoGame) : null;
    if (tplNoGame?.hasGame === false) {
      if (tplNoGame.content_styles) {
        theme.content_styles = JSON.parse(JSON.stringify(tplNoGame.content_styles));
      }
      if (tplNoGame.image_styles) {
        theme.image_styles = JSON.parse(JSON.stringify(tplNoGame.image_styles));
      }
    }
  }

  const gidForPosition = toGameId(theme.gameID);
  if (gidForPosition != null) {
    const rawTid2 = theme.template;
    const tid2 = typeof rawTid2 === 'number' ? rawTid2 : parseInt(String(rawTid2), 10);
    const tpl2 = !Number.isNaN(tid2) ? getTemplateById(tid2) : null;
    if (!theme.game_position || String(theme.game_position).trim() === '') {
      theme.game_position = resolveInitialGamePosition(theme, tpl2);
    }
  }

  clearLightGameIfEmpty(theme);
  stripGameFieldsIfLightTemplateHasNoGame(theme);

  if (theme.popup_type === 'gaming') {
    if (lightPersistedNoGame) {
      theme.hasGame = false;
    } else {
      const active = hasActiveLightGame(theme);
      const rawTidL = theme.template;
      const tidL =
        typeof rawTidL === 'number' && Number.isInteger(rawTidL)
          ? rawTidL
          : parseInt(String(rawTidL ?? '').trim(), 10);
      const tplL =
        !Number.isNaN(tidL) && tidL > 0 ? getTemplateById(tidL) : null;
      const catalogWantsGame =
        !!tplL &&
        tplL.hasGame !== false &&
        (tplL.hasGame === true ||
          (tplL.gameID != null && tplL.gameID !== '') ||
          templateDefaultGameToId(tplL) != null);
      theme.hasGame = active || catalogWantsGame || theme.hasGame === true;
    }
  } else if (theme.popup_type === 'gaming') {
    theme.hasGame = true;
  }
}

export function getGameTypeName(theme) {
  if (!theme || theme.gameID == null || theme.gameID === '') return '';
  const rec = getGameRecordById(theme.gameID);
  return rec ? rec.name : '';
}

/** Yalnızca sayısal id (veya "3" gibi rakam stringi); o başka. */
export function gameTypeNameToId(raw) {
  const numeric = toGameId(raw);
  if (numeric != null) return numeric;
  if (raw == null) return null;
  const key = String(raw).toLowerCase().trim();
  return LEGACY_DEFAULT_GAME_ID[key] ?? null;
}

/**
 * Tema oyun kimliği: yalnızca `theme.gameID`.
 * id null / çözülemez: gaming → null, gaming → 1 (wheel).
 */
export function setGameTypeById(theme, gameIdRaw) {
  if (!theme || typeof theme !== 'object') return;
  const id = toGameId(gameIdRaw);
  if (id == null) {
    theme.gameID = 1;
    return;
  }
  const rec = getGameRecordById(id);
  theme.gameID = rec ? rec.id : 1;
}

/** UI girdisi → theme.gameID (yalnızca sayısal çözüm). */
export function syncThemeGameIdFromTypeName(theme, raw) {
  setGameTypeById(theme, gameTypeNameToId(raw));
}

/**
 * İlk boyamada gömülü #katman_2 stilleri görünüp sonra JS ile düzelmesin diye,
 * DB'deki gameColors (CSS custom properties) kök svg öğesinde inline uygulanır.
 * Ham SVG stringi (çoğunlukla bellekte); DOM'a yazılırken gameColors ile birleştirilir.
 */
export function mergeGameColorsIntoSvgMarkup(svgMarkup, gameColors) {
  if (!svgMarkup || typeof svgMarkup !== 'string') return svgMarkup;
  if (!gameColors || typeof gameColors !== 'object') return svgMarkup;

  const parts = [];
  for (const [key, val] of Object.entries(gameColors)) {
    if (!key || !key.startsWith('--')) continue;
    if (val == null) continue;
    const v = String(val).trim();
    if (!v) continue;
    parts.push(`${key}: ${v}`);
  }
  if (parts.length === 0) return svgMarkup;

  const inlineStyle = parts.join('; ');

  let replaced = false;
  const out = svgMarkup.replace(/<svg\b([^>]*)>/i, (full, attrs) => {
    replaced = true;

    const mDouble = attrs.match(/\sstyle\s*=\s*"([^"]*)"/i);
    const mSingle = attrs.match(/\sstyle\s*=\s*'([^']*)'/i);
    if (mDouble) {
      const existing = (mDouble[1] || '').trim();
      const merged = existing ? `${existing}; ${inlineStyle}` : inlineStyle;
      return `<svg${attrs.replace(/\sstyle\s*=\s*"[^"]*"/i, ` style="${merged.replace(/"/g, '&quot;')}"`)}>`;
    }
    if (mSingle) {
      const existing = (mSingle[1] || '').trim();
      const merged = existing ? `${existing}; ${inlineStyle}` : inlineStyle;
      return `<svg${attrs.replace(/\sstyle\s*=\s*'[^']*'/i, ` style='${merged.replace(/'/g, '&#39;')}'`)}>`;
    }

    const safe = inlineStyle.replace(/"/g, '&quot;');
    return `<svg${attrs} style="${safe}">`;
  });

  return replaced ? out : svgMarkup;
}

export function getGameSvgString(theme) {
  if (!theme) return '';
  const mem = theme.gameSVG;
  if (typeof mem === 'string' && mem.trim().length >= 40) {
    return mem;
  }
  if (theme.gameID != null && theme.gameID !== '') {
    const rec = getGameRecordById(theme.gameID);
    if (rec?.game && String(rec.game).trim().length >= 40) {
      return rec.game;
    }
  }
  return typeof mem === 'string' ? mem : '';
}

export function setGameSvgString(theme, svg) {
  if (!theme) return;
  theme.gameSVG = svg ?? '';
}

export function getGameHeightStyle(theme) {
  return String(theme?.game_styles?.game_svg_area || '').trim();
}

export function setGameHeightStyle(theme, styleStr) {
  if (!theme) return;
  const normalized = styleStr || '';
  theme.game_styles = theme.game_styles || {};
  theme.game_styles.game_svg_area = normalized;
}

/**
 * Oyun varken yalnızca boş `game_svg_area` için şablondan varsayılan yükseklik alınır.
 * game_styles / content_styles / image_styles temada ne kayıtlıysa normalize dokunmaz.
 */
export function mergeGameSvgAreaFromTemplate(theme, template) {
  if (!theme || typeof theme !== 'object') return;
  if (theme.gameID == null || theme.gameID === '') return;
  const gsTpl = template?.game_styles;
  if (!gsTpl || typeof gsTpl !== 'object') return;
  theme.game_styles = theme.game_styles || {};
  const tplAreaStr = gsTpl.game_svg_area
    ? String(gsTpl.game_svg_area).trim()
    : '';
  if (!String(theme.game_styles.game_svg_area || '').trim() && tplAreaStr) {
    theme.game_styles.game_svg_area = String(gsTpl.game_svg_area);
  }
}

/**
 * Eski gaming akışı şablon `desktop_style` özetini temaya taşıyordu; `desktop_style` kaldırıldı.
 * `theme-manager` içindeki çağrı korunur; ek iş: yalnızca boş `game_svg_area` için şablon yedeği.
 */
export function mergeLightGameDesktopStyleFromTemplate(theme, template) {
  if (!theme || theme.popup_type !== 'gaming') return;
  mergeGameSvgAreaFromTemplate(theme, template);
}

export function clearGameThemeLight(theme) {
  if (!theme) return;
  theme.gameID = null;
  theme.gameSVG = '';
  theme.gameColors = {};
  if (theme.game_styles && typeof theme.game_styles === 'object') {
    delete theme.game_styles.gameBackground;
    delete theme.game_styles.gameOpacity;
  }
  delete theme.gameBackground;
  delete theme.gameBackgroundOpacity;
  if (theme.desktop_style) delete theme.desktop_style;
  setGameHeightStyle(theme, '');
  if (theme.popup_type === 'gaming') {
    theme.hasGame = false;
  }
}

export function copyGameThemeFields(from, to) {
  if (!from || !to) return;
  to.gameID = from.gameID;
  delete to.gameSVG;
  to.gameColors = from.gameColors ? { ...from.gameColors } : {};
  const fromGs = from.game_styles;
  if (fromGs && typeof fromGs === 'object') {
    if (String(fromGs.game_svg_area || '').trim()) {
      to.game_styles = to.game_styles || {};
      to.game_styles.game_svg_area = String(fromGs.game_svg_area);
    }
    if (Object.prototype.hasOwnProperty.call(fromGs, 'gameBackground')) {
      to.game_styles = to.game_styles || {};
      to.game_styles.gameBackground = fromGs.gameBackground;
    }
    if (Object.prototype.hasOwnProperty.call(fromGs, 'gameOpacity')) {
      to.game_styles = to.game_styles || {};
      to.game_styles.gameOpacity = fromGs.gameOpacity;
    }
  }
}

export function getGameTypeFromThemeInfo(themeInfo) {
  if (!themeInfo) return null;
  if (themeInfo.gameID != null && themeInfo.gameID !== '') {
    const rec = getGameRecordById(themeInfo.gameID);
    return rec ? rec.name : null;
  }
  return null;
}



