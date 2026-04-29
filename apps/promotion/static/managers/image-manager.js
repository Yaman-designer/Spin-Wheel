import { getPromotionId } from '../promotion.init.js';
import { preserveBackgroundColor } from '../utils/color-utils.js';
import { GameManager } from './game-manager.js';
import { getTemplateById } from '../templates.js';
import {
  applyStyleString,
  applyGameAreaBackgroundFromTheme,
  styleStringWithoutGameAreaBackground,
  applyPopupBackgroundImage,
  isUnifiedPopupShellTheme,
  ensureWheelluckContentInner,
  containerStyleValue,
  mergeBackgroundImage,
} from '../utils/dom-utils.js';
import { hasActiveLightGame } from '../utils/game-theme-utils.js';

const isSplitRowLayoutType = (layoutType) => {
  const t = String(layoutType || '').toLowerCase().trim();
  return t === 'split' || t === 'split-reverse';
};

const MAX_USER_GALLERY_IMAGES = 5;
const MAX_POPUP_BG_USER_GALLERY_IMAGES = 5;
/** Üst/dekoratif görsel “Resize Image” slider ve tema % değeri üst sınırı */
const TOP_IMAGE_RESIZE_PERCENT_MIN = 10;
const TOP_IMAGE_RESIZE_PERCENT_MAX = 100;

export class ImageManager {
  constructor(theme, themeManager = null, autoInit = true) {
    this.theme = theme;
    this.themeManager = themeManager;
    this.popupType = theme.popup_type;
    this.imageGallery = document.getElementById('imageGallery');
    this.imageInput = document.getElementById('imageInput');
    this.uploadPlaceholder = this.imageGallery?.querySelector('.upload-placeholder') ?? null;
    this.maxUserGalleryImages = MAX_USER_GALLERY_IMAGES;
    this._uploadTooltip = null;
    this._uploadTooltipShowListenerAttached = false;
    this.uploadImageForm = document.getElementById('uploadImageForm');
    this.popupBackgroundGallery = document.getElementById('popupBackgroundImageGallery');
    this.popupBackgroundInput = document.getElementById('popupBackgroundImageInput');
    this.uploadPopupBackgroundForm = document.getElementById('uploadPopupBackgroundImageForm');
    this.popupBackgroundUploadPlaceholder = document.getElementById('popupBackgroundUploadPlaceholder');
    this.maxPopupBgUserGalleryImages = MAX_POPUP_BG_USER_GALLERY_IMAGES;
    this._popupBgUploadTooltip = null;
    this._popupBgUploadTooltipShowListenerAttached = false;
    this.topImageHeightInput = document.getElementById('topImageHeight');
    this.topImageSizeValue = document.getElementById('topImageSizeValue');
    this.topImagePositionRadios = document.querySelectorAll('input[name="top_image_position"]');
    this.resetTopImageBtn = document.getElementById('reset_top_image');
    this.topImageDefaultHeight = 30;
    this._initialTopImageTimeout = null;
    this._isTemplateChanging = false;
    /** Split duzende tum gorsellerde scale(slider/100) kullanilir; ratio/recompute yok. */
    this._applyingSizeGuard = false;
    /** Tek sutunda sol/sag secildiginde yan yana duzen aktif mi */
    this._singleRowLayoutActive = false;

    if (themeManager && themeManager.gameManager) {
      this.gameManager = themeManager.gameManager;
    } else {
      this.gameManager = new GameManager(theme, themeManager);
    }
    this.gameManager.initShellGameControlsDOM();

    if (autoInit) {
      this.init();
    }
  }

  init() {
    ensureWheelluckContentInner();
    this.setInitialBackground();
    this.ensureThemeTemplateGalleryItem();
    this.ensurePopupBackgroundTemplateItem();
    this.setInitialTopImage();
    this.setInitialPopupBackgroundSelection();
    this.gameManager.setInitialGameSvg();
    this.toggleLightControls();
    this.setupEventListeners();
    this.loadTopImagePosition();
  }

  normalizeAssetPath(path) {
    if (!path || typeof path !== 'string') return '';
    const p = path.trim();
    if (!p) return '';
    if (p.startsWith('http://') || p.startsWith('https://')) return p;
    return p.startsWith('/') ? p : `/${p}`;
  }

  getTemplateDefaultImagePath() {
    if (!this.isUnifiedShell()) return '';
    const tpl = this.getCurrentTemplate();
    if (!tpl) return '';
    const raw = tpl.image?.path || tpl.top_image?.path || '';
    return this.normalizeAssetPath(raw);
  }

  isThemeDefaultImageUrl(imageUrl) {
    const def = this.getTemplateDefaultImagePath();
    if (!def || !imageUrl) return false;
    try {
      const a = new URL(String(imageUrl).trim(), window.location.origin).pathname;
      const b = def.startsWith('/') ? def : `/${def}`;
      return a === b || a.endsWith(b);
    } catch {
      return false;
    }
  }

  applyLightSplitBaseStyles() {
    const { topImage, inner } = this.getLightImageNodes();
    if (!topImage) return;
    topImage.style.removeProperty('transform');
    if (inner) {
      inner.style.removeProperty('transform');
      inner.style.removeProperty('transform-origin');
    }
  }

  applyLightDesktopImageHostsFromTheme() {
    if (!this.isUnifiedShell()) return;
    const { wrapper, inner } = this.getLightImageNodes();
    if (!wrapper) return;

    const fromData = (
      this.getImageData()?.path ||
      this.theme?.image?.path ||
      this.theme?.top_image?.path ||
      ''
    ).trim();
    const imgPos = String(this._shellPlacementKey() || 'top').trim().toLowerCase();

    if (!fromData) {
      const collapse =
        this.isLightSplitLayout() || imgPos === 'left' || imgPos === 'right';
      if (collapse) {
        wrapper.style.setProperty('flex', '0 0 0', 'important');
        wrapper.style.setProperty('width', '0', 'important');
        wrapper.style.setProperty('max-width', '0', 'important');
        wrapper.style.setProperty('min-width', '0', 'important');
        wrapper.style.setProperty('overflow', 'hidden', 'important');
        if (inner) {
          inner.style.setProperty('width', '0', 'important');
          inner.style.setProperty('height', '0', 'important');
          inner.style.setProperty('min-height', '0', 'important');
          inner.style.setProperty('overflow', 'hidden', 'important');
        }
      }
      return;
    }

    const desktop = this.theme?.desktop_style;
    if (!desktop) return;
    if (desktop.image?.style) applyStyleString(wrapper, desktop.image.style);
    if (desktop.image_inner?.style) applyStyleString(inner, desktop.image_inner.style);
  }

  ensureThemeTemplateGalleryItem() {
    if (!this.imageGallery) return;

    if (!this.isUnifiedShell()) {
      const existing = this.imageGallery.querySelector('.theme-template-image');
      if (existing) existing.remove();
      this.checkImageCount();
      return;
    }

    const path = this.getTemplateDefaultImagePath();
    let el = this.imageGallery.querySelector('.theme-template-image');

    if (!path) {
      if (el) el.remove();
      this.checkImageCount();
      return;
    }

    if (!el) {
      el = document.createElement('div');
      el.className = 'image-item theme-template-image';
      el.setAttribute('data-theme-template', 'true');
      el.innerHTML = `
        <img src="${path}" alt="" />
        <span class="theme-template-badge">default</span>
      `;
      this.imageGallery.insertBefore(el, this.imageGallery.firstChild);
    } else {
      const img = el.querySelector('img');
      if (img) {
        const next = path;
        try {
          const cur = new URL(img.src, window.location.origin).pathname;
          const want = this.normalizeAssetPath(next);
          if (cur !== want && !cur.endsWith(want)) {
            img.src = next;
          }
        } catch {
          img.src = next;
        }
      }
      if (el !== this.imageGallery.firstChild) {
        this.imageGallery.insertBefore(el, this.imageGallery.firstChild);
      }
    }
    this.checkImageCount();
  }

  getTemplateDefaultBackgroundPath() {
    if (!this.isUnifiedShell()) return '';
    const tpl = this.getCurrentTemplate();
    if (!tpl) return '';
    const raw = tpl.background_image?.path || '';
    return this.normalizeAssetPath(raw);
  }

  _popupBgDisplayUrlsMatch(a, b) {
    const sa = String(a || '').trim();
    const sb = String(b || '').trim();
    if (!sa || !sb) return false;
    try {
      const ua = new URL(sa, window.location.origin);
      const ub = new URL(sb, window.location.origin);
      if (ua.pathname === ub.pathname) return true;
      return ua.href === ub.href;
    } catch {
      return sa === sb;
    }
  }

  ensurePopupBackgroundTemplateItem() {
    if (!this.popupBackgroundGallery) return;

    if (!this.isUnifiedShell()) {
      const existing = this.popupBackgroundGallery.querySelector('.theme-template-popup-bg');
      if (existing) existing.remove();
      this.checkPopupBackgroundImageCount();
      return;
    }

    const path = this.getTemplateDefaultBackgroundPath();
    let el = this.popupBackgroundGallery.querySelector('.theme-template-popup-bg');

    if (!path) {
      if (el) el.remove();
      this.checkPopupBackgroundImageCount();
      return;
    }

    if (!el) {
      el = document.createElement('div');
      el.className = 'image-item theme-template-image theme-template-popup-bg';
      el.setAttribute('data-theme-template', 'true');
      el.innerHTML = `
        <img src="${path}" alt="" loading="lazy" decoding="async" />
        <span class="theme-template-badge">default</span>
      `;
      this.popupBackgroundGallery.insertBefore(el, this.popupBackgroundGallery.firstChild);
    } else {
      if (!el.classList.contains('theme-template-image')) {
        el.classList.add('theme-template-image');
      }
      const img = el.querySelector('img');
      if (img) {
        img.decoding = 'async';
        const next = path;
        try {
          const cur = new URL(img.src, window.location.origin).pathname;
          const want = this.normalizeAssetPath(next);
          const wantPath = want.startsWith('http')
            ? new URL(want).pathname
            : want.startsWith('/')
              ? want
              : `/${want}`;
          if (cur !== wantPath && !cur.endsWith(wantPath)) {
            img.src = next;
          }
        } catch {
          img.src = next;
        }
      }
      if (el !== this.popupBackgroundGallery.firstChild) {
        this.popupBackgroundGallery.insertBefore(el, this.popupBackgroundGallery.firstChild);
      }
      if (!el.querySelector('.theme-template-badge')) {
        const badge = document.createElement('span');
        badge.className = 'theme-template-badge';
        badge.textContent = 'default';
        el.appendChild(badge);
      }
    }
    this.checkPopupBackgroundImageCount();
  }

