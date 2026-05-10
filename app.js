const STORAGE_PROGRESS = 'angielski-pwa-progress-v1';
const STORAGE_CUSTOM_WORDS = 'angielski-pwa-custom-words-v1';

const el = id => document.getElementById(id);

const state = {
  baseWords: [],
  customWords: [],
  activeWords: [],
  currentIndex: 0,
  currentWord: null,
  mode: 'flashcards',
  progress: {
    done: 0,
    good: 0,
    bad: 0,
    mistakes: {}
  }
};

const modeNames = {
  flashcards: 'Fiszki',
  choice: 'Test wyboru',
  typing: 'Wpisywanie odpowiedzi',
  mistakes: 'Powtórka błędów'
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  loadProgress();
  loadCustomWords();
  await loadWords();
  fillCategories();
  bindEvents();
  updateStats();
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
      { english: 'house', polish: 'dom', category: 'podstawowe' },
      { english: 'work', polish: 'praca', category: 'podstawowe' }
    ];
  }
}

function bindEvents() {
  el('startBtn').addEventListener('click', startLesson);
  el('resetBtn').addEventListener('click', resetProgress);
  el('showAnswerBtn').addEventListener('click', showAnswer);
  el('rightBtn').addEventListener('click', () => markAnswer(true));
  el('wrongBtn').addEventListener('click', () => markAnswer(false));
  el('nextBtn').addEventListener('click', nextWord);
  el('checkTypingBtn').addEventListener('click', checkTyping);
  el('typingInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') checkTyping();
  });
  el('addWordBtn').addEventListener('click', addCustomWord);
  el('modeSelect').addEventListener('change', startLesson);
  el('categorySelect').addEventListener('change', startLesson);
}

function allWords() {
  return [...state.baseWords, ...state.customWords];
}

function fillCategories() {
  const categories = [...new Set(allWords().map(w => w.category))].sort((a, b) => a.localeCompare(b, 'pl'));
  el('categorySelect').innerHTML = '<option value="all">Wszystkie</option>' + categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
}

