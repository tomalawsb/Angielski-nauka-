const APP_VERSION = '2.0';
const STORAGE_PROGRESS = 'angielski-pwa-progress-v2';
const STORAGE_CUSTOM_WORDS = 'angielski-pwa-custom-words-v2';
const STORAGE_SETTINGS = 'angielski-pwa-settings-v2';

const el = id => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0, 10);

const state = {
  baseWords: [],
  customWords: [],
  activeWords: [],
  currentIndex: 0,
  currentWord: null,
  mode: 'flashcards',
  direction: 'en-pl',
  settings: { dailyGoal: 20 },
  progress: {
    done: 0,
    good: 0,
    bad: 0,
    days: {},
    mistakes: {},
    hard: {}
  }
};

const modeNames = {
  flashcards: 'Fiszki',
  choice: 'Test wyboru',
  typing: 'Wpisywanie odpowiedzi',
  mistakes: 'Powtórka błędów',
  hard: 'Trudne słówka'
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  loadSettings();
  loadProgress();
  loadCustomWords();
  await loadWords();
  fillCategories();
  bindEvents();
  applySettingsToUi();
  updateStats();
  renderWordList();
  prepareLesson();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

async function loadWords() {
  try {
    const res = await fetch('words.json', { cache: 'no-store' });
    state.baseWords = await res.json();
  } catch (e) {
    state.baseWords = [
      { english: 'house', polish: 'dom', category: 'podstawowe', example: 'This is my house.' },
      { english: 'work', polish: 'praca', category: 'podstawowe', example: 'I go to work.' }
    ];
  }
}

function bindEvents() {
  el('startBtn').addEventListener('click', startLesson);
  el('resetBtn').addEventListener('click', resetProgress);
  el('showAnswerBtn').addEventListener('click', showAnswer);
  el('rightBtn').addEventListener('click', () => markAnswer(true));
  el('wrongBtn').addEventListener('click', () => markAnswer(false));
  el('hardBtn').addEventListener('click', toggleHardCurrent);
  el('nextBtn').addEventListener('click', nextWord);
  el('speakBtn').addEventListener('click', speakCurrent);
  el('checkTypingBtn').addEventListener('click', checkTyping);
  el('typingInput').addEventListener('keydown', e => { if (e.key === 'Enter') checkTyping(); });
  el('addWordBtn').addEventListener('click', addCustomWord);
  el('modeSelect').addEventListener('change', startLesson);
  el('categorySelect').addEventListener('change', startLesson);
  el('directionSelect').addEventListener('change', startLesson);
  el('dailyGoalInput').addEventListener('change', updateDailyGoal);
  el('exportBtn').addEventListener('click', exportData);
  el('importBtn').addEventListener('click', () => el('importFile').click());
  el('importFile').addEventListener('change', importData);
  el('clearCustomBtn').addEventListener('click', clearCustomWords);
  el('searchInput').addEventListener('input', renderWordList);
}

function allWords() {
  return [...state.baseWords, ...state.customWords];
}

function fillCategories() {
  const categories = [...new Set(allWords().map(w => w.category || 'inne'))].sort((a, b) => a.localeCompare(b, 'pl'));
  el('categorySelect').innerHTML = '<option value="all">Wszystkie</option>' + categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
}

function startLesson() {
  state.mode = el('modeSelect').value;
  state.direction = el('directionSelect').value;
  const category = el('categorySelect').value;
  let words = allWords();

  if (category !== 'all') words = words.filter(w => w.category === category);

  if (state.mode === 'mistakes') {
    const keys = Object.keys(state.progress.mistakes || {}).filter(key => state.progress.mistakes[key] > 0);
    words = words.filter(w => keys.includes(wordKey(w)));
    if (!words.length) {
      setFeedback('Nie ma jeszcze słówek z błędami.', false);
      words = allWords();
    }
  }

  if (state.mode === 'hard') {
    const keys = Object.keys(state.progress.hard || {});
    words = words.filter(w => keys.includes(wordKey(w)));
    if (!words.length) {
      setFeedback('Nie oznaczono jeszcze trudnych słówek.', false);
      words = allWords();
    }
  }

  state.activeWords = shuffle([...words]);
  state.currentIndex = 0;
  renderCurrentWord();
}

function prepareLesson() {
  el('modeBadge').textContent = modeNames[state.mode];
  el('progressInfo').textContent = '0 / 0';
  setLessonButtons(false);
}

function setLessonButtons(enabled) {
  ['showAnswerBtn', 'rightBtn', 'wrongBtn', 'hardBtn', 'nextBtn', 'speakBtn'].forEach(id => el(id).disabled = !enabled);
}

function renderCurrentWord() {
  hideAnswer();
  el('feedback').textContent = '';
  el('choiceBox').classList.add('hidden');
  el('typingBox').classList.add('hidden');

  if (!state.activeWords.length) {
    el('question').textContent = 'Brak słówek';
    el('progressInfo').textContent = '0 / 0';
    setLessonButtons(false);
    return;
  }

  state.currentWord = state.activeWords[state.currentIndex];
  const q = getQuestion(state.currentWord);
  const a = getAnswer(state.currentWord);

  el('modeBadge').textContent = modeNames[state.mode];
  el('progressInfo').textContent = `${state.currentIndex + 1} / ${state.activeWords.length}`;
  el('question').textContent = q;
  el('answer').textContent = a;
  el('example').textContent = state.currentWord.example ? `Przykład: ${state.currentWord.example}` : '';

  setLessonButtons(true);
  el('showAnswerBtn').disabled = ['choice', 'typing'].includes(state.mode);
  el('rightBtn').disabled = ['choice', 'typing'].includes(state.mode);
  el('wrongBtn').disabled = ['choice', 'typing'].includes(state.mode);

  if (state.mode === 'choice') renderChoices(a);
  if (state.mode === 'typing') renderTyping();
}

function getQuestion(word) {
  return state.direction === 'en-pl' ? word.english : word.polish;
}

function getAnswer(word) {
  return state.direction === 'en-pl' ? word.polish : word.english;
}

function renderChoices(correct) {
  const wrong = shuffle(allWords().map(getAnswer).filter(value => normalize(value) !== normalize(correct))).slice(0, 3);
  const answers = shuffle([correct, ...wrong]);
  el('choiceBox').innerHTML = answers.map(answer => `<button data-answer="${escapeHtml(answer)}">${escapeHtml(answer)}</button>`).join('');
  el('choiceBox').classList.remove('hidden');
  [...el('choiceBox').querySelectorAll('button')].forEach(btn => {
    btn.addEventListener('click', () => {
      const ok = normalize(btn.dataset.answer) === normalize(correct);
      btn.classList.add(ok ? 'correct' : 'wrong');
      if (!ok) [...el('choiceBox').querySelectorAll('button')].forEach(b => {
        if (normalize(b.dataset.answer) === normalize(correct)) b.classList.add('correct');
      });
      markAnswer(ok, false);
      [...el('choiceBox').querySelectorAll('button')].forEach(b => b.disabled = true);
    });
  });
}

function renderTyping() {
  el('typingBox').classList.remove('hidden');
  el('typingInput').value = '';
  el('typingInput').placeholder = state.direction === 'en-pl' ? 'Wpisz po polsku' : 'Wpisz po angielsku';
  setTimeout(() => el('typingInput').focus(), 50);
}

function checkTyping() {
  if (!state.currentWord) return;
  const typed = el('typingInput').value;
  const ok = normalize(typed) === normalize(getAnswer(state.currentWord));
  markAnswer(ok, false);
  showAnswer();
}

function showAnswer() {
  el('answer').classList.remove('hidden');
  if (state.currentWord && state.currentWord.example) el('example').classList.remove('hidden');
}

function hideAnswer() {
  el('answer').classList.add('hidden');
  el('example').classList.add('hidden');
}

function markAnswer(ok, disableButtons = true) {
  if (!state.currentWord) return;

  const day = todayKey();
  if (!state.progress.days) state.progress.days = {};
  if (!state.progress.days[day]) state.progress.days[day] = { done: 0, good: 0, bad: 0 };

  state.progress.done += 1;
  state.progress.days[day].done += 1;

  if (ok) {
    state.progress.good += 1;
    state.progress.days[day].good += 1;
    reduceMistake(state.currentWord);
    setFeedback('Dobrze.', true);
  } else {
    state.progress.bad += 1;
    state.progress.days[day].bad += 1;
    addMistake(state.currentWord);
    setFeedback(`Źle. Poprawna odpowiedź: ${getAnswer(state.currentWord)}`, false);
  }

  saveProgress();
  updateStats();
  showAnswer();

  if (disableButtons) {
    el('rightBtn').disabled = true;
    el('wrongBtn').disabled = true;
  }
}

function nextWord() {
  if (!state.activeWords.length) return;
  state.currentIndex += 1;
  if (state.currentIndex >= state.activeWords.length) {
    state.currentIndex = 0;
    state.activeWords = shuffle(state.activeWords);
    setFeedback('Koniec rundy. Zaczynam kolejną.', true);
  }
  renderCurrentWord();
}

function speakCurrent() {
  if (!state.currentWord || !('speechSynthesis' in window)) return;
  const text = state.direction === 'en-pl' ? state.currentWord.english : getAnswer(state.currentWord);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function addMistake(word) {
  const key = wordKey(word);
  state.progress.mistakes[key] = (state.progress.mistakes[key] || 0) + 1;
}

function reduceMistake(word) {
  const key = wordKey(word);
  if (!state.progress.mistakes[key]) return;
  state.progress.mistakes[key] -= 1;
  if (state.progress.mistakes[key] <= 0) delete state.progress.mistakes[key];
}

function toggleHardCurrent() {
  if (!state.currentWord) return;
  const key = wordKey(state.currentWord);
  if (state.progress.hard[key]) {
    delete state.progress.hard[key];
    setFeedback('Usunięto ze słówek trudnych.', true);
  } else {
    state.progress.hard[key] = true;
    setFeedback('Dodano do trudnych słówek.', true);
  }
  saveProgress();
  renderWordList();
}

function addCustomWord() {
  const english = el('newEnglish').value.trim();
  const polish = el('newPolish').value.trim();
  const category = el('newCategory').value.trim() || 'własne';
  const example = el('newExample').value.trim();

  if (!english || !polish) {
    setFeedback('Wpisz słowo angielskie i polskie tłumaczenie.', false);
    return;
  }

  state.customWords.push({ english, polish, category, example });
  saveCustomWords();
  fillCategories();
  renderWordList();

  ['newEnglish', 'newPolish', 'newCategory', 'newExample'].forEach(id => el(id).value = '');
  setFeedback('Dodano własne słówko.', true);
}

function clearCustomWords() {
  if (!confirm('Usunąć wszystkie własne słówka?')) return;
  state.customWords = [];
  saveCustomWords();
  fillCategories();
  renderWordList();
  setFeedback('Usunięto własne słówka.', true);
}

function renderWordList() {
  const query = normalize(el('searchInput')?.value || '');
  const rows = allWords().filter(w => !query || normalize(`${w.english} ${w.polish} ${w.category}`).includes(query)).slice(0, 120);
  el('wordList').innerHTML = rows.map(w => {
    const customIndex = state.customWords.findIndex(c => wordKey(c) === wordKey(w));
    const hard = state.progress.hard && state.progress.hard[wordKey(w)];
    const removeBtn = customIndex >= 0 ? `<button class="danger" data-remove="${customIndex}">Usuń</button>` : '<small>systemowe</small>';
    return `<div class="word-row">
      <div><strong>${escapeHtml(w.english)}</strong><br><small>${escapeHtml(w.example || '')}</small></div>
      <div>${escapeHtml(w.polish)}</div>
      <span class="tag">${escapeHtml(w.category || 'inne')}${hard ? ' · trudne' : ''}</span>
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
    });
  });
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
}

function updateDailyGoal() {
  const value = Math.max(1, Math.min(999, Number(el('dailyGoalInput').value) || 20));
  state.settings.dailyGoal = value;
  saveSettings();
  updateStats();
}

function resetProgress() {
  if (!confirm('Usunąć zapisane postępy? Własne słówka zostaną.')) return;
  state.progress = { done: 0, good: 0, bad: 0, days: {}, mistakes: {}, hard: {} };
  saveProgress();
  updateStats();
  renderWordList();
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
      if (Array.isArray(data.customWords)) state.customWords = data.customWords;
      if (data.progress) state.progress = normalizeProgress(data.progress);
      if (data.settings) state.settings = { ...state.settings, ...data.settings };
      saveCustomWords();
      saveProgress();
      saveSettings();
      applySettingsToUi();
      fillCategories();
      updateStats();
      renderWordList();
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
    hard: p.hard || {}
  };
}

function saveProgress() {
  localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(state.progress));
}

function loadCustomWords() {
  try { state.customWords = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_WORDS)) || []; }
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
    .replace(/\s+/g, ' ');
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
