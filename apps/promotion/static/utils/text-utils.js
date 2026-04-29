import {
  applyStyleObject,
  isUnifiedPopupShellTheme,
  getCloseFormButtonElement,
  setSubmitWidgetText,
} from './dom-utils.js';

export function isButtonFieldType(type) {
  return type === 'button' || type === 'submit_button';
}

export function getInputFieldButtonText(theme, action) {
  const fields = theme?.input_fields;
  if (!Array.isArray(fields)) return '';
  const f = fields.find(
    (x) => x && isButtonFieldType(x.type) && x.action === action
  );
  if (!f || f.text == null) return '';
  return String(f.text).trim();
}


export function getPrimarySubmitInputField(theme) {
  const fields = theme?.input_fields;
  if (!Array.isArray(fields)) return null;
  return (
    fields.find(
      (f) => f && isButtonFieldType(f.type) && f.action === 'submit_form'
    ) || null
  );
}

export function getPrimarySubmitFieldStyle(theme) {
  const f = getPrimarySubmitInputField(theme);
  return f?.style && typeof f.style === 'object' ? f.style : null;
}

export function getPrimaryCloseFormInputField(theme) {
  const fields = theme?.input_fields;
  if (!Array.isArray(fields)) return null;
  return (
    fields.find(
      (f) => f && isButtonFieldType(f.type) && f.action === 'close_form'
    ) || null
  );
}

export function getPrimaryCloseFieldStyle(theme) {
  const f = getPrimaryCloseFormInputField(theme);
  return f?.style && typeof f.style === 'object' ? f.style : null;
}

/** Birincil submit alanının `style` nesnesine patch uygular (mutation). */
export function mergePrimarySubmitFieldStyle(theme, patch) {
  const f = getPrimarySubmitInputField(theme);
  if (!f || !patch || typeof patch !== 'object') return;
  if (!f.style || typeof f.style !== 'object') f.style = {};
  Object.assign(f.style, patch);
}

/** Close (No thanks) butonu `input_fields` kaydına patch uygular (mutation). */
export function mergePrimaryCloseFormFieldStyle(theme, patch) {
  const f = getPrimaryCloseFormInputField(theme);
  if (!f || !patch || typeof patch !== 'object') return;
  if (!f.style || typeof f.style !== 'object') f.style = {};
  Object.assign(f.style, patch);
}

function normalizeColor(color) {
  if (!color) return '';
  if (color.length === 9 && color.startsWith('#')) return color.substring(0, 7);
  return color;
}

