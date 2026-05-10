'use strict';

const APP_VERSION = '5.0.0';
const STORAGE_KEY = 'angielski_daily_trainer_state_v5';
const OLD_KEYS = ['englishPwaProgressV4', 'angielski-pwa-progress-v4', 'angielskiPwaProgress'];
const DAY = 24 * 60 * 60 * 1000;

const $ = (id) => document.getElementById(id);
const todayKey = (date = new Date()) => date.toISOString().slice(0, 10);
const addDays = (days) => todayKey(new Date(Date.now() + days * DAY));
const normalize = (text) => String(text || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ąćęłńóśźż\s]/gi, '').replace(/\s+/g, ' ');

let WORDS = [];
let state = null;
let session = null;
let selectedChoice = null;
let checkedThisCard = false;

const defaultState = () => ({
  version: APP_VERSION,
  createdAt: new Date().toISOString(),
  settings: { dailyNew: 7, dailyReview: 18, defaultLevel: 'A1', defaultTrack: 'all', voiceEnabled: true },
  user: { xp: 0, level: 1, streakDays: 0, lastActiveDay: null, totalCorrect: 0, totalWrong: 0, bestAnswerStreak: 0, currentAnswerStreak: 0 },
  items: {},
  days: {},
  mistakes: {}
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateState(JSON.parse(raw));
  } catch (_) {}
  for (const key of OLD_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return migrateState(JSON.parse(raw));
    } catch (_) {}
  }
  return defaultState();
}

