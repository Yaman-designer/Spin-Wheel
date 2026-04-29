import {
  applyTextStyles,
  getPrimarySubmitFieldStyle,
  mergePrimarySubmitFieldStyle,
} from '../utils/text-utils.js';
import {
  getCloseFormButtonElement,
  getPrimarySubmitButtonElement,
  isUnifiedPopupShellTheme,
} from '../utils/dom-utils.js';

export class TextEditorManager {
  constructor(themeManager) {
    this.themeManager = themeManager;

    this.textEditorState = {
      currentInput: null,
      currentInputName: null,
      currentPreviewElement: null,
      currentEditorElement: null
    };

    this.textInputMap = {
      'headline': {
        previewId: 'headline',
        icon: 'H',
        label: 'Headline'
      },
      'description': {
        previewId: 'description',
        icon: 'T',
        label: 'Description'
      },
      'disclaimer': {
        previewId: 'disclaimer',
        icon: 'D',
        label: 'Disclaimer'
      }
    };
  }

  get theme() {
    return this.themeManager.theme;
  }

  set theme(value) {
    this.themeManager.theme = value;
  }

  initialize() {
    const textInputs = document.querySelectorAll('.texts-input-container input, .texts-input-container textarea');
    textInputs.forEach(input => {
      input.setAttribute('readonly', 'readonly');
      input.style.cursor = 'pointer';
      input.style.backgroundColor = '#f8f9fa';
      
      input.addEventListener('click', (e) => {
        const inputRow = input.closest('.texts-input-row');
        if (inputRow && inputRow.nextElementSibling && inputRow.nextElementSibling.classList.contains('inline-text-editor')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.openTextEditor(input);
      });

      input.addEventListener('keydown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const inputRow = input.closest('.texts-input-row');
        if (!inputRow || !inputRow.nextElementSibling || !inputRow.nextElementSibling.classList.contains('inline-text-editor')) {
          this.openTextEditor(input);
        }
      });
      
      input.addEventListener('focus', (e) => {
        e.preventDefault();
        e.stopPropagation();
        input.blur();
        const inputRow = input.closest('.texts-input-row');
        if (!inputRow || !inputRow.nextElementSibling || !inputRow.nextElementSibling.classList.contains('inline-text-editor')) {
          this.openTextEditor(input);
        }
      });
    });

    this.setupPreviewClickListeners();
  }