  getUserPopupBgGalleryImageItemCount() {
    if (!this.popupBackgroundGallery) return 0;
    return this.popupBackgroundGallery.querySelectorAll('.image-item[data-id]').length;
  }

  _disposePopupBgUploadTooltip() {
    if (this._popupBgUploadTooltip) {
      try {
        this._popupBgUploadTooltip.dispose();
      } catch {
        /* noop */
      }
      this._popupBgUploadTooltip = null;
    }
  }

  checkPopupBackgroundImageCount() {
    if (!this.popupBackgroundUploadPlaceholder) return;
    const atLimit = this.getUserPopupBgGalleryImageItemCount() >= this.maxPopupBgUserGalleryImages;

    if (atLimit) {
      this.popupBackgroundUploadPlaceholder.style.display = 'none';
      this._disposePopupBgUploadTooltip();
      ['data-bs-toggle', 'data-bs-placement', 'data-bs-custom-class', 'data-bs-title'].forEach((attr) => {
        this.popupBackgroundUploadPlaceholder.removeAttribute(attr);
      });
    } else {
      this.popupBackgroundUploadPlaceholder.style.display = 'flex';
      this.popupBackgroundUploadPlaceholder.setAttribute('data-bs-toggle', 'tooltip');
      this.popupBackgroundUploadPlaceholder.setAttribute('data-bs-placement', 'bottom');
      this.popupBackgroundUploadPlaceholder.setAttribute('data-bs-custom-class', 'custom-tooltip');
      this.popupBackgroundUploadPlaceholder.setAttribute(
        'data-bs-title',
        'Image must be JPEG, PNG, JPG, WEBP, GIF, or SVG format and less than 1MB.'
      );
      const existingPopupBgTip =
        typeof bootstrap !== 'undefined' && bootstrap?.Tooltip?.getInstance
          ? bootstrap.Tooltip.getInstance(this.popupBackgroundUploadPlaceholder)
          : null;
      if (existingPopupBgTip) {
        this._popupBgUploadTooltip = existingPopupBgTip;
      } else if (typeof bootstrap !== 'undefined' && bootstrap?.Tooltip) {
        this._popupBgUploadTooltip = new bootstrap.Tooltip(this.popupBackgroundUploadPlaceholder);
        if (!this._popupBgUploadTooltipShowListenerAttached) {
          this._popupBgUploadTooltipShowListenerAttached = true;
          this.popupBackgroundUploadPlaceholder.addEventListener('show.bs.tooltip', () => {
            setTimeout(() => {
              const inst =
                typeof bootstrap !== 'undefined' && bootstrap?.Tooltip?.getInstance
                  ? bootstrap.Tooltip.getInstance(this.popupBackgroundUploadPlaceholder)
                  : null;
              inst?.hide();
            }, 3000);
          });
        }
      }
    }
  }

  setInitialPopupBackgroundSelection() {
    if (!this.isUnifiedShell() || !this.popupBackgroundGallery) return;
    const tpl = this.getCurrentTemplate();
    const merged = mergeBackgroundImage(this.theme, tpl) || { path: '', style: '' };
    const effectivePath = String(merged.path || '').trim();

    this.popupBackgroundGallery.querySelectorAll('.image-item').forEach((el) => {
      el.classList.remove('selectedPopupBackground');
    });

    if (effectivePath) {
      let matched = null;
      this.popupBackgroundGallery.querySelectorAll('.image-item').forEach((item) => {
        if (item.classList.contains('upload-placeholder')) return;
        const img = item.querySelector('img');
        if (!img) return;
        if (
          this._popupBgDisplayUrlsMatch(img.src, effectivePath) ||
          this._popupBgDisplayUrlsMatch(effectivePath, img.src)
        ) {
          matched = item;
        }
      });
      if (matched) {
        matched.classList.add('selectedPopupBackground');
        return;
      }
    }

    const def = this.popupBackgroundGallery.querySelector('.theme-template-popup-bg');
    if (def) def.classList.add('selectedPopupBackground');
  }

  loadTopImagePosition() {
    if (!this.isUnifiedShell()) return;
    const position = String(this._shellPlacementKey() || '').trim().toLowerCase();
    if (position !== 'left' && position !== 'right' && position !== 'top') return;
    const radios = document.querySelectorAll('input[name="top_image_position"]');
    const radio = Array.from(radios).find(r => r.value === position);
    if (radio) radio.checked = true;
    this.applyImagePosition(position);
  }

  getUserGalleryImageItemCount() {
    if (!this.imageGallery) return 0;
    return this.imageGallery.querySelectorAll(
      '.image-item:not(.upload-placeholder):not(.theme-template-image)'
    ).length;
  }

  _disposeUploadTooltip() {
    if (this._uploadTooltip) {
      try {
        this._uploadTooltip.dispose();
      } catch {
        /* noop */
      }
      this._uploadTooltip = null;
    }
  }

  checkImageCount() {
    if (!this.uploadPlaceholder) return;
    const atLimit = this.getUserGalleryImageItemCount() >= this.maxUserGalleryImages;

    if (atLimit) {
      this.uploadPlaceholder.style.display = 'none';
      this._disposeUploadTooltip();
      ['data-bs-toggle', 'data-bs-placement', 'data-bs-custom-class', 'data-bs-title'].forEach((attr) => {
        this.uploadPlaceholder.removeAttribute(attr);
      });
    } else {
      this.uploadPlaceholder.style.display = 'flex';
      this.uploadPlaceholder.setAttribute('data-bs-toggle', 'tooltip');
      this.uploadPlaceholder.setAttribute('data-bs-placement', 'bottom');
      this.uploadPlaceholder.setAttribute('data-bs-custom-class', 'custom-tooltip');
      this.uploadPlaceholder.setAttribute(
        'data-bs-title',
        'Image must be JPEG, PNG, JPG, WEBP, GIF, or SVG format and less than 1MB.'
      );
      const existingTopTip =
        typeof bootstrap !== 'undefined' && bootstrap?.Tooltip?.getInstance
          ? bootstrap.Tooltip.getInstance(this.uploadPlaceholder)
          : null;
      if (existingTopTip) {
        this._uploadTooltip = existingTopTip;
      } else if (typeof bootstrap !== 'undefined' && bootstrap?.Tooltip) {
        this._uploadTooltip = new bootstrap.Tooltip(this.uploadPlaceholder);
        if (!this._uploadTooltipShowListenerAttached) {
          this._uploadTooltipShowListenerAttached = true;
          this.uploadPlaceholder.addEventListener('show.bs.tooltip', () => {
            setTimeout(() => {
              const inst =
                typeof bootstrap !== 'undefined' && bootstrap?.Tooltip?.getInstance
                  ? bootstrap.Tooltip.getInstance(this.uploadPlaceholder)
                  : null;
              inst?.hide();
            }, 3000);
          });
        }
      }
    }
  }

  selectedPopupType(popup_type) {
    this.theme.popup_type = popup_type
    this.themeManager.theme.popup_type = popup_type;
    this.popupType = popup_type;
    this.toggleLightControls();
  }

  getEffectivePopupType() {
    return this.theme.popup_type;
  }

  isUnifiedShell() {
    return isUnifiedPopupShellTheme(this.theme);
  }

  isLightPopup() {
    return this.isUnifiedShell();
  }

  isLightSplitLayout() {
    const activeTheme = this.themeManager?.theme || this.theme;
    const t = activeTheme?.layout?.type;
    return this.isUnifiedShell() && isSplitRowLayoutType(t);
  }

  isLightSingleColumnLayout() {
    const activeTheme = this.themeManager?.theme || this.theme;
    return this.isUnifiedShell() && activeTheme?.layout?.type === 'vertical';
  }

  getImageTarget() {
    if (this.isUnifiedShell()) {
      return 'top';
    }
    return 'background';
  }

  toggleLightControls() {
    this.updateTopControlsVisibility();
  }

  updateTopControlsVisibility() {
    const accordion = document.getElementById('accordionExample');
    const layoutType = this.theme.layout.type;
    accordion.setAttribute('data-image-target', this.getImageTarget());
    accordion.setAttribute('data-layout-type', layoutType);

    const imageAccordionItem = document.getElementById('imageAccordionItem');
    if (imageAccordionItem) {
      const isGaming = (this.theme?.popup_type || this.popupType) === 'gaming';
      imageAccordionItem.style.display = isGaming ? 'none' : '';
    }

    const isSplitLayout = isSplitRowLayoutType(layoutType);
    const topPositionInput = document.getElementById('top_image_position_top');
    const topPositionWrapper = document.getElementById('top-position-option');

    if (isSplitLayout) {
      topPositionInput.disabled = true;
      topPositionWrapper.style.display = 'none';
      if (this.getTopImagePosition() === 'top') {
        const layoutPosition = String(this.theme?.layout?.position || '').toLowerCase().trim();
        if (layoutPosition !== 'left' && layoutPosition !== 'right') return;
        this.setImageData({ position: layoutPosition });
        const radios = document.querySelectorAll('input[name="top_image_position"]');
        const radio = Array.from(radios).find(r => r.value === layoutPosition);
        if (radio) radio.checked = true;
        this.applyImagePosition(layoutPosition);
      }
    } else {
      topPositionInput.disabled = false;
      topPositionWrapper.style.removeProperty('display');
    }

    this.gameManager.updateGameControlsVisibility();

    this.ensureThemeTemplateGalleryItem();
    this.syncLightTopImageFormControlsVisibility();
  }

  /**
   * Gaming birleşik kabukta: üst görsel yokken Resize/Pozisyon satırını gizler; path gelince gösterir.
   * CSS: #accordionExample[data-top-image-active="true"]
   */
  syncLightTopImageFormControlsVisibility() {
    const accordion = document.getElementById('accordionExample');
    if (!accordion || !this.isUnifiedShell()) return;
    const popupType = String(
      this.themeManager?.theme?.popup_type || this.theme?.popup_type || ''
    )
      .trim()
      .toLowerCase();
    if (popupType !== 'gaming') {
      accordion.removeAttribute('data-top-image-active');
      return;
    }
    const path = String(this.getImageData()?.path || '').trim();
    if (path) {
      accordion.setAttribute('data-top-image-active', 'true');
    } else {
      accordion.removeAttribute('data-top-image-active');
    }
  }