function migrateState(src) {
  const fresh = defaultState();
  if (!src || typeof src !== 'object') return fresh;
  return {
    ...fresh,
    ...src,
    version: APP_VERSION,
    settings: { ...fresh.settings, ...(src.settings || {}) },
    user: { ...fresh.user, ...(src.user || {}) },
    items: src.items || src.wordProgress || {},
    days: src.days || src.daily || {},
    mistakes: src.mistakes || {}
  };
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

async function boot() {
  bindUi();
  state = loadState();
  await loadWords();
  ensureFilterOptions();
  syncSettingsUi();
  renderAll();
  registerServiceWorker();
}

async function loadWords() {
  try {
    const response = await fetch(`words.json?v=${APP_VERSION}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Nie udało się pobrać words.json');
    WORDS = await response.json();
  } catch (error) {
    console.error(error);
    WORDS = [];
    alert('Nie udało się wczytać bazy słówek. Sprawdź, czy uruchamiasz aplikację przez serwer/GitHub Pages, a nie bezpośrednio z pliku index.html.');
  }
}

function bindUi() {
  document.querySelectorAll('[data-nav]').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.nav)));
  $('startSessionBtn').addEventListener('click', () => startSmartSession());
  $('startReviewsBtn').addEventListener('click', () => startReviewOnlySession());
  $('checkBtn').addEventListener('click', checkAnswer);
  $('nextBtn').addEventListener('click', nextCard);
  $('dontKnowBtn').addEventListener('click', () => markAnswer(false, 'Nie wiem'));
  $('speakBtn').addEventListener('click', speakCurrent);
  $('refreshAppBtn').addEventListener('click', hardRefresh);
  $('searchInput').addEventListener('input', renderBase);
  $('levelFilter').addEventListener('change', renderBase);
  $('trackFilter').addEventListener('change', renderBase);
  ['dailyNewInput','dailyReviewInput','defaultLevelInput','defaultTrackInput','voiceEnabledInput'].forEach(id => $(id).addEventListener('change', saveSettingsFromUi));
  $('exportBtn').addEventListener('click', exportProgress);
  $('importBtn').addEventListener('click', importProgress);
  $('resetProgressBtn').addEventListener('click', resetProgress);
}

function showScreen(name) {
  const id = `screen${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
  const screen = $(id);
  if (screen) {
    screen.classList.add('active');
    $('screenTitle').textContent = screen.dataset.title || 'Angielski';
  }
  renderAll();
}

function ensureFilterOptions() {
  const levels = [...new Set(WORDS.map(w => w.level).filter(Boolean))].sort(levelSort);
  const tracks = [...new Set(WORDS.map(w => w.track).filter(Boolean))].sort();
  fillSelect($('levelFilter'), [['all','Wszystkie poziomy'], ...levels.map(x => [x,x])]);
  fillSelect($('trackFilter'), [['all','Wszystkie ścieżki'], ...tracks.map(x => [x,x])]);
  fillSelect($('defaultLevelInput'), [['all','Wszystkie poziomy'], ...levels.map(x => [x,x])]);
  fillSelect($('defaultTrackInput'), [['all','Wszystkie ścieżki'], ...tracks.map(x => [x,x])]);
}
function fillSelect(el, options) { el.innerHTML = options.map(([v,t]) => `<option value="${escapeHtml(v)}">${escapeHtml(t)}</option>`).join(''); }
function levelSort(a,b){ return ['A1','A2','B1','B2','C1','C2'].indexOf(a) - ['A1','A2','B1','B2','C1','C2'].indexOf(b); }

function syncSettingsUi() {
  $('dailyNewInput').value = state.settings.dailyNew;
  $('dailyReviewInput').value = state.settings.dailyReview;
  $('defaultLevelInput').value = state.settings.defaultLevel || 'all';
  $('defaultTrackInput').value = state.settings.defaultTrack || 'all';
  $('voiceEnabledInput').checked = !!state.settings.voiceEnabled;
}
function saveSettingsFromUi() {
  state.settings.dailyNew = clamp(parseInt($('dailyNewInput').value, 10) || 7, 1, 30);
  state.settings.dailyReview = clamp(parseInt($('dailyReviewInput').value, 10) || 18, 1, 80);
  state.settings.defaultLevel = $('defaultLevelInput').value;
  state.settings.defaultTrack = $('defaultTrackInput').value;
  state.settings.voiceEnabled = $('voiceEnabledInput').checked;
  saveState(); renderAll();
}

function getProgress(wordId) {
  if (!state.items[wordId]) state.items[wordId] = { seen:0, correct:0, wrong:0, streak:0, mastery:0, nextReview:null, lastAnswer:null, status:'new', intervalIndex:0 };
  return state.items[wordId];
}
function dueWords() {
  const today = todayKey();
  return WORDS.filter(w => { const p = getProgress(w.id); return p.nextReview && p.nextReview <= today && p.status !== 'mastered'; });
}
function weakWords() { return WORDS.filter(w => ['weak','review'].includes(getProgress(w.id).status)).sort((a,b)=>getProgress(b.id).wrong-getProgress(a.id).wrong); }
function candidateNewWords() {
  return WORDS.filter(w => {
    const p = getProgress(w.id);
    if (p.seen > 0) return false;
    if (state.settings.defaultLevel !== 'all' && w.level !== state.settings.defaultLevel) return false;
    if (state.settings.defaultTrack !== 'all' && w.track !== state.settings.defaultTrack) return false;
    return true;
  });
}
function buildDailyQueue(reviewOnly = false) {
  const reviews = dueWords().slice(0, state.settings.dailyReview);
  if (reviewOnly) return reviews.map(w => makeTask(w, 'review'));
  const weak = weakWords().filter(w => !reviews.includes(w)).slice(0, 5);
  const fresh = candidateNewWords().slice(0, state.settings.dailyNew);
  return [
    ...reviews.map(w => makeTask(w, 'review')),
    ...weak.map(w => makeTask(w, 'weak')),
    ...fresh.map(w => makeTask(w, 'new'))
  ];
}
function makeTask(word, kind) {
  const mode = chooseMode(word, kind);
  return { wordId: word.id, kind, mode };
}
function chooseMode(word, kind) {
  const p = getProgress(word.id);
  if (kind === 'new' || p.seen === 0) return 'choice';
  if (p.streak >= 2 && word.english.includes(' ')) return 'sentence';
  return p.seen % 3 === 0 ? 'pl-en' : 'en-pl';
}

function startSmartSession() {
  const queue = buildDailyQueue(false);
  if (!queue.length) {
    alert('Na dziś nie ma nowych zadań według obecnych filtrów. Zmień poziom/ścieżkę albo zwiększ limit nowych słówek.');
    return;
  }
  startSession(queue);
}
function startReviewOnlySession() {
  const queue = buildDailyQueue(true);
  if (!queue.length) { alert('Nie masz obecnie zaległych powtórek.'); return; }
  startSession(queue);
}
function startSession(queue) {
  session = { queue, index:0, correct:0, wrong:0, xp:0, startedAt:new Date().toISOString() };
  selectedChoice = null; checkedThisCard = false;
  $('lessonEmpty').classList.add('hidden');
  $('summaryCard').classList.add('hidden');
  $('lessonCard').classList.remove('hidden');
  showScreen('learn');
  renderLesson();
}
function currentTask() { return session?.queue?.[session.index] || null; }
function currentWord() { const task=currentTask(); return task ? WORDS.find(w => w.id === task.wordId) : null; }

function renderLesson() {
  const task = currentTask(); const word = currentWord();
  if (!task || !word) return finishSession();
  checkedThisCard = false; selectedChoice = null;
  $('lessonMode').textContent = modeLabel(task.mode, task.kind);
  $('lessonProgress').textContent = `${session.index + 1} / ${session.queue.length}`;
  $('lessonBar').style.width = `${((session.index) / session.queue.length) * 100}%`;
  $('feedback').className = 'feedback hidden';
  $('feedback').textContent = '';
  $('checkBtn').classList.remove('hidden');
  $('nextBtn').classList.add('hidden');
  $('dontKnowBtn').disabled = false;
  const prompt = buildPrompt(word, task.mode);
  $('lessonPromptLabel').textContent = prompt.label;
  $('lessonPrompt').textContent = prompt.text;
  $('lessonHint').textContent = `${word.level} • ${word.track} • ${word.category}`;
  $('answerArea').innerHTML = buildAnswerArea(word, task.mode);
  const input = document.querySelector('.answer-input');
  if (input) setTimeout(() => input.focus(), 50);
}
function modeLabel(mode, kind) {
  const names = { 'choice':'wybór', 'pl-en':'pisanie EN', 'en-pl':'pisanie PL', 'sentence':'zdanie' };
  return `${kind === 'new' ? 'nowe' : kind === 'weak' ? 'słabe' : 'powtórka'} • ${names[mode] || mode}`;
}
function buildPrompt(word, mode) {
  if (mode === 'en-pl') return { label:'Przetłumacz na polski', text:word.english };
  if (mode === 'choice') return { label:'Wybierz tłumaczenie', text:word.english };
  return { label:'Przetłumacz na angielski', text:word.polish };
}
function buildAnswerArea(word, mode) {
  if (mode === 'choice') {
    const choices = shuffle([word, ...shuffle(WORDS.filter(w => w.id !== word.id && w.level === word.level)).slice(0,3)]);
    return `<div class="choices">${choices.map(c => `<button class="choice" data-choice="${escapeHtml(c.polish)}">${escapeHtml(c.polish)}</button>`).join('')}</div>`;
  }
  return `<input class="answer-input" autocomplete="off" placeholder="Wpisz odpowiedź..." />`;
}
document.addEventListener('click', (e) => {
  const choice = e.target.closest('.choice');
  if (!choice || checkedThisCard) return;
  document.querySelectorAll('.choice').forEach(c => c.classList.remove('selected'));
  choice.classList.add('selected');
  selectedChoice = choice.dataset.choice;
});
document.addEventListener('keydown', (e) => {
  if (!session) return;
  if (e.key === 'Enter' && !$('nextBtn').classList.contains('hidden')) nextCard();
  else if (e.key === 'Enter' && !$('checkBtn').classList.contains('hidden')) checkAnswer();
});

function checkAnswer() {
  if (checkedThisCard) return;
  const word = currentWord(); const task = currentTask();
  if (!word || !task) return;
  let answer = '';
  if (task.mode === 'choice') answer = selectedChoice || '';
  else answer = document.querySelector('.answer-input')?.value || '';
  if (!answer.trim()) { alert('Najpierw wpisz albo wybierz odpowiedź.'); return; }
  const expected = task.mode === 'en-pl' || task.mode === 'choice' ? word.polish : word.english;
  const ok = isCloseEnough(answer, expected);
  markAnswer(ok, answer);
}
function markAnswer(ok, answer) {
  if (checkedThisCard) return;
  checkedThisCard = true;
  const word = currentWord(); const task = currentTask();
  if (!word || !task) return;
  updateProgress(word, ok);
  session[ok ? 'correct' : 'wrong'] += 1;
  const xp = ok ? (task.kind === 'new' ? 12 : 8) : 2;
  session.xp += xp;
  state.user.xp += xp;
  state.user.level = 1 + Math.floor(state.user.xp / 250);
  const day = todayKey();
  if (!state.days[day]) state.days[day] = { correct:0, wrong:0, xp:0 };
  state.days[day][ok ? 'correct' : 'wrong'] += 1;
  state.days[day].xp += xp;
  updateStreakDay(day);
  if (!ok) state.mistakes[word.id] = (state.mistakes[word.id] || 0) + 1;
  saveState();
  showFeedback(ok, word, answer);
  $('checkBtn').classList.add('hidden');
  $('nextBtn').classList.remove('hidden');
  $('dontKnowBtn').disabled = true;
  $('lessonBar').style.width = `${((session.index + 1) / session.queue.length) * 100}%`;
}
function updateProgress(word, ok) {
  const p = getProgress(word.id);
  p.seen += 1; p.lastAnswer = todayKey();
  if (ok) {
    p.correct += 1; p.streak += 1; p.intervalIndex = Math.min((p.intervalIndex || 0) + 1, 5);
    p.mastery = Math.min(100, Math.round((p.correct / Math.max(1, p.seen)) * 70 + p.streak * 8 + p.intervalIndex * 5));
    const intervals = [1,3,7,14,30,60];
    p.nextReview = addDays(intervals[p.intervalIndex - 1] || 1);
    p.status = p.mastery >= 90 && p.correct >= 5 ? 'mastered' : 'review';
    state.user.totalCorrect += 1;
    state.user.currentAnswerStreak += 1;
    state.user.bestAnswerStreak = Math.max(state.user.bestAnswerStreak, state.user.currentAnswerStreak);
  } else {
    p.wrong += 1; p.streak = 0; p.intervalIndex = 0; p.mastery = Math.max(0, p.mastery - 18); p.nextReview = addDays(1); p.status = 'weak';
    state.user.totalWrong += 1; state.user.currentAnswerStreak = 0;
  }
}
function updateStreakDay(day) {
  if (state.user.lastActiveDay === day) return;
  const yesterday = todayKey(new Date(Date.now() - DAY));
  state.user.streakDays = state.user.lastActiveDay === yesterday ? state.user.streakDays + 1 : 1;
  state.user.lastActiveDay = day;
}
function showFeedback(ok, word, answer) {
  const box = $('feedback');
  box.className = `feedback ${ok ? 'good' : 'bad'}`;
  box.innerHTML = ok ?
    `<strong>Dobrze.</strong><br>Poprawnie: <b>${escapeHtml(word.english)}</b> — ${escapeHtml(word.polish)}` :
    `<strong>Błąd.</strong><br>Twoja odpowiedź: ${escapeHtml(answer)}<br>Poprawnie: <b>${escapeHtml(word.english)}</b> — ${escapeHtml(word.polish)}`;
}
function nextCard() { session.index += 1; renderLesson(); }
function finishSession() {
  if (!session) return;
  $('lessonCard').classList.add('hidden');
  $('summaryCard').classList.remove('hidden');
  $('sumCorrect').textContent = session.correct;
  $('sumWrong').textContent = session.wrong;
  $('sumXp').textContent = session.xp;
  $('sumAccuracy').textContent = percent(session.correct, session.correct + session.wrong);
  session = null;
  renderAll();
}

function renderAll() { renderToday(); renderReviews(); renderProgress(); renderBase(); }
function renderToday() {
  const queue = buildDailyQueue(false);
  const reviews = dueWords().length;
  const fresh = candidateNewWords().length;
  $('todayHeadline').textContent = reviews ? `Masz ${reviews} powtórek do zrobienia` : 'Dzisiaj możesz zrobić nową sesję';
  $('todaySubline').textContent = `Plan: do ${state.settings.dailyReview} powtórek i do ${state.settings.dailyNew} nowych elementów. W bazie: ${WORDS.length}.`;
  $('queueBadge').textContent = `${queue.length} zadań`;
  $('todayQueuePreview').innerHTML = queue.slice(0,8).map(t => renderQueueItem(WORDS.find(w=>w.id===t.wordId), t)).join('') || '<p class="muted">Brak zadań według obecnych ustawień.</p>';
  $('statXp').textContent = state.user.xp;
  $('statUserLevel').textContent = state.user.level;
  $('statStreak').textContent = `${state.user.streakDays} dni`;
  $('statAccuracy').textContent = percent(state.user.totalCorrect, state.user.totalCorrect + state.user.totalWrong);
}
function renderQueueItem(w,t){ if(!w)return''; return `<div class="queue-item"><div><strong>${escapeHtml(w.english)}</strong><div class="muted">${escapeHtml(w.polish)}</div><div class="meta-row"><span class="mini">${w.level}</span><span class="mini">${w.track}</span><span class="mini amber">${modeLabel(t.mode,t.kind)}</span></div></div><span class="badge">${getProgress(w.id).mastery}%</span></div>`; }
function renderReviews() {
  const list = dueWords().concat(weakWords()).filter((w,i,a)=>a.findIndex(x=>x.id===w.id)===i).slice(0,50);
  $('reviewsList').innerHTML = list.map(renderWordItem).join('') || '<p class="muted">Brak powtórek. Nowe zadania znajdziesz na ekranie „Dzisiaj”.</p>';
}
function renderProgress() {
  const progresses = WORDS.map(w => getProgress(w.id));
  $('masteredCount').textContent = progresses.filter(p=>p.status==='mastered').length;
  $('learningCount').textContent = progresses.filter(p=>p.seen>0 && p.status!=='mastered' && p.status!=='weak').length;
  $('weakCount').textContent = progresses.filter(p=>p.status==='weak').length;
  $('bestStreak').textContent = state.user.bestAnswerStreak;
  const days = [...Array(7)].map((_,i)=>todayKey(new Date(Date.now()-(6-i)*DAY)));
  const max = Math.max(1, ...days.map(d => ((state.days[d]?.correct||0)+(state.days[d]?.wrong||0))));
  let total = 0;
  $('weekChart').innerHTML = days.map(d => { const val=(state.days[d]?.correct||0)+(state.days[d]?.wrong||0); total+=val; return `<div class="day-bar"><span style="height:${Math.max(8,Math.round(val/max*94))}px"></span><small>${d.slice(5)}</small></div>`; }).join('');
  $('weekTotal').textContent = `${total} odpowiedzi`;
  const mistakes = Object.entries(state.mistakes).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([id])=>WORDS.find(w=>w.id===id)).filter(Boolean);
  $('mistakesList').innerHTML = mistakes.map(renderWordItem).join('') || '<p class="muted">Brak błędów. Tak trzymać.</p>';
}
function renderBase() {
  const q = normalize($('searchInput')?.value || ''); const level=$('levelFilter')?.value || 'all'; const track=$('trackFilter')?.value || 'all';
  const filtered = WORDS.filter(w => (level==='all'||w.level===level) && (track==='all'||w.track===track) && (!q || normalize(`${w.english} ${w.polish} ${w.category}`).includes(q)));
  $('baseCount').textContent = `${filtered.length} / ${WORDS.length}`;
  $('baseList').innerHTML = filtered.slice(0,180).map(renderWordItem).join('') || '<p class="muted">Nic nie znaleziono.</p>';
}
function renderWordItem(w) { const p=getProgress(w.id); const cls=p.status==='mastered'?'green':p.status==='weak'?'red':'amber'; return `<div class="word-item"><div><strong>${escapeHtml(w.english)}</strong><div class="muted">${escapeHtml(w.polish)}</div><div class="meta-row"><span class="mini">${w.level}</span><span class="mini">${escapeHtml(w.track)}</span><span class="mini ${cls}">${statusLabel(p.status)}</span></div></div><span class="badge">${p.mastery}%</span></div>`; }
function statusLabel(s){ return ({new:'nowe',review:'powtórka',weak:'słabe',mastered:'opanowane',learning:'w nauce'}[s] || s); }

function isCloseEnough(answer, expected) {
  const a=normalize(answer), e=normalize(expected);
  if (!a || !e) return false;
  if (a === e) return true;
  if (e.length > 8 && (a.includes(e) || e.includes(a))) return true;
  const dist = levenshtein(a,e); const limit = e.length < 8 ? 1 : Math.max(2, Math.floor(e.length * 0.18));
  return dist <= limit;
}
function levenshtein(a,b){ const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0)); for(let i=0;i<=a.length;i++)dp[i][0]=i; for(let j=0;j<=b.length;j++)dp[0][j]=j; for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return dp[a.length][b.length]; }

function speakCurrent() {
  const word = currentWord(); if (!word || !('speechSynthesis' in window)) return;
  const text = word.examples?.[0]?.en || word.english;
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang='en-US'; u.rate=.9; speechSynthesis.speak(u);
}
async function hardRefresh() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => { r.active?.postMessage({type:'CLEAR_CACHE'}); return r.unregister(); }));
    }
    if ('caches' in window) { const keys=await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); }
  } finally { location.replace(`index.html?v=${APP_VERSION}&reload=${Date.now()}`); }
}
function exportProgress() { $('importExportBox').value = JSON.stringify(state, null, 2); }
function importProgress() { try { const data=JSON.parse($('importExportBox').value); state=migrateState(data); saveState(); syncSettingsUi(); renderAll(); alert('Import zakończony.'); } catch(_) { alert('Nieprawidłowe dane importu.'); } }
function resetProgress() { if(!confirm('Usunąć wszystkie postępy?')) return; state=defaultState(); saveState(); syncSettingsUi(); renderAll(); }
async function registerServiceWorker() { if (!('serviceWorker' in navigator)) return; try { const reg = await navigator.serviceWorker.register(`service-worker.js?v=${APP_VERSION}`); if (reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'}); } catch(e) { console.warn('SW error', e); } }
function percent(a,b){ return b ? `${Math.round(a/b*100)}%` : '0%'; }
function clamp(v,min,max){ return Math.min(max, Math.max(min, v)); }
function shuffle(arr){ return [...arr].sort(()=>Math.random()-.5); }
function escapeHtml(s){ return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

window.__trainerTests = { normalize, isCloseEnough, levenshtein, defaultState };
boot();
stomWord() {
  const english = el('newEnglish').value.trim();
  const polish = el('newPolish').value.trim();
  const category = el('newCategory').value.trim() || 'własne';
  const difficulty = el('newDifficulty').value || 'easy';
  const example = el('newExample').value.trim();

  if (!english || !polish) {
    setFeedback('Wpisz tekst angielski i polskie tłumaczenie.', false);
    return;
  }

  state.customWords.push(normalizeWordItem({ english, polish, category, difficulty, example, sentencePl: polish }));
  saveCustomWords();
  fillCategories();
  renderWordList();
  renderRandomSentence();

  ['newEnglish', 'newPolish', 'newCategory', 'newExample'].forEach(id => el(id).value = '');
  el('newDifficulty').value = 'easy';
  setFeedback('Dodano własny materiał.', true);
}

function clearCustomWords() {
  if (!confirm('Usunąć wszystkie własne słówka i zdania?')) return;
  state.customWords = [];
  saveCustomWords();
  fillCategories();
  renderWordList();
  renderRandomSentence();
  setFeedback('Usunięto własne materiały.', true);
}

function renderWordList() {
  const query = normalize(el('searchInput')?.value || '');
  const rows = allWords().filter(w => !query || normalize(`${w.english} ${w.polish} ${w.category} ${w.example || ''}`).includes(query)).slice(0, 400);
  el('wordList').innerHTML = rows.map(w => {
    const customIndex = state.customWords.findIndex(c => wordKey(c) === wordKey(w));
    const hard = state.progress.hard && state.progress.hard[wordKey(w)];
    const level = difficultyName(getDifficulty(w));
    const progress = state.progress.perWord?.[wordKey(w)] || { done: 0, good: 0, bad: 0, streak: 0, mastered: false };
    const progressText = progress.done ? `${progress.good}/${progress.done}${progress.mastered ? ' · opanowane' : ''}` : 'brak';
    const removeBtn = customIndex >= 0 ? `<button class="danger" data-remove="${customIndex}">Usuń</button>` : '<small>systemowe</small>';
    return `<div class="word-row">
      <div><strong>${escapeHtml(w.english)}</strong><br><small>${escapeHtml(w.example || '')}</small></div>
      <div>${escapeHtml(w.polish)}</div>
      <span class="tag">${escapeHtml(w.category || 'inne')}${hard ? ' · trudne' : ''}</span>
      <span class="level">${escapeHtml(level)}</span>
      <span class="progress-pill">${escapeHtml(progressText)}</span>
      ${removeBtn}
    </div>`;
  }).join('');

  [...el('wordList').querySelectorAll('[data-remove]')].forEach(btn => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.remove);
      state.customWords.splice(index, 1);
      saveCustomWords();
      fillCategories();
      renderWordList();
      renderRandomSentence();
    });
  });
}