  /**
   * `#additionalInputFields` yeniden çizildikten sonra çağrılır; çift listener önlenir.
   */
  bindInputFieldPreviewWidgets() {
    const submitPreview = getPrimarySubmitButtonElement();
    if (submitPreview && submitPreview.dataset.wheelTextPreviewBound !== '1') {
      submitPreview.dataset.wheelTextPreviewBound = '1';
      submitPreview.style.cursor = 'pointer';
      submitPreview.title = 'Open Input fields';
      submitPreview.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.themeManager?.inputFieldsManager?.openInputAccordionFromPreview();
      });
    }

    const closeWidget = getCloseFormButtonElement();
    if (closeWidget) {
      if (closeWidget.dataset.wheelTextPreviewBound !== '1') {
        closeWidget.dataset.wheelTextPreviewBound = '1';
        closeWidget.style.cursor = 'pointer';
        closeWidget.title = 'Open Input fields';
        closeWidget.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.themeManager?.inputFieldsManager?.openInputAccordionFromPreview();
        });
      }
      return;
    }

    if (isUnifiedPopupShellTheme(this.theme)) {
      return;
    }

    const closeLinkContainer = document.getElementById('close_link');
    if (closeLinkContainer) {
      const closeTextEl = closeLinkContainer.querySelector('.text');
      if (closeTextEl && closeTextEl.dataset.wheelTextPreviewBound !== '1') {
        closeTextEl.dataset.wheelTextPreviewBound = '1';
        closeTextEl.style.cursor = 'pointer';
        closeTextEl.title = 'Open Input fields';
        closeTextEl.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.themeManager?.inputFieldsManager?.openInputAccordionFromPreview();
        });
      }
    }
  }

  setupPreviewClickListeners() {
    const previewToInputMap = {
      headline: 'headline',
      description: 'description',
      disclaimer: 'disclaimer'
    };

    Object.keys(previewToInputMap).forEach((previewId) => {
      let previewElement = document.getElementById(previewId);

      if (previewId === 'headline') {
        const titleSpan = previewElement?.querySelector('span');
        if (titleSpan) {
          previewElement = titleSpan;
        }
      }

      if (previewElement) {
        if (previewElement.dataset.wheelluckPreviewTextBound === '1') {
          return;
        }
        previewElement.dataset.wheelluckPreviewTextBound = '1';
        previewElement.style.cursor = 'pointer';
        previewElement.title = 'Click to edit';
        previewElement.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openEditorFromPreview(previewToInputMap[previewId]);
        });
      }
    });

    this.bindInputFieldPreviewWidgets();
  }

  openEditorFromPreview(inputName) {

    const inputElement = document.querySelector(`input[name="${inputName}"], textarea[name="${inputName}"]`);
    if (!inputElement) return;

    const accordionButton = document.querySelector('.accordion-button[aria-controls="collapseText"]');
    const accordionContent = document.querySelector('#collapseText');
    
    if (accordionButton && accordionContent) {

      const collapseInstance = bootstrap.Collapse.getOrCreateInstance(accordionContent, {
        toggle: false
      });
      collapseInstance.show();
    }
    setTimeout(() => {
      const inputRow = inputElement.closest('.texts-input-row');
      if (inputRow) {
        inputRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      inputElement.setAttribute('readonly', 'readonly');
      this.openTextEditor(inputElement);
    }, 100);
  }

  getCurrentStyles(element) {
    if (!element) return {};
    
    const styles = window.getComputedStyle(element);
    const elementStyles = element.style;
    
    const result = {
      "font-family": elementStyles.fontFamily || styles.fontFamily.split(',')[0].replace(/['"]/g, ''),
      "font-size": elementStyles.fontSize || styles.fontSize,
      "text-align": elementStyles.textAlign || styles.textAlign,
      "font-weight": elementStyles.fontWeight || styles.fontWeight,
      "font-style": elementStyles.fontStyle || styles.fontStyle,
      "text-decoration": elementStyles.textDecoration || styles.textDecoration,
      "color": elementStyles.color || styles.color,
      "line-height": elementStyles.lineHeight || styles.lineHeight,
      "letter-spacing": elementStyles.letterSpacing || styles.letterSpacing
    };
    
    if (elementStyles.position) result["position"] = elementStyles.position;
    if (elementStyles.top) result["top"] = elementStyles.top;
    if (elementStyles.left) result.left = elementStyles.left;
    if (elementStyles.right) result.right = elementStyles.right;
    if (elementStyles.bottom) result.bottom = elementStyles.bottom;
    if (elementStyles.transform) result.transform = elementStyles.transform;
    if (elementStyles.zIndex) result.zIndex = elementStyles.zIndex;
    if (elementStyles.backgroundColor) result.backgroundColor = elementStyles.backgroundColor;
    if (elementStyles.padding) result.padding = elementStyles.padding;
    if (elementStyles.margin) result.margin = elementStyles.margin;
    if (elementStyles.width) result.width = elementStyles.width;
    if (elementStyles.height) result.height = elementStyles.height;
    if (elementStyles.alignItems) result.alignItems = elementStyles.alignItems;
    if (elementStyles.justifyContent) result.justifyContent = elementStyles.justifyContent;
    
    return result;
  }

  /**
   * Inline editörün ürettiği stiller (font, hizalama, renk, htmlContent) güncellenir;
   * şablondan gelen letter-spacing, line-height, margin, white-space vb. korunur.
   */
  mergePreservedTextFieldStyles(existing, editorStyles) {
    const base = existing && typeof existing === 'object' ? { ...existing } : {};
    const editor = editorStyles && typeof editorStyles === 'object' ? { ...editorStyles } : {};

    const editorControlledGroups = [
      ['fontFamily', 'font-family'],
      ['fontSize', 'font-size'],
      ['textAlign', 'text-align'],
      ['fontWeight', 'font-weight'],
      ['fontStyle', 'font-style'],
      ['textDecoration', 'text-decoration'],
      ['color'],
      ['htmlContent'],
    ];

    for (const group of editorControlledGroups) {
      const editorTouchesGroup = group.some((k) =>
        Object.prototype.hasOwnProperty.call(editor, k)
      );
      if (editorTouchesGroup) {
        group.forEach((k) => delete base[k]);
      }
    }

    const merged = { ...base, ...editor };

    if (merged.fontSize != null && String(merged.fontSize).trim() !== '') {
      merged['font-size'] = merged['font-size'] || merged.fontSize;
    }
    if (merged.fontFamily != null && String(merged.fontFamily).trim() !== '') {
      merged['font-family'] = merged['font-family'] || merged.fontFamily;
    }
    if (merged.textAlign != null && String(merged.textAlign).trim() !== '') {
      merged['text-align'] = merged['text-align'] || merged.textAlign;
    }
    if (merged.fontWeight != null && merged.fontWeight !== '') {
      merged['font-weight'] = merged['font-weight'] || merged.fontWeight;
    }
    if (merged.fontStyle != null && merged.fontStyle !== '') {
      merged['font-style'] = merged['font-style'] || merged.fontStyle;
    }
    if (merged.textDecoration != null && merged.textDecoration !== '') {
      merged['text-decoration'] = merged['text-decoration'] || merged.textDecoration;
    }

    return merged;
  }

  openTextEditor(inputElement) {
    const inputName = inputElement.getAttribute('name');
    const inputConfig = this.textInputMap[inputName];
    
    if (!inputConfig) return;
    
    let fullValue = inputElement.getAttribute('data-full-value');
    
    if (!fullValue) {
      const currentValue = inputElement.value || '';
      if (currentValue.endsWith('...')) {
        fullValue = currentValue;
      } else {
        fullValue = currentValue;
      }
      inputElement.setAttribute('data-full-value', fullValue);
    }

    this.closeTextEditor();

    this.textEditorState.currentInput = inputElement;
    this.textEditorState.currentInputName = inputName;

    let previewElement = null;
    if (inputConfig.previewId) {
      previewElement = document.getElementById(inputConfig.previewId);
    } else if (inputConfig.previewSelector) {
      previewElement = document.querySelector(inputConfig.previewSelector);
    }
    this.textEditorState.currentPreviewElement = previewElement;

    let currentValue = inputElement.getAttribute('data-full-value') || '';
    
    if (!currentValue) {
      const inputValue = inputElement.value || '';
      if (inputValue.endsWith('...')) {
        currentValue = inputValue.substring(0, inputValue.length - 3);
      } else {
        currentValue = inputValue;
      }
      inputElement.setAttribute('data-full-value', currentValue);
    }
    let currentStyles = {};
    if (this.theme.texts && this.theme.text_styles && this.theme.text_styles.hasOwnProperty(inputName)) {
      const savedStyles = this.theme.text_styles[inputName];
      if (savedStyles && Object.keys(savedStyles).length > 0) {
        currentStyles = savedStyles;
        if (currentStyles.fontFamily && !currentStyles["font-family"]) {
          currentStyles["font-family"] = currentStyles.fontFamily;
        } else if (currentStyles["font-family"] && !currentStyles.fontFamily) {
          currentStyles.fontFamily = currentStyles["font-family"];
        }
        if (currentStyles.fontSize && !currentStyles["font-size"]) {
          currentStyles["font-size"] = currentStyles.fontSize;
        } else if (currentStyles["font-size"] && !currentStyles.fontSize) {
          currentStyles.fontSize = currentStyles["font-size"];
        }
        if (currentStyles.textAlign && !currentStyles["text-align"]) {
          currentStyles["text-align"] = currentStyles.textAlign;
        } else if (currentStyles["text-align"] && !currentStyles.textAlign) {
          currentStyles.textAlign = currentStyles["text-align"];
        }
        if (currentStyles.fontWeight && !currentStyles["font-weight"]) {
          currentStyles["font-weight"] = currentStyles.fontWeight;
        } else if (currentStyles["font-weight"] && !currentStyles.fontWeight) {
          currentStyles.fontWeight = currentStyles["font-weight"];
        }
        if (currentStyles.fontStyle && !currentStyles["font-style"]) {
          currentStyles["font-style"] = currentStyles.fontStyle;
        } else if (currentStyles["font-style"] && !currentStyles.fontStyle) {
          currentStyles.fontStyle = currentStyles["font-style"];
        }
        if (currentStyles.textDecoration && !currentStyles["text-decoration"]) {
          currentStyles["text-decoration"] = currentStyles.textDecoration;
        } else if (currentStyles["text-decoration"] && !currentStyles.textDecoration) {
          currentStyles.textDecoration = currentStyles["text-decoration"];
        }
      } else {
        currentStyles = this.getCurrentStyles(previewElement);
      }
      
      if (inputName === 'submit_button') {
        const theme = this.themeManager?.theme || this.theme;
        let buttonTextColor = getPrimarySubmitFieldStyle(theme)?.color;
        if (buttonTextColor) {
          if (buttonTextColor.startsWith('#') && buttonTextColor.length === 9) {
            buttonTextColor = buttonTextColor.substring(0, 7);
          }
          currentStyles["color"] = buttonTextColor;
        }
      }
    } else {
      currentStyles = this.getCurrentStyles(previewElement);

      if (inputName === 'submit_button') {
        const theme = this.themeManager?.theme || this.theme;
        let buttonTextColor = getPrimarySubmitFieldStyle(theme)?.color;
        if (buttonTextColor) {
          if (buttonTextColor.startsWith('#') && buttonTextColor.length === 9) {
            buttonTextColor = buttonTextColor.substring(0, 7);
          }
          currentStyles["color"] = buttonTextColor;
        }
      }
    }

    const template = document.getElementById('inlineTextEditorTemplate');
    const editorClone = template.content.cloneNode(true);
    const editorElement = editorClone.querySelector('.inline-text-editor');

    const editorTextarea = editorElement.querySelector('.text-editor-textarea');
    
    editorTextarea.setAttribute('contenteditable', 'true');
    editorTextarea.setAttribute('spellcheck', 'true');
    editorTextarea.style.pointerEvents = 'auto';
    editorTextarea.style.userSelect = 'text';
    editorTextarea.style.webkitUserSelect = 'text';
    editorTextarea.style.mozUserSelect = 'text';
    editorTextarea.style.msUserSelect = 'text';
    editorTextarea.style.cursor = 'text';
    editorTextarea.style.outline = 'none';
    editorTextarea.removeAttribute('readonly');
    editorTextarea.removeAttribute('disabled');
    
    editorTextarea.style.maxHeight = 'none';
    editorTextarea.style.overflow = 'auto';
    editorTextarea.style.whiteSpace = 'pre-wrap';
    editorTextarea.style.webkitLineClamp = 'none';
    editorTextarea.style.display = 'block';
    
    if (currentValue) {
      if (currentStyles && currentStyles.htmlContent) {
        editorTextarea.innerHTML = currentStyles.htmlContent;
      } else {
        editorTextarea.textContent = currentValue;
        let escapedHtml = editorTextarea.innerHTML.replace(/\n/g, '<br>');
        
        const fontWeight = currentStyles?.["font-weight"] || currentStyles?.fontWeight;
        if (fontWeight && (fontWeight === 'bold' || parseInt(fontWeight) >= 600)) {
          escapedHtml = `<strong>${escapedHtml}</strong>`;
        }
        editorTextarea.innerHTML = escapedHtml;
      }
    } else {
      editorTextarea.innerHTML = '';
      editorTextarea.textContent = '';
    }
    
    if (!currentStyles["font-family"] && !currentStyles.fontFamily) {
      currentStyles["font-family"] = 'Arial';
    }
    if (!currentStyles["font-size"] && !currentStyles.fontSize) {
      currentStyles["font-size"] = '20px';
    }
    if (!currentStyles["text-align"] && !currentStyles.textAlign) {
      currentStyles["text-align"] = 'left';
    }
    
    const fontFamilySelect = editorElement.querySelector('.fontFamilySelect');
    const fontSizeInput = editorElement.querySelector('.fontSizeInput');
    
    if (fontFamilySelect) {
      let fontFamilyValue = currentStyles["font-family"] || currentStyles.fontFamily || 'Arial';
      if (fontFamilyValue) {
        fontFamilyValue = fontFamilyValue.replace(/^["']|["']$/g, '').trim();
      }
      
      const optionExists = Array.from(fontFamilySelect.options).some(
        option => {
          const optionValue = option.value.replace(/^["']|["']$/g, '').trim();
          const optionText = option.text.replace(/^["']|["']$/g, '').trim();
          return optionValue === fontFamilyValue || optionText === fontFamilyValue ||
                 optionValue.toLowerCase() === fontFamilyValue.toLowerCase() ||
                 optionText.toLowerCase() === fontFamilyValue.toLowerCase();
        }
      );
      
      if (optionExists) {
        const matchingOption = Array.from(fontFamilySelect.options).find(
          option => {
            const optionValue = option.value.replace(/^["']|["']$/g, '').trim();
            const optionText = option.text.replace(/^["']|["']$/g, '').trim();
            return optionValue === fontFamilyValue || optionText === fontFamilyValue ||
                   optionValue.toLowerCase() === fontFamilyValue.toLowerCase() ||
                   optionText.toLowerCase() === fontFamilyValue.toLowerCase();
          }
        );
        if (matchingOption) {
          fontFamilySelect.value = matchingOption.value;
          editorTextarea.style.fontFamily = matchingOption.value;
        }
      } else {
        const similarOption = Array.from(fontFamilySelect.options).find(
          option => {
            const optionValue = option.value.replace(/^["']|["']$/g, '').trim().toLowerCase();
            const optionText = option.text.replace(/^["']|["']$/g, '').trim().toLowerCase();
            const searchValue = fontFamilyValue.toLowerCase();
            return optionValue.includes(searchValue) || searchValue.includes(optionValue) ||
                   optionText.includes(searchValue) || searchValue.includes(optionText);
          }
        );
        if (similarOption) {
          fontFamilySelect.value = similarOption.value;
          editorTextarea.style.fontFamily = similarOption.value;
        } else {
          const newOption = document.createElement('option');
          newOption.value = fontFamilyValue;
          newOption.textContent = fontFamilyValue;
          fontFamilySelect.appendChild(newOption);
          fontFamilySelect.value = fontFamilyValue;
          editorTextarea.style.fontFamily = fontFamilyValue;
        }
      }
    } else {
      let fontFamilyValue = currentStyles["font-family"] || currentStyles.fontFamily || 'Arial';
      fontFamilyValue = fontFamilyValue.replace(/^["']|["']$/g, '').trim();
      editorTextarea.style.fontFamily = fontFamilyValue;
    }
    
    const fontSizeValue = currentStyles["font-size"] || currentStyles.fontSize || '20px';
    let fontSize = 20;
    if (fontSizeValue) {
      const fontSizeStr = fontSizeValue.toString().trim();
      const numericValue = parseFloat(fontSizeStr.replace(/px|rem|em|pt|%/gi, ''));
      if (!isNaN(numericValue) && numericValue > 0) {
        fontSize = Math.round(numericValue);
      }
    }
    fontSize = Math.max(5, fontSize);
    if (fontSizeInput) {
      fontSizeInput.value = fontSize;
    }
    
    editorTextarea.style.textAlign = currentStyles["text-align"] || currentStyles.textAlign || 'left';
    
    const textColorInput = editorElement.querySelector('.textColorInput');
    const textColorUnderline = editorElement.querySelector('.textColorUnderline');
    if (textColorInput && textColorUnderline) {
      let colorValue = null;
      
      if (inputName === 'submit_button') {
        const theme = this.themeManager?.theme || this.theme;
        colorValue = getPrimarySubmitFieldStyle(theme)?.color;
        if (colorValue && colorValue.startsWith('#') && colorValue.length === 9) {
          colorValue = colorValue.substring(0, 7);
        }
      } else {
        colorValue = currentStyles["color"] || currentStyles.color;
        if ((!colorValue || colorValue === 'rgba(0, 0, 0, 0)' || colorValue === 'transparent' || colorValue === 'rgb(0, 0, 0)') && previewElement) {
          const inlineColor = previewElement.style.color;
          const computedColor = window.getComputedStyle(previewElement).color;
          colorValue = inlineColor || computedColor;
        }
      }
      
      if (colorValue && colorValue !== 'rgba(0, 0, 0, 0)' && colorValue !== 'transparent') {
        let colorHex = colorValue;
        if (colorHex.startsWith('#') && colorHex.length === 9) {
          colorHex = colorHex.substring(0, 7);
        }
        if (colorHex.startsWith('rgb')) {
          const rgb = colorHex.match(/\d+/g);
          if (rgb && rgb.length >= 3) {
            colorHex = '#' + rgb.slice(0, 3).map(x => {
              const hex = parseInt(x).toString(16);
              return hex.length === 1 ? '0' + hex : hex;
            }).join('');
          }
        }
        if (!colorHex.startsWith('#') && !colorHex.startsWith('rgb')) {
          colorHex = colorValue;
        }
        textColorInput.value = colorHex;
        textColorUnderline.style.setProperty('border-bottom-color', colorHex, 'important');
      } else {
        textColorInput.value = '';
        textColorUnderline.style.removeProperty('border-bottom-color');
      }
    }
    
    const alignment = currentStyles["text-align"] || currentStyles.textAlign || 'left';
    setTimeout(() => {
      this.updateAlignmentButtons(alignment, editorElement);
    }, 50);
    
    const fontWeight = currentStyles["font-weight"] || currentStyles.fontWeight;
    if (fontWeight && fontWeight !== 'normal' && fontWeight !== '400') {
      editorTextarea.style.fontWeight = fontWeight;
    }
    const fontStyle = currentStyles["font-style"] || currentStyles.fontStyle;
    if (fontStyle && fontStyle !== 'normal') {
      editorTextarea.style.fontStyle = fontStyle;
    }
    const textDecoration = currentStyles["text-decoration"] || currentStyles.textDecoration;
    if (textDecoration && textDecoration === 'underline') {
      editorTextarea.style.textDecoration = 'underline';
    } else if (textDecoration && textDecoration === 'line-through') {
      const text = editorTextarea.textContent || editorTextarea.innerText;
      if (text && !/<(s|strike)[^>]*>/i.test(editorTextarea.innerHTML)) {
        editorTextarea.innerHTML = `<s>${text}</s>`;
      }
    }
    
    editorElement.setAttribute('data-saved-styles', JSON.stringify(currentStyles));

    const inputRow = inputElement.closest('.texts-input-row');
    if (inputRow) {
      inputRow.parentNode.insertBefore(editorElement, inputRow.nextSibling);
    } else {
      inputElement.parentNode.insertBefore(editorElement, inputElement.nextSibling);
    }

    this.textEditorState.currentEditorElement = editorElement;

    this.setupEditorControls(editorElement, currentStyles);
  }

  closeTextEditor() {
    const editorElement = this.textEditorState.currentEditorElement;
    const inputElement = this.textEditorState.currentInput;
    
    if (this.textEditorState.pickers && this.textEditorState.pickers.length > 0) {
      this.textEditorState.pickers.forEach(picker => {
        if (picker && picker.destroy) {
          try {
            picker.destroy();
          } catch (e) {
            // Ignore
          }
        }
      });
      this.textEditorState.pickers = [];
    }
    
    if (this.textEditorState.pickerObservers && this.textEditorState.pickerObservers.length > 0) {
      this.textEditorState.pickerObservers.forEach(observer => {
        if (observer && observer.disconnect) {
          observer.disconnect();
        }
      });
      this.textEditorState.pickerObservers = [];
    }
    
    if (editorElement) {
      editorElement.remove();
    }
    
    if (inputElement) {
      inputElement.setAttribute('readonly', 'readonly');
    }
    
    this.textEditorState.currentInput = null;
    this.textEditorState.currentInputName = null;
    this.textEditorState.currentPreviewElement = null;
    this.textEditorState.currentEditorElement = null;
  }

  setupEditorControls(editorElement, savedStyles = {}) {
    const editorTextarea = editorElement.querySelector('.text-editor-textarea');
    const fontFamilySelect = editorElement.querySelector('.fontFamilySelect');
    const fontSizeInput = editorElement.querySelector('.fontSizeInput');
    
    if (fontFamilySelect) {
      this.applyFontStylesToOptions(fontFamilySelect);
    }

    editorElement.querySelectorAll('.toolbar-btn[data-command]').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const editorTextarea = editorElement.querySelector('.text-editor-textarea');
        if (editorTextarea && document.activeElement !== editorTextarea) {
          editorTextarea.focus();
        }
        
        const command = newBtn.getAttribute('data-command');
        if (command) {
          this.executeFormatCommand(command, newBtn, editorElement);
        }
      });
    });

    if (fontFamilySelect) {
      fontFamilySelect.addEventListener('change', (e) => {
        editorTextarea.style.fontFamily = e.target.value;
        this.updatePreviewRealTime(editorElement);
      });
    }

    fontSizeInput.addEventListener('input', (e) => {
      let size = parseInt(e.target.value);
      if (isNaN(size) || size < 5) {
        size = 5;
      }
      size = Math.max(5, size);
      e.target.value = size;
      this.updatePreviewRealTime(editorElement);
    });
    
    fontSizeInput.addEventListener('blur', (e) => {
      let size = parseInt(e.target.value);
      if (isNaN(size) || size < 5) {
        size = 5;
      }
      size = Math.max(5, size);
      e.target.value = size;
      this.updatePreviewRealTime(editorElement);
    });

    const textColorInput = editorElement.querySelector('.textColorInput');
    const textColorBox = editorElement.querySelector('.textColorBox');
    const textColorUnderline = editorElement.querySelector('.textColorUnderline');
    
    if (textColorInput && textColorBox && textColorUnderline) {
      const editorId = 'textEditor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      textColorBox.id = 'textColorBox_' + editorId;
      textColorInput.id = 'textColorInput_' + editorId;
      
      const inputName = this.textEditorState.currentInputName;
      let initialColor = (textColorInput.value || savedStyles.color || '').trim();
      if (!/^#[0-9A-Fa-f]{3,8}$/i.test(initialColor)) {
        initialColor = '';
      }

      if (inputName === 'submit_button') {
        const theme = this.themeManager?.theme || this.theme;
        const btnColor = getPrimarySubmitFieldStyle(theme)?.color;
        if (btnColor && String(btnColor).trim()) {
          initialColor = String(btnColor).trim();
          if (initialColor.startsWith('#') && initialColor.length === 9) {
            initialColor = initialColor.substring(0, 7);
          }
        }
      }

      const pickerUiColor = initialColor || '#9ca3af';
      textColorInput.value = initialColor;
      if (initialColor) {
        textColorUnderline.style.setProperty('border-bottom-color', initialColor, 'important');
      } else {
        textColorUnderline.style.removeProperty('border-bottom-color');
      }

      if (typeof Picker !== 'undefined' || (typeof global !== 'undefined' && global.Picker) || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
        const picker = new Picker({
          parent: textColorBox,
          popup: 'bottom',
          color: pickerUiColor,
          alpha: false,
          onChange: (color) => {
            const colorHex = color.hex;
            textColorUnderline.style.setProperty('border-bottom-color', colorHex, 'important');
            textColorInput.value = colorHex;
            
            const editorTextarea = editorElement.querySelector('.text-editor-textarea');
            if (editorTextarea) {
              const selection = window.getSelection();
              let savedRange = null;
              if (selection.rangeCount > 0) {
                try {
                  const range = selection.getRangeAt(0);
                  if (range.commonAncestorContainer && editorTextarea.contains(
                    range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
                      ? range.commonAncestorContainer.parentElement 
                      : range.commonAncestorContainer
                  )) {
                    savedRange = range.cloneRange();
                  }
                } catch (e) {
                  // Ignore
                }
              }
              
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = editorTextarea.innerHTML;
              const colorSpans = tempDiv.querySelectorAll('span[style*="color"], span[style*="Color"]');
              colorSpans.forEach(span => {
                const parent = span.parentNode;
                if (parent) {
                  while (span.firstChild) {
                    parent.insertBefore(span.firstChild, span);
                  }
                  parent.removeChild(span);
                }
              });
              
              if (tempDiv.innerHTML !== editorTextarea.innerHTML) {
                editorTextarea.innerHTML = tempDiv.innerHTML;
                
                if (savedRange) {
                  try {
                    selection.removeAllRanges();
                    selection.addRange(savedRange);
                  } catch (e) {
                    // Ignore cursor restore errors
                  }
                }
              }
            }
            
            this.updatePreviewRealTime(editorElement);
          }
        });
        
        if (inputName === 'submit_button') {
          setTimeout(() => {
            const theme = this.themeManager?.theme || this.theme;
            let correctColor = getPrimarySubmitFieldStyle(theme)?.color;
            if (correctColor) {
              if (correctColor.startsWith('#') && correctColor.length === 9) {
                correctColor = correctColor.substring(0, 7);
              }
              if (picker && picker.setColor) {
                picker.setColor(correctColor, false);
              }
              textColorInput.value = correctColor;
              textColorUnderline.style.setProperty('border-bottom-color', correctColor, 'important');
            }
          }, 150);
        }
        
        const setupPickerEvents = () => {
          if (picker && picker.domElement) {
            const pickerElement = picker.domElement;
            
            const stopAllEvents = (e) => {
              e.stopPropagation();
              e.stopImmediatePropagation();
            };
            
            ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'pointerdown', 'pointerup'].forEach(eventType => {
              pickerElement.addEventListener(eventType, stopAllEvents, { capture: true, passive: false });
            });
            
            const observer = new MutationObserver(() => {
              const allElements = pickerElement.querySelectorAll('*');
              allElements.forEach(element => {
                ['mousedown', 'mouseup', 'click'].forEach(eventType => {
                  element.addEventListener(eventType, (e) => {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                  }, { capture: true, passive: false });
                });
              });
            });
            
            observer.observe(pickerElement, {
              childList: true,
              subtree: true
            });
            
            if (!this.textEditorState.pickerObservers) {
              this.textEditorState.pickerObservers = [];
            }
            this.textEditorState.pickerObservers.push(observer);
          }
        };
        
        setTimeout(setupPickerEvents, 100);
        setTimeout(setupPickerEvents, 300);
        
        if (!this.textEditorState.pickers) {
          this.textEditorState.pickers = [];
        }
        this.textEditorState.pickers.push(picker);
        
        editorTextarea.addEventListener('mouseup', () => {
          setTimeout(() => {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              if (!range.collapsed) {
                const container = range.commonAncestorContainer;
                const element = container.nodeType === Node.TEXT_NODE 
                  ? container.parentElement 
                  : container;
                if (element) {
                  const computedColor = window.getComputedStyle(element).color;
                  if (computedColor && computedColor !== 'rgb(0, 0, 0)') {
                    const rgb = computedColor.match(/\d+/g);
                    if (rgb && rgb.length === 3) {
                      const hex = '#' + rgb.map(x => {
                        const hex = parseInt(x).toString(16);
                        return hex.length === 1 ? '0' + hex : hex;
                      }).join('');
                      textColorInput.value = hex;
                      const textColorUnderline = editorElement.querySelector('.textColorUnderline');
                      if (textColorUnderline) {
                        textColorUnderline.style.setProperty('border-bottom-color', hex, 'important');
                      }
                      if (picker && picker.setColor) {
                        picker.setColor(hex);
                      }
                    }
                  }
                }
              }
            }
          }, 10);
        });
      }
    }

    editorTextarea.addEventListener('click', (e) => {
      if (document.activeElement !== editorTextarea) {
        editorTextarea.focus();
      }
      e.stopPropagation();
    });
    
    editorTextarea.addEventListener('focus', () => {
      editorTextarea.setAttribute('contenteditable', 'true');
      editorTextarea.style.pointerEvents = 'auto';
      editorTextarea.style.userSelect = 'text';
    });
    
    editorTextarea.addEventListener('input', (e) => {
      const text = editorTextarea.textContent || editorTextarea.innerText || '';
      if (text && text.length > 100) {
        const truncated = text.substring(0, 100);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = editorTextarea.innerHTML;
        const plainText = tempDiv.textContent || tempDiv.innerText;
        if (plainText.length > 100) {
          let charCount = 0;
          let cutPosition = 0;
          const walker = document.createTreeWalker(
            tempDiv,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          let node;
          while (node = walker.nextNode()) {
            const nodeLength = node.textContent.length;
            if (charCount + nodeLength > 100) {
              node.textContent = node.textContent.substring(0, 100 - charCount);
              let nextNode = node.nextSibling;
              while (nextNode) {
                const toRemove = nextNode;
                nextNode = nextNode.nextSibling;
                toRemove.remove();
              }
              break;
            }
            charCount += nodeLength;
          }
          editorTextarea.innerHTML = tempDiv.innerHTML;
        }
      }
      this.updatePreviewRealTime(editorElement);
    });

    editorTextarea.addEventListener('keyup', () => {
      this.updateFormatButtonStates(editorElement);
      this.updatePreviewRealTime(editorElement);
    });

    editorTextarea.addEventListener('mouseup', () => {
      setTimeout(() => {
        this.updateFormatButtonStates(editorElement);
      }, 10);
    });
    
    if (savedStyles && Object.keys(savedStyles).length > 0) {
      this.updateFormatButtonStatesFromStyles(editorElement, savedStyles);
      setTimeout(() => {
        this.updateFormatButtonStatesFromStyles(editorElement, savedStyles);
      }, 150);
    }

    editorTextarea.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text');
      const currentText = editorTextarea.textContent || editorTextarea.innerText;
      const selection = window.getSelection();
      let start = 0;
      let end = 0;
      
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        start = range.startOffset;
        end = range.endOffset;
      }
      
      const beforeText = currentText.substring(0, start);
      const afterText = currentText.substring(end);
      const newText = beforeText + paste + afterText;
      
      if (newText.length > 100) {
        const maxLength = 100;
        const availableLength = maxLength - beforeText.length - afterText.length;
        if (availableLength > 0) {
          const truncatedPaste = paste.substring(0, availableLength);
          const finalText = beforeText + truncatedPaste + afterText;
          
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(truncatedPaste);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } else {
          return;
        }
      } else {
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(paste);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      
      this.updatePreviewRealTime(editorElement);
    });

    editorTextarea.addEventListener('keydown', (e) => {
      if (!e.ctrlKey && !e.metaKey && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && !e.key.startsWith('Arrow') && e.key !== 'Tab') {
        const currentText = editorTextarea.textContent || editorTextarea.innerText;
        if (currentText.length >= 100) {
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (range.collapsed) {
              e.preventDefault();
              return;
            }
          } else {
            e.preventDefault();
            return;
          }
        }
      }
      
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') {
          e.preventDefault();
          this.executeFormatCommand('bold', editorElement.querySelector('[data-command="bold"]'), editorElement);
          this.updatePreviewRealTime(editorElement);
        } else if (e.key === 'i') {
          e.preventDefault();
          this.executeFormatCommand('italic', editorElement.querySelector('[data-command="italic"]'), editorElement);
          this.updatePreviewRealTime(editorElement);
        } else if (e.key === 'u') {
          e.preventDefault();
          this.executeFormatCommand('underline', editorElement.querySelector('[data-command="underline"]'), editorElement);
          this.updatePreviewRealTime(editorElement);
        }
      }
    });

    editorTextarea.setAttribute('contenteditable', 'true');
    editorTextarea.setAttribute('spellcheck', 'true');
    editorTextarea.style.pointerEvents = 'auto';
    editorTextarea.style.userSelect = 'text';
    editorTextarea.style.cursor = 'text';
    editorTextarea.style.outline = 'none';
    
    setTimeout(() => {
      editorTextarea.focus();
      try {
        const range = document.createRange();
        const selection = window.getSelection();
        
        if (editorTextarea.isConnected && editorTextarea.parentNode) {
          if (editorTextarea.childNodes.length > 0) {
            range.selectNodeContents(editorTextarea);
            range.collapse(false);
          } else {
            range.setStart(editorTextarea, 0);
            range.setEnd(editorTextarea, 0);
          }
          
          if (range.startContainer && range.startContainer.isConnected) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      } catch (e) {
        editorTextarea.focus();
      }
    }, 100);
  }

  updatePreviewRealTime(editorElement) {
    const editorTextarea = editorElement.querySelector('.text-editor-textarea');
    const inputElement = this.textEditorState.currentInput;
    const previewElement = this.textEditorState.currentPreviewElement;
    
    if (!inputElement || !editorTextarea) return;

    let content = editorTextarea.innerText || editorTextarea.textContent;
    let htmlContent = editorTextarea.innerHTML;
    
    if (content.length > 100) {
      content = content.substring(0, 100);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      const plainText = tempDiv.textContent || tempDiv.innerText;
      if (plainText.length > 100) {
        let charCount = 0;
        const walker = document.createTreeWalker(
          tempDiv,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        let node;
        while (node = walker.nextNode()) {
            const nodeLength = node.textContent.length;
            if (charCount + nodeLength > 100) {
              node.textContent = node.textContent.substring(0, 100 - charCount);
              let nextNode = node.nextSibling;
            while (nextNode) {
              const toRemove = nextNode;
              nextNode = nextNode.nextSibling;
              toRemove.remove();
            }
            break;
          }
          charCount += nodeLength;
        }
        htmlContent = tempDiv.innerHTML;
        editorTextarea.innerHTML = htmlContent;
      }
    }
    
    let cleanHtml = htmlContent
      .replace(/<div[^>]*>/gi, '<br>')
      .replace(/<\/div>/gi, '')
      .replace(/<br\s*\/?>/gi, '<br>')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '<br>');
    
    cleanHtml = cleanHtml.replace(/(<br\s*\/?>){2,}/gi, '<br>');
    
    const fontFamilySelect = editorElement.querySelector('.fontFamilySelect');
    let fontFamily = editorTextarea.style.fontFamily || 
                     (fontFamilySelect ? fontFamilySelect.value : 'Arial');
    
    // Normalize font-family: çift tırnakları temizle ve tutarlı formatta kaydet
    if (fontFamily) {
      fontFamily = fontFamily.replace(/^["']|["']$/g, '').trim();
    }
    if (!fontFamily) {
      fontFamily = 'Arial';
    }
    
    let safeHtml = cleanHtml
      .replace(/<div>/gi, '<br>')
      .replace(/<\/div>/gi, '')
      .replace(/<p>/gi, '')
      .replace(/<\/p>/gi, '<br>')
      .replace(/<br\s*\/?>/gi, '<br>');
    
    safeHtml = safeHtml.replace(/<(?!\/?(strong|b|em|i|u|s|strike|br)\b)[^>]*>/gi, '');
    
    const tempSpanDiv = document.createElement('div');
    tempSpanDiv.innerHTML = safeHtml;
    const allSpans = tempSpanDiv.querySelectorAll('span');
    allSpans.forEach(span => {
      const parent = span.parentNode;
      if (parent) {
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
      }
    });
    safeHtml = tempSpanDiv.innerHTML;
    
    if (editorTextarea) {
      const textareaCleanDiv = document.createElement('div');
      textareaCleanDiv.innerHTML = editorTextarea.innerHTML;
      const textareaSpans = textareaCleanDiv.querySelectorAll('span');
      textareaSpans.forEach(span => {
        const parent = span.parentNode;
        if (parent) {
          while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
          }
          parent.removeChild(span);
        }
      });
      if (textareaCleanDiv.innerHTML !== editorTextarea.innerHTML) {
        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
        editorTextarea.innerHTML = textareaCleanDiv.innerHTML;
        if (range) {
          try {
            selection.removeAllRanges();
            selection.addRange(range);
          } catch (e) {
            // Ignore
          }
        }
      }
    }
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = safeHtml;
    const hasBold = tempDiv.querySelector('strong, b') !== null;
    const hasItalic = tempDiv.querySelector('em, i') !== null;
    const hasUnderline = tempDiv.querySelector('u') !== null;
    const hasStrikethrough = tempDiv.querySelector('s, strike') !== null;
    
    const fontSizeInput = editorElement.querySelector('.fontSizeInput');
    let fontSizeNum = fontSizeInput ? parseInt(fontSizeInput.value) : 20;
    if (isNaN(fontSizeNum) || fontSizeNum < 5) {
      fontSizeNum = 5;
    }
    const fontSizeValue = fontSizeNum + 'px';
    
    const textColorInput = editorElement.querySelector('.textColorInput');
    let textColor = '';
    if (textColorInput) {
      textColor = textColorInput.value;
    } else if (editorTextarea.style.color) {
      textColor = editorTextarea.style.color;
    }
    
    let finalHtmlContent = safeHtml || content;
    if (finalHtmlContent && typeof finalHtmlContent === 'string') {
      finalHtmlContent = finalHtmlContent.replace(/\n/g, '<br>');
    }
    
    const styles = {
      fontFamily: fontFamily,
      'font-family': fontFamily,
      fontSize: fontSizeValue,
      textAlign: editorTextarea.style.textAlign || 'left',
      fontWeight: hasBold ? 'bold' : 'normal',
      fontStyle: hasItalic ? 'italic' : 'normal',
      textDecoration: hasUnderline ? 'underline' : (hasStrikethrough ? 'line-through' : 'none'),
      color: textColor || ''
    };
    
    const currentInputName = this.textEditorState.currentInputName;
    if (currentInputName !== 'submit_button') {
      styles.htmlContent = finalHtmlContent;
    }

    inputElement.setAttribute('data-full-value', content);
    inputElement.value = content;
    inputElement.setAttribute('readonly', 'readonly');

    let previewHtml = null;
    if (previewElement) {
      let cleanHtmlWithBreaks = cleanHtml.replace(/\n/g, '<br>');
      
      previewHtml = cleanHtmlWithBreaks
        .replace(/<(?!\/?(strong|b|em|i|u|s|strike|br|span)\b)[^>]*>/gi, '')
        .replace(/<br\s*\/?>/gi, '<br>');
      
      previewHtml = previewHtml.replace(/\n/g, '<br>');
      
      if (styles.color) {
        const tempPreviewDiv = document.createElement('div');
        tempPreviewDiv.innerHTML = previewHtml;
        const colorSpans = tempPreviewDiv.querySelectorAll('span[style*="color"], span[style*="Color"]');
        colorSpans.forEach(span => {
          const parent = span.parentNode;
          if (parent) {
            while (span.firstChild) {
              parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
          }
        });
        previewHtml = tempPreviewDiv.innerHTML;
      }
      
      previewElement.innerHTML = previewHtml || content.replace(/\n/g, '<br>');
      previewElement.style.fontFamily = styles.fontFamily;
      previewElement.style.setProperty('font-size', styles.fontSize, 'important');
      previewElement.style.textAlign = styles.textAlign;
      if (styles.color) {
        previewElement.style.setProperty('color', styles.color, 'important');
      } else {
        previewElement.style.removeProperty('color');
      }
    }

    const inputName = this.textEditorState.currentInputName;
    if (inputName) {
      {
        if (!this.theme.texts) this.theme.texts = {};
        if (!this.theme.text_styles) this.theme.text_styles = {};
        
        let mergedFieldStyles;

        if (inputName === 'submit_button') {
          const theme = this.themeManager?.theme || this.theme;
          const existingFieldStyles = getPrimarySubmitFieldStyle(theme) || {};
          const stylesWithoutColor = { ...styles };
          delete stylesWithoutColor.color;
          mergedFieldStyles = this.mergePreservedTextFieldStyles(
            existingFieldStyles,
            stylesWithoutColor
          );
          const patch = { ...mergedFieldStyles };
          if (styles.color) {
            patch.color = styles.color;
          }
          mergePrimarySubmitFieldStyle(theme, patch);
          mergedFieldStyles = getPrimarySubmitFieldStyle(theme) || patch;
        } else {
          const existingFieldStyles = this.theme.text_styles[inputName] || {};
          mergedFieldStyles = this.mergePreservedTextFieldStyles(
            existingFieldStyles,
            styles
          );
          this.theme.text_styles[inputName] = mergedFieldStyles;
        }

        const textContent = content;
        this.updatePopupPreviewElement(inputName, mergedFieldStyles, textContent);
      }
    }
  }

  updatePopupPreviewElement(inputName, styles, content) {
    const inputMap = this.textInputMap[inputName];
    if (!inputMap) {
      return;
    }
    
    let popupElement = null;
    
    if (inputMap.previewId) {
      if (inputMap.previewId === 'headline') {
        popupElement = document.querySelector(`#${inputMap.previewId} span`) || document.getElementById(inputMap.previewId);
      } else {
        popupElement = document.getElementById(inputMap.previewId);
      }
    } else if (inputMap.previewSelector) {
      popupElement = document.querySelector(inputMap.previewSelector);
    }
    
    if (!popupElement) {
      return;
    }
    
    applyTextStyles(popupElement, styles);
    
    if (content !== undefined && content !== null) {
      if (inputMap.previewId === 'headline') {
        const titleSpan = popupElement.querySelector('span') || popupElement;
        if (titleSpan) {
          titleSpan.textContent = content;
        }
      } else {
        popupElement.textContent = content;
      }
    }
  }

  executeFormatCommand(command, button, editorElement, colorValue = null) {
    const editorTextarea = editorElement.querySelector('.text-editor-textarea');
    
    if (command !== 'foreColor' && document.activeElement !== editorTextarea) {
      editorTextarea.focus();
    }
    
    if (command.startsWith('justify')) {
      let alignment = 'left';
      if (command === 'justifyCenter') alignment = 'center';
      else if (command === 'justifyRight') alignment = 'right';
      
      editorTextarea.style.textAlign = alignment;
      this.updateAlignmentButtons(alignment, editorElement);
      this.updatePreviewRealTime(editorElement);
      return;
    }
    
    if (command === 'foreColor' && colorValue) {
      const selection = window.getSelection();
      let savedRange = null;
      
      if (selection.rangeCount > 0) {
        try {
          const range = selection.getRangeAt(0);
          const container = range.commonAncestorContainer;
          const isWithinEditor = editorTextarea.contains(
            container.nodeType === Node.TEXT_NODE ? container.parentElement : container
          );
          
          if (isWithinEditor && !range.collapsed) {
            savedRange = range.cloneRange();
          }
        } catch (e) {
          // Ignore
        }
      }
      
      if (savedRange && !savedRange.collapsed) {
        try {
          const range = savedRange.cloneRange();
          const contents = range.extractContents();
          const span = document.createElement('span');
          span.style.color = colorValue;
          
          if (contents.childNodes.length > 0) {
            span.appendChild(contents);
          } else {
            span.textContent = range.toString();
          }
          
          range.insertNode(span);
          
          this.updatePreviewRealTime(editorElement);
        } catch (e) {
          // Ignore
        }
      } else {
        const currentHTML = editorTextarea.innerHTML;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentHTML;
        
        const walker = document.createTreeWalker(
          tempDiv,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent.trim()) {
            textNodes.push(node);
          }
        }
        
        textNodes.reverse().forEach(textNode => {
          const span = document.createElement('span');
          span.style.color = colorValue;
          const textContent = textNode.textContent;
          const parent = textNode.parentNode;
          if (parent) {
            parent.replaceChild(span, textNode);
            span.textContent = textContent;
          }
        });
        
        editorTextarea.innerHTML = tempDiv.innerHTML;
        
        this.updatePreviewRealTime(editorElement);
      }
      
      return;
    }

    const selection = window.getSelection();
    let savedRange = null;
    if (selection.rangeCount > 0) {
      try {
        const currentRange = selection.getRangeAt(0);
        // Check if range is still valid
        if (currentRange.startContainer && currentRange.startContainer.isConnected) {
          savedRange = currentRange.cloneRange();
        }
      } catch (e) {
        // Ignore
      }
    }
    
    if (!savedRange || savedRange.collapsed) {
      try {
        if (editorTextarea.isConnected && editorTextarea.parentNode) {
          const range = document.createRange();
          if (editorTextarea.childNodes.length > 0) {
            range.selectNodeContents(editorTextarea);
          } else {
            range.setStart(editorTextarea, 0);
            range.setEnd(editorTextarea, 0);
          }
          
          if (range.startContainer && range.startContainer.isConnected) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      } catch (e) {
        return;
      }
    }
    
    try {
      document.execCommand(command, false, null);
    } catch (e) {
      // Ignore
    }
    
    if (savedRange && !savedRange.collapsed && savedRange.startContainer && savedRange.startContainer.isConnected) {
      try {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      } catch (e) {
        selection.removeAllRanges();
      }
    } else {
      selection.removeAllRanges();
    }
    
    setTimeout(() => {
      const isActive = document.queryCommandState(command);
      if (isActive) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
      
      this.updateFormatButtonStates(editorElement);
      this.updatePreviewRealTime(editorElement);
    }, 10);
  }

  updateAlignmentButtons(alignment, editorElement) {
    editorElement.querySelectorAll('.toolbar-btn[data-command^="justify"]').forEach(btn => {
      btn.classList.remove('active');
    });
    
    let activeBtn = null;
    if (alignment === 'left') activeBtn = editorElement.querySelector('[data-command="justifyLeft"]');
    else if (alignment === 'center') activeBtn = editorElement.querySelector('[data-command="justifyCenter"]');
    else if (alignment === 'right') activeBtn = editorElement.querySelector('[data-command="justifyRight"]');
    
    if (activeBtn) activeBtn.classList.add('active');
  }

  updateFormatButtonStates(editorElement) {
    const editorTextarea = editorElement.querySelector('.text-editor-textarea');
    if (!editorTextarea || !editorTextarea.isConnected) return;
    
    if (document.activeElement !== editorTextarea) {
      return;
    }
    
    const selection = window.getSelection();
    let savedRange = null;
    if (selection.rangeCount > 0) {
      try {
        const currentRange = selection.getRangeAt(0);
        if (currentRange.startContainer && currentRange.startContainer.isConnected) {
          savedRange = currentRange.cloneRange();
        }
      } catch (e) {
        // Ignore
      }
    }
    
    if (!savedRange || savedRange.collapsed) {
      return;
    }
    
    const commands = ['bold', 'italic', 'underline', 'strikeThrough'];
    commands.forEach(cmd => {
      const btn = editorElement.querySelector(`[data-command="${cmd}"]`);
      if (btn) {
        try {
          const isActive = document.queryCommandState(cmd);
          if (isActive) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        } catch (e) {
          const htmlContent = editorTextarea.innerHTML;
          let hasFormat = false;
          
          if (cmd === 'bold') {
            hasFormat = /<(strong|b)[\s>]/.test(htmlContent);
          } else if (cmd === 'italic') {
            hasFormat = /<(em|i)[\s>]/.test(htmlContent);
          } else if (cmd === 'underline') {
            hasFormat = /<u[\s>]/.test(htmlContent);
          } else if (cmd === 'strikeThrough') {
            hasFormat = /<(s|strike)[\s>]/.test(htmlContent);
          }
          
          if (hasFormat) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        }
      }
    });
    
    if (savedRange && !savedRange.collapsed) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    } else {
      selection.removeAllRanges();
    }
  }

  updateFormatButtonStatesFromStyles(editorElement, styles) {
    const editorTextarea = editorElement.querySelector('.text-editor-textarea');
    if (!editorTextarea || !styles) return;
    
    editorElement.querySelectorAll('.toolbar-btn[data-command]').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const htmlContent = editorTextarea.innerHTML || '';
    const hasBoldInHTML = /<(strong|b)[^>]*>/i.test(htmlContent);
    const hasItalicInHTML = /<(em|i)[^>]*>/i.test(htmlContent);
    const hasUnderlineInHTML = /<u[^>]*>/i.test(htmlContent);
    const hasStrikethroughInHTML = /<(s|strike)[^>]*>/i.test(htmlContent);
    
    const fontWeight = styles["font-weight"] || styles.fontWeight;
    const fontStyle = styles["font-style"] || styles.fontStyle;
    const textDecoration = styles["text-decoration"] || styles.textDecoration;
    const hasBoldInStyles = fontWeight && (fontWeight === 'bold' || parseInt(fontWeight) >= 600);
    const hasItalicInStyles = fontStyle === 'italic';
    const hasUnderlineInStyles = textDecoration === 'underline';
    const hasStrikethroughInStyles = false;
    
    let hasBoldCommand = false;
    let hasItalicCommand = false;
    let hasUnderlineCommand = false;
    let hasStrikethroughCommand = false;
    
    try {
      const range = document.createRange();
      if (editorTextarea.firstChild) {
        range.selectNodeContents(editorTextarea);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        hasBoldCommand = document.queryCommandState('bold');
        hasItalicCommand = document.queryCommandState('italic');
        hasUnderlineCommand = document.queryCommandState('underline');
        hasStrikethroughCommand = document.queryCommandState('strikeThrough');
        
        selection.removeAllRanges();
      }
    } catch (e) {
      // Ignore
    }
    
    const boldBtn = editorElement.querySelector('[data-command="bold"]');
    const italicBtn = editorElement.querySelector('[data-command="italic"]');
    const underlineBtn = editorElement.querySelector('[data-command="underline"]');
    const strikeBtn = editorElement.querySelector('[data-command="strikeThrough"]');
    
    if (boldBtn && (hasBoldInHTML || hasBoldInStyles || hasBoldCommand)) {
      boldBtn.classList.add('active');
    }
    if (italicBtn && (hasItalicInHTML || hasItalicInStyles || hasItalicCommand)) {
      italicBtn.classList.add('active');
    }
    if (underlineBtn && (hasUnderlineInHTML || hasUnderlineInStyles || hasUnderlineCommand)) {
      underlineBtn.classList.add('active');
    }
    if (strikeBtn && (hasStrikethroughInHTML || hasStrikethroughCommand)) {
      strikeBtn.classList.add('active');
    }
    
    if (styles.textAlign) {
      this.updateAlignmentButtons(styles.textAlign, editorElement);
    }
  }

  applyFontStylesToOptions(selectElement) {
    if (!selectElement) return;
    
    Array.from(selectElement.options).forEach(option => {
      const fontName = option.value;
      if (fontName && fontName.trim()) {
        let cssFontName = fontName.trim();
        if (cssFontName.includes(' ') && !cssFontName.startsWith("'") && !cssFontName.startsWith('"')) {
          cssFontName = `'${cssFontName}'`;
        }
        
        option.style.fontFamily = cssFontName;
        option.style.padding = '4px 8px';
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Oyun SVG metinleri (.wheelText) — theme.game_styles.game_svg_text
// Listeyi ve normalizasyonu tek yerde tutar; Change Game alanı burayı kullanır.
// ---------------------------------------------------------------------------

export const DEFAULT_GAME_SVG_TEXT_STYLE = 'font-family: Arial, Helvetica, sans-serif;';

export const DEFAULT_GAME_SVG_TEXT_SIZE = '28px';

function _normalizeFontSizeToken(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^[\d.]+\s*(px|em|rem|%|pt)$/i.test(s)) return s.replace(/\s+/g, '');
  if (/^[\d.]+$/.test(s)) return `${s}px`;
  const n = parseFloat(s);
  return Number.isFinite(n) ? `${n}px` : '';
}

/** @type {{ id: string, label: string, style: string }[]} */
export const GAME_TEXT_FONT_OPTIONS = [
  { id: 'arial', label: 'Arial', style: 'font-family: Arial, Helvetica, sans-serif;' },
  { id: 'helvetica', label: 'Helvetica', style: 'font-family: Helvetica, Arial, sans-serif;' },
  { id: 'times', label: 'Times New Roman', style: 'font-family: "Times New Roman", Times, serif;' },
  { id: 'courier', label: 'Courier New', style: 'font-family: "Courier New", Courier, monospace;' },
  { id: 'verdana', label: 'Verdana', style: 'font-family: Verdana, Geneva, sans-serif;' },
  { id: 'georgia', label: 'Georgia', style: 'font-family: Georgia, serif;' },
  { id: 'palatino', label: 'Palatino', style: 'font-family: Palatino, "Palatino Linotype", serif;' },
  { id: 'garamond', label: 'Garamond', style: 'font-family: Garamond, "Times New Roman", serif;' },
  { id: 'bookman', label: 'Bookman', style: 'font-family: "Bookman Old Style", Georgia, serif;' },
  { id: 'comic', label: 'Comic Sans MS', style: 'font-family: "Comic Sans MS", "Comic Sans", cursive, sans-serif;' },
  { id: 'trebuchet', label: 'Trebuchet MS', style: 'font-family: "Trebuchet MS", Helvetica, sans-serif;' },
  { id: 'arial_black', label: 'Arial Black', style: 'font-family: "Arial Black", Gadget, sans-serif;' },
  { id: 'impact', label: 'Impact', style: 'font-family: Impact, Charcoal, sans-serif;' },
  { id: 'lucida_console', label: 'Lucida Console', style: 'font-family: "Lucida Console", Monaco, monospace;' },
  { id: 'tahoma', label: 'Tahoma', style: 'font-family: Tahoma, Geneva, Verdana, sans-serif;' },
  { id: 'lucida_sans', label: 'Lucida Sans Unicode', style: 'font-family: "Lucida Sans Unicode", "Lucida Grande", sans-serif;' },
  { id: 'gill_sans', label: 'Gill Sans', style: 'font-family: "Gill Sans", "Gill Sans MT", Calibri, sans-serif;' },
  { id: 'century_gothic', label: 'Century Gothic', style: 'font-family: "Century Gothic", CenturyGothic, AppleGothic, sans-serif;' },
  { id: 'franklin', label: 'Franklin Gothic Medium', style: 'font-family: "Franklin Gothic Medium", "Arial Narrow", sans-serif;' },
  { id: 'book_antiqua', label: 'Book Antiqua', style: 'font-family: "Book Antiqua", Palatino, serif;' },
  { id: 'righteous', label: 'Righteous', style: 'font-family: "Righteous", "Segoe Script", fantasy, cursive, sans-serif;' },
  { id: 'ubuntu', label: 'Ubuntu', style: 'font-family: Ubuntu, "Ubuntu Condensed", "Trebuchet MS", sans-serif;' },
];

function _normalizeSvgTextStyleString(s) {
  return String(s || '')
    .replace(/\s*;/g, ';')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function _firstFontFamilyFromStyle(styleText) {
  const m = /font-family\s*:\s*([^;]+)/i.exec(String(styleText || ''));
  if (!m) return '';
  return m[1]
    .split(',')[0]
    .replace(/["']/g, '')
    .trim()
    .toLowerCase();
}

function _coerceGameSvgFontFamilyToCss(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return DEFAULT_GAME_SVG_TEXT_STYLE;
  if (/font-family\s*:/i.test(s)) {
    return s.endsWith(';') ? s : `${s};`;
  }
  const token = s.replace(/^["']|["']$/g, '').trim();
  if (!token) return DEFAULT_GAME_SVG_TEXT_STYLE;

  const byLabel = GAME_TEXT_FONT_OPTIONS.find(
    (o) => o.label.toLowerCase() === token.toLowerCase()
  );
  if (byLabel) return byLabel.style;

  const tl = token.toLowerCase();
  const byId = GAME_TEXT_FONT_OPTIONS.find((o) => o.id === tl || o.id === tl.replace(/\s+/g, '_'));
  if (byId) return byId.style;

  const byFirst = GAME_TEXT_FONT_OPTIONS.find((o) => {
    const of = _firstFontFamilyFromStyle(o.style);
    return of && of === tl;
  });
  if (byFirst) return byFirst.style;

  const safe = token.replace(/[<>"\\]/g, '');
  return `font-family: "${safe}", sans-serif;`;
}

export function coerceGameSvgTextToCss(raw) {
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    const famRaw = raw.fontFamily ?? raw['font-family'];
    let fontPart = _coerceGameSvgFontFamilyToCss(famRaw);
    if (!String(famRaw ?? '').trim()) {
      fontPart = DEFAULT_GAME_SVG_TEXT_STYLE;
    }
    fontPart = String(fontPart).replace(/\s*;\s*$/, '').trim();
    const fsNorm = _normalizeFontSizeToken(raw.fontSize ?? raw['font-size']);
    if (fsNorm) {
      return `${fontPart}; font-size: ${fsNorm};`;
    }
    return fontPart.endsWith(';') ? fontPart : `${fontPart};`;
  }
  return _coerceGameSvgFontFamilyToCss(raw);
}

export function resolveGameTextFontOptionId(styleText) {
  if (styleText != null && typeof styleText === 'object' && !Array.isArray(styleText)) {
    const fam = styleText.fontFamily ?? styleText['font-family'];
    return resolveGameTextFontOptionId(fam == null ? '' : fam);
  }
  const raw = String(styleText || '').trim();
  if (!raw) return GAME_TEXT_FONT_OPTIONS[0].id;

  if (!/font-family\s*:/i.test(raw)) {
    const plain = raw.replace(/^["']|["']$/g, '').trim();
    const byPlain = GAME_TEXT_FONT_OPTIONS.find(
      (o) =>
        o.label.toLowerCase() === plain.toLowerCase() ||
        o.id === plain.toLowerCase().replace(/\s+/g, '_')
    );
    if (byPlain) return byPlain.id;
  }

  const css = coerceGameSvgTextToCss(raw);
  const n = _normalizeSvgTextStyleString(css);
  const exact = GAME_TEXT_FONT_OPTIONS.find((o) => _normalizeSvgTextStyleString(o.style) === n);
  if (exact) return exact.id;

  const first = _firstFontFamilyFromStyle(css);
  if (first) {
    const byFirst = GAME_TEXT_FONT_OPTIONS.find((o) => {
      const of = _firstFontFamilyFromStyle(o.style);
      return of && (of === first || first.includes(of) || of.includes(first));
    });
    if (byFirst) return byFirst.id;
  }

  return GAME_TEXT_FONT_OPTIONS[0].id;
}

export function getGameSvgTextStyleFromTheme(theme) {
  return coerceGameSvgTextToCss(theme?.game_styles?.game_svg_text);
}

/** @param {unknown} raw theme.game_styles.game_svg_text */
export function parseGameSvgTextFontSize(raw) {
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    const n = _normalizeFontSizeToken(raw.fontSize ?? raw['font-size']);
    return n || DEFAULT_GAME_SVG_TEXT_SIZE;
  }
  const m = /font-size\s*:\s*([^;]+)/i.exec(String(raw ?? ''));
  if (m) {
    const n = _normalizeFontSizeToken(m[1]);
    if (n) return n;
  }
  return DEFAULT_GAME_SVG_TEXT_SIZE;
}

export function ensureGameStylesSvgText(theme) {
  if (!theme) return;
  theme.game_styles = theme.game_styles && typeof theme.game_styles === 'object' ? theme.game_styles : {};
  const g = theme.game_styles.game_svg_text;
  const emptyObject =
    g != null && typeof g === 'object' && !Array.isArray(g) && Object.keys(g).length === 0;
  if (g == null || (typeof g === 'string' && String(g).trim() === '') || emptyObject) {
    theme.game_styles.game_svg_text = {
      fontFamily: 'Arial',
      fontSize: DEFAULT_GAME_SVG_TEXT_SIZE,
    };
  }
}