function cleanFontFamily(fontFamily) {
  if (!fontFamily) return '';
  let val = fontFamily.replace(/^["']|["']$/g, '').replace(/\\"/g, '"');
  if (val.includes(' ') && !val.startsWith("'") && !val.startsWith('"')) {
    val = `'${val}'`;
  }
  return val;
}

function normalizeTextStyles(styles) {
  if (!styles || typeof styles !== 'object') return {};
  const normalized = {};
  Object.keys(styles).forEach((key) => {
    const value = styles[key];
    if (value === undefined || value === null || value === '') return;
    if (key === 'htmlContent' || key === 'position') {
      normalized[key] = value;
      return;
    }
    const cssKey = key.includes('-') ? key : key.replace(/([A-Z])/g, '-$1').toLowerCase();
    if (cssKey === 'font-family') normalized[cssKey] = cleanFontFamily(value);
    else if (cssKey === 'color') normalized[cssKey] = normalizeColor(value);
    else normalized[cssKey] = value;
  });
  return normalized;
}

export function applyTextStyles(element, styles) {
  if (!element || !styles) return;
  applyStyleObject(element, normalizeTextStyles(styles), { important: true, exclude: ['htmlContent'] });
}

export function clearTextStyles(element) {
  if (!element) return;

  const props = ['font-family', 'font-size', 'font-weight', 'font-style', 'text-align', 'text-decoration', 'color'];
  props.forEach(p => element.style.removeProperty(p));

  if (element.id === 'headline' || element.closest?.('#headline')) {
    const titleSpan = element.querySelector('span') || (element.id === 'headline' ? element.querySelector('span') : null);
    if (titleSpan) {
      props.forEach(p => titleSpan.style.removeProperty(p));
    }
    if (element.tagName === 'SPAN' && element.closest('#headline')) {
      const titleParent = element.closest('#headline');
      props.forEach(p => titleParent.style.removeProperty(p));
    }
  }
}

export function clearAllTextStyles() {
  const titleElement = document.getElementById('headline');
  if (titleElement) {
    clearTextStyles(titleElement);
    const titleSpan = titleElement.querySelector('span');
    if (titleSpan) clearTextStyles(titleSpan);
  }

  ['description', 'disclaimer', 'submit_button'].forEach(id => {
    const el = document.getElementById(id);
    if (el) clearTextStyles(el);
  });

  const closeLegacy = document.querySelector('#close_link .text') || document.getElementById('close_link');
  if (closeLegacy) clearTextStyles(closeLegacy);
  const closeWidget = getCloseFormButtonElement();
  if (closeWidget) clearTextStyles(closeWidget);
}

export function applyCurrentTextStylesToDOM(theme) {
  const styles = theme?.text_styles;
  if (!styles) return;

  const titleElement = document.getElementById('headline');
  if (titleElement && styles.headline) {
    const titleSpan = titleElement.querySelector('span');
    if (titleSpan) applyTextStyles(titleSpan, styles.headline);
    applyTextStyles(titleElement, styles.headline);
  }

  const descriptionEl = document.getElementById('description');
  if (descriptionEl && styles.description) applyTextStyles(descriptionEl, styles.description);

  const disclaimerEl = document.getElementById('disclaimer');
  if (disclaimerEl && styles.disclaimer) applyTextStyles(disclaimerEl, styles.disclaimer);

  const buttonEl = document.getElementById('submit_button');
  const submitStyles = getPrimarySubmitFieldStyle(theme);
  if (buttonEl && submitStyles && Object.keys(submitStyles).length > 0) {
    applyTextStyles(buttonEl, submitStyles);
  }

  const closeStyles = getPrimaryCloseFieldStyle(theme) || styles?.close_link;
  if (closeStyles && Object.keys(closeStyles).length > 0) {
    if (isUnifiedPopupShellTheme(theme)) {
      const w = getCloseFormButtonElement();
      if (w) {
        applyTextStyles(w, closeStyles);
      }
    } else {
      const closeContainerEl = document.getElementById('close_link');
      const closeTextEl = document.querySelector('#close_link .text');
      if (closeContainerEl) {
        applyTextStyles(closeContainerEl, closeStyles);
        if (closeTextEl) {
          closeTextEl.removeAttribute('style');
        }
      }
    }
  }
}

export function applyTemplateTexts(theme, templateTexts) {
  if (!templateTexts) return;
  theme.texts = theme.texts || {};

  if (!theme.text_styles) theme.text_styles = {};
  if (templateTexts.styles && typeof templateTexts.styles === 'object') {
    const raw = JSON.parse(JSON.stringify(templateTexts.styles));
    const legacySubmit = raw.submit_button;
    const legacyClose = raw.close_link;
    delete raw.submit_button;
    delete raw.close_link;
    Object.assign(theme.text_styles, raw);
    if (legacySubmit && typeof legacySubmit === 'object' && Object.keys(legacySubmit).length > 0) {
      mergePrimarySubmitFieldStyle(theme, legacySubmit);
    }
    if (legacyClose && typeof legacyClose === 'object' && Object.keys(legacyClose).length > 0) {
      mergePrimaryCloseFormFieldStyle(theme, legacyClose);
    }
  }
  const legacyCloseTextStyles = theme.text_styles.close_link;
  delete theme.text_styles.submit_button;
  delete theme.text_styles.close_link;

  const styles = theme.text_styles;

  Object.keys(templateTexts).forEach(key => {
    if (key === 'styles') return;

    if (key === 'submit_button' || key === 'close_link') {
      const action = key === 'submit_button' ? 'submit_form' : 'close_form';
      const fields = Array.isArray(theme.input_fields) ? [...theme.input_fields] : [];
      const idx = fields.findIndex(
        (f) => f && isButtonFieldType(f.type) && f.action === action
      );
      if (idx >= 0) {
        fields[idx] = { ...fields[idx], text: templateTexts[key] };
        theme.input_fields = fields;
      }
      let previewEl;
      if (key === 'close_link') {
        previewEl = isUnifiedPopupShellTheme(theme)
          ? getCloseFormButtonElement()
          : document.getElementById('close_link');
      } else {
        previewEl = document.getElementById('submit_button');
      }
      if (previewEl) {
        if (key === 'close_link') {
          if (previewEl.classList?.contains('submit-button-widget')) {
            setSubmitWidgetText(previewEl, templateTexts[key]);
          } else {
            const closeTextEl = previewEl.querySelector('.text');
            if (closeTextEl) {
              closeTextEl.innerHTML = String(templateTexts[key]).replace(/\n/g, '<br>');
              closeTextEl.removeAttribute('style');
            } else {
              previewEl.innerHTML = String(templateTexts[key]).replace(/\n/g, '<br>');
            }
          }
        } else {
          previewEl.textContent = templateTexts[key];
        }
        const btnStyles =
          key === 'submit_button'
            ? getPrimarySubmitFieldStyle(theme)
            : getPrimaryCloseFieldStyle(theme) || legacyCloseTextStyles;
        if (btnStyles && Object.keys(btnStyles).length > 0) {
          applyTextStyles(previewEl, btnStyles);
        } else {
          clearTextStyles(previewEl);
        }
      }
      const legacyNamedInput = document.querySelector(
        `input[name="${key === 'submit_button' ? 'submit_button' : 'close_link'}"]`
      );
      if (legacyNamedInput) {
        legacyNamedInput.value = templateTexts[key];
        legacyNamedInput.setAttribute('data-full-value', templateTexts[key]);
      }
      return;
    }

    theme.texts[key] = templateTexts[key];

    let previewEl;
    if (key === 'headline') {
      const el = document.getElementById('headline');
      previewEl = el?.querySelector('span') || el;
    } else {
      previewEl = document.getElementById(key);
    }

    if (previewEl) {
      previewEl.innerHTML = String(templateTexts[key]).replace(/\n/g, '<br>');

      if (key === 'headline') {
        const titleParent = document.getElementById('headline');
        if (styles.headline) {
          applyTextStyles(previewEl, styles.headline);
          if (titleParent && titleParent !== previewEl) applyTextStyles(titleParent, styles.headline);
        } else {
          clearTextStyles(previewEl);
          if (titleParent && titleParent !== previewEl) clearTextStyles(titleParent);
        }
      } else {
        if (styles[key]) {
          applyTextStyles(previewEl, styles[key]);
        } else {
          clearTextStyles(previewEl);
        }
      }
    }

    const inputTag = (key === 'description' || key === 'disclaimer') ? 'textarea' : 'input';
    const inputEl = document.querySelector(`${inputTag}[name="${key}"]`);
    if (inputEl) {
      inputEl.value = templateTexts[key];
      inputEl.setAttribute('data-full-value', templateTexts[key]);
    }
  });

  if (styles && Object.keys(styles).length > 0) {
    Object.keys(styles).forEach((k) => {
      theme.text_styles[k] = styles[k];
    });
    Object.keys(templateTexts).forEach(k => {
      if (k === 'styles' || k === 'submit_button' || k === 'close_link') return;
      if (!theme.text_styles[k]) theme.text_styles[k] = {};
    });
  } else {
    Object.keys(templateTexts).forEach(k => {
      if (k === 'styles' || k === 'submit_button' || k === 'close_link') return;
      theme.text_styles[k] = theme.text_styles[k] || {};
    });
  }
  delete theme.text_styles.submit_button;
  delete theme.text_styles.close_link;
}