function renderRandomSentence() {
  const list = sentenceWords();
  if (!list.length) return;
  const item = list[Math.floor(Math.random() * list.length)];
  el('phrasePl').textContent = sentencePolish(item);
  el('phraseEn').textContent = sentenceEnglish(item);
}

function updateStats() {
  const p = state.progress;
  const day = todayKey();
  const today = p.days?.[day]?.done || 0;
  const accuracy = p.done ? Math.round((p.good / p.done) * 100) : 0;
  const goal = Number(state.settings.dailyGoal) || 20;
  const percent = Math.min(100, Math.round((today / goal) * 100));

  el('doneCount').textContent = p.done;
  el('todayCount').textContent = today;
  el('goodCount').textContent = p.good;
  el('badCount').textContent = p.bad;
  el('accuracyCount').textContent = `${accuracy}%`;
  el('dailyGoalText').textContent = `${today} / ${goal}`;
  el('dailyProgressBar').style.width = `${percent}%`;
  renderProgressDashboard();
}

function renderProgressDashboard() {
  const p = state.progress || {};
  const perWord = p.perWord || {};
  const all = allWords();
  const learned = Object.values(perWord).filter(item => item.done > 0).length;
  const mastered = Object.values(perWord).filter(item => item.mastered).length;
  const hardCount = Object.keys(p.hard || {}).length;
  const mistakeCount = Object.values(p.mistakes || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const accuracy = p.done ? Math.round((p.good / p.done) * 100) : 0;
  const xp = (Number(p.good) || 0) * 10 + (Number(p.bad) || 0) * 3;
  const level = Math.max(1, Math.floor(xp / 100) + 1);
  const nextXp = level * 100;
  const currentLevelStart = (level - 1) * 100;
  const levelProgress = Math.min(100, Math.round(((xp - currentLevelStart) / (nextXp - currentLevelStart)) * 100));

  setText('progressLevel', level);
  setText('progressXp', `${xp} XP`);
  setText('progressAccuracy', `${accuracy}%`);
  setText('progressLearned', `${learned} / ${all.length}`);
  setText('progressMastered', mastered);
  setText('progressHard', hardCount);
  setText('progressMistakes', mistakeCount);
  setText('progressStreak', calculateDayStreak(p.days || {}));
  setWidth('levelProgressBar', `${levelProgress}%`);

  renderWeeklyProgress(p.days || {});
  renderTopMistakes();
}

function renderWeeklyProgress(days) {
  const node = el('weeklyProgress');
  if (!node) return;
  const rows = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const item = days[key] || { done: 0, good: 0, bad: 0 };
    const label = d.toLocaleDateString('pl-PL', { weekday: 'short' });
    const acc = item.done ? Math.round((item.good / item.done) * 100) : 0;
    rows.push(`<div class="week-day"><strong>${escapeHtml(label)}</strong><span>${item.done}</span><small>${acc}%</small></div>`);
  }
  node.innerHTML = rows.join('');
}

