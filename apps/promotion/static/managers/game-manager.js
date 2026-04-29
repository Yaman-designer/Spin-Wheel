import { DefaultGameSvgs, getGameRecordById } from '../utils/game-svgs.js';
import {
  getGameTypeName,
  getGameSvgString,
  getGameHeightStyle,
  setGameHeightStyle,
  setGameTypeById,
  syncThemeGameIdFromTypeName,
  setGameSvgString,
  clearGameThemeLight,
  hasActiveLightGame,
  mergeGameColorsIntoSvgMarkup,
  reconcilePersistedGameSvgWithGameId,
  getEffectiveGameColors,
  templateDefaultGameToId,
  templateDefaultGameToTypeName,
} from '../utils/game-theme-utils.js';
import { getTemplateById } from '../templates.js';
import {
  applyStyleString,
  applyGameAreaBackgroundFromTheme,
  styleStringWithoutGameAreaBackground,
  mergeStyleStringIntoElement,
  isUnifiedPopupShellTheme,
  ensureWheelluckContentInner,
  containerStyleValue,
} from '../utils/dom-utils.js';
import {
  GAME_TEXT_FONT_OPTIONS,
  getGameSvgTextStyleFromTheme,
  resolveGameTextFontOptionId,
  parseGameSvgTextFontSize,
} from './text-editor-manager.js';
import { MiniGameEngine } from './mini-game-engine.js';
const _isSplitRowLayoutType = (layoutType) => {
  const t = String(layoutType || '').toLowerCase().trim();
  return t === 'split' || t === 'split-reverse';
};

const _resolveLayoutPositionFromType = (layout) =>
  String(layout?.position || '').toLowerCase().trim();

function _normalizeGameLayoutPos(position) {
  const p = String(position || '').toLowerCase().trim();
  return p === 'left' || p === 'right' || p === 'top' ? p : 'top';
}

/**
 * `game_styles.*.game` satırı `.game-svg-container` için uygulanırken `applyStyleString` cssText'i komple değiştirir;
 * oyun alanı rengi `theme.game_styles.gameBackground` + `applyGameAreaBackgroundFromTheme` ile sürmeli (change game / SVG boyut).
 */
function _gameContainerBucketSansAreaBackground(bucketGameString) {
  const g = String(bucketGameString || '').trim();
  if (!g) return '';
  const stripped = styleStringWithoutGameAreaBackground(g);
  return stripped && stripped.trim() ? stripped.trim() : g;
}

/** Tema → şablon → popup; yalnızca `game` ve `game_inner`. */
function _resolveGameBucketField(theme, position, field) {
  const pos = _normalizeGameLayoutPos(position);
  const pick = (gs) => String(gs?.[pos]?.[field] ?? '').trim();
  let v = pick(theme?.game_styles);
  if (v) return v;
  v = pick(getTemplateById(theme?.template)?.game_styles);
  if (v) return v;
  return pick(getTemplateById(theme?.template)?.game_styles);
}

/** Kök SVG stili — yalnızca `game_styles.game_svg`. */
function _resolveGameSvgRoot(theme) {
  const root = String(theme?.game_styles?.game_svg ?? '').trim();
  if (root) return root;
  const tpl = getTemplateById(theme?.template);
  const tr = String(tpl?.game_styles?.game_svg ?? '').trim();
  if (tr) return tr;
  return String(getTemplateById(theme?.template)?.game_styles?.game_svg ?? '').trim();
}

const GAME_SVG_TEXT_VIEWBOX_REF_WIDTH = 954;
const GAME_SVG_TEXT_VIEWBOX_SCALE_THRESHOLD = 1400;
const SILVER_WHEEL_GROUP_SCALE = 3;

function _getGameSvgRootFontScale(svg) {
  if (!svg || typeof svg.viewBox === 'undefined' || !svg.viewBox.baseVal) return 1;
  const w = svg.viewBox.baseVal.width;
  if (!Number.isFinite(w) || w <= 0) return 1;
  if (w < GAME_SVG_TEXT_VIEWBOX_SCALE_THRESHOLD) return 1;
  let scale = w / GAME_SVG_TEXT_VIEWBOX_REF_WIDTH;
  const isSilverWheelLayout =
    Boolean(svg.querySelector('#silver-wheel-texts')) ||
    Boolean(svg.querySelector('#silver-wheel-slices'));
  if (isSilverWheelLayout) {
    scale /= SILVER_WHEEL_GROUP_SCALE;
  }
  return scale;
}

function _scaleGameSvgTextCssForLargeViewBox(styleText, scale) {
  if (!styleText || scale === 1 || !Number.isFinite(scale) || scale <= 0) return styleText;
  const m = /font-size\s*:\s*([^;]+)/i.exec(styleText);
  if (!m) return styleText;
  const raw = String(m[1]).trim();
  const n = parseFloat(raw.replace(/px/i, '').trim());
  if (!Number.isFinite(n) || n <= 0) return styleText;
  const scaled = Math.round(n * scale * 100) / 100;
  return styleText.replace(/font-size\s*:\s*[^;]+/i, `font-size: ${scaled}px`);
}

/** UI-only labels for Game Colors (theme keys remain slice_*, CSS vars unchanged). */
const GAME_COLOR_LABELS = {
  wheel: { row: (n) => `Segment #${n}`, center: 'Center', pin: 'Pointer' },
  silverwheel: { row: (n) => `Segment #${n}`, center: 'Center', pin: 'Pointer' },
  scratchcard: { row: (n) => `Panel #${n}`, center: 'Base', pin: 'Overlay' },
  slot: { row: (n) => `Column #${n}`, center: 'Frame', pin: 'Marker' },
  _empty: { row: (n) => `Area #${n}`, center: 'Center', pin: 'Pointer' },
};

export const REWARD_LABEL_MAX_LENGTH = 14;
/** Sunucu `PromotionForm.clean_theme` ile aynı (smart_reward kapalıyken). */
export const MIN_ACTIVE_REWARDS = 3;

export function truncateRewardLabel(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  return s.length <= REWARD_LABEL_MAX_LENGTH ? s : s.slice(0, REWARD_LABEL_MAX_LENGTH);
}
function _applyRewardToGameSvgTextElement(el, reward) {
  const text = truncateRewardLabel(reward.text ?? reward.label ?? '');
  const tspan = el.querySelector('tspan');
  
  if (tspan) {
    tspan.textContent = text;
  } else {
    el.textContent = text;
  }


  el.setAttribute('data-code', reward.code ?? '');
  el.setAttribute('data-weight', String(reward.weight ?? 0));
  el.setAttribute('data-has-reward', reward.hasReward ? '1' : '0');

  const currentTransform = el.getAttribute('transform');
  if (!currentTransform || currentTransform.includes('NaN') || currentTransform.trim() === "") {
   
    el.setAttribute('transform', 'rotate(0)');
  }
}
/** `searchRoot`: string SVG için geçici kök; `null` = canlı önizleme (önce .game-svg-inner / .game-svg-container). */
function _applyRewardsToWheelTexts(rewards, searchRoot) {
  rewards.forEach((reward) => {
    const sliceClass = reward.sliceText;
    if (!sliceClass) return;
    let el = null;
    if (searchRoot) {
      el = searchRoot.querySelector(`.wheelText.${sliceClass}`);
    } else if (typeof document !== 'undefined') {
      const scope =
        document.querySelector('.game-svg-inner') || document.querySelector('.game-svg-container');
      el = scope ? scope.querySelector(`.wheelText.${sliceClass}`) : null;
      if (!el) {
        el = document.querySelector(`.game-svg-container .wheelText.${sliceClass}`);
      }
    }
    if (el) _applyRewardToGameSvgTextElement(el, reward);
  });
}

/** WEIGHT (%) yalnızca 0–100 tam sayı; boş bırakılamaz (rakam yoksa 0). */
function _sanitizeRewardWeightInputElement(el) {
  if (!el) return;
  const digits = String(el.value ?? '').replace(/\D/g, '');
  if (digits === '') {
    el.value = '0';
    return;
  }
  let n = parseInt(digits, 10);
  if (n > 100) n = 100;
  const next = String(n);
  if (el.value !== next) el.value = next;
}

function _clampParsedRewardWeight(weight) {
  if (Number.isNaN(weight) || weight < 0) return 0;
  if (weight > 100) return 100;
  return weight;
}

function _collectRewardsFromGameRewardsDom() {
  const rows = document.querySelectorAll('#gameRewardsContainer .reward-row');
  const out = [];
  rows.forEach((row, i) => {
    const labelInput = row.querySelector(`input[name="reward_label_${i}"]`);
    const codeInput = row.querySelector(`input[name="reward_code_${i}"]`);
    const weightInput = row.querySelector(`input[name="reward_weight_${i}"]`);
    const hasCheckbox = row.querySelector(`input[name="reward_has_${i}"]`);
    const sliceInput = row.querySelector(`input[name="reward_sliceText_${i}"]`);
    let label = labelInput ? labelInput.value.trim() : '';
    label = truncateRewardLabel(label);
    if (labelInput && labelInput.value !== label) labelInput.value = label;
    const code = codeInput ? codeInput.value.trim() : '';
    let weight = weightInput ? parseInt(weightInput.value, 10) : 0;
    weight = _clampParsedRewardWeight(weight);
    if (weightInput) {
      const raw = String(weightInput.value ?? '').trim();
      if (raw === '' || Number.isNaN(parseInt(weightInput.value, 10))) {
        weightInput.value = String(weight);
      }
    }
    const hasReward = hasCheckbox ? hasCheckbox.checked : false;
    const sliceText = (sliceInput?.value || '').trim();
    out.push({
      label,
      text: label,
      code,
      couponCode: code,
      weight,
      hasReward,
      sliceText,
    });
  });
  return out;
}


export function syncGameSvgWithRewardInputs(gameSvgHtml) {
  if (!gameSvgHtml || typeof gameSvgHtml !== 'string') {
    return gameSvgHtml;
  }

  try {
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = gameSvgHtml;

    const rewardsNew = _collectRewardsFromGameRewardsDom();
    if (rewardsNew.length === 0) {
      return gameSvgHtml;
    }

    _applyRewardsToWheelTexts(rewardsNew, tempContainer);
    
  
    tempContainer.querySelectorAll('[transform]').forEach(el => {
        let attr = el.getAttribute('transform');
        if (attr.includes('NaN')) {
            el.setAttribute('transform', attr.replace(/NaN/g, '0'));
        }
    });

    return tempContainer.innerHTML;
  } catch (e) {
    console.error("Error updating SVG:", e);
    return gameSvgHtml; 
  }
}

export class GameManager {
  constructor(theme = null, themeManager = null) {
    this.theme = theme;
    this.themeManager = themeManager;
    this.currentView = 'wheel';
    this.gameTypeSelect = null;
    this.switchBtn = null;

    this.lightPopupGameSvgHeightInput = null;
    this.lightPopupGameSvgSizeValue = null;
    this.removeGameButton = null;
    this.removeGameButtonWrapper = null;
    this.gameSvgSizeControls = null;
    this.changeGameAccordion = null;
    this.gameSvgDefaultHeight = 30;
    
    this.validGameTypes = ['wheel', 'slot', 'scratchcard', 'silverwheel'];
  }

  init(theme = null) {
    if (theme) {
      this.theme = theme;
    }
    
    this._initializeFromTheme();
    this._syncDefaultGameHeightFromTheme();
    
    if (typeof window !== 'undefined') {
      window.currentView = this.currentView;
    }
    
    this.initDOMElements();
  }

  _initializeFromTheme() {
    if (!this.theme) {
      this.currentView = 'wheel';
      return;
    }

    const typeFromId = getGameTypeName(this.theme);

    if (this._isUnifiedShell() && !typeFromId) {
      this.currentView = '';
      return;
    }

    if (typeFromId && this.validGameTypes.includes(typeFromId)) {
      this.currentView = typeFromId;
      return;
    }

    // Çok eski tema: gameID yok / normalize öncesi — şablon id’sinden tahmin
    this.currentView = 'wheel';
    if (this.theme.template != null && this.theme.template !== '') {
      const tid = String(this.theme.template).toLowerCase();
      if (tid.includes('scratch')) {
        this.currentView = 'scratchcard';
      } else if (tid.includes('slot')) {
        this.currentView = 'slot';
      }
    }

    if (!getGameTypeName(this.theme)) {
      syncThemeGameIdFromTypeName(this.theme, this.currentView);
    }
  }

