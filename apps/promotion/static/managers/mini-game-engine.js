/**
 * mini-game-engine.js 
 */
const MiniGameEngine = (() => {

  function pickReward(rewards) {
    const pool = rewards || [];
    const total = pool.reduce((s, r) => s + (r.weight || 0), 0);
    if (total <= 0) return pool.find(r => r.hasReward) || pool[0] || null;
    let rand = Math.random() * total;
    for (const r of pool) { rand -= (r.weight || 0); if (rand <= 0) return r; }
    return pool[pool.length - 1];
  }

  function ensureKeyframes(id, css) {
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id; s.textContent = css;
      document.head.appendChild(s);
    }
  }

  const SYMBOLS = ['🍒','🍋','💎','⭐','💰','🎁','7️⃣','🔔'];

  function bootSlot(container, rewards, onResult) {
    const svg = container.querySelector('#slot-machine-svg') || container.querySelector('svg');
    if (!svg) return;

    ensureKeyframes('mini-slot-kf', `
      @keyframes slotWinPulse {
        0%,100% { filter: brightness(1); }
        50%     { filter: brightness(1.7) drop-shadow(0 0 10px gold); }
      }
    `);

    const allRects = [...svg.querySelectorAll('rect')];
    const allTexts = [...svg.querySelectorAll('text')];

    const spinBtn = allRects.find(r => Number(r.getAttribute('ry')) >= 20 && Number(r.getAttribute('width')) >= 180);
    const spinLabel = allTexts.find(t => /SPIN/i.test(t.textContent));
    const reelEls = allTexts.filter(t => t.getAttribute('font-size') === "42");
    const creditEl = allTexts.find(t => t.textContent.trim() === '100' || t.id?.includes('credit'));
    const winEl    = allTexts.find(t => t.textContent.trim() === '0' || t.id?.includes('win'));

    let spinning = false;
    let credits = creditEl ? parseInt(creditEl.textContent) || 100 : 100;
    let wins = 0;

    function rand() { return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]; }

    function doSpin() {
      if (spinning || credits <= 0) return;
      if (reelEls.length === 0) {
          console.warn("No reel elements found for slot machine.");
          return;
      }

      spinning = true;
      credits--;
      if (creditEl) creditEl.textContent = String(credits);

      const reward = pickReward(rewards);
      const isWin = !!reward?.hasReward;

      const stopAt = Math.min(reelEls.length, 3);
      const winSym = '🍒';
      const finals = isWin ? Array(stopAt).fill(winSym) : Array.from({length: stopAt}, rand);

      reelEls.slice(0, stopAt).forEach((el, i) => {
        const iv = setInterval(() => { el.textContent = rand(); }, 60);
        setTimeout(() => {
          clearInterval(iv);
          el.textContent = finals[i] || '❓';
          if (isWin) el.style.animation = 'slotWinPulse 0.5s ease 3';
        }, 500 + i * 150);
      });

      setTimeout(() => {
        if (isWin) { 
            wins++; 
            if (winEl) winEl.textContent = String(wins); 
        }
        spinning = false;
        if (typeof onResult === 'function') onResult(reward);
      }, 500 + (stopAt - 1) * 150 + 300);
    }

    [spinBtn, spinLabel].forEach(el => {
      if (!el) return;
      el.style.cursor = 'pointer';
      el.addEventListener('click', doSpin);
    });
  }

  function bootScratch(container, rewards, onResult) {
    const svg = container.querySelector('#scratch-card-svg') || container.querySelector('svg');
    if (!svg) return;

    let done = false;
    const allRects = [...svg.querySelectorAll('rect')];
    const allTexts = [...svg.querySelectorAll('text')];

    const foil = allRects.find(r => (r.getAttribute('fill') || '').includes('scratchPattern') || r.id?.includes('foil'));
    const ctaBtn = allRects.find(r => Number(r.getAttribute('ry')) >= 20 && Number(r.getAttribute('width')) >= 200);
    const ctaText = allTexts.find(t => /SCRATCH|CLAIM/i.test(t.textContent));
    const prizeLabel = allTexts.find(t => t.textContent.includes('%') || t.id?.includes('prize'));

    function reveal() {
      if (done) return;
      done = true;

      const reward = pickReward(rewards);
      const isWin = !!reward?.hasReward;

      if (foil) { 
          foil.style.transition = 'opacity 0.7s'; 
          foil.style.opacity = '0'; 
          setTimeout(() => foil.style.display = 'none', 700);
      }

      svg.querySelectorAll('ellipse').forEach(e => { 
          e.style.transition = 'opacity 0.4s'; 
          e.style.opacity = '0'; 
      });

      if (prizeLabel) prizeLabel.textContent = isWin ? (reward.text || 'WIN!') : 'No Luck 😢';
      if (ctaText) ctaText.textContent = isWin ? '🎉 CLAIM REWARD' : '😞 TRY AGAIN';

      if (typeof onResult === 'function') onResult(reward);
    }

    [foil, ctaBtn, ctaText].forEach(el => {
      if (!el) return;
      el.style.cursor = 'pointer';
      el.addEventListener('click', reveal);
    });

    if (foil) {
      let dragging = false, moved = 0;
      foil.addEventListener('mousedown', () => { dragging = true; moved = 0; });
      foil.addEventListener('mousemove', () => { if (dragging && ++moved > 12) reveal(); });
      ['mouseup', 'mouseleave'].forEach(ev => document.addEventListener(ev, () => { dragging = false; }));
      
      foil.addEventListener('touchstart', () => { moved = 0; }, {passive: true});
      foil.addEventListener('touchmove', e => { 
          if (++moved > 8) reveal(); 
      }, { passive: true });
    }
  }

  function boot(containerEl, gameId, rewards, onResult) {
    if (!containerEl) return;
    const id = Number(gameId);
   
    const safeRewards = Array.isArray(rewards) ? rewards : [];
    
    if (id === 2) bootSlot(containerEl, safeRewards, onResult);
    else if (id === 3) bootScratch(containerEl, safeRewards, onResult);
  }

  return { boot };
})();

if (typeof window !== 'undefined') window.MiniGameEngine = MiniGameEngine;
export { MiniGameEngine };

window.MiniGameEngine = MiniGameEngine;