function renderTopMistakes() {
  const node = el('topMistakes');
  if (!node) return;
  const words = allWords();
  const rows = Object.entries(state.progress.mistakes || {})
    .filter(([, count]) => Number(count) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 8)
    .map(([key, count]) => {
      const w = words.find(item => wordKey(item) === key);
      const label = w ? `${w.english} — ${w.polish}` : key;
      return `<li><span>${escapeHtml(label)}</span><strong>${Number(count)}</strong></li>`;
    });
  node.innerHTML = rows.length ? rows.join('') : '<li><span>Brak błędów do powtórki</span><strong>0</strong></li>';
}

function calculateDayStreak(days) {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().slice(0, 10);
    if ((days[key]?.done || 0) > 0) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function setText(id, value) {
  const node = el(id);
  if (node) node.textContent = value;
}

function setWidth(id, value) {
  const node = el(id);
  if (node) node.style.width = value;
}

function updateDailyGoal() {
  const value = Math.max(1, Math.min(999, Number(el('dailyGoalInput').value) || 20));
  state.settings.dailyGoal = value;
  saveSettings();
  updateStats();
}

function updateVoiceSettings() {
  state.settings.voiceName = el('voiceSelect').value || '';
  state.settings.speechRate = Number(el('rateInput').value) || 0.9;
  state.settings.recognitionLang = el('recognitionLangSelect').value || 'en-US';
  state.settings.autoSpeak = el('autoSpeakInput').checked;
  saveSettings();
}

function resetProgress() {
  if (!confirm('Usunąć zapisane postępy? Własne słówka zostaną.')) return;
  state.progress = { done: 0, good: 0, bad: 0, days: {}, mistakes: {}, hard: {}, perWord: {}, lastSessionAt: '' };
  saveProgress();
  updateStats();
  renderWordList();
  renderProgressDashboard();
  setFeedback('Postępy wyzerowane.', true);
}

function exportData() {
  const data = {
    app: 'Angielski PWA',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    progress: state.progress,
    customWords: state.customWords
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `angielski-pwa-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data.customWords)) state.customWords = data.customWords.map(normalizeWordItem);
      if (data.progress) state.progress = normalizeProgress(data.progress);
      if (data.settings) state.settings = { ...state.settings, ...data.settings };
      saveCustomWords();
      saveProgress();
      saveSettings();
      applySettingsToUi();
      fillCategories();
      updateStats();
      renderWordList();
      renderRandomSentence();
      setFeedback('Import danych zakończony.', true);
    } catch (e) {
      setFeedback('Nie udało się zaimportować pliku JSON.', false);
    }
    event.target.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_PROGRESS));
    if (saved) state.progress = normalizeProgress(saved);
  } catch (e) {}
}

function normalizeProgress(p) {
  return {
    done: Number(p.done) || 0,
    good: Number(p.good) || 0,
    bad: Number(p.bad) || 0,
    days: p.days || {},
    mistakes: p.mistakes || {},
    hard: p.hard || {},
    perWord: p.perWord || {},
    lastSessionAt: p.lastSessionAt || ''
  };
}

function saveProgress() {
  localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(state.progress));
}

function loadCustomWords() {
  try { state.customWords = (JSON.parse(localStorage.getItem(STORAGE_CUSTOM_WORDS)) || []).map(normalizeWordItem); }
  catch (e) { state.customWords = []; }
}

function saveCustomWords() {
  localStorage.setItem(STORAGE_CUSTOM_WORDS, JSON.stringify(state.customWords));
}

function loadSettings() {
  try { state.settings = { ...state.settings, ...(JSON.parse(localStorage.getItem(STORAGE_SETTINGS)) || {}) }; }
  catch (e) {}
}

function saveSettings() {
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(state.settings));
}

function applySettingsToUi() {
  el('dailyGoalInput').value = state.settings.dailyGoal || 20;
  el('rateInput').value = state.settings.speechRate || 0.9;
  el('recognitionLangSelect').value = state.settings.recognitionLang || 'en-US';
  el('autoSpeakInput').checked = state.settings.autoSpeak !== false;
  if (state.settings.voiceName) el('voiceSelect').value = state.settings.voiceName;
  el('difficultySelect').value = state.settings.difficulty || 'all';
}


function normalizeWordItem(word) {
  const item = { ...word };
  item.english = String(item.english || '').trim();
  item.polish = String(item.polish || '').trim();
  item.category = String(item.category || 'inne').trim() || 'inne';
  item.example = String(item.example || '').trim();
  item.sentencePl = String(item.sentencePl || item.polish || '').trim();
  item.difficulty = getDifficulty(item);
  return item;
}

function getDifficulty(word) {
  const value = String(word?.difficulty || '').toLowerCase();
  if (['easy', 'medium', 'hard'].includes(value)) return value;
  const category = String(word?.category || '').toLowerCase();
  const english = String(word?.english || '');
  if (category.includes('zdania techniczne') || category.includes('zdania praca')) return 'hard';
  if (category.includes('zdania') || english.split(/\s+/).length >= 5) return 'medium';
  if (category.includes('techniczne') || category.includes('praca')) return 'medium';
  return 'easy';
}

function difficultyName(value) {
  return { easy: 'Łatwy', medium: 'Średni', hard: 'Trudny' }[value] || 'Wszystkie';
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js?v=4.0.0');
    if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          setFeedback('Pobrano nową wersję. Odświeżam aplikację.', true);
          worker.postMessage({ type: 'SKIP_WAITING' });
          setTimeout(() => location.reload(), 600);
        }
      });
    });
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data && event.data.type === 'CACHE_CLEARED') {
        location.reload();
      }
    });
    registration.update().catch(() => {});
  } catch (e) {}
}

async function clearAppCacheAndReload() {
  setFeedback('Czyszczę cache aplikacji i pobieram najnowszą wersję.', true);
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        if (registration.active) registration.active.postMessage({ type: 'CLEAR_CACHE' });
        await registration.update().catch(() => {});
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  } catch (e) {}
  const url = new URL(location.href);
  url.searchParams.set('v', String(Date.now()));
  location.replace(url.toString());
}

function setFeedback(text, ok) {
  el('feedback').textContent = text;
  el('feedback').style.color = ok ? 'var(--success)' : 'var(--danger)';
}

function wordKey(word) {
  return `${word.english}|${word.polish}|${word.category || 'inne'}`;
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-ząćęłńóśźż0-9 ]/gi, '')
    .replace(/\b(a|an|the)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCloseEnough(userText, correctText) {
  const a = normalize(userText);
  const b = normalize(correctText);
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.includes(a) && a.length >= Math.min(8, b.length)) return true;
  const score = similarity(a, b);
  return score >= 0.82;
}

function similarity(a, b) {
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (!longer.length) return 1;
  return (longer.length - levenshtein(longer, shorter)) / longer.length;
}

function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[b.length];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