  getCurrentGameType() {
    if (this._isUnifiedShell() && (!this.theme || !getGameTypeName(this.theme))) {
      return '';
    }

    if (this._isUnifiedShell() && (!this.currentView || this.currentView.trim() === '')) {
      return '';
    }
    
    return this.currentView || 'wheel';
  }

  /** Öncelik: ThemeManager ile paylaşılan tema nesnesi, yoksa `this.theme`. */
  _activeTheme() {
    return this.themeManager?.theme || this.theme;
  }

  /** Aynı state’i `this.theme` ve varsa ayrı `themeManager.theme` kopyasına uygula. */
  _forEachLinkedTheme(fn) {
    const a = this.theme;
    const b = this.themeManager?.theme;
    if (a) fn(a);
    if (b && b !== a) fn(b);
  }

  _syncRewardsToLinkedThemes(rewards) {
    if (this.theme) this.theme.rewards = rewards;
    const b = this.themeManager?.theme;
    if (b && b !== this.theme) b.rewards = JSON.parse(JSON.stringify(rewards));
  }

  /** `this.theme.gameColors` öncelikli (ThemeManager kopyası yedek). */
  _gameColorsFromLinkedThemes() {
    return this.theme?.gameColors || this.themeManager?.theme?.gameColors || null;
  }

  _setGameType(gameType, updateTheme = true, updateDOM = true) {
    const validatedType = this._validateGameType(gameType);
    const previousView = this.currentView;

    if (validatedType === this.currentView) {
      const themeType = getGameTypeName(this.theme);
      const themeEmpty = this._isUnifiedShell() && !themeType;
      if (!themeEmpty) {
        return;
      }
    }

    this.currentView = validatedType;

    if (typeof window !== 'undefined') {
      window.currentView = validatedType;
    }

    if (updateTheme && this.theme) {
      this._forEachLinkedTheme((t) => {
        syncThemeGameIdFromTypeName(t, validatedType);
        if (previousView !== validatedType) {
          setGameSvgString(t, '');
        }
      });
    }

    if (updateTheme && this.theme?.popup_type === 'gaming') {
      this._forEachLinkedTheme((t) => {
        t.hasGame = hasActiveLightGame(t);
      });
    }

    if (updateDOM) {
      this._updateDOMElements();
    }
  }

  _validateGameType(gameType) {
    if (typeof gameType !== 'string') {
      return 'wheel';
    }
    const normalized = gameType.toLowerCase().trim();
    const compact = normalized.replace(/[\s_-]+/g, '');
    // Boş string için boş dön (gaming popup için)
    if (normalized === '') {
      return '';
    }

    if (this.validGameTypes.includes(normalized)) {
      return normalized;
    }
    if (this.validGameTypes.includes(compact)) {
      return compact;
    }
    if (/^\d+$/.test(compact)) {
      const rec = getGameRecordById(Number(compact));
      const name = rec?.name != null ? String(rec.name).toLowerCase().trim() : '';
      if (name && this.validGameTypes.includes(name)) {
        return name;
      }
    }
    if (compact === 'scratch') return 'scratchcard';
    if (compact === 'silverwheel') return 'silverwheel';
    
    console.warn(`Invalid game type: ${gameType}, defaulting to wheel`);
    return 'wheel';
  }

  _updateGameColorLabels() {
    if (typeof document === 'undefined') return;

    let raw = '';
    if (this.gameTypeSelect?.value?.trim?.()) {
      raw = this.gameTypeSelect.value.trim();
    } else if (getGameTypeName(this.theme)) {
      raw = getGameTypeName(this.theme);
    }

    if (!raw) {
      this._applyGameColorLabels(
        this._isUnifiedShell() ? GAME_COLOR_LABELS._empty : GAME_COLOR_LABELS.wheel
      );
      return;
    }

    const validated = this._validateGameType(raw);
    if (!validated) {
      this._applyGameColorLabels(GAME_COLOR_LABELS._empty);
      return;
    }

    const map = GAME_COLOR_LABELS[validated] || GAME_COLOR_LABELS.wheel;
    this._applyGameColorLabels(map);
  }

