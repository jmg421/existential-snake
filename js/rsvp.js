// RSVP — Rapid Serial Visual Presentation engine
// N170 timing, OVP alignment, punctuation delays, tap-to-pause
// Based on JARVIS_RSVP_SPEC.md neuroscience insights

const T_BASE = 190;           // ms per word — N170 threshold + small buffer for game context
const LONG_WORD_EXTRA = 20;   // ms per char over 6
const COMMA_DELAY = 100;      // breath pause
const SENTENCE_DELAY = 250;   // thought-completion pause
const EMOJI_DELAY = 300;      // let emoji register visually

// Tokenize: split into words, bind punctuation to preceding word
function tokenize(text) {
  return text.split(/\s+/).filter(w => w.length > 0);
}

// Calculate display duration for a token
function duration(word) {
  let ms = T_BASE;
  // Strip emoji for length calc
  const stripped = word.replace(/[\u{1F000}-\u{1FFFF}]/gu, '');
  if (stripped.length > 6) ms += (stripped.length - 6) * LONG_WORD_EXTRA;
  // Punctuation delays
  if (/[,;:]$/.test(word)) ms += COMMA_DELAY;
  if (/[.!?]$/.test(word)) ms += SENTENCE_DELAY;
  // Emoji gets extra time
  if (/[\u{1F000}-\u{1FFFF}]/u.test(word)) ms += EMOJI_DELAY;
  return ms;
}

// OVP: find the anchor character index (center - 1, clamped)
function ovpIndex(word) {
  const len = word.length;
  if (len <= 2) return 0;
  return Math.max(0, Math.floor(len / 2) - 1);
}

// Build HTML for a word with OVP highlight on the anchor char
function renderWord(word) {
  const idx = ovpIndex(word);
  const before = word.slice(0, idx);
  const anchor = word[idx];
  const after = word.slice(idx + 1);
  return `${esc(before)}<span class="rsvp-anchor">${esc(anchor)}</span>${esc(after)}`;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/**
 * Play RSVP sequence into a container element.
 * Returns a controller { pause(), resume(), stop(), done: Promise }
 * @param {HTMLElement} el — container to render into
 * @param {string} text — full text to display
 * @param {object} opts — { onDone }
 */
export function playRSVP(el, text, opts = {}) {
  const words = tokenize(text);
  if (!words.length) { opts.onDone?.(); return { pause(){}, resume(){}, stop(){}, done: Promise.resolve() }; }

  let idx = 0;
  let paused = false;
  let stopped = false;
  let timer = null;

  const resolve_fns = [];
  const done = new Promise(r => resolve_fns.push(r));

  el.classList.add('rsvp-active');
  el.innerHTML = `<span class="rsvp-word"></span>`;
  const wordEl = el.querySelector('.rsvp-word');

  function showNext() {
    if (stopped || idx >= words.length) {
      el.classList.remove('rsvp-active');
      resolve_fns.forEach(r => r());
      opts.onDone?.();
      return;
    }
    if (paused) return;
    const word = words[idx];
    wordEl.innerHTML = renderWord(word);
    idx++;
    timer = setTimeout(showNext, duration(word));
  }

  // Tap container to pause/resume
  function toggle(e) {
    e.stopPropagation();
    if (paused) ctrl.resume(); else ctrl.pause();
  }
  el.addEventListener('click', toggle);
  el.addEventListener('touchstart', toggle, { passive: true });

  const ctrl = {
    pause() { paused = true; clearTimeout(timer); el.classList.add('rsvp-paused'); },
    resume() { paused = false; el.classList.remove('rsvp-paused'); showNext(); },
    stop() {
      stopped = true; clearTimeout(timer);
      el.removeEventListener('click', toggle);
      el.removeEventListener('touchstart', toggle);
      el.classList.remove('rsvp-active', 'rsvp-paused');
      resolve_fns.forEach(r => r());
    },
    done,
  };

  showNext();
  return ctrl;
}
