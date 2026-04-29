import { templates, default_text } from "./templates.js";
import { TEMPLATE_SVG_KEYS } from './managers/template-manager.js';
import { containerStyleValue } from './utils/dom-utils.js';
import { getGameRecordById } from './utils/game-svgs.js';

export default class TemplateSelector {
  constructor() {
    this.grid = null;
    this.categoriesList = null;
    this.platformTypeSelect = null;
    this.searchInput = null;
    this.popupTypeFilter = null;
    this.emptyStateEl = null;
    this.promotionName = '';
    this.promotionWebsite = '';

    this.templates = [...(templates || [])];

    this.templatePayloadCache = new Map();
    this.svgSourceCache = new Map();
    this.svgPreviewCache = new Map();

    this.popupTemplateNames = new Set();
  }

  // --- Caching ---

  getSerializedTemplatePayload(cacheKey, data) {
    if (!cacheKey) return '';
    if (!this.templatePayloadCache.has(cacheKey)) {
      this.templatePayloadCache.set(cacheKey, encodeURIComponent(JSON.stringify(data || {})));
    }
    return this.templatePayloadCache.get(cacheKey);
  }

  cacheSvgSource(key, svg) {
    if (key && svg && !this.svgSourceCache.has(key)) {
      this.svgSourceCache.set(key, svg);
    }
  }