  _applyGameColorLabels(map) {
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById(`game-color-row-label-${i}`);
      if (el) el.textContent = map.row(i);
    }
    const centerEl = document.getElementById('game-color-label-center');
    const pinEl = document.getElementById('game-color-label-pin');
    if (centerEl) centerEl.textContent = map.center;
    if (pinEl) pinEl.textContent = map.pin;
  }

  _isSmartRewardActive() {
    if (typeof document === 'undefined') {
      return Boolean(this.theme?.options?.smart_reward);
    }
    const el = document.querySelector('input[name="smart_reward"]');
    if (el) return el.checked === true;
    return Boolean(this.theme?.options?.smart_reward);
  }

  /** Weight toplamı=100 uyarısı / kayıt öncesi kontrol yalnızca oyun varken. */
  _shouldValidateRewardWeightsTotal() {
    const t = this.theme;
    if (!t) return false;
    if (t.hasGame === false) return false;
    if (t.hasGame === true) return true;
    if (String(t.popup_type || '').toLowerCase() === 'gaming') return true;
    return Boolean(hasActiveLightGame(t));
  }

  syncSmartRewardRewardsUi() {
    if (typeof document === 'undefined') return;
    const smart = this._isSmartRewardActive();
    const note = document.getElementById('game-rewards-smart-note');
    if (note) {
      note.hidden = !smart;
    }
    const randomBtn = document.getElementById('reward-weights-random-btn');
    if (randomBtn) {
      randomBtn.disabled = smart;
    }
    const container = document.getElementById('gameRewardsContainer');
    if (!container) return;
    const rows = container.querySelectorAll('.reward-row');
    rows.forEach((row, i) => {
      const toggle = row.querySelector(`input[name="reward_has_${i}"]`);
      const isActive = toggle ? toggle.checked : false;
      const weightInput = row.querySelector(`input[name="reward_weight_${i}"]`);
      if (weightInput) {
        weightInput.disabled = !isActive || smart;
        weightInput.tabIndex = !isActive || smart ? -1 : 0;
      }
    });
    this._syncRewardWeightSumUi();
  }

  /**
   * Smart Reward kapalıyken ödül satırları varsa tüm Weight (%) değerlerinin toplamı.
   * @returns {number|null} null = kontrol uygulanmaz (smart, konteyner yok, satır yok).
   */
  getManualRewardWeightsTotal() {
    if (typeof document === 'undefined') return null;
    if (!this._shouldValidateRewardWeightsTotal()) return null;
    if (this._isSmartRewardActive()) return null;
    const container = document.getElementById('gameRewardsContainer');
    if (!container) return null;
    if (container.querySelectorAll('.reward-row').length === 0) return null;
    const rewards = _collectRewardsFromGameRewardsDom();
    return rewards.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  }

  _syncRewardWeightSumUi() {
    const alertEl = document.getElementById('game-rewards-weight-sum-alert');
    if (!alertEl) return;
    if (!this._shouldValidateRewardWeightsTotal()) {
      alertEl.hidden = true;
      alertEl.textContent = '';
      return;
    }

    const total = this.getManualRewardWeightsTotal();
    if (total === null || total === 100) {
      alertEl.hidden = true;
      alertEl.textContent = '';
      return;
    }

    alertEl.hidden = false;
    alertEl.textContent = `Total weight is ${total}%. Adjust the Weight (%) values so they add up to exactly 100%.`;
    /* Do not expand the Rewards accordion here: changeGameType/_renderGameRewards runs this path too; save opens it when invalid. */
  }

  /**
   * Rewards accordion panelini açar (Bootstrap Collapse veya sınıf geri dönüşü).
   */
  _openRewardsAccordion() {
    if (typeof document === 'undefined') return;
    const accordionItem = document.getElementById('rewardsAccordion');
    if (!accordionItem) return;
    if (window.getComputedStyle(accordionItem).display === 'none') return;

    const accordionContent = document.getElementById('collapseRewards');
    if (!accordionContent) return;

    const accordionButton =
      document.querySelector('[data-bs-target="#collapseRewards"]') ||
      document.querySelector('.accordion-button[aria-controls="collapseRewards"]');

    if (typeof bootstrap !== 'undefined' && bootstrap?.Collapse) {
      const collapseInstance = bootstrap.Collapse.getOrCreateInstance(accordionContent, {
        toggle: false,
      });
      collapseInstance.show();
    } else {
      accordionContent.classList.add('show');
    }
    if (accordionButton) {
      accordionButton.classList.remove('collapsed');
      accordionButton.setAttribute('aria-expanded', 'true');
    }
    setTimeout(() => {
      accordionItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  _renderGameRewards(gameRewards) {
    if (typeof document === 'undefined') return;

    const section = document.getElementById('game-rewards-section');
    const container = document.getElementById('gameRewardsContainer');
    if (!section || !container) return;

    container.innerHTML = '';

    if (!gameRewards || !Array.isArray(gameRewards) || gameRewards.length === 0) {
      const accordion = document.getElementById('rewardsAccordion');
      if (accordion) accordion.style.display = 'none';
      return;
    }

    const table = document.createElement('table');
    table.className = 'table table-sm table-borderless align-middle mb-0';

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th class="col-reward-label" scope="col">Label <span class="text-muted fw-normal small">(max ${REWARD_LABEL_MAX_LENGTH})</span></th>
      <th class="col-reward-coupon" scope="col">Coupon Code</th>
      <th class="col-wt" scope="col">Weight (%)</th>
      <th class="col-toggle" scope="col" aria-label="Active"></th>
    </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    const applyRowState = (tr, isActive) => {
      if (isActive) {
        tr.classList.remove('reward-disabled');
        tr.classList.add('reward-active');
      } else {
        tr.classList.remove('reward-active');
        tr.classList.add('reward-disabled');
      }
      const smartReward = this._isSmartRewardActive();
      // Code ve weight input'larını enable/disable
      const codeInput = tr.querySelector('input[name^="reward_code_"]');
      const weightInput = tr.querySelector('input[name^="reward_weight_"]');
      if (codeInput) {
        codeInput.disabled = !isActive;
        codeInput.tabIndex = isActive ? 0 : -1;
      }
      if (weightInput) {
        weightInput.disabled = !isActive || smartReward;
        weightInput.tabIndex = !isActive || smartReward ? -1 : 0;
        _sanitizeRewardWeightInputElement(weightInput);
      }
    };

    gameRewards.forEach((reward, index) => {
      const isActive = !!reward.hasReward;
      const tr = document.createElement('tr');
      tr.className = 'reward-row';

      const sliceKey = String(reward.sliceText || '').trim();
      const sliceHidden = document.createElement('input');
      sliceHidden.type = 'hidden';
      sliceHidden.name = `reward_sliceText_${index}`;
      sliceHidden.value = sliceKey;

      // Label (always shown, even grayed)
      const tdLabel = document.createElement('td');
      tdLabel.className = 'col-reward-label';
      tdLabel.appendChild(sliceHidden);
      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'form-control';
      labelInput.value = truncateRewardLabel(reward.text || reward.label || '');
      labelInput.placeholder = 'Label';
      labelInput.name = `reward_label_${index}`;
      labelInput.maxLength = REWARD_LABEL_MAX_LENGTH;
      labelInput.addEventListener('input', () => {
        const t = truncateRewardLabel(labelInput.value);
        if (labelInput.value !== t) labelInput.value = t;
        this._onRewardInputChange();
      });
      tdLabel.appendChild(labelInput);

      // Code
      const tdCode = document.createElement('td');
      tdCode.className = 'col-reward-coupon';
      const codeInput = document.createElement('input');
      codeInput.type = 'text';
      codeInput.className = 'form-control';
      codeInput.value = reward.couponCode || '';
      codeInput.placeholder = 'Coupon Code';
      codeInput.name = `reward_code_${index}`;
      codeInput.maxLength = 12;
      codeInput.addEventListener('input', () => this._onRewardInputChange());
      tdCode.appendChild(codeInput);

      // Weight
      const tdWt = document.createElement('td');
      tdWt.className = 'col-wt';
      const weightInput = document.createElement('input');
      weightInput.type = 'number';
      weightInput.className = 'form-control';
      weightInput.value = reward.weight != null ? reward.weight : 0;
      weightInput.min = '0';
      weightInput.max = '100';
      weightInput.step = '1';
      weightInput.inputMode = 'numeric';
      weightInput.name = `reward_weight_${index}`;
      const onWeightEdit = () => {
        _sanitizeRewardWeightInputElement(weightInput);
        this._onRewardInputChange();
      };
      weightInput.addEventListener('input', onWeightEdit);
      weightInput.addEventListener('change', onWeightEdit);
      weightInput.addEventListener('blur', onWeightEdit);
      weightInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const nav = [
          'Backspace',
          'Delete',
          'Tab',
          'Escape',
          'Enter',
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Home',
          'End',
        ];
        if (nav.includes(e.key)) return;
        if (/^\d$/.test(e.key)) return;
        e.preventDefault();
      });
      _sanitizeRewardWeightInputElement(weightInput);
      tdWt.appendChild(weightInput);

      // Toggle switch
      const tdToggle = document.createElement('td');
      tdToggle.className = 'col-toggle';
      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'reward-toggle';
      const toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.checked = isActive;
      toggleInput.name = `reward_has_${index}`;
      toggleInput.addEventListener('change', () => {
        const rewardsContainer = document.getElementById('gameRewardsContainer');
        const rewardRowCount = rewardsContainer
          ? rewardsContainer.querySelectorAll('.reward-row').length
          : 0;
        if (
          !this._isSmartRewardActive() &&
          rewardRowCount >= MIN_ACTIVE_REWARDS &&
          !toggleInput.checked
        ) {
          const activeCount = rewardsContainer.querySelectorAll(
            '.reward-row input[type="checkbox"][name^="reward_has_"]:checked'
          ).length;
          if (activeCount < MIN_ACTIVE_REWARDS) {
            toggleInput.checked = true;
            applyRowState(tr, true);
            if (typeof toastr !== 'undefined' && typeof toastr.warning === 'function') {
              toastr.warning('At least three rewards must remain active.');
            }
            return;
          }
        }
        applyRowState(tr, toggleInput.checked);
        this._onRewardInputChange();
      });
      const slider = document.createElement('span');
      slider.className = 'slider';
      toggleLabel.appendChild(toggleInput);
      toggleLabel.appendChild(slider);
      tdToggle.appendChild(toggleLabel);

      tr.appendChild(tdLabel);
      tr.appendChild(tdCode);
      tr.appendChild(tdWt);
      tr.appendChild(tdToggle);

      // İlk durumu uygula
      applyRowState(tr, isActive);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    // Random butonu
    const btnRow = document.createElement('div');
    btnRow.className = 'd-flex justify-content-end mt-2';
    const randomBtn = document.createElement('button');
    randomBtn.type = 'button';
    randomBtn.id = 'reward-weights-random-btn';
    randomBtn.className = 'btn btn-sm btn-outline-primary';
    randomBtn.innerHTML = '<i class="bi bi-shuffle"></i> Random';
    randomBtn.addEventListener('click', () => this._randomizeWeights());
    btnRow.appendChild(randomBtn);
    container.appendChild(btnRow);

    this.syncSmartRewardRewardsUi();

    // Accordion'u göster
    const accordion = document.getElementById('rewardsAccordion');
    if (accordion) accordion.style.display = '';
  }

  _updateRewardsVisibility() {
    if (typeof document === 'undefined') return;
    const accordion = document.getElementById('rewardsAccordion');
    if (!accordion) return;

    const gameType = this.getCurrentGameType();
    if (!gameType || gameType.trim() === '') {
      accordion.style.display = 'none';
      return;
    }

    const container = document.getElementById('gameRewardsContainer');
    const hasRows = container && container.querySelectorAll('.reward-row').length > 0;
    accordion.style.display = hasRows ? '' : 'none';
  }

  _randomizeWeights() {
    if (this._isSmartRewardActive()) return;
    const container = document.getElementById('gameRewardsContainer');
    if (!container) return;

    const rows = container.querySelectorAll('.reward-row');
    const activeIndices = [];

    rows.forEach((row, i) => {
      const toggle = row.querySelector(`input[name="reward_has_${i}"]`);
      if (toggle && toggle.checked) {
        activeIndices.push(i);
      }
    });

    if (activeIndices.length === 0) return;

    // Rastgele böl: 100'ü n parçaya
    const n = activeIndices.length;
    const cuts = [];
    for (let i = 0; i < n - 1; i++) {
      cuts.push(Math.random() * 100);
    }
    cuts.sort((a, b) => a - b);

    const values = [];
    let prev = 0;
    for (let i = 0; i < cuts.length; i++) {
      values.push(Math.round(cuts[i] - prev));
      prev = cuts[i];
    }
    values.push(Math.round(100 - prev));

    // Yuvarlamadan kayıp farkı düzelt
    let sum = values.reduce((a, b) => a + b, 0);
    if (sum !== 100) {
      const maxIdx = values.indexOf(Math.max(...values));
      values[maxIdx] += 100 - sum;
    }

    // Minimum 1 garantisi
    for (let i = 0; i < values.length; i++) {
      if (values[i] <= 0) values[i] = 1;
    }
    sum = values.reduce((a, b) => a + b, 0);
    if (sum !== 100) {
      const maxIdx = values.indexOf(Math.max(...values));
      values[maxIdx] += 100 - sum;
    }

    // Değerleri input'lara yaz
    activeIndices.forEach((rowIdx, i) => {
      const weightInput = container.querySelector(`input[name="reward_weight_${rowIdx}"]`);
      if (weightInput) {
        weightInput.value = values[i];
      }
    });

    // Pasif olanları 0 yap
    rows.forEach((row, i) => {
      if (!activeIndices.includes(i)) {
        const weightInput = row.querySelector(`input[name="reward_weight_${i}"]`);
        if (weightInput) weightInput.value = 0;
      }
    });

    this._onRewardInputChange();
  }

  _onRewardInputChange() {
    if (typeof document === 'undefined') return;

    const container = document.getElementById('gameRewardsContainer');
    if (!container) return;

    const rewards = _collectRewardsFromGameRewardsDom();

    this._syncRewardsToLinkedThemes(rewards);
    _applyRewardsToWheelTexts(rewards, null);
    this._syncRewardWeightSumUi();
  }

  _loadInitialRewards() {
    const gameType = this.getCurrentGameType();
    if (!gameType || gameType.trim() === '') {
      this._updateRewardsVisibility();
      return;
    }

    // Önce temadaki kayıtlı rewards'lara bak
    const savedRewards = this.theme?.rewards;
    if (savedRewards && Array.isArray(savedRewards) && savedRewards.length > 0) {
      // Tema formatını gameRewards formatına dönüştür
      const mapped = savedRewards.map((r, i) => ({
        text: truncateRewardLabel(r.label || r.text || ''),
        couponCode: r.couponCode || r.code || '',
        weight: r.weight ?? 0,
        hasReward: r.hasReward !== undefined ? r.hasReward : r.weight > 0,
        sliceText: r.sliceText || r.sliceTex || r.textSlice || r.textSlot || r.sliceKey || '',
      }));
      this._renderGameRewards(mapped);
      return;
    }

    // Yoksa oyun varsayılanlarını kullan
    const gameData = DefaultGameSvgs.getGame(gameType);
    if (gameData && gameData.gameRewards && Array.isArray(gameData.gameRewards)) {
      this._renderGameRewards(gameData.gameRewards);
    } else {
      this._updateRewardsVisibility();
    }
  }

_bootMiniGamePreview() {
    if (typeof document === 'undefined') return;
    const gameId = this.theme?.gameID;
    if (!gameId || gameId === 1) return;


    setTimeout(() => {
      const container = document.querySelector('.game-svg-container');
      if (!container) return;

      const savedRewards = this.theme?.rewards;
      const rewards = Array.isArray(savedRewards) && savedRewards.length
        ? savedRewards
        : (getGameRecordById(gameId)?.gameRewards || []);

  
      if (window.MiniGameEngine) {
          window.MiniGameEngine.boot(container, gameId, rewards, (reward) => {
            console.info('[MiniGameEngine] Result:', reward?.text || 'no reward');
          });
      }
    }, 100);
  }
  initDOMElements() {
    if (typeof document === 'undefined') {
      return;
    }

    this.gameTypeSelect = document.getElementById('gameTypeSelect');
    if (this.gameTypeSelect) {
      this._setupGameTypeSelect();
    }

    // İlk yükleme: mevcut oyun türünün rewards'larını göster
    this._loadInitialRewards();
    this._bootMiniGamePreview();

    this.switchBtn = document.getElementById('switch-promotion-view');
    if (this.switchBtn) {
      this._setupSwitchButton();
    }

    this._bindGamePreviewClickOpensAccordion();
    this.setupGameEventListeners();

    this._setupGamePositionRadios();
    this._syncGamePositionUi();
    this.applyGamePositionLayout();

    this._updateGameColorLabels();
  }

  /**
   * Önizlemedeki oyuna (.game-svg-container / .game-svg-inner) tıklanınca
   * "Change the Game" accordion'unu açar.
   */
  _openChangeGameAccordion() {
    if (typeof document === 'undefined') return;
    const accordionItem = document.getElementById('changeGameAccordion');
    if (!accordionItem) return;
    if (window.getComputedStyle(accordionItem).display === 'none') return;

    const accordionContent = document.getElementById('collapseGameType');
    if (!accordionContent) return;

    const accordionButton =
      document.querySelector('[data-bs-target="#collapseGameType"]') ||
      document.querySelector('.accordion-button[aria-controls="collapseGameType"]');

    if (typeof bootstrap !== 'undefined' && bootstrap?.Collapse) {
      const collapseInstance = bootstrap.Collapse.getOrCreateInstance(accordionContent, {
        toggle: false,
      });
      collapseInstance.show();
    } else {
      accordionContent.classList.add('show');
    }
    if (accordionButton) {
      accordionButton.classList.remove('collapsed');
      accordionButton.setAttribute('aria-expanded', 'true');
    }
    setTimeout(() => {
      accordionItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  _bindGamePreviewClickOpensAccordion() {
    if (typeof document === 'undefined') return;
    if (document.documentElement.dataset.gamePreviewAccordionBound === '1') return;
    document.documentElement.dataset.gamePreviewAccordionBound = '1';

    document.body.addEventListener('click', (e) => {
      const gameEl = e.target.closest('.game-svg-container, .game-svg-inner');
      if (!gameEl) return;

      const wheelRoot = document.getElementById('wheelluckContainer');
      if (!wheelRoot || !wheelRoot.contains(gameEl)) return;

      const accordionItem = document.getElementById('changeGameAccordion');
      if (!accordionItem || window.getComputedStyle(accordionItem).display === 'none') return;

      this._openChangeGameAccordion();
    });
  }

  _setupGameTypeSelect() {
    if (!this.gameTypeSelect) {
      return;
    }

    if (this._isUnifiedShell()) {
      const gameType = getGameTypeName(this.theme) || '';
      if (this.gameTypeSelect.value !== gameType) {
        this.gameTypeSelect.value = gameType;
      }
      this._syncGamePositionUi();
      this.applyGamePositionLayout();
      this._updateGameColorLabels();
      return;
    }

    const gameType = getGameTypeName(this.theme) || (this.currentView || 'wheel');

    const emptyOption = this.gameTypeSelect.querySelector('option[value=""]');
    if (emptyOption) {
      emptyOption.remove();
    }

    if (this.gameTypeSelect.value !== gameType) {
      this.gameTypeSelect.value = gameType;
    }

    const newSelect = this.gameTypeSelect.cloneNode(true);
    this.gameTypeSelect.parentNode.replaceChild(newSelect, this.gameTypeSelect);
    this.gameTypeSelect = newSelect;
    if (this.gameTypeSelect.value !== gameType) {
      this.gameTypeSelect.value = gameType;
    }

    this.gameTypeSelect.addEventListener('change', (event) => {
      this._handleGameTypeChange(event.target.value);
    });

    this._syncGamePositionUi();
    this.applyGamePositionLayout();
    this._updateGameColorLabels();
  }

  _setupGamePositionRadios() {
    if (typeof document === 'undefined') return;
    if (document.documentElement.dataset.gamePositionRadiosBound === '1') return;
    document.documentElement.dataset.gamePositionRadiosBound = '1';
    document.body.addEventListener('change', (e) => {
      const t = e.target;
      if (!t || t.name !== 'game_position' || t.disabled) return;
      this._commitGamePositionFromForm();
    });
  }

  _readGamePositionFromForm() {
    const el = document.querySelector('input[name="game_position"]:not(:disabled):checked');
    return (el?.value || '').trim();
  }

  _commitGamePositionFromForm() {
    const pos = this._readGamePositionFromForm();
    if (!pos) return;
    const forTheme = this._coerceGamePositionForLightSplitLayout(pos);
    if (forTheme !== 'left' && forTheme !== 'right' && forTheme !== 'top') return;
    const applyPosition = (targetTheme) => {
      if (!targetTheme) return;
      targetTheme.layout = targetTheme.layout || {};
      targetTheme.layout.position = forTheme;
      targetTheme.game_position = forTheme;
    };
    this._forEachLinkedTheme(applyPosition);
    this.applyGamePositionLayout();
    if (this.themeManager && typeof this.themeManager.renderPromotionPreview === 'function') {
      this.themeManager.renderPromotionPreview(true);
      requestAnimationFrame(() => {
        this.applyGamePositionLayout();
        this._syncGamePositionUi();
      });
    }
  }

  /**
   * Split satırı gaming shell: yalnızca left/right. top veya boş → layout.position veya left.
   */
  _coerceGamePositionForLightSplitLayout(pos) {
    let p = String(pos ?? '').toLowerCase().trim();
    if (!this._isUnifiedShell()) return p;
    const activeTheme = this._activeTheme();
    const lt = String(activeTheme?.layout?.type || '').toLowerCase().trim();
    if (!_isSplitRowLayoutType(lt)) return p;
    // Top seçimini split layout'ta da koru; kullanıcı left/right/top arasında geçiş yapabilsin.
    if (p === 'top') return 'top';
    if (p !== 'left' && p !== 'right') {
      p = _resolveLayoutPositionFromType(activeTheme?.layout || {});
    }
    return p;
  }

  /** Oyun stilleri / data-game-position: mobil önizlemede kabuk üstte sıralansa bile tema left|right korunur. */
  _resolveGameStylesLayoutPosition() {
    const activeTheme = this._activeTheme();
    return _normalizeGameLayoutPos(
      this._coerceGamePositionForLightSplitLayout(
        _resolveLayoutPositionFromType(activeTheme?.layout || {})
      )
    );
  }

  _syncGamePositionUi() {
    if (typeof document === 'undefined') return;
    const hWrap = document.getElementById('gamePositionHorizontal');
    const vWrap = document.getElementById('gamePositionVertical');
    const gameWrap = document.getElementById('gamePositionControls');
    if (!hWrap && !vWrap) return;

    const activeTheme = this._activeTheme();
    const rawGid = Number(activeTheme?.gameID);
    const gid = Number.isInteger(rawGid) && rawGid > 0 ? rawGid : null;
    if (gid == null) {
      if (gameWrap) gameWrap.style.display = 'none';
      hWrap?.querySelectorAll('input[name="game_position"]').forEach((inp) => {
        inp.disabled = true;
      });
      vWrap?.querySelectorAll('input[name="game_position"]').forEach((inp) => {
        inp.disabled = true;
      });
      return;
    }
    if (gameWrap) gameWrap.style.removeProperty('display');
    const layoutType = String(activeTheme?.layout?.type || '').toLowerCase().trim();
    const splitRow = this._isUnifiedShell() && _isSplitRowLayoutType(layoutType);
    const orient = splitRow ? 'horizontal' : 'vertical';

    let pos = _resolveLayoutPositionFromType(activeTheme?.layout || {});
    const allowed = ['left', 'top', 'right'];

    if (splitRow) {
      pos = this._coerceGamePositionForLightSplitLayout(pos);
    } else if (!allowed.includes(pos)) {
      return;
    }

    if (hWrap) hWrap.style.display = orient === 'horizontal' ? '' : 'none';
    if (vWrap) vWrap.style.display = !splitRow && orient === 'vertical' ? '' : 'none';

    hWrap?.querySelectorAll('input[name="game_position"]').forEach((inp) => {
      inp.disabled = orient !== 'horizontal';
    });
    vWrap?.querySelectorAll('input[name="game_position"]').forEach((inp) => {
      inp.disabled = splitRow || orient !== 'vertical';
    });

    const idByPos =
      orient === 'horizontal'
        ? { left: 'game_pos_h_left', right: 'game_pos_h_right' }
        : { left: 'game_pos_v_left', top: 'game_pos_v_top', right: 'game_pos_v_right' };
    const targetId = idByPos[pos];
    const radio = targetId ? document.getElementById(targetId) : null;
    if (radio) {
      radio.checked = true;
    }
  }

  /**
   * Gaming: oyun yokken dekoratif görsel yan sütunda (sol/sağ) ise kabuk genişliği oyun satırıyla aynı
   * `splitShellWidth` (ör. max-width 800px) kalsın; aksi halde `width: fit-content` ile ~500px’e düşüyordu.
   */
  _shellWidthGameLikePositionForLightDecor(activeTheme) {
    if (!activeTheme || String(activeTheme.popup_type || '').toLowerCase() !== 'gaming') return null;
    const decorPath = String(activeTheme?.image?.path || activeTheme?.top_image?.path || '').trim();
    if (!decorPath) return null;

    const imgPos = String(activeTheme?.image?.position || activeTheme?.top_image?.position || '')
      .trim()
      .toLowerCase();
    if (imgPos === 'left' || imgPos === 'right') return imgPos;

    const lt = String(activeTheme?.layout?.type || '').toLowerCase().trim();
    if (_isSplitRowLayoutType(lt)) {
      let p = _resolveLayoutPositionFromType(activeTheme.layout || {});
      if (p !== 'left' && p !== 'right') {
        p = lt === 'split-reverse' ? 'right' : 'left';
      }
      return p === 'left' || p === 'right' ? p : null;
    }

    const p = _resolveLayoutPositionFromType(activeTheme.layout || {});
    return p === 'left' || p === 'right' ? p : null;
  }

  applyGamePositionLayout() {
    if (!this._isUnifiedShell()) return;
    const activeTheme = this._activeTheme();
    const rawGid = Number(activeTheme?.gameID);
    const gid = Number.isInteger(rawGid) && rawGid > 0 ? rawGid : null;
    const shell = typeof document !== 'undefined' ? document.getElementById('wheelluckContainer') : null;
    if (!shell) return;
    if (gid == null) {
      const suppress = Boolean(this.themeManager?._suppressNoGameLayoutMutations);
      if (
        !suppress &&
        !shell.classList?.contains('mobile-preview-mode')
      ) {
        if (typeof window !== 'undefined' && window.wheelApp?.imageManager?.resetLightSplitLayoutAfterTopImageRemoved) {
          window.wheelApp.imageManager.resetLightSplitLayoutAfterTopImageRemoved();
        }
        this._resetContentWrapperForNoGameEditor(shell);
      }
      if (!suppress) {
        const sideForShell = this._shellWidthGameLikePositionForLightDecor(activeTheme);
        this._applyDynamicShellWidthForGame(sideForShell, shell);
      }
      return;
    }
    const isMobilePreview = Boolean(shell?.classList?.contains('mobile-preview-mode'));
    let pos = _resolveLayoutPositionFromType(activeTheme?.layout || {});
    pos = String(pos).toLowerCase().trim();
    if (pos !== 'left' && pos !== 'right' && pos !== 'top') return;
    if (isMobilePreview) {
      pos = 'top';
    } else {
      pos = this._coerceGamePositionForLightSplitLayout(pos);
    }
    this._applyDynamicShellWidthForGame(pos, shell);
    if (
      !isMobilePreview &&
      typeof window !== 'undefined' &&
      window.wheelApp?.imageManager?.applySplitRowShellFromTheme
    ) {
      window.wheelApp.imageManager.applySplitRowShellFromTheme();
    }
    this._applyShellStyleBucketsForPosition(pos);
    this._applyGameStyleBucketForPosition(this._resolveGameStylesLayoutPosition());
    this._syncShellGamePositionAttribute(this._resolveGameStylesLayoutPosition());
  }

  /**
   * Gaming: görsel sol/sağdayken kabuk `containerStyle['max-width']` ile genişler; üst/tekrar taban `width`.
   * Oyun yokken `applyGamePositionLayout` erken döndüğü için ImageManager burayı çağırır.
   */
  syncLightPopupShellWidthForImagePosition(imagePosition) {
    if (!this._isUnifiedShell() || typeof document === 'undefined') return;
    const shell = document.getElementById('wheelluckContainer');
    if (!shell) return;
    const p = String(imagePosition || '').trim().toLowerCase();
    const side = p === 'left' || p === 'right' ? p : null;
    this._applyDynamicShellWidthForGame(side, shell);
  }

  _applyDynamicShellWidthForGame(position, shell) {
    if (!shell) return;
    /* Editör mobil önizleme: kabuk genişliği theme-manager _applyMobilePreviewLayoutOverrides ile; tema 980px burada ezilmesin */
    if (shell.classList?.contains('mobile-preview-mode')) return;
    if (position != null) {
      shell.style.removeProperty('min-width');
    }
    const activeTheme = this._activeTheme();
    const tplKey = activeTheme?.template != null ? Number(activeTheme.template) : NaN;
    const legacyId = Number(activeTheme?.id);
    const templateId =
      Number.isInteger(tplKey) && tplKey > 0 ? tplKey : Number.isInteger(legacyId) && legacyId > 0 ? legacyId : NaN;
    const template =
      !Number.isNaN(templateId) ? getTemplateById(templateId) : null;
    const cs = activeTheme?.containerStyle && typeof activeTheme.containerStyle === 'object'
      ? activeTheme.containerStyle
      : {};
    const tplCs = template?.containerStyle && typeof template.containerStyle === 'object'
      ? template.containerStyle
      : {};
    // Left/right: prefer explicit max-width; if missing, use popup width so 980px themes do not fall back to 800px.
    const splitShellWidth = String(
      containerStyleValue(cs, 'max-width') ||
        containerStyleValue(tplCs, 'max-width') ||
        containerStyleValue(cs, 'width') ||
        containerStyleValue(tplCs, 'width') ||
        '800px'
    );
    const parseShellPx = (raw) => {
      const n = parseInt(String(raw ?? '').replace(/px/gi, '').trim(), 10);
      return Number.isNaN(n) ? 0 : n;
    };
    const splitPx = parseShellPx(splitShellWidth);
    const csWidthPx = parseShellPx(containerStyleValue(cs, 'width'));
    // Yan düzende width tema'ya yazılıyor; üst görünüme dönünce cs.width hâlâ o genişlikte kalıyordu.
    const widthLooksLikeSideShell =
      csWidthPx > 0 && splitPx > 0 && Math.abs(csWidthPx - splitPx) <= 16;
    const baseWidth = String(
      widthLooksLikeSideShell
        ? tplCs.width || containerStyleValue(cs, 'width') || '480px'
        : cs.width || tplCs.width || '480px'
    );
    const targetWidth =
      position === 'left' || position === 'right' ? splitShellWidth : baseWidth;
    const maxWidthForCss = splitShellWidth;

    this._forEachLinkedTheme((t) => {
      t.containerStyle = t.containerStyle || {};
      t.containerStyle.width = targetWidth;
      t.containerStyle['max-width'] = maxWidthForCss;
      t.popup_settings = t.popup_settings || {};
      t.popup_settings.popup_width = targetWidth;
    });

    shell.style.setProperty('width', targetWidth, 'important');
    shell.style.setProperty('max-width', maxWidthForCss, 'important');
  }

  _applyShellStyleBucketsForPosition(position) {
    if (position !== 'left' && position !== 'right' && position !== 'top') return;
    const activeTheme = this._activeTheme();
    const contentBucket = activeTheme?.content_styles?.[position];
    const imageBucket = activeTheme?.image_styles?.[position];
    if (!contentBucket && !imageBucket) return;
    const contentWrapper = document.querySelector('.contentWrapper');
    const content = document.getElementById('wheelluckContent');
    const contentInner = document.getElementById('wheelluckContentInner');
    const image = document.querySelector('.image-container');
    const imageInner = image?.querySelector('.wheelluckImageInner');

    if (contentWrapper && contentBucket?.content_wrapper) {
      applyStyleString(contentWrapper, contentBucket.content_wrapper);
    }
    if (content && contentBucket?.content) {
      applyStyleString(content, contentBucket.content);
    }
    if (contentInner && contentBucket?.content_inner) {
      applyStyleString(contentInner, contentBucket.content_inner);
    }
    if (image && imageBucket?.image) {
      applyStyleString(image, imageBucket.image);
    }
    if (imageInner && imageBucket?.image_inner) {
      applyStyleString(imageInner, imageBucket.image_inner);
    }
  }

  _applyGameStyleBucketForPosition(position) {
    if (position !== 'left' && position !== 'right' && position !== 'top') return;
    const activeTheme = this._activeTheme();
    const gameContainer = document.querySelector('.game-svg-container');
    const gameInner = gameContainer?.querySelector('.game-svg-inner');
    const g = _resolveGameBucketField(activeTheme, position, 'game');
    const gi = _resolveGameBucketField(activeTheme, position, 'game_inner');
    if (gameContainer && g) {
      const stripped = styleStringWithoutGameAreaBackground(g);
      applyStyleString(gameContainer, stripped && stripped.trim() ? stripped : g);
    }
    if (gameInner && gi) applyStyleString(gameInner, gi);
    applyGameAreaBackgroundFromTheme(activeTheme);
  }

  /** Önizleme kabuğu — pin düzeltmesi vb. için CSS seçicileri (left | right | top). */
  _syncShellGamePositionAttribute(pos) {
    if (typeof document === 'undefined') return;

    const shell = document.getElementById('wheelluckContainer');
    if (!shell) return;
    const p = String(pos || '')
      .toLowerCase()
      .trim();
    shell.setAttribute('data-game-position', p);
   
  }

  /**
   * Light/gaming: oyun yokken sütun yönü / taşma.
   * - Dikey şablon + yan görsel yok: tema `layout.position` left/right kalsa bile `top` bucket + tam genişlik
   *   (aksi halde %55 içerik + sağda boş sütun; mobil→masaüstünde removeProperty ile silinen inline’lar da top ile toparlanır).
   * - Yan görsel var: gerçek pozisyon bucket’ı (satır düzeni); split + oyun yok: resetLightSplitLayout önce genişliği düzeltir, burada bucket tekrar uygulanmaz.
   */
  _resetContentWrapperForNoGameEditor(shellEl) {
    if (typeof document === 'undefined' || !this._isUnifiedShell()) return;
    const shell = shellEl || document.getElementById('wheelluckContainer');
    if (!shell || shell.classList?.contains('mobile-preview-mode')) return;
    const contentWrapper = document.querySelector('.contentWrapper');
    const content = document.getElementById('wheelluckContent');
    if (!contentWrapper || !content) return;

    const activeTheme = this._activeTheme();
    const layoutType = String(activeTheme?.layout?.type || '').toLowerCase().trim();
    const splitRow = _isSplitRowLayoutType(layoutType);
    const imgPath = String(activeTheme?.image?.path || activeTheme?.top_image?.path || '').trim();
    const noSideImage = !imgPath;

    if (!splitRow && !noSideImage) {
      const pos = _normalizeGameLayoutPos(_resolveLayoutPositionFromType(activeTheme?.layout || {}));
      this._applyShellStyleBucketsForPosition(pos);
      shell.removeAttribute('data-game-position');
      return;
    }

    if (!splitRow && noSideImage) {
      this._applyShellStyleBucketsForPosition('top');
    }

    /* Split + yan görsel: oyun yokken bile şablon satırı (left/right/top bucket) korunmalı. */
    if (splitRow && !noSideImage) {
      let pos = String(activeTheme?.layout?.position || '').trim().toLowerCase();
      if (pos !== 'left' && pos !== 'right' && pos !== 'top') {
        const lt = String(activeTheme?.layout?.type || '').toLowerCase().trim();
        pos = lt === 'split-reverse' ? 'right' : 'left';
      }
      const im = typeof window !== 'undefined' ? window.wheelApp?.imageManager : null;
      if (im && typeof im.applyLightSplitColumnOrder === 'function') {
        if (pos === 'left' || pos === 'right') {
          im.applyLightSplitColumnOrder(pos);
          if (typeof im.applySidePositionContentTopSpacing === 'function') {
            im.applySidePositionContentTopSpacing(pos);
          }
          return;
        }
        if (pos === 'top' && typeof im.applyPositionStyleBuckets === 'function') {
          im.applyPositionStyleBuckets('top');
          return;
        }
      }
    }

    contentWrapper.style.setProperty('flex-direction', 'column', 'important');
    contentWrapper.style.setProperty('align-items', 'stretch', 'important');
    contentWrapper.style.setProperty('width', '100%', 'important');
    contentWrapper.style.setProperty('justify-content', 'flex-start', 'important');
    contentWrapper.style.setProperty('height', '100%', 'important');
    contentWrapper.style.setProperty('min-height', '0', 'important');
    contentWrapper.style.setProperty('overflow', 'hidden', 'important');

    content.style.setProperty('order', '1', 'important');
    content.style.setProperty('margin-top', '0', 'important');
    content.style.setProperty('width', '100%', 'important');
    content.style.setProperty('max-width', '100%', 'important');
    content.style.setProperty('flex', '1 1 auto', 'important');
    content.style.setProperty('align-self', 'stretch', 'important');
    content.style.setProperty('min-width', '0', 'important');

    const image = document.querySelector('.image-container');
    if (image) {
      image.style.setProperty('order', '2', 'important');
      image.style.setProperty('width', '100%', 'important');
      image.style.setProperty('max-width', '100%', 'important');
      image.style.setProperty('align-self', 'stretch', 'important');
    }

    shell.removeAttribute('data-game-position');
  }

  _setupSwitchButton() {
    if (!this.switchBtn) {
      return;
    }

    this.switchBtn.addEventListener('click', () => {
      const newView = this.currentView === 'wheel' ? 'scratchcard' : 'wheel';
      this._handleGameTypeChange(newView);
    });
  }

  /**
   * Remove Game sonrası tekrar oyun seçildiğinde: şablondaki konum, SVG yüksekliği, metin stili ve palet.
   */
  _applyTemplateDefaultsForUnifiedGameRestart() {
    if (!this._isUnifiedShell()) return;
    const rawTid = this.theme?.template ?? this.themeManager?.theme?.template;
    const tid = typeof rawTid === 'number' ? rawTid : parseInt(String(rawTid ?? ''), 10);
    const tpl = Number.isInteger(tid) && tid > 0 ? getTemplateById(tid) : null;
    if (!tpl) return;

    const layout = tpl.layout && typeof tpl.layout === 'object' ? tpl.layout : {};
    const posRaw = String(layout.position ?? 'left').trim().toLowerCase();
    const pos = ['left', 'right', 'top'].includes(posRaw) ? posRaw : 'left';
    const tplGs = tpl.game_styles && typeof tpl.game_styles === 'object' ? tpl.game_styles : null;

    this._forEachLinkedTheme((t) => {
      t.layout = t.layout && typeof t.layout === 'object' ? t.layout : {};
      t.layout.position = pos;
      t.game_position = pos;
      if (tplGs) {
        t.game_styles = t.game_styles && typeof t.game_styles === 'object' ? t.game_styles : {};
        const area = String(tplGs.game_svg_area ?? '').trim();
        if (area) t.game_styles.game_svg_area = area;
        else delete t.game_styles.game_svg_area;
        const gst = tplGs.game_svg_text;
        if (gst != null) {
          if (typeof gst === 'string' && String(gst).trim()) {
            t.game_styles.game_svg_text = gst;
          } else if (typeof gst === 'object' && !Array.isArray(gst) && Object.keys(gst).length > 0) {
            t.game_styles.game_svg_text = JSON.parse(JSON.stringify(gst));
          }
        }
      }
      if (tpl.gameColors && typeof tpl.gameColors === 'object' && Object.keys(tpl.gameColors).length > 0) {
        t.gameColors = JSON.parse(JSON.stringify(tpl.gameColors));
      }
    });

    this._syncGamePositionUi();
    this.applyGamePositionLayout();
    if (typeof window !== 'undefined' && window.wheelApp?.imageManager?.applySplitRowShellFromTheme) {
      window.wheelApp.imageManager.applySplitRowShellFromTheme();
    }

    const areaStr = String(getGameHeightStyle(this.theme) || '').trim();
    const m = areaStr.match(/height:\s*([\d.]+)%/i);
    let pct = m ? parseFloat(m[1]) : NaN;
    if (!Number.isFinite(pct)) pct = this.gameSvgDefaultHeight;
    pct = Math.min(100, Math.max(10, Math.round(pct)));
    const heightIn =
      this.lightPopupGameSvgHeightInput || document.getElementById('lightPopupGameSvgHeight');
    const sizeVal =
      this.lightPopupGameSvgSizeValue || document.getElementById('lightPopupGameSvgSizeValue');
    if (heightIn) heightIn.value = String(pct);
    if (sizeVal) sizeVal.textContent = `${pct}%`;

    this.syncGameTextFontSelectFromTheme();
  }

  changeGameType(gameType, options = {}) {
    const { skipPreviewUpdate = false, updateDOM = true } = options;

    if (!gameType || gameType.trim() === '') {
      return false;
    }

    const validatedType = this._validateGameType(gameType);
    const rawThemeType = getGameTypeName(this.theme);
    const previousGameType = this._isUnifiedShell()
      ? (typeof rawThemeType === 'string' ? rawThemeType.trim() : '')
      : rawThemeType || this.currentView;
    const gameTypeChanged = previousGameType !== validatedType;

    if (!gameTypeChanged && !updateDOM) {
      return false;
    }

    this._setGameType(validatedType, true, updateDOM);

    const reAddedFromEmpty =
      this._isUnifiedShell() &&
      !String(previousGameType || '').trim() &&
      Boolean(String(validatedType || '').trim());
    if (reAddedFromEmpty) {
      this._applyTemplateDefaultsForUnifiedGameRestart();
    }

    if (this.gameTypeSelect && this.gameTypeSelect.value !== validatedType) {
      this.gameTypeSelect.value = validatedType;
    }

    // Oyun değişince circle/pin satırlarının görünürlüğünü güncelle (scratchcard'da pin kapalı)
    if (this.themeManager && this.themeManager.popupManager && typeof this.themeManager.popupManager.updateCirclePinVisibility === 'function') {
      this.themeManager.popupManager.updateCirclePinVisibility();
    }

    const rawGameId = Number(this.theme?.gameID);
    const selectedGameId = Number.isInteger(rawGameId) && rawGameId > 0 ? rawGameId : null;
    const gameData =
      selectedGameId != null
        ? DefaultGameSvgs.getGameById(selectedGameId)
        : DefaultGameSvgs.getGame(validatedType);

    if (gameTypeChanged) {
      if (gameData && gameData.gameRewards && Array.isArray(gameData.gameRewards)) {
        this._renderGameRewards(gameData.gameRewards);
      }
    }

    const renderedSvg = gameData?.svg || '';
    this._forEachLinkedTheme((t) => setGameSvgString(t, renderedSvg));

    const preferredColors = this._resolveGamePalette(gameData, {
      preferEngineDefaults: gameTypeChanged,
      allowTemplateFallback: true,
    });
    if (preferredColors && Object.keys(preferredColors).length > 0) {
      this._forEachLinkedTheme((t) => {
        t.gameColors = { ...preferredColors };
      });
    }

    if (this.themeManager?.colorManager) {
      setTimeout(() => {
        if (preferredColors && Object.keys(preferredColors).length > 0) {
          this.themeManager.colorManager.applyGameColorsFromTemplate(preferredColors);
        } else {
          this.themeManager.colorManager.applyCurrentColors();
        }
        if (typeof this.themeManager._updateGameColorsResetBaselineFromCurrentTheme === 'function') {
          this.themeManager._updateGameColorsResetBaselineFromCurrentTheme();
        }
      }, 100);
    }

    if (!skipPreviewUpdate) {
      const svgMarkup = renderedSvg || gameData?.svg || '';
      const updatedInPlace = this._replaceCurrentGameSvgMarkup(svgMarkup, validatedType);
      if (!updatedInPlace) return false;
    }
    this.applyGamePositionLayout();
    this._syncGamePositionUi();

    if (gameTypeChanged && this._isUnifiedShell()) {
      const rawTid = this.theme?.template ?? this.themeManager?.theme?.template;
      const tid =
        typeof rawTid === 'number' && Number.isInteger(rawTid)
          ? rawTid
          : parseInt(String(rawTid ?? '').trim(), 10);
      const tpl =
        Number.isInteger(tid) && tid > 0 ? getTemplateById(tid) : null;
      if (
        this.themeManager &&
        typeof this.themeManager._resetGameAreaBackgroundFromTemplate === 'function'
      ) {
        this.themeManager._resetGameAreaBackgroundFromTemplate(tpl);
      }
    }

    this._updateGameColorLabels();
    this._updateRewardsVisibility();
    if (this._isUnifiedShell()) {
      this.updateGameControlsVisibility();
    }
    return true;
  }

  /**
   * Tema `gameColors` + oyun kaydı + şablon zincirini tek yerde çözer.
   * @param {object} gameData DefaultGameSvgs satırı
   * @param {{ preferEngineDefaults?: boolean, allowTemplateFallback?: boolean }} options
   *   preferEngineDefaults: tema.gameColors boşken oyun motoru varsayılanına öncelik (ör. oyun türü değişimi)
   *   allowTemplateFallback: false — SVG swap’ta şablon paletini kullanma
   */
  _resolveGamePalette(gameData, options = {}) {
    const preferEngineDefaults = options.preferEngineDefaults === true;
    const allowTemplateFallback = options.allowTemplateFallback !== false;
    const activeTheme = this._activeTheme();

    const themeStored = activeTheme?.gameColors;
    if (themeStored && typeof themeStored === 'object' && Object.keys(themeStored).length > 0) {
      return { ...themeStored };
    }

    if (!preferEngineDefaults) {
      const eff = getEffectiveGameColors(activeTheme);
      if (eff && typeof eff === 'object' && Object.keys(eff).length > 0) {
        return { ...eff };
      }
    } else {
      if (
        gameData?.gameColors &&
        typeof gameData.gameColors === 'object' &&
        Object.keys(gameData.gameColors).length > 0
      ) {
        return { ...gameData.gameColors };
      }
      const eff = getEffectiveGameColors(activeTheme);
      if (eff && typeof eff === 'object' && Object.keys(eff).length > 0) {
        return { ...eff };
      }
    }

    if (
      gameData?.gameColors &&
      typeof gameData.gameColors === 'object' &&
      Object.keys(gameData.gameColors).length > 0
    ) {
      return { ...gameData.gameColors };
    }

    if (!allowTemplateFallback) {
      return {};
    }

    const tid =
      activeTheme?.template ?? this.theme?.template ?? this.themeManager?.theme?.template;
    const tpl = tid != null ? (getTemplateById(tid)) : null;
    if (tpl?.gameColors && typeof tpl.gameColors === 'object' && Object.keys(tpl.gameColors).length > 0) {
      return { ...tpl.gameColors };
    }
    return {};
  }

  _replaceCurrentGameSvgMarkup(svgMarkup, gameType) {
    if (!this._isUnifiedShell()) return false;
    const gameInner = this._getOrCreateGameInnerForSvgSwap();
    if (!gameInner) return false;
    const gameContainer = gameInner.closest('.game-svg-container');

    const gameData = DefaultGameSvgs.getGame(gameType);
    let themeColors = this._gameColorsFromLinkedThemes();
    const hasThemeColors =
      themeColors && typeof themeColors === 'object' && Object.keys(themeColors).length > 0;
    if (!hasThemeColors) {
      const resolved = this._resolveGamePalette(gameData, {
        preferEngineDefaults: true,
        allowTemplateFallback: false,
      });
      themeColors = Object.keys(resolved).length > 0 ? resolved : null;
    }

    const finalSvg =
      themeColors && Object.keys(themeColors).length > 0
        ? mergeGameColorsIntoSvgMarkup(svgMarkup || '', themeColors)
        : (svgMarkup || '');
    if (!finalSvg) return false;

    if (
      this.theme?.popup_type !== 'gaming' &&
      typeof window !== 'undefined' &&
      window.wheelApp?.imageManager?.removeTopImage
    ) {
      window.wheelApp.imageManager.removeTopImage();
    }

    gameInner.innerHTML = finalSvg;
    const sizePercent = this._extractHeightPercent(getGameHeightStyle(this.theme)) || this.gameSvgDefaultHeight;
    this._applyGameSvgSizeWithContainer(sizePercent, gameContainer || undefined);
    this._applyGameSvgTextStylesToContainer(gameInner);
    return true;
  }

  /** theme.game_styles.game_svg_text → SVG .wheelText (TextEditorManager ile aynı kaynak). */
  _applyGameSvgTextStylesToContainer(rootEl) {
    if (!rootEl || typeof document === 'undefined') return;
    const activeTheme = this._activeTheme();
    const baseStyle = getGameSvgTextStyleFromTheme(activeTheme);
    const svg = rootEl.querySelector('svg');
    const scale = _getGameSvgRootFontScale(svg);
    const styleText = _scaleGameSvgTextCssForLargeViewBox(baseStyle, scale);
    rootEl.querySelectorAll('.wheelText').forEach((el) => {
      mergeStyleStringIntoElement(el, styleText);
    });
  }

  applyGameSvgTextStylesToActivePreview() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.game-svg-inner').forEach((inner) => {
      this._applyGameSvgTextStylesToContainer(inner);
    });
  }

  _getOrCreateGameInnerForSvgSwap() {
    let gameInner = document.querySelector('.game-svg-container .game-svg-inner');
    if (gameInner) return gameInner;

    const content = document.getElementById('wheelluckContent');
    const contentWrapper = document.querySelector('.contentWrapper') || content?.parentElement;
    if (!contentWrapper) return null;

    let gameContainer = contentWrapper.querySelector('.game-svg-container');
    if (!gameContainer) {
      gameContainer = document.createElement('div');
      gameContainer.className = 'game-svg-container';
      if (content) {
        contentWrapper.insertBefore(gameContainer, content);
      } else {
        contentWrapper.appendChild(gameContainer);
      }
    }

    gameInner = gameContainer.querySelector('.game-svg-inner');
    if (!gameInner) {
      gameInner = document.createElement('div');
      gameInner.className = 'game-svg-inner';
      gameContainer.appendChild(gameInner);
    }
    return gameInner;
  }

  _handleGameTypeChange(newGameType) {
    const validatedType = this._validateGameType(newGameType);
    this.changeGameType(validatedType, {
      skipPreviewUpdate: false,
      updateDOM: true
    });
  }


_updateDOMElements() {
    if (typeof document === 'undefined') return;

    const inner = document.querySelector('.game-svg-inner');
    if (!inner) return;

  
    let svgForDom = getGameSvgString(this.theme);
    svgForDom = mergeGameColorsIntoSvgMarkup(svgForDom, this.theme.gameColors);
    svgForDom = syncGameSvgWithRewardInputs(svgForDom);

  
    inner.innerHTML = svgForDom;

   
    setTimeout(() => {
        this._bootMiniGamePreview();
    }, 200);
}

  updateTheme(theme) {
    this.theme = theme;
    if (theme) {
      this._initializeFromTheme();
      this._syncDefaultGameHeightFromTheme();
      if (typeof window !== 'undefined') {
        window.currentView = this.currentView;
      }
      this._syncGamePositionUi();
      this.applyGamePositionLayout();
      this.syncGameTextFontSelectFromTheme();
      this.applyGameSvgTextStylesToActivePreview();
    }
  }

  /** Light / gaming aynı kabuk; bucket tabanlı stiller ile boyanır. */
  _isUnifiedShell() {
    return isUnifiedPopupShellTheme(this.theme);
  }

  _extractHeightPercent(styleText = '') {
    const match = styleText.match(/height:\s*([\d.]+)%/);
    return match ? parseFloat(match[1]) : null;
  }

  _syncDefaultGameHeightFromTheme() {
    const configured = this._extractHeightPercent(getGameHeightStyle(this.theme));
    if (Number.isFinite(configured) && configured > 0) {
      this.gameSvgDefaultHeight = configured;
    }
  }

  initShellGameControlsDOM() {
    this.gameTypeSelect = document.getElementById('gameTypeSelect');
    this.gameTextFontSelect = document.getElementById('gameTextFontSelect');
    this.gameTextFontSizeInput = document.getElementById('gameTextFontSizeInput');
    this.gameTextFontRow = document.getElementById('gameTextFontRow');
    this.lightPopupGameSvgHeightInput = document.getElementById('lightPopupGameSvgHeight');
    this.lightPopupGameSvgSizeValue = document.getElementById('lightPopupGameSvgSizeValue');
    this.removeGameButton = document.getElementById('removeGameButton');
    this.removeGameButtonWrapper = document.getElementById('removeGameButtonWrapper');
    this.gameSvgSizeControls = document.getElementById('gameSvgSizeControls');
    this.changeGameAccordion = document.getElementById('changeGameAccordion');
    this._populateGameTextFontSelect();
  }

  /**
   * Birleşik kabuk: SVG yüksekliği ve "Remove Game" yalnızca gerçekten bir oyun seçildiğinde görünsün.
   */
  _syncShellGameAuxUiVisibility() {
    if (!this._isUnifiedShell()) return;
    if (!this.gameSvgSizeControls || !this.removeGameButtonWrapper) return;

    const fromSelect = this.gameTypeSelect?.value?.trim?.() || '';
    const fromTheme = getGameTypeName(this.theme) || '';
    const hasGame = Boolean(fromSelect || fromTheme);

    const display = hasGame ? 'block' : 'none';
    this.gameSvgSizeControls.style.removeProperty('display');
    this.removeGameButtonWrapper.style.removeProperty('display');
    this.gameSvgSizeControls.style.display = display;
    this.removeGameButtonWrapper.style.display = display;
  }

  setInitialGameSvg() {
    const popupType = this.theme.popup_type;
    this.changeGameAccordion.style.display =
      popupType === 'gaming' || popupType == null || popupType === '' ? 'block' : 'none';

    if (!this._isUnifiedShell()) {
      if (this.gameSvgSizeControls) this.gameSvgSizeControls.style.display = 'none';
      if (this.removeGameButtonWrapper) this.removeGameButtonWrapper.style.display = 'none';
    } else {
      this._syncShellGameAuxUiVisibility();
    }

    if (this._isUnifiedShell()) {
      const template =
        getTemplateById(this.theme.template) || {};
      /* gaming-default: katalogda hasGame:false + hasGame:true — oyun seçimi isteğe bağlı; yine de tema.gameID ile doldurulmalı */
      const hasGameEnabled = template.hasGame !== false;
      const isGaming = popupType === 'gaming';

      if (isGaming) {
        this.gameTypeSelect.querySelectorAll('option[value=""]').forEach((n) => n.remove());
      } else if (!this.gameTypeSelect.querySelector('option[value=""]')) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Select game';
        this.gameTypeSelect.insertBefore(opt, this.gameTypeSelect.firstChild);
      }

      let gameType = '';
      if (hasGameEnabled) {
        gameType = (getGameTypeName(this.theme) || '').trim();
        if (!gameType) {
          if (hasActiveLightGame(this.theme)) {
            const id = Number(this.theme.gameID);
            if (Number.isInteger(id) && id > 0) {
              this._forEachLinkedTheme((t) => setGameTypeById(t, id));
              gameType = (getGameTypeName(this.theme) || '').trim();
            }
          } else if (this.theme.hasGame !== false) {
            const rawFallbackId = Number(template.gameID ?? template.defaultGame);
            const fallbackId = Number.isInteger(rawFallbackId) && rawFallbackId > 0 ? rawFallbackId : null;
            if (fallbackId != null) {
              this._forEachLinkedTheme((t) => setGameTypeById(t, fallbackId));
              gameType = (getGameTypeName(this.theme) || '').trim();
            }
          }
        }
      }

      if (isGaming && hasGameEnabled && !gameType) {
        let fid = templateDefaultGameToId(template);
        if (!Number.isInteger(fid) || fid <= 0) {
          fid = 1;
        }
        this._forEachLinkedTheme((t) => setGameTypeById(t, fid));
        gameType = (getGameTypeName(this.theme) || '').trim();
        if (!gameType) {
          gameType = this._validateGameType(templateDefaultGameToTypeName(template) || 'wheel');
        }
      }

      if (gameType) {
        this.gameTypeSelect.value = gameType;
        const size = this._extractHeightPercent(getGameHeightStyle(this.theme)) || this.gameSvgDefaultHeight;
        this.lightPopupGameSvgHeightInput.value = size;
        this.lightPopupGameSvgSizeValue.innerText = `${size}%`;
        this._updateGameColorLabels();
        this._loadInitialRewards();
        this._updateSliceColorsVisibility();

        setTimeout(() => {
          this.applyGameSvgWithType(gameType, true);
          this._updateSliceColorsVisibility();
          setTimeout(() => this.themeManager.colorManager?.applyCurrentColors(), 300);
        }, 200);
      } else {
        this.gameTypeSelect.value = '';
        if (template.hasGame === false) {
          this._updateSliceColorsVisibility();
          this._updateRewardsVisibility();
          this._syncShellGameAuxUiVisibility();
        } else {
          clearGameThemeLight(this.theme);
          this._updateSliceColorsVisibility();
          this._updateRewardsVisibility();
        }
      }
    } else {
      this.initDOMElements();
    }
  }

  /**
   * Light birleşik kabukta üst görsel sıfırlandığında: şablonda oyun varsa temayı ve önizlemeyi
   * "Reset game" (resetGameOnly) ile uyumlu şekilde geri yükler (removeGameSvg sonrası).
   */
  restoreUnifiedLightGameAfterTopImageCleared() {
    if (!this._isUnifiedShell()) return;
    if (String(this.theme?.popup_type || '').toLowerCase() !== 'gaming') return;
    const template =
      getTemplateById(this.theme.template) || {};
    if (!template || template.hasGame === false) return;

    const revertLightHasGame = () => {
      this._forEachLinkedTheme((t) => {
        if (t && t.popup_type === 'gaming') {
          t.hasGame = false;
        }
      });
    };

    this._forEachLinkedTheme((t) => {
      if (t && t.popup_type === 'gaming') {
        t.hasGame = template.hasGame !== false;
      }
    });

    const tm = this.themeManager;
    if (tm?.templateManager && typeof tm.templateManager._applyTemplateGameDefaults === 'function') {
      tm.templateManager._applyTemplateGameDefaults(this.theme, template, true);
    }

    if (!this.gameTypeSelect) {
      revertLightHasGame();
      return;
    }

    let gameType = (getGameTypeName(this.theme) || '').trim();
    if (!gameType) {
      if (hasActiveLightGame(this.theme)) {
        const id = Number(this.theme.gameID);
        if (Number.isInteger(id) && id > 0) {
          this._forEachLinkedTheme((t) => setGameTypeById(t, id));
          gameType = (getGameTypeName(this.theme) || '').trim();
        }
      }
    }
    if (!gameType && this.theme.hasGame !== false) {
      const rawFallbackId = Number(template.gameID ?? template.defaultGame);
      const fallbackId = Number.isInteger(rawFallbackId) && rawFallbackId > 0 ? rawFallbackId : null;
      if (fallbackId != null) {
        this._forEachLinkedTheme((t) => setGameTypeById(t, fallbackId));
        gameType = (getGameTypeName(this.theme) || '').trim();
      }
    }
    if (!gameType) {
      revertLightHasGame();
      return;
    }

    this.gameTypeSelect.value = gameType;
    this._updateGameColorLabels();
    this._loadInitialRewards();
    this._updateSliceColorsVisibility();
    this.applyGameSvgWithType(gameType, true);
    this._updateSliceColorsVisibility();
    this._syncShellGameAuxUiVisibility();
    if (tm && typeof tm.resetGameOnly === 'function') {
      tm.resetGameOnly();
    }
  }

  applyGameSvgWithType(gameType, skipPreviewUpdate = false) {
    if (!this._isUnifiedShell()) return;

    ensureWheelluckContentInner();

    const wheelPopupContent = document.querySelector('#wheelluckContent');
    let contentWrapper = document.querySelector('.contentWrapper');
    if (!contentWrapper && wheelPopupContent?.parentElement) {
      contentWrapper = wheelPopupContent.parentElement;
    }
    if (!contentWrapper) {
      return;
    }

    contentWrapper.querySelectorAll('.wheelContainer').forEach((n) => n.remove());

    const existingGame = contentWrapper.querySelectorAll('.game-svg-container');
    for (let i = 1; i < existingGame.length; i++) existingGame[i].remove();

    let gameContainer = existingGame[0] || null;
    if (!gameContainer) {
      gameContainer = document.createElement('div');
      gameContainer.classList.add('game-svg-container');
      contentWrapper.insertBefore(gameContainer, wheelPopupContent || contentWrapper.firstChild);
    }

    if (
      wheelPopupContent &&
      _isSplitRowLayoutType(this.theme?.layout?.type) &&
      gameContainer.parentNode === contentWrapper
    ) {
      contentWrapper.insertBefore(gameContainer, wheelPopupContent);
    }

    gameContainer.style.removeProperty('display');
    gameContainer.style.setProperty('display', 'flex', 'important');

    const validatedType = this._validateGameType(gameType);
    this._setGameType(validatedType, true, true);

    this._forEachLinkedTheme((t) => reconcilePersistedGameSvgWithGameId(t));

    let savedSvg = (getGameSvgString(this.theme) || '').trim();
    const themeGameName = getGameTypeName(this.theme);
    if (themeGameName && themeGameName !== validatedType) {
      savedSvg = '';
      this._forEachLinkedTheme((t) => setGameSvgString(t, ''));
    }

    let svgContent = '';

    if (this.themeManager?.templateManager?.renderGame) {
      svgContent =
        this.themeManager.templateManager.renderGame(validatedType, {
          loadDefaults: !savedSvg,
          applyRewards: true,
          applyColors: false,
          customSvg: savedSvg,
          writeLuckywheel: false,
        }) || '';
    }

    if (!svgContent) {
      const gameData = DefaultGameSvgs.getGame(validatedType);
      svgContent = savedSvg || gameData.svg || '';
      if (svgContent) {
        this._forEachLinkedTheme((t) => setGameSvgString(t, svgContent));
      }
    }

    if (!svgContent) return;

    const gameData = DefaultGameSvgs.getGame(validatedType);

    if (typeof window !== 'undefined' && window.wheelApp?.imageManager?.removeTopImage) {
      window.wheelApp.imageManager.removeTopImage();
    }

    const sizePercent = this._extractHeightPercent(getGameHeightStyle(this.theme)) || this.gameSvgDefaultHeight;

    let inner = gameContainer.querySelector('.game-svg-inner');
    if (!inner) {
      inner = document.createElement('div');
      inner.className = 'game-svg-inner';
      gameContainer.appendChild(inner);
    }
    inner.innerHTML = '';

    let themeColors = this._gameColorsFromLinkedThemes();
    let hasThemeColors =
      themeColors && typeof themeColors === 'object' && Object.keys(themeColors).length > 0;

    if (!hasThemeColors) {
      const resolved = this._resolveGamePalette(gameData, {
        preferEngineDefaults: false,
        allowTemplateFallback: true,
      });
      if (resolved && Object.keys(resolved).length > 0) {
        themeColors = resolved;
        hasThemeColors = true;
      }
    }

    const colorsToApply = hasThemeColors ? themeColors : gameData?.gameColors;
    const svgForDom =
      colorsToApply && Object.keys(colorsToApply).length > 0
        ? mergeGameColorsIntoSvgMarkup(svgContent, colorsToApply)
        : svgContent;

    inner.innerHTML = svgForDom;

    // SVG DOM'da olmadan applyGameColorsFromTemplate çalışmaz; inline markup ile ilk kare doğru renkte.
    // Kayıtlı tema: theme.gameColors — yoksa oyun varsayılanı (gameData.gameColors).
    if (!skipPreviewUpdate && this.themeManager.colorManager && colorsToApply) {
      this.themeManager.colorManager.applyGameColorsFromTemplate(colorsToApply);
      this.themeManager.colorManager.updateTextColorsForAllViews?.();
    }

    // Uygulanan renkleri temaya kaydet (save sırasında korunsun)
    if (colorsToApply) {
      this._forEachLinkedTheme((t) => {
        t.gameColors = { ...colorsToApply };
      });
    }

    const heightStyle = `height: ${sizePercent}%`;
    this._forEachLinkedTheme((t) => setGameHeightStyle(t, heightStyle));

    if (this.themeManager.colorManager) {
      setTimeout(() => this.themeManager.colorManager.applyCurrentColors(), 100);
    }

    this.applyGamePositionLayout();
    this._applyGameSvgSizeWithContainer(sizePercent, gameContainer);

    this._syncShellGameAuxUiVisibility();
  }

  /**
   * Birleşik kabuk: SVG ölçekleme için kök attribute düzeni + game_styles.game_svg stili.
   */
  _fitShellGameSvgElements(wrapperEl) {
    if (!wrapperEl || typeof wrapperEl.children === 'undefined') return;
    const activeTheme = this._activeTheme();
    const rootSvgStyle = _resolveGameSvgRoot(activeTheme);

    const directRoots = Array.from(wrapperEl.children).filter(
      (el) => el.tagName && el.tagName.toLowerCase() === 'svg'
    );
    const targets =
      directRoots.length > 0 ? directRoots : [wrapperEl.querySelector('svg')].filter(Boolean);
    targets.forEach((svg) => {
      const pr = (svg.getAttribute('preserveAspectRatio') || '').trim();
      if (!pr || pr.toLowerCase() === 'none') {
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      if (rootSvgStyle) mergeStyleStringIntoElement(svg, rootSvgStyle);
    });
  }

  _applyGameSvgSizeWithContainer(sizePercent, container) {
    const gameContainer = container || document.querySelector('.game-svg-container');
    if (!gameContainer) return;

    const wheelPopup = document.querySelector('#wheelluckContainer');
    /* Mobil önizleme: kabuk yüksekliği % bölünmesin; SVG doğal yükseklik, scroll .contentWrapper’da */
    if (wheelPopup?.classList?.contains('mobile-preview-mode')) {
      const inner = gameContainer.querySelector('.game-svg-inner');
      if (inner) {
        this._fitShellGameSvgElements(inner);
        this._applyGameSvgTextStylesToContainer(inner);
      }
      return;
    }

    const clamped = Math.min(100, Math.max(10, sizePercent));

    const activeTheme = this._activeTheme();
    const layoutPos = this._resolveGameStylesLayoutPosition();
    const isLightPopup = String(activeTheme?.popup_type || '').toLowerCase().trim() === 'gaming';
    const isLightSplit = this._isUnifiedShell() && (layoutPos === 'left' || layoutPos === 'right');
    /** Light + üst: oyun bandı yüksekliği doğrudan `.contentWrapper` yüksekliğinin slider yüzdesi (72 → %72). */
    const isLightTopShell =
      this._isUnifiedShell() && isLightPopup && layoutPos === 'top';
    const isGamingPopup = String(activeTheme?.popup_type || '').toLowerCase().trim() === 'gaming';
    const usePercentGameHeight = isLightSplit || isGamingPopup;

    setGameHeightStyle(this.theme, `height: ${clamped}%`);

    const baseOuter = _resolveGameBucketField(activeTheme, layoutPos, 'game');
    const baseOuterSansBg = _gameContainerBucketSansAreaBackground(baseOuter);
    const baseInner = _resolveGameBucketField(activeTheme, layoutPos, 'game_inner');
    const areaStyle = String(getGameHeightStyle(activeTheme) || '').trim();

    let containerHeightPx;
    if (!usePercentGameHeight && !isLightTopShell) {
      if (wheelPopup) {
        const parseCssPx = (v) => {
          if (v == null || v === '') return 0;
          const n = parseInt(String(v).replace(/px/i, '').trim(), 10);
          return Number.isNaN(n) ? 0 : n;
        };
        const rect = wheelPopup.getBoundingClientRect?.();
        const rectH = rect && rect.height > 0 ? rect.height : 0;
        const popupH = Math.max(
          200,
          Math.round(
            rectH ||
              wheelPopup.clientHeight ||
              parseCssPx(containerStyleValue(this.theme?.containerStyle, 'height')) ||
              450
          )
        );
        const usable = Math.max(120, Math.round(popupH * 0.94) - 12);
        const minBand = 56;
        const t = (clamped - 10) / 90;
        containerHeightPx = Math.round(minBand + t * (usable - minBand));
      } else {
        containerHeightPx = Math.round(60 + (clamped - 10) * 3.78);
      }
    }

    const containerStyleStr = usePercentGameHeight
      ? [baseOuterSansBg, areaStyle].filter(Boolean).join('; ')
      : isLightTopShell
        ? [baseOuterSansBg, `height: ${clamped}%`].filter(Boolean).join('; ')
        : [baseOuterSansBg, `height: ${containerHeightPx}px`].filter(Boolean).join('; ');

    const inner = gameContainer.querySelector('.game-svg-inner');

    /* Light sol/sağ: game_svg_area yüzdesi pembe sütunu kısaltıyordu; sütun tam yükseklik, yüzde iç kutuda. */
    if (isLightSplit) {
      applyStyleString(gameContainer, baseOuterSansBg);
      if (inner) {
        applyStyleString(inner, [baseInner, areaStyle].filter(Boolean).join('; '));
        this._fitShellGameSvgElements(inner);
        this._applyGameSvgTextStylesToContainer(inner);
      }
    } else if (isLightTopShell) {
      applyStyleString(gameContainer, containerStyleStr);
      if (inner) {
        applyStyleString(
          inner,
          [
            baseInner,
            'min-height: 0',
            'max-height: 100%',
            'height: 100%',
            'width: 100%',
            'flex: 1 1 auto',
          ]
            .filter(Boolean)
            .join('; ')
        );
        this._fitShellGameSvgElements(inner);
        this._applyGameSvgTextStylesToContainer(inner);
      }
    } else {
      applyStyleString(gameContainer, containerStyleStr);
      if (inner) {
        applyStyleString(inner, baseInner);
        this._fitShellGameSvgElements(inner);
        this._applyGameSvgTextStylesToContainer(inner);
      }
    }

    if (this.lightPopupGameSvgSizeValue) {
      this.lightPopupGameSvgSizeValue.innerText = `${clamped}%`;
    }
    if (this.lightPopupGameSvgHeightInput && this.lightPopupGameSvgHeightInput.value !== `${clamped}`) {
      this.lightPopupGameSvgHeightInput.value = clamped;
    }
    if (this._isUnifiedShell()) wheelPopup?.classList.add('has-game-svg');
    if (this._isUnifiedShell() && activeTheme) {
      applyGameAreaBackgroundFromTheme(activeTheme);
    }
  }

  syncAfterNoGameTemplate() {
    this._forEachLinkedTheme((t) => {
      t.gameID = null;
      t.gameSVG = '';
      setGameHeightStyle(t, '');
      if (t.popup_type === 'gaming') {
        t.hasGame = false;
      }
    });
    if (this.gameTypeSelect) {
      this.gameTypeSelect.value = '';
    }
    this.currentView = '';
    if (typeof window !== 'undefined') {
      window.currentView = '';
    }
    const root = document.querySelector('#wheelluckContainer');
    if (root) {
      root.classList.remove('has-game-svg');
    }
    this._updateSliceColorsVisibility();
    this.updateGameControlsVisibility();
    if (typeof this._syncShellGameAuxUiVisibility === 'function') {
      this._syncShellGameAuxUiVisibility();
    }
    if (this.themeManager?.popupManager && typeof this.themeManager.popupManager.updateCirclePinVisibility === 'function') {
      this.themeManager.popupManager.updateCirclePinVisibility();
    }
    if (this.gameTypeSelect && typeof this._setupGameTypeSelect === 'function') {
      this._setupGameTypeSelect();
    }
    this.applyGamePositionLayout();
    this._syncGamePositionUi();
    this.themeManager?.scheduleDesktopPreviewFit?.();
  }

  removeGameSvg() {
    if (!this._isUnifiedShell()) return;
    if (this.theme?.popup_type === 'gaming') return;

    document.querySelectorAll('.game-svg-container').forEach((c) => c.remove());

    this._forEachLinkedTheme((t) => clearGameThemeLight(t));

    const sel = this.gameTypeSelect || document.getElementById('gameTypeSelect');
    if (sel) sel.value = '';
    this.currentView = '';
    if (typeof window !== 'undefined') {
      window.currentView = '';
    }
    this._updateSliceColorsVisibility();
    this._renderGameRewards([]);  // Rewards'ları temizle
    const heightIn =
      this.lightPopupGameSvgHeightInput || document.getElementById('lightPopupGameSvgHeight');
    const sizeVal =
      this.lightPopupGameSvgSizeValue || document.getElementById('lightPopupGameSvgSizeValue');
    if (heightIn) heightIn.value = String(this.gameSvgDefaultHeight);
    if (sizeVal) sizeVal.textContent = `${this.gameSvgDefaultHeight}%`;
    document.querySelector('#wheelluckContainer')?.classList.remove('has-game-svg');
    this.applyGamePositionLayout();
    this._syncGamePositionUi();
    this.updateGameControlsVisibility();
    this.themeManager?.scheduleDesktopPreviewFit?.();
  }

  _populateGameTextFontSelect() {
    const sel = this.gameTextFontSelect;
    if (!sel || sel.dataset.populated === '1') return;
    sel.innerHTML = '';
    GAME_TEXT_FONT_OPTIONS.forEach(({ id, label, style }) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = label;
      opt.setAttribute('data-svg-text-style', style);
      const fm = /font-family:\s*([^;]+)/i.exec(style);
      if (fm) opt.style.fontFamily = fm[1].trim();
      sel.appendChild(opt);
    });
    sel.dataset.populated = '1';
  }

  syncGameTextFontSelectFromTheme() {
    if (!this.gameTextFontSelect) return;
    this._populateGameTextFontSelect();
    const raw = this.theme?.game_styles?.game_svg_text;
    const id = resolveGameTextFontOptionId(raw);
    if ([...this.gameTextFontSelect.options].some((o) => o.value === id)) {
      this.gameTextFontSelect.value = id;
    } else {
      this.gameTextFontSelect.value = GAME_TEXT_FONT_OPTIONS[0]?.id ?? 'arial';
    }
    if (this.gameTextFontSizeInput) {
      const sizeStr = parseGameSvgTextFontSize(raw);
      const px = parseInt(sizeStr, 10);
      this.gameTextFontSizeInput.value = Number.isFinite(px) ? String(px) : '28';
    }
  }

  _commitGameSvgTextStyleFromControls() {
    if (!this.gameTextFontSelect || !this._isUnifiedShell()) return;
    const id = this.gameTextFontSelect.value;
    const meta = GAME_TEXT_FONT_OPTIONS.find((o) => o.id === id);
    const opt = this.gameTextFontSelect.selectedOptions[0];
    const label = meta?.label ?? opt?.textContent?.trim() ?? 'Arial';
    let px = parseInt(this.gameTextFontSizeInput?.value, 10);
    if (!Number.isFinite(px)) {
      px = parseInt(parseGameSvgTextFontSize(this.theme?.game_styles?.game_svg_text), 10);
    }
    if (!Number.isFinite(px)) px = 28;
    px = Math.min(96, Math.max(8, px));
    if (this.gameTextFontSizeInput) this.gameTextFontSizeInput.value = String(px);
    const payload = { fontFamily: label, fontSize: `${px}px` };
    this._forEachLinkedTheme((t) => {
      t.game_styles = t.game_styles && typeof t.game_styles === 'object' ? t.game_styles : {};
      t.game_styles.game_svg_text = payload;
    });
    this.applyGameSvgTextStylesToActivePreview();
  }

  _updateSliceColorsVisibility() {
    if (!this._isUnifiedShell()) return;
    const sliceColorsSection = document.getElementById('slice-colors-section');
    if (!sliceColorsSection) return;
    const hasGame = this.gameTypeSelect.value.trim() || getGameTypeName(this.theme);
    sliceColorsSection.style.display = hasGame ? '' : 'none';
    if (this.gameTextFontRow) {
      this.gameTextFontRow.style.display = hasGame ? '' : 'none';
      if (hasGame) this.syncGameTextFontSelectFromTheme();
    }
    const pm = this.themeManager?.popupManager;
    if (pm && typeof pm.updateCirclePinVisibility === 'function') {
      pm.updateCirclePinVisibility();
    }
    this._updateGameColorLabels();
  }

  updateGameControlsVisibility() {
    if (!isUnifiedPopupShellTheme(this.theme)) {
      if (this.changeGameAccordion) this.changeGameAccordion.style.display = 'none';
      if (this.gameSvgSizeControls) this.gameSvgSizeControls.style.setProperty('display', 'none', 'important');
      if (this.removeGameButtonWrapper) this.removeGameButtonWrapper.style.setProperty('display', 'none', 'important');
      return;
    }
    if (this.changeGameAccordion) this.changeGameAccordion.style.display = 'block';
    const gameTypeRow = document.getElementById('gameTypeSelectRow');
    if (gameTypeRow) {
      gameTypeRow.style.removeProperty('display');
    }
    this._syncShellGameAuxUiVisibility();
  }

  setupGameEventListeners() {
    if (!this._isUnifiedShell()) return;

    if (this.gameTextFontSelect && this.gameTextFontSelect.dataset.fontChangeBound !== '1') {
      this.gameTextFontSelect.dataset.fontChangeBound = '1';
      this.gameTextFontSelect.addEventListener('change', () => this._commitGameSvgTextStyleFromControls());
    }
    if (this.gameTextFontSizeInput && this.gameTextFontSizeInput.dataset.gameTextSizeBound !== '1') {
      this.gameTextFontSizeInput.dataset.gameTextSizeBound = '1';
      this.gameTextFontSizeInput.addEventListener('input', () => this._commitGameSvgTextStyleFromControls());
    }

    const svgHeightEl =
      this.lightPopupGameSvgHeightInput || document.getElementById('lightPopupGameSvgHeight');
    if (svgHeightEl && svgHeightEl.dataset.wheelluckSvgHeightBound !== '1') {
      svgHeightEl.dataset.wheelluckSvgHeightBound = '1';
      this.lightPopupGameSvgHeightInput = svgHeightEl;
      svgHeightEl.addEventListener('input', (e) => {
        const raw = parseInt(e.target.value, 10);
        const size = Number.isFinite(raw)
          ? Math.min(100, Math.max(10, raw))
          : this.gameSvgDefaultHeight;
        this._applyGameSvgSizeWithContainer(size);
        const label =
          this.lightPopupGameSvgSizeValue || document.getElementById('lightPopupGameSvgSizeValue');
        if (label) label.textContent = `${size}%`;
      });
    }

    const removeBtn = this.removeGameButton || document.getElementById('removeGameButton');
    if (removeBtn && removeBtn.dataset.wheelluckRemoveGameBound !== '1') {
      removeBtn.dataset.wheelluckRemoveGameBound = '1';
      this.removeGameButton = removeBtn;
      removeBtn.addEventListener('click', () => this.removeGameSvg());
    }

    if (!this.gameTypeSelect) return;
    if (this.gameTypeSelect.dataset.gameEventsBound === '1') return;
    this.gameTypeSelect.dataset.gameEventsBound = '1';

    this.gameTypeSelect.addEventListener('change', (event) => {
      const newGameType = event.target.value;
      if (!newGameType) {
        if (this.theme?.popup_type === 'gaming') {
          const cur = this._validateGameType(
            getGameTypeName(this.theme) || this.currentView || 'wheel'
          );
          if (this.gameTypeSelect.value !== cur) {
            this.gameTypeSelect.value = cur;
          }
          return;
        }
        this.removeGameSvg();
        this._updateSliceColorsVisibility();
        return;
      }
      // Oyun değişiminde yalnızca SVG + palet/label güncellensin; layout/stil yeniden kurulmasın.
      this.changeGameType(newGameType, { skipPreviewUpdate: false, updateDOM: true });
      this._updateSliceColorsVisibility();
    });
  }
}



