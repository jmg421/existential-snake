// Input handling — keyboard + touch/swipe
let onDirectionChange = null;
let onStart = null;

export function initInput(callbacks) {
  onDirectionChange = callbacks.onDirection;
  onStart = callbacks.onStart;

  // Keyboard
  document.addEventListener('keydown', e => {
    const map = {
      ArrowUp: {x:0,y:-1}, ArrowDown: {x:0,y:1},
      ArrowLeft: {x:-1,y:0}, ArrowRight: {x:1,y:0}
    };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    handleDirection(d);
  });

  // Touch/swipe
  let touchStartX = 0, touchStartY = 0;
  document.addEventListener('touchstart', e => {
    // Ignore touches on soundboard buttons
    if (e.target.closest('.sb-btn')) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (e.target.closest('.sb-btn')) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 20) return; // too small
    if (absDx > absDy) {
      handleDirection(dx > 0 ? {x:1,y:0} : {x:-1,y:0});
    } else {
      handleDirection(dy > 0 ? {x:0,y:1} : {x:0,y:-1});
    }
  }, { passive: true });
}

function handleDirection(d) {
  if (onDirectionChange) onDirectionChange(d);
  if (onStart) { onStart(); onStart = null; }
}