function startLesson() {
  state.mode = el('modeSelect').value;
  const category = el('categorySelect').value;
  let words = allWords();

  if (category !== 'all') words = words.filter(w => w.category === category);

  if (state.mode === 'mistakes') {
    const mistakeKeys = Object.keys(state.progress.mistakes).filter(key => state.progress.mistakes[key] > 0);
    words = words.filter(w => mistakeKeys.includes(wordKey(w)));
    if (!words.length) {
      setFeedback('Nie ma jeszcze słówek z błędami.', false);
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
  el('showAnswerBtn').disabled = true;
  el('rightBtn').disabled = true;
  el('wrongBtn').disabled = true;
  el('nextBtn').disabled = true;
}

function renderCurrentWord() {
  hideAnswer();
  el('feedback').textContent = '';
  el('choiceBox').classList.add('hidden');
  el('typingBox').classList.add('hidden');

  if (!state.activeWords.length) {
    el('question').textContent = 'Brak słówek';
    el('progressInfo').textContent = '0 / 0';
    return;
  }

  state.currentWord = state.activeWords[state.currentIndex];
  el('modeBadge').textContent = modeNames[state.mode];
  el('progressInfo').textContent = `${state.currentIndex + 1} / ${state.activeWords.length}`;
  el('question').textContent = state.currentWord.english;
  el('answer').textContent = state.currentWord.polish;

  el('showAnswerBtn').disabled = state.mode !== 'flashcards';
  el('rightBtn').disabled = state.mode !== 'flashcards';
  el('wrongBtn').disabled = state.mode !== 'flashcards';
  el('nextBtn').disabled = false;

  if (state.mode === 'choice') renderChoices();
  if (state.mode === 'typing') renderTyping();
  if (state.mode === 'mistakes') {
    el('showAnswerBtn').disabled = false;
    el('rightBtn').disabled = false;
    el('wrongBtn').disabled = false;
  }
}

function renderChoices() {
  const correct = state.currentWord.polish;
  const wrong = shuffle(allWords().filter(w => w.polish !== correct)).slice(0, 3).map(w => w.polish);
  const answers = shuffle([correct, ...wrong]);

  el('choiceBox').innerHTML = answers.map(answer => `<button data-answer="${escapeHtml(answer)}">${escapeHtml(answer)}</button>`).join('');
  el('choiceBox').classList.remove('hidden');

  [...el('choiceBox').querySelectorAll('button')].forEach(btn => {
    btn.addEventListener('click', () => {
      const ok = normalize(btn.dataset.answer) === normalize(correct);
      btn.classList.add(ok ? 'correct' : 'wrong');
      if (!ok) {
        [...el('choiceBox').querySelectorAll('button')].forEach(b => {
          if (normalize(b.dataset.answer) === normalize(correct)) b.classList.add('correct');
        });
      }
      markAnswer(ok, false);
      [...el('choiceBox').querySelectorAll('button')].forEach(b => b.disabled = true);
    });
  });
}

function renderTyping() {
  el('typingBox').classList.remove('hidden');
  el('typingInput').value = '';
  el('typingInput').focus();
}

function checkTyping() {
  if (!state.currentWord) return;
  const typed = el('typingInput').value;
  const ok = normalize(typed) === normalize(state.currentWord.polish);
  markAnswer(ok, false);
  showAnswer();
}

function showAnswer() {
  el('answer').classList.remove('hidden');
}

function hideAnswer() {
  el('answer').classList.add('hidden');
}

function markAnswer(ok, disableButtons = true) {
  if (!state.currentWord) return;

  state.progress.done += 1;
  if (ok) {
    state.progress.good += 1;
    reduceMistake(state.currentWord);
    setFeedback('Dobrze.', true);
  } else {
    state.progress.bad += 1;
    addMistake(state.currentWord);
    setFeedback(`Źle. Poprawna odpowiedź: ${state.currentWord.polish}`, false);
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
  }
  renderCurrentWord();
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

function addCustomWord() {
  const english = el('newEnglish').value.trim();
  const polish = el('newPolish').value.trim();
  const category = el('newCategory').value.trim() || 'własne';

  if (!english || !polish) {
    setFeedback('Wpisz słowo angielskie i polskie tłumaczenie.', false);
    return;
  }

  state.customWords.push({ english, polish, category });
  saveCustomWords();
  fillCategories();

  el('newEnglish').value = '';
  el('newPolish').value = '';
  el('newCategory').value = '';
  setFeedback('Dodano własne słówko.', true);
}

function updateStats() {
  const p = state.progress;
  const accuracy = p.done ? Math.round((p.good / p.done) * 100) : 0;
  el('doneCount').textContent = p.done;
  el('goodCount').textContent = p.good;
  el('badCount').textContent = p.bad;
  el('accuracyCount').textContent = `${accuracy}%`;
}

function resetProgress() {
  if (!confirm('Usunąć zapisane postępy?')) return;
  state.progress = { done: 0, good: 0, bad: 0, mistakes: {} };
  saveProgress();
  updateStats();
  setFeedback('Postępy wyzerowane.', true);
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_PROGRESS));
    if (saved) state.progress = saved;
  } catch (e) {}
}

function saveProgress() {
  localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(state.progress));
}

function loadCustomWords() {
  try {
    state.customWords = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_WORDS)) || [];
  } catch (e) {
    state.customWords = [];
  }
}

function saveCustomWords() {
  localStorage.setItem(STORAGE_CUSTOM_WORDS, JSON.stringify(state.customWords));
}

function setFeedback(text, ok) {
  el('feedback').textContent = text;
  el('feedback').style.color = ok ? 'var(--success)' : 'var(--danger)';
}

function wordKey(word) {
  return `${word.english}|${word.polish}|${word.category}`;
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
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