  applyGameColorsToSvgMarkup(svgMarkup, gameColors) {
    const svg = String(svgMarkup || '');
    if (!svg || !gameColors || typeof gameColors !== 'object') return svg;

    const colorVars = Object.entries(gameColors)
      .filter(([k, v]) => k && v != null && String(v).trim() !== '')
      .map(([k, v]) => `${k}: ${String(v).trim()};`)
      .join(' ');
    if (!colorVars) return svg;

    return svg.replace(/<svg\b([^>]*)>/i, (match, attrs = '') => {
      const styleMatch = attrs.match(/\sstyle\s*=\s*(['"])([\s\S]*?)\1/i);
      if (styleMatch) {
        const quote = styleMatch[1];
        const existing = styleMatch[2].trim();
        const merged = `${existing}${existing.endsWith(';') ? ' ' : '; '}${colorVars}`.trim();
        return `<svg${attrs.replace(styleMatch[0], ` style=${quote}${merged}${quote}`)}>`;
      }
      return `<svg${attrs} style="${colorVars}">`;
    });
  }

  getSvgPreviewData(key) {
    if (!key) return '';
    if (!this.svgPreviewCache.has(key)) {
      const svg = this.svgSourceCache.get(key);
      if (!svg) {
        this.svgPreviewCache.set(key, '');
      } else {
        try {
          this.svgPreviewCache.set(key, encodeURIComponent(svg));
        } catch (e) {
          console.error('Failed to encode SVG preview', e);
          this.svgPreviewCache.set(key, '');
        }
      }
    }
    return this.svgPreviewCache.get(key);
  }

  // --- Template classification ---

  getPopupType() {
    return 'gaming';
  }

  getGameInfo(t) {
    const rec = getGameRecordById(t.gameID);
    if (!rec) {
      const fallback = getGameRecordById(1);
      return { gameType: 'wheel', gameId: 1, svg: fallback?.game || '', category: 'wheel' };
    }
    return { gameType: rec.name, gameId: rec.id, svg: rec.game, category: rec.name };
  }

  // --- Template payload (sent to backend on selection) ---

  buildTemplatePayload(t) {
    const payload = { template: t.id, template_id: t.id };

    const fields = [
      'popup_type', 'containerStyle', 'layout', 'background_image', 'image',
      'top_image', 'bottom_image', 'texts', 'text_styles', 'close_button',
      'game_styles', 'content_styles', 'image_styles',
      'input_fields', 'input_fields_style', 'mobile_style',
    ];
    fields.forEach(key => { if (t[key] != null) payload[key] = t[key]; });


    const popupType = this.getPopupType(t);
    if (popupType === 'gaming') {
      const { gameId, category } = this.getGameInfo(t);
      const gameRecord = getGameRecordById(gameId);
      if (!gameRecord) {
        throw new Error(`Game record not found for template ${t?.id ?? t?.name ?? 'unknown'} and gameID ${gameId}`);
      }
      payload.gameColors = t.gameColors || gameRecord.gameColors || null;
      payload.gameID = gameId;
      payload.gameType = category;
      if (Array.isArray(gameRecord.gameRewards) && gameRecord.gameRewards.length) {
        payload.rewards = gameRecord.gameRewards.map((gr) => {
          const text = String(gr?.text ?? '').trim();
          const code = String(gr?.couponCode ?? gr?.code ?? '').trim();
          return {
            label: text,
            text: text,
            code,
            couponCode: code,
            weight: gr?.weight ?? 0,
            hasReward: gr?.hasReward !== undefined ? !!gr.hasReward : code.length > 0,
            sliceText: String(gr?.sliceText ?? '').trim(),
          };
        });
      }
    }

    payload.popup_type = 'gaming';
    return payload;
  }

  // --- CSRF ---

  getCsrfToken() {
    const input = document.querySelector('input[name=csrfmiddlewaretoken]');
    if (input) return input.value;
    const cookie = document.cookie.split(';').find(c => c.trim().startsWith('csrftoken='));
    if (cookie) return cookie.split('=')[1];
    return document.querySelector('meta[name=csrf-token]')?.getAttribute('content') || '';
  }

  // --- Card preview builders ---

  buildTextPreview(t, textColor, showCloseLink) {
    const headline = t.texts?.headline || default_text?.headline || '';
    const description = t.texts?.description || default_text?.description || '';
    const disclaimer = t.texts?.disclaimer || default_text?.disclaimer || '';
    const submitBtn = (t.input_fields || []).find(
      (f) =>
        f &&
        (f.type === 'submit_button' || f.type === 'button') &&
        f.action === 'submit_form'
    );
    const button = submitBtn?.text || '';
    const closeBtn = (t.input_fields || []).find(
      (f) =>
        f &&
        (f.type === 'submit_button' || f.type === 'button') &&
        f.action === 'close_form'
    );
    const close = closeBtn?.text || '';

    const tc = textColor ? `color:${textColor};` : '';
    return `
      <div class="p-2 d-flex flex-column justify-content-center text-center" style="gap:.3rem; position:relative; z-index:2; user-select:none; pointer-events:none;">
        <div style="font-size:clamp(.68rem, 1.4vw, .9rem); line-height:1.2; ${tc} font-weight:700; z-index:2;">${headline}</div>
        <div style="font-size:clamp(.46rem, .8vw, .58rem); line-height:1.35; ${tc}">${description}</div>
        <div style="font-size:clamp(.42rem, .72vw, .54rem); line-height:1.3; ${tc}">${disclaimer}</div>
        <div style="width:90%; max-width:560px; margin-left:auto; margin-right:auto; margin-top:0.25rem;">
          <input class="form-control form-control-sm mini-ph" placeholder="Your email address" readonly tabindex="-1" style="margin-bottom:0.5rem; background:rgba(255,255,255,.95); border:1px solid rgba(0,0,0,.08); height:22px; padding:.2rem .4rem; font-size:clamp(.48rem,.7vw,.58rem); pointer-events:none; user-select:none;">
          <div class="btn btn-sm w-100" style="background:#ff8e93; color:#101010; font-weight:700; border-radius:.3rem; border:1px solid rgba(255,255,255,.6); padding:.18rem 0; font-size:clamp(.52rem,.8vw,.62rem); pointer-events:none; user-select:none;">${button}</div>
          ${showCloseLink ? `<div class="text-end" style="font-size:clamp(.44rem,.7vw,.56rem); ${tc} opacity:0.85; margin-top:.25rem; pointer-events:none; user-select:none;">${close} <span style="margin-left:.25rem;">&times;</span></div>` : ''}
        </div>
      </div>`;
  }

  getCardBgStyle(t, isLight, thumbnail, bgColor) {
    if (isLight) return thumbnail || !bgColor ? '' : `background:${bgColor};`;
    const bg = t.background_image?.path;
    return bg
      ? `background-image:url('${bg}'); background-size:cover; background-position:center;`
      : bgColor
        ? `background:${bgColor};`
        : '';
  }

  buildLightPopupMedia(t, thumbnail, bgColor, textColor) {
    if (thumbnail) {
      const bg = bgColor ? `background:${bgColor};` : '';
      return `<img src="${thumbnail}" alt="" class="w-100 h-100" style="object-fit:contain; width:100%; height:100%; position:absolute; top:0; left:0; z-index:0; pointer-events:none; ${bg}">`;
    }
    return `
      <div class="tpl-row align-items-center h-100 px-2">
        <div class="tpl-text flex-grow-1" style="max-width:100%;">
          ${this.buildTextPreview(t, textColor, false)}
        </div>
      </div>`;
  }

  buildGamingMedia(t, device, textColor, svg) {
    const topImg = t.top_image?.path || '';
    const bottomImg = t.bottom_image?.path || '';
    const hasGame = !!svg;

    return `
      ${topImg ? `<img src="${topImg}" alt="" class="position-absolute top-0 start-50 translate-middle-x img-fluid" style="max-height:14%; object-fit:contain; z-index:1; pointer-events:none;">` : ''}
      <div class="tpl-row align-items-center h-100 px-2">
        ${hasGame ? `
          <div class="tpl-wheel flex-shrink-0 me-3" style="width:${device === 'desktop' ? '38%' : '100%'}; max-width:${device === 'desktop' ? '380px' : 'min(100%, 280px)'}; z-index:1;">
            <div class="template-svg-container"></div>
          </div>
        ` : ''}
        <div class="tpl-text flex-grow-1" style="max-width:${hasGame ? (device === 'desktop' ? '52%' : '100%') : '100%'}; min-width:0; ${hasGame ? (device === 'desktop' ? 'margin-left:auto;' : 'margin-left:0;') : ''}">
          ${this.buildTextPreview(t, textColor, true)}
        </div>
      </div>
      ${bottomImg ? `<img src="${bottomImg}" alt="" class="position-absolute bottom-0 start-50 translate-middle-x img-fluid" style="max-height:14%; object-fit:contain; z-index:1; pointer-events:none;">` : ''}`;
  }

  // --- Card rendering ---

  async renderCards(device) {
    if (!this.grid) return;
    this.grid.innerHTML = '';

    const csrfToken = this.getCsrfToken();
    const batchSize = 10;

    const readCssVar = (str, name) => {
      const m = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(str || '');
      return m?.[1]?.trim() || '';
    };

    for (let i = 0; i < this.templates.length; i += batchSize) {
      const fragment = document.createDocumentFragment();
      const batch = this.templates.slice(i, i + batchSize);

      batch.forEach((t, batchIdx) => {
        const idx = i + batchIdx;
        const title = t.name?.trim() || `Template ${idx + 1}`;
        const displayTitle = title.charAt(0).toUpperCase() + title.slice(1);
        const id = t.id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const popupType = this.getPopupType(t);
        let svg = '';
        let category = '';
        ({ svg, category } = this.getGameInfo(t));

        const payload = this.buildTemplatePayload(t);
        const serialized = this.getSerializedTemplatePayload(id, payload);

        const baseBgColor =
          containerStyleValue(t.containerStyle, 'background') || '';
        const textColor =
          t.text_styles?.headline?.color ||
          t.text_styles?.description?.color ||
          '';
        const thumbnail = t.thumbnail || '';

        const pinColor1 = t.gameColors?.['--pin-color-1'] || readCssVar(svg, 'pin-color-1');
        const pinColor2 = t.gameColors?.['--pin-color-2'] || readCssVar(svg, 'pin-color-2');
        const svgCacheKey = svg ? `${title}|${category}` : '';

        const cardMediaHeight = `height:${device === 'desktop' ? '210px' : '300px'};`;

        const cardMediaContent = this.buildGamingMedia(t, device, textColor, svg);

        // Column
        const col = document.createElement('div');
        col.className = device === 'mobile' ? 'col-12 col-sm-6 col-lg-3' : 'col-12 col-sm-6 col-lg-4';
        col.setAttribute('data-template-id', id);
        col.setAttribute('data-template-name', displayTitle);
        if (t.categories?.length) col.setAttribute('data-categories', t.categories.join(','));
        col.setAttribute('data-popup-type', popupType);
        col.setAttribute('data-has-game', 'true');

        // Form
        const form = document.createElement('form');
        form.method = 'post';
        form.className = 'h-100';

        form.innerHTML = `
          ${csrfToken ? `<input type="hidden" name="csrfmiddlewaretoken" value="${csrfToken}">` : ''}
          <input type="hidden" name="template_id" value="${id}">
          <input type="hidden" name="template_theme_data" value="${serialized}">
          ${this.promotionName ? `<input type="hidden" name="name" value="${this.promotionName}">` : ''}
          ${this.promotionWebsite ? `<input type="hidden" name="website" value="${this.promotionWebsite}">` : ''}
          <div class="card h-70 template-card">
            <div class="card-media" ${cardMediaHeight ? `style="${cardMediaHeight}"` : ''}>
              <div class="w-100 h-100 overflow-hidden position-relative" style="${this.getCardBgStyle(t, false, thumbnail, baseBgColor)} --pin-color-1:${pinColor1}; --pin-color-2:${pinColor2};">
                ${cardMediaContent}
              </div>
            </div>
            <div class="card-body" style="user-select:none;">
              <div class="fw-semibold mb-3">${displayTitle}</div>
            </div>
          </div>
        `;

        col.appendChild(form);

        const card = form.querySelector('.template-card');
        if (card) {
          card.style.cursor = 'pointer';
          card.style.userSelect = 'none';
          card.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            form.submit();
          });
        }

        // SVG caching for gaming templates
        const svgHolder = form.querySelector('.template-svg-container');
        if (svgHolder && svgCacheKey && svg) {
          svgHolder.dataset.svgKey = svgCacheKey;
          const svgToCache = this.applyGameColorsToSvgMarkup(svg, t.gameColors);
          this.cacheSvgSource(svgCacheKey, svgToCache);
        }

        fragment.appendChild(col);
      });

      this.grid.appendChild(fragment);

      if (i + batchSize < this.templates.length) {
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    }

    requestAnimationFrame(() => this.renderCachedSvgs());
  }

  renderCachedSvgs() {
    if (!this.grid) return;
    this.grid.querySelectorAll('.template-svg-container[data-svg-key]').forEach(holder => {
      const key = holder.dataset.svgKey;
      holder.removeAttribute('data-svg-key');
      const svgRaw = this.svgSourceCache.get(key);
      if (!svgRaw) return;
      holder.innerHTML = svgRaw;

      const inlineSvg = holder.querySelector('svg');
      if (inlineSvg) {
        inlineSvg.style.width = '100%';
        inlineSvg.style.height = 'auto';
        inlineSvg.style.display = 'block';
      }
    });
  }

  // --- Category rendering ---

  renderTemplateCategories() {
    if (!this.categoriesList) return;

    const allBtn = this.categoriesList.querySelector('a[data-category-type="all-templates"]');
    this.categoriesList.innerHTML = '';
    if (allBtn) {
      allBtn.className = 'category-tag active';
      allBtn.innerHTML = 'All';
      this.categoriesList.appendChild(allBtn);
    }

    const activePopupType = this.popupTypeFilter?.value || 'gaming';
    const counts = {};
    (this.templates || []).forEach(t => {
      const popupType = this.getPopupType(t);
      if (activePopupType === 'all' || popupType === activePopupType) {
        (t.categories || []).forEach(cat => {
          counts[cat] = (counts[cat] || 0) + 1;
        });
      }
    });

    Object.keys(counts).sort().forEach(cat => {
      const link = document.createElement('a');
      link.href = '#';
      link.className = 'category-tag';
      link.setAttribute('data-category-type', cat.toLowerCase().replace(/\s+/g, '-'));
      link.setAttribute('data-category', cat);
      link.innerHTML = `${cat} <span class="badge">${counts[cat]}</span>`;
      this.categoriesList.appendChild(link);
    });

    this.categoriesList.querySelectorAll('a[data-category-type]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        this.categoriesList.querySelectorAll('a[data-category-type]').forEach(l => l.classList.remove('active'));
        a.classList.add('active');
        this.applyAllFilters();
      });
    });
  }

  // --- Device management ---

  async setActiveDevice(device) {
    if (this.platformTypeSelect) this.platformTypeSelect.value = device;
    document.body.classList.toggle('force-mobile-templates', device === 'mobile');
    await this.renderCards(device);
    this.applyAllFilters();
  }

  // --- Filtering (single source of truth) ---

  applyAllFilters() {
    if (!this.grid) return;

    const searchTerm = (this.searchInput?.value || '').toLowerCase().trim();
    const popupType = this.popupTypeFilter?.value || 'gaming';

    let activeCategory = null;
    if (this.categoriesList) {
      const activeEl = this.categoriesList.querySelector('a.active');
      if (activeEl) {
        const type = activeEl.getAttribute('data-category-type');
        if (type !== 'all-templates') {
          activeCategory = activeEl.getAttribute('data-category');
        }
      }
    }

    this.grid.querySelectorAll('[data-template-id]').forEach(card => {
      const name = (card.getAttribute('data-template-name') || '').toLowerCase();
      const cats = card.getAttribute('data-categories') || '';
      const cardType = card.getAttribute('data-popup-type') || 'gaming';

      const searchOk = !searchTerm
        || name.includes(searchTerm)
        || cats.toLowerCase().includes(searchTerm);

      const categoryOk = !activeCategory
        || cats.split(',').includes(activeCategory);

      const typeOk = popupType === 'all' || cardType === 'gaming';

      const show = searchOk && categoryOk && typeOk;
      card.classList.toggle('d-none', !show);
      card.style.display = show ? '' : 'none';
    });

    this.updateEmptyState();
  }

  updateEmptyState() {
    if (!this.grid || !this.emptyStateEl) return;
    const visible = Array.from(this.grid.querySelectorAll('[data-template-id]'))
      .filter(c => !c.classList.contains('d-none') && c.style.display !== 'none').length;
    this.emptyStateEl.classList.toggle('is-visible', visible === 0);
  }

  // --- Initialization ---

  async init() {
    const section = document.querySelector('section.section[data-promotion-name]');
    if (!section) return;

    this.promotionName = section.getAttribute('data-promotion-name') || '';
    this.promotionWebsite = section.getAttribute('data-promotion-website') || '';
    this.grid = document.getElementById('templateGrid');
    this.categoriesList = document.getElementById('templateCategoriesList');
    this.platformTypeSelect = document.getElementById('platformTypeSelect');
    this.searchInput = document.getElementById('templateSearchInput');
    this.popupTypeFilter = document.getElementById('popupTypeFilter');
    this.emptyStateEl = document.getElementById('templateEmptyState');

    if (!this.grid || !this.categoriesList) return;

    const currentPopupType = 'gaming';
    if (this.popupTypeFilter) this.popupTypeFilter.value = currentPopupType;

    const initialDevice = window.matchMedia?.('(max-width: 576px)')?.matches ? 'mobile' : 'desktop';
    await this.setActiveDevice(initialDevice);
    this.renderTemplateCategories();
    this.applyAllFilters();

    this.platformTypeSelect?.addEventListener('change', (e) => this.setActiveDevice(e.target.value));

    this.searchInput?.addEventListener('input', () => {
      if (this.searchInput.value.trim() && this.categoriesList) {
        const links = this.categoriesList.querySelectorAll('a[data-category-type]');
        const allBtn = this.categoriesList.querySelector('a[data-category-type="all-templates"]');
        links.forEach(l => l.classList.remove('active'));
        allBtn?.classList.add('active');
      }
      this.applyAllFilters();
    });

    this.popupTypeFilter?.addEventListener('change', () => {
      this.renderTemplateCategories();
      const allBtn = this.categoriesList?.querySelector('a[data-category-type="all-templates"]');
      if (allBtn) {
        this.categoriesList.querySelectorAll('a[data-category-type]').forEach(l => l.classList.remove('active'));
        allBtn.classList.add('active');
      }
      this.applyAllFilters();
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const templateSelector = new TemplateSelector();
  await templateSelector.init();
});

