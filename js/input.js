// Input — keyboard, touch/swipe, d-pad, pause, share, mobile detection
let onDirectionChange = null;
let onStartFn = null;
let onPauseFn = null;
let initialized = false;

export const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || window.innerWidth < 700;

export function initInput(callbacks) {
  onDirectionChange = callbacks.onDirection;
  onStartFn = callbacks.onStart;
  onPauseFn = callbacks.onPause;

  if (initialized) return;
  initialized = true;

  // Mark desktop
  if (!isMobile) document.body.classList.add('desktop');

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === 'p') { if (onPauseFn) onPauseFn(); return; }
    const map = { ArrowUp:{x:0,y:-1}, ArrowDown:{x:0,y:1}, ArrowLeft:{x:-1,y:0}, ArrowRight:{x:1,y:0},
                  w:{x:0,y:-1}, s:{x:0,y:1}, a:{x:-1,y:0}, d:{x:1,y:0} };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    handleDirection(d);
  });

  // Touch/swipe
  let touchStartX = 0, touchStartY = 0;
  document.addEventListener('touchstart', e => {
    if (e.target.closest('.sb-btn,.dpad-btn,#shareBtn,#themeToggle')) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (e.target.closest('.sb-btn,.dpad-btn,#shareBtn,#themeToggle')) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) handleDirection(dx > 0 ? {x:1,y:0} : {x:-1,y:0});
    else handleDirection(dy > 0 ? {x:0,y:1} : {x:0,y:-1});
  }, { passive: true });

  // D-pad buttons
  const dirMap = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
  document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
    const handler = e => { e.preventDefault(); handleDirection(dirMap[btn.dataset.dir]); };
    btn.addEventListener('touchstart', handler, { passive: false });
    btn.addEventListener('mousedown', handler);
  });

  // Pause button
  document.getElementById('pauseBtn')?.addEventListener('click', () => { if (onPauseFn) onPauseFn(); });

  // Share button
  document.getElementById('shareBtn')?.addEventListener('click', () => {
    const url = window.location.href;
    const text = `🐍 I got ${parseInt(localStorage.getItem('skibidi-highscore') || 0)} aura in Skibidi Things! Can you beat it? 🕷️`;
    if (navigator.share) {
      navigator.share({ title: 'Skibidi Things', text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text + ' ' + url).then(() => {
        document.getElementById('shareBtn').textContent = '✅ Copied!';
        setTimeout(() => document.getElementById('shareBtn').textContent = '📤 Share', 2000);
      });
    }
  });
}

function handleDirection(d) {
  if (onDirectionChange) onDirectionChange(d);
  if (onStartFn) { const fn = onStartFn; onStartFn = null; fn(); }
}