  parseStyleString(styleText = '') {
    if (!styleText || typeof styleText !== 'string') return {};
    
    const styles = {};
    const properties = styleText.split(';').filter(prop => prop.trim());
    
    properties.forEach(prop => {
      const colonIndex = prop.indexOf(':');
      if (colonIndex > 0) {
        const key = prop.substring(0, colonIndex).trim();
        const value = prop.substring(colonIndex + 1).trim();
        if (key && value) {
          styles[key] = value;
        }
      }
    });
    
    return styles;
  }

  camelToKebab(str) {
    if (str.includes('-')) {
      return str;
    }
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  applyStylesToElement(element, styles, important = false) {
    if (!element || !styles) return;
    
    Object.keys(styles).forEach(key => {
      const value = styles[key];
      if (value !== null && value !== undefined && value !== '') {
        const cssProperty = this.camelToKebab(key);
        if (important) {
          element.style.setProperty(cssProperty, value, 'important');
        } else {
          element.style.setProperty(cssProperty, value);
        }
      }
    });
  }

  extractPaddingFromStyle(styleText = '') {
    if (!styleText) return null;
    
    const paddingMatch = styleText.match(/padding:\s*([^;]+)/i);
    if (paddingMatch) {
      return paddingMatch[1].trim();
    }
    
    const paddingTopMatch = styleText.match(/padding-top:\s*([^;]+)/i);
    const paddingRightMatch = styleText.match(/padding-right:\s*([^;]+)/i);
    const paddingBottomMatch = styleText.match(/padding-bottom:\s*([^;]+)/i);
    const paddingLeftMatch = styleText.match(/padding-left:\s*([^;]+)/i);
    
    if (paddingTopMatch || paddingRightMatch || paddingBottomMatch || paddingLeftMatch) {
      return {
        top: paddingTopMatch ? paddingTopMatch[1].trim() : null,
        right: paddingRightMatch ? paddingRightMatch[1].trim() : null,
        bottom: paddingBottomMatch ? paddingBottomMatch[1].trim() : null,
        left: paddingLeftMatch ? paddingLeftMatch[1].trim() : null
      };
    }
    
    return null;
  }

  extractHeightPercent(styleText = '') {
    const match = styleText.match(/height:\s*([\d.]+)%/);
    return match ? parseFloat(match[1]) : null;
  }

  /** Slider + kayıtlı tema stilleri için % boyutu 10–100 aralığına çeker. */
  clampTopImageResizePercent(value) {
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (!Number.isFinite(n)) return this.topImageDefaultHeight;
    return Math.min(
      TOP_IMAGE_RESIZE_PERCENT_MAX,
      Math.max(TOP_IMAGE_RESIZE_PERCENT_MIN, Math.round(n))
    );
  }

  getSplitImageSizePercent() {
    if (!this.isLightSplitLayout()) return null;
    const position = String(this.theme?.layout?.position || this._shellPlacementKey() || 'left').trim().toLowerCase();
    const activeTheme = this.themeManager?.theme || this.theme;
    const innerStyle =
      activeTheme?.image_styles?.[position]?.image_inner ||
      this.getCurrentTemplate()?.image_styles?.[position]?.image_inner || '';
    const widthMatch = innerStyle.match(/width:\s*([\d.]+)%/);
    const heightMatch = innerStyle.match(/height:\s*([\d.]+)%/);
    return (widthMatch ? parseFloat(widthMatch[1]) : null) ||
           (heightMatch ? parseFloat(heightMatch[1]) : null);
  }

  getEffectiveImageSize() {
    const fromStyle = this.extractHeightPercent(this.getImageData()?.style);
    if (fromStyle != null) {
      return this.clampTopImageResizePercent(fromStyle);
    }
    /* Birleşik: height bazen sadece legacy top_image.style'da (image.style boş string) */
    if (this.isUnifiedShell() && this.theme?.top_image?.style) {
      const fromLegacyTop = this.extractHeightPercent(this.theme.top_image.style);
      if (fromLegacyTop != null) return this.clampTopImageResizePercent(fromLegacyTop);
    }
    if (this.isLightSplitLayout()) {
      const splitSize = this.getSplitImageSizePercent();
      if (splitSize != null) return this.clampTopImageResizePercent(splitSize);
    }
    return this.clampTopImageResizePercent(this.topImageDefaultHeight);
  }

  applyPaddingToContainer(container, paddingValue) {
    if (!paddingValue || !container) return;
    if (typeof paddingValue === 'string') {
      container.style.setProperty('padding', paddingValue, 'important');
    } else if (typeof paddingValue === 'object') {
      if (paddingValue.top) container.style.setProperty('padding-top', paddingValue.top, 'important');
      if (paddingValue.right) container.style.setProperty('padding-right', paddingValue.right, 'important');
      if (paddingValue.bottom) container.style.setProperty('padding-bottom', paddingValue.bottom, 'important');
      if (paddingValue.left) container.style.setProperty('padding-left', paddingValue.left, 'important');
    }
  }

  addPaddingToStyle(styleString, paddingValue) {
    if (!paddingValue) return styleString;
    let newStyle = styleString;
    if (typeof paddingValue === 'string') {
      newStyle += `; padding: ${paddingValue}`;
    } else if (typeof paddingValue === 'object') {
      if (paddingValue.top) newStyle += `; padding-top: ${paddingValue.top}`;
      if (paddingValue.right) newStyle += `; padding-right: ${paddingValue.right}`;
      if (paddingValue.bottom) newStyle += `; padding-bottom: ${paddingValue.bottom}`;
      if (paddingValue.left) newStyle += `; padding-left: ${paddingValue.left}`;
    }
    return newStyle;
  }

  getImageData() {
    return this.isUnifiedShell() ? this.theme.image : this.theme.top_image;
  }

  /**
   * Birleşik kabukta yerleşim: layout.position (sol/sağ/üst); yoksa eski kayıtlar için image.position.
   * Dikey şablonda layout.position genelde "top" kalırken sütun yanı görsel sol/sağda olabilir — o zaman legacy image.position.
   */
  _shellPlacementKey() {
    if (!this.isUnifiedShell()) return '';
    const lp = String(this.theme?.layout?.position || '').trim().toLowerCase();
    if (lp === 'left' || lp === 'right') return lp;
    const leg = String(
      this.getImageData()?.position || this.theme?.image?.position || this.theme?.top_image?.position || ''
    )
      .trim()
      .toLowerCase();
    if (leg === 'left' || leg === 'right') return leg;
    if (lp === 'top') return 'top';
    if (leg === 'top') return 'top';
    return '';
  }

  setImageData(data) {
    if (!data || typeof data !== 'object') return;
    const { position, ...rest } = data;
    const tgt = this.isUnifiedShell() ? this.getImageData() : null;

    if (this.isUnifiedShell()) {
      if ('position' in data) {
        const p = String(position ?? '').trim().toLowerCase();
        if (p === 'left' || p === 'right' || p === 'top') {
          this.theme.layout = this.theme.layout || {};
          this.theme.layout.position = p;
          if (this.themeManager?.theme && this.themeManager.theme !== this.theme) {
            this.themeManager.theme.layout = this.themeManager.theme.layout || {};
            this.themeManager.theme.layout.position = p;
          }
        }
      }
      if (this.themeManager && typeof this.themeManager.patchDecorativeImage === 'function') {
        if (Object.keys(rest).length > 0) {
          this.themeManager.patchDecorativeImage(rest);
        }
      } else if (tgt) {
        Object.assign(tgt, rest);
      }
      if (tgt && 'position' in tgt) delete tgt.position;
      if (this.theme?.top_image && 'position' in this.theme.top_image) delete this.theme.top_image.position;
      return;
    }

    Object.assign(this.getImageData(), data);
  }

  getLightImageNodes() {
    const root = document.getElementById('wheelluckContainer');
    const wrapper =
      root?.querySelector('.image-container.wheelluckImage') ||
      root?.querySelector('.image-container') ||
      null;
    const inner = wrapper?.querySelector('.wheelluckImageInner') || null;
    const topImage = inner?.querySelector('.top-image') || null;
    return { wrapper, inner, topImage };
  }

  getTopImagePosition() {
    const checked = Array.from(this.topImagePositionRadios).find(r => r.checked);
    if (checked?.value) return checked.value;
    return this._shellPlacementKey() || '';
  }

  styleObjectToString(styles = {}) {
    const parts = [];
    Object.keys(styles).forEach((key) => {
      const value = styles[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        parts.push(`${key}: ${String(value).trim()}`);
      }
    });
    return parts.join('; ');
  }

  mergeDecorativeImageStyleDefaults(styleText = '') {
    const parsed = this.parseStyleString(styleText || '');
    const canonical = new Set(
      Object.keys(parsed).map((k) => String(k).toLowerCase().replace(/\s+/g, ''))
    );
    const add = (kebab, val) => {
      const key = kebab.replace(/\s+/g, '');
      if (canonical.has(key)) return;
      parsed[kebab] = val;
      canonical.add(key);
    };
    add('object-fit', 'contain');
    add('max-width', '100%');
    add('max-height', '100%');
    add('box-sizing', 'border-box');
    return this.styleObjectToString(parsed);
  }

  normalizeImageStyleForPosition(position) {
    const imageData = this.getImageData();
    const parsedStyles = this.parseStyleString(imageData.style || '');
    const fallbackPos = this.isUnifiedShell() ? this._shellPlacementKey() : String(imageData.position || '').trim().toLowerCase();
    const currentPosition = String(position || fallbackPos || '').trim().toLowerCase();
    if (currentPosition !== 'left' && currentPosition !== 'right' && currentPosition !== 'top') {
      return this.mergeDecorativeImageStyleDefaults(this.styleObjectToString(parsedStyles));
    }

    if (currentPosition === 'left' || currentPosition === 'right') {
      const existingObjPos = String(
        parsedStyles['object-position'] || parsedStyles.objectPosition || ''
      ).trim();
      if (!existingObjPos) {
        parsedStyles['object-position'] =
          currentPosition === 'left' ? 'left center' : 'right center';
      }
      if (!String(parsedStyles['padding-top'] || '').trim()) {
        parsedStyles['padding-top'] = '0';
      }
    } else if (currentPosition === 'top') {
      const existingObjPosTop = String(
        parsedStyles['object-position'] || parsedStyles.objectPosition || ''
      ).trim();
      if (!existingObjPosTop) {
        parsedStyles['object-position'] = 'center top';
      }
      if (!parsedStyles['padding-top']) {
        parsedStyles['padding-top'] = '30px';
      }
    }

    const withFit = this.mergeDecorativeImageStyleDefaults(this.styleObjectToString(parsedStyles));
    return withFit;
  }

  /**
   * Gaming yan görsel + oyun yok: şablondaki content `min-width:0` dar kabukta metni sıkıştırır.
   * Yazı alanı bozulmasın diye okunabilir taban genişlik (kabuk genişliği ayrıca sync ile 800’e çekilir).
   */
  _applyLightSideDecorContentReadabilityMinWidth(position) {
    if (!this.isUnifiedShell()) return;
    const p = String(position || '').trim().toLowerCase();
    if (p !== 'left' && p !== 'right') return;
    const theme = this.themeManager?.theme || this.theme;
    const hasDecor = String(theme?.image?.path || theme?.top_image?.path || '').trim();
    if (!hasDecor) return;
    const content = document.getElementById('wheelluckContent');
    if (!content) return;
    const hasGameDom = Boolean(document.querySelector('.game-svg-container'));
    if (hasGameDom) return;
    content.style.setProperty('min-width', 'min(360px, 55%)', 'important');
  }

  applyLightSplitColumnOrder(position) {
    const imageWrapper = document.querySelector('.image-container');
    const wheelluckContent = document.getElementById('wheelluckContent');
    if (!wheelluckContent) return;
    const bucketApplied = this.applyPositionStyleBuckets(position);
    if (!bucketApplied) {
      const imgOrder = position === 'left' ? '1' : '2';
      const contentOrder = position === 'left' ? '2' : '1';
      if (imageWrapper) {
        imageWrapper.style.setProperty('order', imgOrder, 'important');
      }
      wheelluckContent.style.setProperty('order', contentOrder, 'important');
      document.querySelector('.game-svg-container')?.style.setProperty('order', '3', 'important');
      document.getElementById('close_button')?.style.setProperty('order', '4', 'important');
    }
  }

  applyLightMobileSplitNoGameStack(position) {
    if (!this.isUnifiedShell() || !this.isLightSplitLayout()) return;
    const theme = this.themeManager?.theme || this.theme;
    const hasActiveGame =
      theme?.popup_type === 'gaming' ||
      (theme?.gameID != null && String(theme.gameID).trim() !== '');
    if (hasActiveGame) return;

    const pos = String(position || '').trim().toLowerCase();
    if (pos !== 'left' && pos !== 'right') return;

    const contentWrapper = document.querySelector('.contentWrapper');
    const content = document.getElementById('wheelluckContent');
    const imageWrapper = document.querySelector('.image-container');
    if (!contentWrapper || !content || !imageWrapper) return;

    contentWrapper.style.setProperty('flex-direction', 'column', 'important');
    contentWrapper.style.setProperty('align-items', 'stretch', 'important');
    contentWrapper.style.setProperty('justify-content', 'flex-start', 'important');

    const imageOnRight = pos === 'right';
    if (imageOnRight) {
      content.style.setProperty('order', '1', 'important');
      imageWrapper.style.setProperty('order', '2', 'important');
    } else {
      imageWrapper.style.setProperty('order', '1', 'important');
      content.style.setProperty('order', '2', 'important');
    }
    content.style.setProperty('width', '100%', 'important');
    content.style.setProperty('max-width', '100%', 'important');
    imageWrapper.style.setProperty('width', '100%', 'important');
    imageWrapper.style.setProperty('max-width', '100%', 'important');
  }

  applyPositionStyleBuckets(position) {
    const pos = String(position || '').trim().toLowerCase();
    if (pos !== 'left' && pos !== 'right' && pos !== 'top') return false;
    const activeTheme = this.themeManager?.theme || this.theme;
    const gameBucket = activeTheme?.game_styles?.[pos];
    const contentBucket = activeTheme?.content_styles?.[pos];
    const imageBucket = activeTheme?.image_styles?.[pos];
    if (!gameBucket && !contentBucket && !imageBucket) return false;

    const contentWrapper = document.querySelector('.contentWrapper');
    const content = document.getElementById('wheelluckContent');
    const contentInner = document.getElementById('wheelluckContentInner');
    const game = document.querySelector('.game-svg-container');
    const gameInner = game?.querySelector('.game-svg-inner');
    const image = document.querySelector('.image-container');
    const imageInner = image?.querySelector('.wheelluckImageInner');

    if (contentWrapper && contentBucket?.content_wrapper) {
      applyStyleString(contentWrapper, contentBucket.content_wrapper);
    }
    if (content && contentBucket?.content) {
      applyStyleString(content, contentBucket.content);
      this.applySidePositionContentTopSpacing(pos);
      this._applyLightSideDecorContentReadabilityMinWidth(pos);
    }
    if (contentInner && contentBucket?.content_inner) {
      applyStyleString(contentInner, contentBucket.content_inner);
    }
    if (game && gameBucket?.game) {
      const stripped = styleStringWithoutGameAreaBackground(gameBucket.game);
      applyStyleString(game, stripped && stripped.trim() ? stripped : gameBucket.game);
    }
    if (gameInner && gameBucket?.game_inner) {
      applyStyleString(gameInner, gameBucket.game_inner);
    }
    if (image && imageBucket?.image) {
      applyStyleString(image, imageBucket.image);
    }
    if (imageInner && imageBucket?.image_inner) {
      applyStyleString(imageInner, imageBucket.image_inner);
    }
    applyGameAreaBackgroundFromTheme(activeTheme);
    return true;
  }

  applySidePositionContentTopSpacing(position) {
    const pos = String(position || '').trim().toLowerCase();
    if (pos !== 'left' && pos !== 'right') return;
    const content = document.getElementById('wheelluckContent');
    if (!content) return;
    content.style.setProperty('padding-top', '50px', 'important');
  }

  applySplitRowShellFromTheme() {
    if (!this.isUnifiedShell() || !this.isLightSplitLayout()) return;
    const theme = this.themeManager?.theme || this.theme;
    const gameId = Number(theme?.gameID);
    if (!theme || !Number.isInteger(gameId) || gameId <= 0) return;
    const layoutPos = String(theme?.layout?.position || '').trim().toLowerCase();
    if (layoutPos !== 'left' && layoutPos !== 'right') return;
    this.applyLightSplitColumnOrder(layoutPos);
  }

  resetLightSplitLayoutAfterTopImageRemoved() {
    if (!this.isUnifiedShell() || !this.isLightSplitLayout()) return;

    const theme = this.themeManager?.theme || this.theme;
    const gameId = Number(theme?.gameID);
    if (theme && Number.isInteger(gameId) && gameId > 0) {
      this.applySplitRowShellFromTheme();
      return;
    }

    /* Oyun yok ama şablonda dekoratif görsel var (ör. id:4): split satır düzenini koru; sütun yığını yalnız görsel yokken. */
    const decorPath = String(theme?.image?.path || theme?.top_image?.path || '').trim();
    if (decorPath) {
      let pos = String(theme?.layout?.position || '').trim().toLowerCase();
      if (pos !== 'left' && pos !== 'right' && pos !== 'top') {
        const lt = String(theme?.layout?.type || '').toLowerCase().trim();
        pos = lt === 'split-reverse' ? 'right' : 'left';
      }
      if (pos === 'left' || pos === 'right') {
        this.applyLightSplitColumnOrder(pos);
        this.applySidePositionContentTopSpacing(pos);
        return;
      }
      if (pos === 'top') {
        this.applyPositionStyleBuckets('top');
        return;
      }
    }

    const contentWrapper = document.querySelector('.contentWrapper');
    const content = document.getElementById('wheelluckContent');
    if (!contentWrapper || !content) return;

    contentWrapper.style.setProperty('flex-direction', 'column', 'important');
    contentWrapper.style.setProperty('align-items', 'stretch', 'important');
    contentWrapper.style.setProperty('justify-content', 'flex-start', 'important');
    contentWrapper.style.setProperty('width', '100%', 'important');
    contentWrapper.style.setProperty('height', 'auto', 'important');
    contentWrapper.style.setProperty('min-height', '0', 'important');
    contentWrapper.style.setProperty('overflow', 'visible', 'important');

    content.style.setProperty('order', '1', 'important');
    content.style.setProperty('width', '100%', 'important');
    content.style.setProperty('max-width', '100%', 'important');
    content.style.setProperty('flex', '0 1 auto', 'important');
    content.style.setProperty('min-width', '0', 'important');
    content.style.setProperty('margin-top', '24px', 'important');

    document.querySelector('.game-svg-container')?.style.setProperty('order', '2', 'important');
    document.getElementById('close_button')?.style.setProperty('order', '3', 'important');
  }

  getTemplateOriginalSize() {
    const tpl = this.getCurrentTemplate();
    const parse = (v) => parseInt(String(v).replace(/px/gi, ''), 10) || 0;
    return {
      width: parse(tpl?.width) || parse(containerStyleValue(tpl?.containerStyle, 'width')) || 480,
      height: parse(tpl?.height) || parse(containerStyleValue(tpl?.containerStyle, 'height')) || 580
    };
  }

  /**
   * Yan yana (left/right) düzen: “üst görsel” (dikey) tabana göre genişlik artar, yükseklik düşer.
   * Eski formül newWidth ile orantılı yükseklik ×1.08 kullanıyordu; top → left geçişinde kabuk daha uzun görünüyordu.
   * Sol/sağ sonrası tema width şişmesi için taban yine şablon kökü + makul üst sınır.
   */
  _getSideBySideShellDimensions(theme) {
    const orig = this.getTemplateOriginalSize();
    const ps = theme?.popup_settings || {};
    const cs = theme?.containerStyle && typeof theme.containerStyle === 'object' ? theme.containerStyle : {};
    const parsePx = (v) => {
      const n = parseInt(String(v ?? '').replace(/px/gi, '').trim(), 10);
      return Number.isNaN(n) || n <= 0 ? 0 : n;
    };
    const readW = parsePx(ps.popup_width) || parsePx(containerStyleValue(cs, 'width'));
    const readH =
      parsePx(ps.popup_height) ||
      parsePx(containerStyleValue(cs, 'height')) ||
      parsePx(containerStyleValue(cs, 'max-height'));
    const baseW0 = orig.width > 0 ? orig.width : 480;
    const baseH0 = orig.height > 0 ? orig.height : 580;
    const maxSaneW = Math.ceil(baseW0 * 1.28);
    const maxSaneH = Math.ceil(baseH0 * 1.28);
    let baseW = readW > 0 && readW <= maxSaneW ? readW : baseW0;
    let baseH = readH > 0 && readH <= maxSaneH ? readH : baseH0;
    const widthMult = 1.12;
    const newWidth = Math.ceil(baseW * widthMult);
    const landscapeH = Math.round(newWidth / 1.2);
    const shorterThanTop = Math.round(baseH * 0.88);
    const newHeight = Math.max(320, Math.min(shorterThanTop, landscapeH));
    return { newWidth, newHeight };
  }

  /**
   * Dikey şablon + sol/sağ görsel: kabuk genişletilir; satır/içerik oranı yalnız tema bucket’larından.
   */
  applyLightSingleRowLayout(position) {
    const popup = document.getElementById('wheelluckContainer');
    const contentWrapper = document.querySelector('.contentWrapper');
    if (!popup || !contentWrapper) return;

    const theme = this.themeManager?.theme || this.theme;
    const dims = this._getSideBySideShellDimensions(theme);
    const pos = String(position || '').trim().toLowerCase();
    /* Birlesik kabuk + yan gorsel: genisligi oyun satiri zincirinden ver (max-width 800). */
    if (
      this.isUnifiedShell() &&
      (pos === 'left' || pos === 'right') &&
      this.themeManager?.gameManager?.syncLightPopupShellWidthForImagePosition
    ) {
      this.themeManager.gameManager.syncLightPopupShellWidthForImagePosition(pos);
      const wAfter = String(popup.style.getPropertyValue('width') || '').trim();
      if (!wAfter) {
        popup.style.setProperty('width', `${dims.newWidth}px`, 'important');
      }
    } else {
      popup.style.setProperty('width', `${dims.newWidth}px`, 'important');
    }
    popup.style.setProperty('height', `${dims.newHeight}px`, 'important');
    popup.style.setProperty('max-width', '100%', 'important');

    if (this.theme.background_image?.path || this.theme.background_image?.style) {
      applyPopupBackgroundImage(popup, this.theme.background_image);
    }

    this._applyDecorativeSideColumnLayoutLikeSplit(position, { syncShellWidth: true });

    this._singleRowLayoutActive = true;
    this.syncPopupSize();
  }

  clearLightSingleRowLayout() {
    if (!this._singleRowLayoutActive) return;
    const popup = document.getElementById('wheelluckContainer');
    const contentWrapper = document.querySelector('.contentWrapper');
    const imageWrapper = document.querySelector('.image-container');
    const content = document.getElementById('wheelluckContent');
    const inner = imageWrapper?.querySelector('.wheelluckImageInner');
    if (!popup || !contentWrapper) { this._singleRowLayoutActive = false; return; }

    const orig = this.getTemplateOriginalSize();
    popup.style.setProperty('width', `${orig.width}px`, 'important');
    popup.style.setProperty('height', `${orig.height}px`, 'important');

    const desktop = this.theme.desktop_style;
    if (desktop?.content_wrapper?.style) applyStyleString(contentWrapper, desktop.content_wrapper.style);
    if (this.theme.background_image?.path || this.theme.background_image?.style) {
      applyPopupBackgroundImage(popup, this.theme.background_image);
    }
    if (desktop?.content?.style && content) applyStyleString(content, desktop.content.style);
    if (desktop?.image?.style && imageWrapper) applyStyleString(imageWrapper, desktop.image.style);
    if (desktop?.image_inner?.style && inner) applyStyleString(inner, desktop.image_inner.style);

    document.querySelector('.game-svg-container')?.style.removeProperty('order');
    document.getElementById('close_button')?.style.removeProperty('order');

    this._singleRowLayoutActive = false;
    this.themeManager?.gameManager?.syncLightPopupShellWidthForImagePosition?.('top');
    this.syncPopupSize();
  }

  syncPopupSize() {
    requestAnimationFrame(() => {
      this.themeManager?.popupManager?.syncPopupSizeInputsFromDom?.();
    });
  }
  applyVerticalImageAlignment(topImage, position) {
    const baseStyle = this.getImageData().style || this.getCurrentTemplate()?.image?.style || '';
    if (baseStyle) applyStyleString(topImage, baseStyle);

    const sizePct = this.getEffectiveImageSize();
    this.applyTopImageSize(sizePct);
  }

  syncLayoutPositionFromImagePosition(position) {
    const pos = String(position || '').trim().toLowerCase();
    if (pos !== 'left' && pos !== 'right' && pos !== 'top') return;

    this.theme.layout = this.theme.layout || {};
    this.theme.layout.position = pos;

    if (this.themeManager.theme !== this.theme) {
      this.themeManager.theme.layout = this.themeManager.theme.layout || {};
      this.themeManager.theme.layout.position = this.theme.layout.position;
    }

    document.getElementById('accordionExample')?.setAttribute('data-layout-type', this.theme.layout.type);
  }

  persistSplitColumnOrderToDesktopStyles(position) {
    const imgOrder = position === 'left' ? '1' : '2';
    const contentOrder = position === 'left' ? '2' : '1';

    const patchOrderInStyleString = (styleStr, orderVal) => {
      if (styleStr == null || styleStr === undefined) return styleStr;
      const s = String(styleStr).trim();
      if (!s) return `order: ${orderVal} !important`;
      if (/\border\s*:/i.test(s)) {
        return s.replace(/\border\s*:\s*[^;]+/gi, `order: ${orderVal} !important`);
      }
      return `${s}; order: ${orderVal} !important`;
    };

    if (this.theme.desktop_style?.image) {
      this.theme.desktop_style.image.style = patchOrderInStyleString(
        this.theme.desktop_style.image.style,
        imgOrder
      );
    }
    if (this.theme.desktop_style?.content) {
      this.theme.desktop_style.content.style = patchOrderInStyleString(
        this.theme.desktop_style.content.style,
        contentOrder
      );
    }

    if (this.themeManager.theme !== this.theme) {
      this.themeManager.theme.desktop_style.image = this.theme.desktop_style.image;
      this.themeManager.theme.desktop_style.content = this.theme.desktop_style.content;
    }
  }

  _applyDecorativeSideColumnLayoutLikeSplit(position, { syncShellWidth = false } = {}) {
    const pos = String(position || '').trim().toLowerCase();
    if (pos !== 'left' && pos !== 'right') return;
    this.applyLightSplitColumnOrder(pos);
    this.syncLayoutPositionFromImagePosition(pos);
    this.persistSplitColumnOrderToDesktopStyles(pos);
    if (syncShellWidth) {
      /* Oyun varken de yan satırda kabuk genişliği splitShellWidth ile kalsın; yoksa fit-content + dar px üst üste biniyordu */
      this.themeManager?.gameManager?.syncLightPopupShellWidthForImagePosition?.(pos);
    }
  }

  applyImagePosition(position) {
    const { topImage } = this.getLightImageNodes();
    const explicit =
      position !== undefined && position !== null ? String(position).trim().toLowerCase() : '';
    if (explicit && explicit !== 'left' && explicit !== 'right' && explicit !== 'top') return;

    const prevRaw = String(this._shellPlacementKey() || '').trim().toLowerCase();
    const previousPosition =
      prevRaw === 'left' || prevRaw === 'right' || prevRaw === 'top' ? prevRaw : 'top';
    const currentPosition =
      explicit === 'left' || explicit === 'right' || explicit === 'top'
        ? explicit
        : previousPosition;

    const isMobileScreen = window.innerWidth <= 768;
    const isSide = (p) => p === 'left' || p === 'right';
    const prevSide = isSide(previousPosition);
    const curSide = isSide(currentPosition);
    const sideSwapOnly = prevSide && curSide && previousPosition !== currentPosition;

    this.setImageData({ position: currentPosition });
    if (!topImage) return;
    topImage.setAttribute('data-position', currentPosition);

    if (this.isUnifiedShell()) {
      if (isMobileScreen) {
        if (curSide && this.isLightSplitLayout()) {
          this.applyLightMobileSplitNoGameStack(currentPosition);
        }
        return;
      }

      if (sideSwapOnly) {
        this._applyDecorativeSideColumnLayoutLikeSplit(currentPosition, { syncShellWidth: false });
        if (this.isLightSingleColumnLayout()) {
          this.applyLightSplitBaseStyles();
        }
        const sp = this.getEffectiveImageSize();
        this.applyTopImageSize(sp);
        this.applySidePositionContentTopSpacing(currentPosition);
        return;
      }

      if (curSide && this.isLightSplitLayout()) {
        this._applyDecorativeSideColumnLayoutLikeSplit(currentPosition, { syncShellWidth: true });
        const sp = this.getEffectiveImageSize();
        this.applyTopImageSize(sp);
        this.applySidePositionContentTopSpacing(currentPosition);
        return;
      }

      if (curSide && this.isLightSingleColumnLayout()) {
        this.applyLightSingleRowLayout(currentPosition);
        this.applyLightSplitBaseStyles();
        const sp = this.getEffectiveImageSize();
        this.applyTopImageSize(sp);
        this.applySidePositionContentTopSpacing(currentPosition);
        return;
      }

      if (currentPosition === 'top') {
        this.syncLayoutPositionFromImagePosition('top');
        if (this.isLightSingleColumnLayout() && prevSide) {
          this.clearLightSingleRowLayout();
        }
        if (this.isLightSingleColumnLayout()) {
          this.applyPositionStyleBuckets('top');
        }
        this.applyLightDesktopImageHostsFromTheme();
        this.applyVerticalImageAlignment(topImage, 'top');
      }
      return;
    }

    if (isMobileScreen) return;

    const normalizedStyle = this.normalizeImageStyleForPosition(currentPosition);
    if (normalizedStyle) this.setImageData({ style: normalizedStyle });

    const currentHeight = topImage.style.getPropertyValue('height');
    const imageStyle = this.getImageData().style || '';
    if (imageStyle) {
      const imageStyleObj = this.parseStyleString(imageStyle);
      for (const [key, value] of Object.entries(imageStyleObj)) {
        if (value == null || value === '') continue;
        const cssProperty = this.camelToKebab(key);
        if (cssProperty === 'height') continue;
        topImage.style.setProperty(cssProperty, String(value).replace(/\s*!important\s*/g, '').trim(), 'important');
      }
    }
    if (currentHeight) topImage.style.setProperty('height', currentHeight, 'important');
  }

  applyTopImageSize(sizePercent) {
    if (this._applyingSizeGuard) return;
    this._applyingSizeGuard = true;
    try {
      this._applyTopImageSizeInner(sizePercent);
    } finally {
      this._applyingSizeGuard = false;
    }
  }

  _applyTopImageSizeInner(sizePercent) {
    const { topImage, inner } = this.getLightImageNodes();
    if (!topImage) return;

    const wheelPopup = document.querySelector('#wheelluckContainer');
    const clamped = this.clampTopImageResizePercent(sizePercent);
    const isGaming = this.isUnifiedShell();

    if (this.topImageSizeValue) this.topImageSizeValue.innerText = `${clamped}%`;
    if (this.topImageHeightInput && this.topImageHeightInput.value !== `${clamped}`) {
      this._updatingTopImageSize = true;
      this.topImageHeightInput.value = clamped;
      setTimeout(() => { this._updatingTopImageSize = false; }, 0);
    }
    if (isGaming && wheelPopup) {
      const hasPath = String(this.getImageData()?.path || '').trim();
      if (hasPath) wheelPopup.classList.add('has-top-image');
      else wheelPopup.classList.remove('has-top-image');
    }

    if (this.isLightSplitLayout()) {
      if (inner) {
        inner.style.setProperty('width', `${clamped}%`, 'important');
        inner.style.setProperty('height', `${clamped}%`, 'important');
        /* Şablon image_inner genelde flex-start + stretch; % küçültünce kutu dış kenara yapışıyordu. */
        inner.style.setProperty('flex', '0 0 auto', 'important');
        inner.style.setProperty('align-self', 'center', 'important');
        inner.style.setProperty('margin', 'auto', 'important');
        inner.style.removeProperty('transform');
        inner.style.removeProperty('transform-origin');
      }
      /* Classic top_image.style ile aynı: slider % tema.image.style’a yazılsın; yeniden yükte getEffectiveImageSize doğru okusun */
      const parsed = this.parseStyleString(String(this.getImageData()?.style || '').trim());
      parsed.height = `${clamped}%`;
      parsed.width = `${clamped}%`;
      this.setImageData({ style: this.styleObjectToString(parsed) });
    } else {
      if (inner) {
        inner.style.removeProperty('transform');
        inner.style.removeProperty('transform-origin');
      }
      const shell = document.getElementById('wheelluckContainer');
      const shellH =
        shell && shell.offsetHeight > 40
          ? shell.offsetHeight
          : this.getTemplateOriginalSize().height || 480;
      const bandPx = Math.max(48, Math.round(shellH * (clamped / 100)));
      if (inner) {
        inner.style.setProperty('min-height', `${bandPx}px`, 'important');
      }
      const imageData = this.getImageData();
      const parsedStyles = this.parseStyleString(imageData.style || '');
      // Ebeveynde tanımlı yükseklik yokken img height:% — hesaplanan yükseklik 0 oluyordu (dikey/top).
      parsedStyles.height = 'auto';
      parsedStyles['max-height'] = `${bandPx}px`;
      const styleParts = [];
      for (const [key, value] of Object.entries(parsedStyles)) {
        if (value != null && value !== '') styleParts.push(`${key}: ${value}`);
      }
      const mergedStyle = styleParts.join('; ');
      this.setImageData({ style: mergedStyle });
      applyStyleString(topImage, mergedStyle);
    }
  }

  applyTopImage(imageUrl, sizePercent = null) {
    if (this.isUnifiedShell()) {
      this.applyLightPopupImage(imageUrl, sizePercent);
    } else {
      this.applyGamingPopupImage(imageUrl, sizePercent);
    }
  }

  applyLightPopupImage(imageUrl, sizePercent = null) {
    if (!imageUrl || !imageUrl.trim()) {
      this.removeTopImage();
      return;
    }

    if (sizePercent === null) {
      sizePercent = this.getEffectiveImageSize();
    }

    this.setImageData({ path: imageUrl });
    this.themeManager?.templateManager?.ensureUnifiedImageContainer?.();
    const { topImage: existingTopImage } = this.getLightImageNodes();
    if (!existingTopImage) return;

    this.applyLightDesktopImageHostsFromTheme();

    const rawImgStyle =
      this.getImageData().style || this.getCurrentTemplate()?.image?.style || '';
    const mergedImgStyle = this.mergeDecorativeImageStyleDefaults(rawImgStyle);
    this.setImageData({ style: mergedImgStyle });
    if (mergedImgStyle) applyStyleString(existingTopImage, mergedImgStyle);

    this.applyTopImageSize(sizePercent);
    existingTopImage.onload = () => {
      const sp = this.getEffectiveImageSize();
      this.applyTopImageSize(sp);
    };
    existingTopImage.src = imageUrl;

    /* Sol/sağ: yalnızca radyoda yan seçiliyse radyo kazanır; varsayılan "top" radyo tema layout (ör. right) ile çakışmasın */
    const radioPos = String(this.getTopImagePosition() || '').trim().toLowerCase();
    let imagePosition =
      radioPos === 'left' || radioPos === 'right'
        ? radioPos
        : String(this.theme?.layout?.position || '').trim().toLowerCase();
    if (imagePosition !== 'left' && imagePosition !== 'right' && imagePosition !== 'top') {
      imagePosition = String(this.getCurrentTemplate()?.layout?.position || '').trim().toLowerCase();
    }
    if (imagePosition !== 'left' && imagePosition !== 'right' && imagePosition !== 'top') {
      const legacy = String(this._shellPlacementKey() || '').trim().toLowerCase();
      if (legacy === 'left' || legacy === 'right' || legacy === 'top') {
        imagePosition = legacy;
      }
    }
    if (imagePosition !== 'left' && imagePosition !== 'right' && imagePosition !== 'top') {
      imagePosition = 'top';
    }
    this.applyImagePosition(imagePosition);

    document.querySelector('#wheelluckContainer').classList.add('has-top-image');
    // Gaming (gaming değil): dekoratif görsel ile oyun bir arada olmasın — gerçek oyun varken görsel yüklenince oyun kaldırılır.
    const pt = String(this.theme?.popup_type || '').toLowerCase().trim();
    const suppressLayout = Boolean(this.themeManager?._suppressNoGameLayoutMutations);
    const domHasGameMarkup = Boolean(
      document.querySelector('.game-svg-container .game-svg-inner')?.innerHTML?.trim()
    );
    const shouldClearGameForDecorativeImage =
      pt !== 'gaming' &&
      this.gameManager &&
      !suppressLayout &&
      (hasActiveLightGame(this.theme) || domHasGameMarkup);
    if (shouldClearGameForDecorativeImage) {
      this.gameManager.removeGameSvg();
    }

    /* Oyun kalktıktan sonra tema.layout güncel; kabuğu tekrar yan sütun genişliğine (splitShellWidth) çek — metin sıkışmasın */
    const layoutPosAfter = String(
      this.themeManager?.theme?.layout?.position || this.theme?.layout?.position || ''
    )
      .trim()
      .toLowerCase();
    if (
      this.isUnifiedShell() &&
      pt !== 'gaming' &&
      (layoutPosAfter === 'left' || layoutPosAfter === 'right') &&
      String(this.themeManager?.theme?.image?.path || this.theme?.image?.path || '').trim() &&
      this.gameManager?.syncLightPopupShellWidthForImagePosition
    ) {
      this.gameManager.syncLightPopupShellWidthForImagePosition(layoutPosAfter);
      this.syncPopupSize();
    }
  }

  applyGamingPopupImage(imageUrl, sizePercent = null) {
    if (!imageUrl || !imageUrl.trim()) {
      this.removeTopImage();
      return;
    }

    const contentWrapper = document.querySelector('.contentWrapper');
    const wheelPopup = document.querySelector('#wheelluckContainer');
    const wheelPopupContent = document.querySelector('#wheelluckContent');

    if (sizePercent === null) {
      sizePercent = this.getEffectiveImageSize();
    }

    let existingTopImage = document.querySelector('.top-image');
    if (existingTopImage?.parentNode) {
      existingTopImage.parentNode.removeChild(existingTopImage);
    }

    const currentPosition = String(this.theme?.layout?.position || this._shellPlacementKey() || '').trim().toLowerCase();
    if (currentPosition === 'left' || currentPosition === 'right' || currentPosition === 'top') {
      this.applyImagePosition(currentPosition);
    }

    if (!existingTopImage) {
      existingTopImage = document.createElement('img');
      existingTopImage.classList.add('top-image');
    }
    contentWrapper.insertBefore(existingTopImage, wheelPopupContent || contentWrapper.firstChild);

    existingTopImage.onload = () => {
      this.applyTopImageSize(sizePercent || this.getEffectiveImageSize());
    };
    existingTopImage.src = imageUrl;

    const mergedThemeStyle = this.mergeDecorativeImageStyleDefaults(this.getImageData().style || '');
    this.setImageData({ style: mergedThemeStyle });
    const parsedImageStyles = this.parseStyleString(mergedThemeStyle);
    const imageStyles = {};
    for (const [key, value] of Object.entries(parsedImageStyles)) {
      if (key.toLowerCase() !== 'height') imageStyles[key] = value;
    }
    this.applyStylesToElement(existingTopImage, imageStyles, true);

    const heightValue = parsedImageStyles.height;
    if (heightValue?.includes('%')) {
      const heightPercent = this.extractHeightPercent(mergedThemeStyle);
      if (heightPercent !== null) this.applyTopImageSize(heightPercent);
    } else if (!heightValue) {
      this.applyTopImageSize(sizePercent);
    }

    this.setImageData({ path: imageUrl });
    wheelPopup.classList.add('has-top-image');
    this.gameManager.removeGameSvg();
  }

  removeTopImage() {
    if (this.isUnifiedShell()) {
      const { wrapper } = this.getLightImageNodes();
      if (wrapper?.parentNode) {
        try {
          wrapper.parentNode.removeChild(wrapper);
        } catch (e) { /* noop */ }
      }
    } else {
      const existingTopImage = document.querySelector('.top-image');
      if (existingTopImage?.parentNode) existingTopImage.parentNode.removeChild(existingTopImage);
    }

    const wheelluckRoot = document.querySelector('#wheelluckContainer');
    if (wheelluckRoot) {
      wheelluckRoot.classList.remove('has-top-image');
      wheelluckRoot.style.removeProperty('--top-image-height');
    }
    this.setImageData({ path: '', style: '' });
    if (this.isUnifiedShell()) {
      this.applyLightDesktopImageHostsFromTheme();
    }
    this.imageGallery?.querySelectorAll('.image-item').forEach((item) => item.classList.remove('selectedTopImage'));
    this.resetLightSplitLayoutAfterTopImageRemoved();
  }

  clearTopImageDOM() {
    if (this.isUnifiedShell()) {
      const { wrapper } = this.getLightImageNodes();
      if (wrapper?.parentNode) {
        try {
          wrapper.parentNode.removeChild(wrapper);
        } catch (e) { /* noop */ }
      }
      const wheelluckRoot = document.querySelector('#wheelluckContainer');
      if (wheelluckRoot) {
        wheelluckRoot.classList.remove('has-top-image');
        wheelluckRoot.style.removeProperty('--top-image-height');
      }
      if (!this.theme) return;
      this.themeManager?.patchDecorativeImage?.({ path: '', style: '' });
      this.applyLightDesktopImageHostsFromTheme();
      return;
    }

    const existingTopImage = document.querySelector('.top-image');
    const topImageContainer = document.querySelector('.image-container');

    if (topImageContainer?.parentNode) {
      try {
        topImageContainer.parentNode.removeChild(topImageContainer);
      } catch (e) {}
    }
    if (existingTopImage?.parentNode && existingTopImage.parentNode !== topImageContainer) {
      try {
        existingTopImage.parentNode.removeChild(existingTopImage);
      } catch (e) {}
    }

    const wheelluckRoot = document.querySelector('#wheelluckContainer');
    if (wheelluckRoot) {
      wheelluckRoot.classList.remove('has-top-image');
      wheelluckRoot.style.removeProperty('--top-image-height');
    }

    if (!this.theme) return;
    this.themeManager?.patchDecorativeImage?.({ path: '', style: '' });
  }

  resetTopImage() {
    this.imageGallery?.querySelectorAll('.image-item').forEach((item) => item.classList.remove('selectedTopImage'));

    const priorDecorativePath = String(
      this.isUnifiedShell()
        ? (this.theme?.image?.path ?? this.theme?.top_image?.path ?? '')
        : (this.theme?.top_image?.path ?? this.theme?.image?.path ?? '')
    ).trim();

    const resetData = this.themeManager.getResetSource() || null;
    const template = this.getCurrentTemplate();

    let sourceImage = null;
    if (resetData) {
      sourceImage = this.isUnifiedShell()
        ? (resetData.image || resetData.top_image)
        : (resetData.top_image || resetData.image);
    }
    if (!sourceImage?.path && template) {
      sourceImage = this.isUnifiedShell()
        ? (template.image || template.top_image)
        : (template.top_image || template.image);
    }

    const path = sourceImage?.path || '';
    const style = sourceImage?.style || '';
    const position = String(
      resetData?.layout?.position || template?.layout?.position || sourceImage?.position || ''
    )
      .trim()
      .toLowerCase();
    this.setImageData({ path, style });
    if (this.isUnifiedShell() && (position === 'left' || position === 'right' || position === 'top')) {
      this.setImageData({ position });
    } else if (!this.isUnifiedShell() && (position === 'left' || position === 'right' || position === 'top')) {
      Object.assign(this.getImageData(), { position });
    }
    this.themeManager.resetTopImage = !path;

    const radios = document.querySelectorAll('input[name="top_image_position"]');
    const radio = Array.from(radios).find(r => r.value === position);
    if (radio) radio.checked = true;

    if (path) {
      this.applyTopImage(path, this.extractHeightPercent(style) || this.topImageDefaultHeight);
    } else {
      if (this._singleRowLayoutActive) {
        this.clearLightSingleRowLayout();
      }
      if (this.isUnifiedShell()) {
        const { wrapper } = this.getLightImageNodes();
        if (wrapper?.parentNode) {
          try {
            wrapper.parentNode.removeChild(wrapper);
          } catch (e) { /* noop */ }
        }
      } else {
        const existingTopImage = document.querySelector('.top-image');
        if (existingTopImage?.parentNode) existingTopImage.parentNode.removeChild(existingTopImage);
      }
      this.applyLightDesktopImageHostsFromTheme();
      if (this.topImageHeightInput) this.topImageHeightInput.value = this.topImageDefaultHeight;
      if (this.topImageSizeValue) this.topImageSizeValue.innerText = `${this.topImageDefaultHeight}%`;
      const wheelPopup = document.querySelector('#wheelluckContainer');
      wheelPopup.classList.remove('has-top-image');
      wheelPopup.style.removeProperty('--top-image-height');
      this.resetLightSplitLayoutAfterTopImageRemoved();
      const templateOriginalHasGame = template?.hasGame !== false;
      if (
        this.isUnifiedShell() &&
        priorDecorativePath &&
        templateOriginalHasGame &&
        this.gameManager &&
        typeof this.gameManager.restoreUnifiedLightGameAfterTopImageCleared === 'function'
      ) {
        this.gameManager.restoreUnifiedLightGameAfterTopImageCleared();
      }
    }
  }

  setInitialBackground() {
    if (this.isUnifiedShell()) {
      return;
    }
    if (this.theme.background_image?.path || this.theme.background_image?.style) {
      const popupMain = document.getElementById('wheelluckContainer');
      const template = this.getCurrentTemplate();

      document.querySelector('.split-background-image')?.remove();

      applyPopupBackgroundImage(popupMain, this.theme.background_image);

      if (template?.layout?.type === 'split' && this.theme.background_image?.style) {
        const desktopStyle = this.theme?.desktop_style || template?.desktop_style;
        const contentWrapper = document.querySelector('.contentWrapper');
        if (contentWrapper && desktopStyle?.content_wrapper?.style) {
          applyStyleString(contentWrapper, desktopStyle.content_wrapper.style);
        }

        const wheelPopupContent = document.querySelector('#wheelluckContent');
        if (wheelPopupContent && desktopStyle?.content?.style) {
          applyStyleString(wheelPopupContent, desktopStyle.content.style);
        }
      }
      
      this.imageGallery?.querySelectorAll('.image-item').forEach((item) => {
        if (item.querySelector('img')?.src === this.theme.background_image.path) {
          item.classList.add('selectedWheelBG');
        }
      });
    }
  }
  
  getCurrentTemplate() {
    const activeTheme = this.themeManager?.theme || this.theme;
    const templateId = activeTheme?.template;
    if (!templateId) return null;
    return getTemplateById(templateId) || null;
  }

  setInitialTopImage() {
    if (!this.isUnifiedShell() || this._isTemplateChanging) return;

    if (this._initialTopImageTimeout) {
      clearTimeout(this._initialTopImageTimeout);
      this._initialTopImageTimeout = null;
    }

    let savedTheme = null;
    const themeInput = document.querySelector('input[name="theme"]');
    if (themeInput?.value) {
      try { savedTheme = JSON.parse(themeInput.value); } catch { /* noop */ }
    }

    const savedImg = savedTheme?.image;
    const savedTop = savedTheme?.top_image;
    const windowImg = window.theme?.image;
    const windowTop = window.theme?.top_image;
    const currentImageData = this.getImageData();

    const pathFrom = (a, b, c) =>
      String(a?.path || b?.path || c?.path || '').trim() || '';
    const stylePreferHeight = (a, b) => {
      const sa = a?.style;
      const sb = b?.style;
      if (this.extractHeightPercent(sa)) return String(sa ?? '');
      if (this.extractHeightPercent(sb)) return String(sb ?? '');
      return String(sa ?? sb ?? '');
    };

    const imageData = {
      path:
        pathFrom(savedImg, savedTop, null) ||
        pathFrom(windowImg, windowTop, null) ||
        String(currentImageData?.path || '').trim() ||
        '',
      style:
        stylePreferHeight(savedImg, savedTop) ||
        stylePreferHeight(windowImg, windowTop) ||
        String(currentImageData?.style || ''),
    };
    this.setImageData(imageData);

    if (!imageData.path) return;

    const size = this.getEffectiveImageSize();
    if (this.topImageHeightInput) this.topImageHeightInput.value = size;
    if (this.topImageSizeValue) this.topImageSizeValue.innerText = `${size}%`;

    const currentPath = imageData.path;
    const normalizedCurrentPath = currentPath.startsWith('/') ? currentPath : '/' + currentPath;
    if (!this.imageGallery) return;
    this.imageGallery.querySelectorAll('.image-item').forEach((item) => {
      const img = item.querySelector('img');
      if (!img) return;
      const imgPath = img.src.replace(window.location.origin, '');
      const normalizedImgPath = imgPath.startsWith('/') ? imgPath : '/' + imgPath;
      if (normalizedImgPath === normalizedCurrentPath || img.src.endsWith(currentPath)) {
        item.classList.add('selectedTopImage');
      }
    });

    this._initialTopImageTimeout = setTimeout(() => {
      if (this._isTemplateChanging) return;
      this.applyTopImage(this.getImageData().path || '', size);
      this._initialTopImageTimeout = null;
    }, 100);
  }
  
  cancelInitialTopImage() {
    if (this._initialTopImageTimeout) {
      clearTimeout(this._initialTopImageTimeout);
      this._initialTopImageTimeout = null;
    }
    this._isTemplateChanging = true;
  }
  
  resetTemplateChangingFlag() {
    this._isTemplateChanging = false;
  }

  setupEventListeners() {
    if (this.uploadPlaceholder) {
      this.uploadPlaceholder.addEventListener('click', () => {
        if (this.getUserGalleryImageItemCount() < this.maxUserGalleryImages) {
          this.imageInput.click();
        }
      });
    }

    this.imageInput.addEventListener('change', () => this.uploadImage());
    if (this.imageGallery) {
      this.imageGallery.addEventListener('click', (event) => this.handleImageClick(event));
    }
    this.gameManager.setupGameEventListeners();

    if (this.topImageHeightInput) {
      this.topImageHeightInput.addEventListener('input', (e) => {
        if (this._updatingTopImageSize) return;
        const size = parseInt(e.target.value, 10);
        if (!isNaN(size)) this.applyTopImageSize(size);
      });
    }

    this.topImagePositionRadios.forEach(radio => {
      radio.addEventListener('change', (e) => this.applyImagePosition(e.target.value));
    });

    if (this.resetTopImageBtn) {
      this.resetTopImageBtn.addEventListener('click', () => this.resetTopImage());
    }
    this.setupPreviewImageAccordionClick();
    this.setupResizeListener();

    if (this.popupBackgroundUploadPlaceholder && this.popupBackgroundInput && this.uploadPopupBackgroundForm) {
      this.popupBackgroundUploadPlaceholder.addEventListener('click', () => {
        if (this.getUserPopupBgGalleryImageItemCount() < this.maxPopupBgUserGalleryImages) {
          this.popupBackgroundInput.click();
        }
      });
      this.popupBackgroundInput.addEventListener('change', () => this.uploadPopupBackgroundImage());
    }
    if (this.popupBackgroundGallery) {
      this.popupBackgroundGallery.addEventListener('click', (event) =>
        this.handlePopupBackgroundGalleryClick(event)
      );
    }
    this.checkPopupBackgroundImageCount();
  }

  openImageAccordion() {
    const accordionButton = document.querySelector('.accordion-button[aria-controls="collapseImage"]');
    const accordionContent = document.getElementById('collapseImage');
    if (!accordionButton || !accordionContent) return;
    if (typeof bootstrap === 'undefined' || !bootstrap?.Collapse) return;
    const collapseInstance = bootstrap.Collapse.getOrCreateInstance(accordionContent, {
      toggle: false,
    });
    collapseInstance.show();
    setTimeout(() => {
      accordionButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  setupPreviewImageAccordionClick() {
    if (this._previewImageAccordionBound) return;
    this._previewImageAccordionBound = true;
    document.body.addEventListener('click', (e) => {
      if (!this.isUnifiedShell()) return;
      const root = document.getElementById('wheelluckContainer');
      if (!root || !root.contains(e.target)) return;
      const host = e.target.closest('.image-container');
      if (!host || !root.contains(host)) return;
      e.preventDefault();
      e.stopPropagation();
      this.openImageAccordion();
    });
  }

  setupResizeListener() {
    // Önceki observer'ı temizle
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    const wheelPopupMain = document.querySelector('#wheelluckContainer');
    if (!wheelPopupMain) {
      // Eğer henüz DOM'da yoksa, biraz bekleyip tekrar dene
      setTimeout(() => this.setupResizeListener(), 500);
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.isUnifiedShell() || this.isLightSplitLayout() || this._applyingSizeGuard) return;
      const imageData = this.getImageData();
      const sp = this.extractHeightPercent(imageData?.style) || this.topImageDefaultHeight;
      this.applyTopImageSize(sp);
    });

    this.resizeObserver.observe(wheelPopupMain);
  }

  uploadImage() {
    const promotion_id = getPromotionId();

    const formData = new FormData(this.uploadImageForm);
    const url = `/promotion/${promotion_id}/upload_image`;

    fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
      }
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          this.addImageToGallery(data.image_url, data.image_id);
        } else {
          this.displayErrorMessage(data.error || 'Please upload a valid image format.');
        }
      })
      .catch(error => {
        this.displayErrorMessage('Please upload a valid image format.');
      });
  }

  addImageToGallery(imageUrl, imageId) {
    if (!this.imageGallery || !this.uploadPlaceholder) return;
    const newImage = document.createElement('div');
    newImage.classList.add('image-item');
    newImage.setAttribute('data-id', imageId);
    newImage.innerHTML = `
          <img src="${imageUrl}" alt="Promotion Image">
          <button type="button" class="delete-image" data-id="${imageId}">
              <i class="bi bi-trash"></i>
          </button>
      `;
    this.imageGallery.insertBefore(newImage, this.uploadPlaceholder);
    this.checkImageCount();
    document.getElementById('errorMessage').style.display = 'none';
  }

  handleImageClick(event) {
    const imageItem = event.target.closest('.image-item');
    if (!imageItem || !this.imageGallery?.contains(imageItem)) return;
    if (imageItem.classList.contains('upload-placeholder')) return;

    if (event.target.closest('.delete-image')) {
      this.deleteImage(imageItem);
    } else {
      this.selectImage(imageItem);
    }
  }

  deleteImage(imageItem) {
    if (
      imageItem.classList.contains('theme-template-image') ||
      imageItem.getAttribute('data-theme-template') === 'true'
    ) {
      return;
    }
    if (!this.imageGallery?.contains(imageItem)) return;
    const promotion_id = getPromotionId();
    const imageId = imageItem.getAttribute('data-id');

    fetch(`/promotion/${promotion_id}/delete_image/${imageId}`, {
      method: 'DELETE',
      headers: {
        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
      }
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          this.imageGallery.removeChild(imageItem);
          this.checkImageCount();
        }
      })
      .catch(() => {});
  }

  selectImage(imageItem) {
    const img = imageItem.querySelector('img');
    if (!img) return;
    const imageUrl = img.src;

    if (this.isUnifiedShell()) {
      this.imageGallery?.querySelectorAll('.image-item').forEach((item) => item.classList.remove('selectedTopImage'));
      imageItem.classList.add('selectedTopImage');
      this.themeManager.resetTopImage = false;
      this.applyTopImage(
        imageUrl,
        parseInt(this.topImageHeightInput?.value ?? '', 10) || this.topImageDefaultHeight
      );
    } else {
      this.imageGallery?.querySelectorAll('.image-item').forEach((item) => item.classList.remove('selectedWheelBG'));
      imageItem.classList.add('selectedWheelBG');
      this.theme.background_image.path = imageUrl;
      this.resetBackground = false;
      this.themeManager.resetBackground = false;
      preserveBackgroundColor(document.getElementById('wheelluckContainer'), `url(${imageUrl})`);
    }
  }

  uploadPopupBackgroundImage() {
    if (!this.uploadPopupBackgroundForm || !this.popupBackgroundInput?.files?.length) return;
    const promotion_id = getPromotionId();
    const formData = new FormData(this.uploadPopupBackgroundForm);
    formData.set('usage', 'popup_bg');
    const url = `/promotion/${promotion_id}/upload_image`;

    fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          this.addPopupBackgroundImageToGallery(data.image_url, data.image_id);
          this.popupBackgroundInput.value = '';
        } else {
          this.displayPopupBackgroundError(data.error || 'Please upload a valid image format.');
        }
      })
      .catch(() => {
        this.displayPopupBackgroundError('Please upload a valid image format.');
      });
  }

  addPopupBackgroundImageToGallery(imageUrl, imageId) {
    if (!this.popupBackgroundGallery || !this.popupBackgroundUploadPlaceholder) return;
    const newImage = document.createElement('div');
    newImage.classList.add('image-item');
    newImage.setAttribute('data-id', imageId);
    newImage.innerHTML = `
          <img src="${imageUrl}" alt="Popup background" loading="lazy" decoding="async">
          <button type="button" class="delete-image" data-id="${imageId}">
              <i class="bi bi-trash"></i>
          </button>
      `;
    this.popupBackgroundGallery.insertBefore(newImage, this.popupBackgroundUploadPlaceholder);
    this.checkPopupBackgroundImageCount();
    const err = document.getElementById('popupBackgroundImageError');
    if (err) err.style.display = 'none';
    this.selectPopupBackgroundImage(newImage);
  }

  displayPopupBackgroundError(message) {
    const el = document.getElementById('popupBackgroundImageError');
    if (!el) return;
    el.innerText = message;
    el.style.display = 'block';
  }

  handlePopupBackgroundGalleryClick(event) {
    const imageItem = event.target.closest('.image-item');
    if (!imageItem || !this.popupBackgroundGallery?.contains(imageItem)) return;
    if (imageItem.classList.contains('upload-placeholder')) return;

    if (event.target.closest('.delete-image')) {
      this.deletePopupBackgroundImage(imageItem);
    } else {
      this.selectPopupBackgroundImage(imageItem);
    }
  }

  selectPopupBackgroundImage(imageItem) {
    if (!this.isUnifiedShell() || !this.popupBackgroundGallery) return;
    const img = imageItem.querySelector('img');
    if (!img) return;
    const imageUrl = img.src;
    const tpl = this.getCurrentTemplate();

    this.popupBackgroundGallery.querySelectorAll('.image-item').forEach((el) => {
      el.classList.remove('selectedPopupBackground');
    });
    imageItem.classList.add('selectedPopupBackground');

    if (!this.theme.background_image) this.theme.background_image = { path: '', style: '' };
    this.theme.background_image.path = imageUrl;
    this.theme.background_image.style =
      tpl?.background_image?.style || this.theme.background_image.style || '';

    if (this.themeManager?.theme && this.themeManager.theme !== this.theme) {
      if (!this.themeManager.theme.background_image) {
        this.themeManager.theme.background_image = { path: '', style: '' };
      }
      this.themeManager.theme.background_image.path = this.theme.background_image.path;
      this.themeManager.theme.background_image.style = this.theme.background_image.style;
    }

    this.themeManager.resetBackground = false;
    const popup = document.getElementById('wheelluckContainer');
    if (popup) applyPopupBackgroundImage(popup, this.theme.background_image);
  }

  deletePopupBackgroundImage(imageItem) {
    if (
      imageItem.classList.contains('theme-template-popup-bg') ||
      imageItem.getAttribute('data-theme-template') === 'true'
    ) {
      return;
    }
    if (!this.popupBackgroundGallery) return;
    const promotion_id = getPromotionId();
    const imageId = imageItem.getAttribute('data-id');

    fetch(`/promotion/${promotion_id}/delete_image/${imageId}`, {
      method: 'DELETE',
      headers: {
        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const wasSelected = imageItem.classList.contains('selectedPopupBackground');
          this.popupBackgroundGallery.removeChild(imageItem);
          this.checkPopupBackgroundImageCount();
          if (wasSelected && this.isUnifiedShell()) {
            const def = this.popupBackgroundGallery.querySelector('.theme-template-popup-bg');
            if (def) {
              this.selectPopupBackgroundImage(def);
            } else {
              if (!this.theme.background_image) this.theme.background_image = { path: '', style: '' };
              this.theme.background_image.path = '';
              const tpl = this.getCurrentTemplate();
              this.theme.background_image.style = tpl?.background_image?.style || '';
              if (this.themeManager?.theme && this.themeManager.theme !== this.theme) {
                if (!this.themeManager.theme.background_image) {
                  this.themeManager.theme.background_image = { path: '', style: '' };
                }
                this.themeManager.theme.background_image.path = '';
                this.themeManager.theme.background_image.style = this.theme.background_image.style;
              }
              const popup = document.getElementById('wheelluckContainer');
              const merged = mergeBackgroundImage(this.theme, tpl);
              if (popup && merged) applyPopupBackgroundImage(popup, merged);
              else if (popup) {
                applyPopupBackgroundImage(popup, {
                  path: '',
                  style: this.theme.background_image?.style || '',
                });
              }
              this.setInitialPopupBackgroundSelection();
            }
          }
        }
      })
      .catch(() => {});
  }

  displayErrorMessage(message) {
    document.getElementById('errorMessage').innerText = message;
    document.getElementById('errorMessage').style.display = 'block';
  }

}




