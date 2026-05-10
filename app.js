const APP_VERSION = '3.0';
const STORAGE_PROGRESS = 'angielski-pwa-progress-v3';
const STORAGE_CUSTOM_WORDS = 'angielski-pwa-custom-words-v3';
const STORAGE_SETTINGS = 'angielski-pwa-settings-v3';

const el = id => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0, 10);
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const state = {
  baseWords: [],
  customWords: [],
  activeWords: [],
  currentIndex: 0,
  currentWord: null,
  mode: 'flashcards',
  direction: 'en-pl',
  voices: [],
  recognition: null,
  isListening: false,
  settings: {
    dailyGoal: 20,
    voiceName: '',
    speechRate: 0.9,
    recognitionLang: 'en-US',
    autoSpeak: true
  },
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
  sentence: 'Całe zdania',
  voice: 'Odpowiedź głosowa',
  listen: 'Lektor pyta',
  dictation: 'Dyktando',
  mistakes: 'Powtórka błędów',
  hard: 'Trudne słówka'
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  migrateOldData();
  loadSettings();
  loadProgress();
  loadCustomWords();
  await loadWords();
  fillCategories();
  bindEvents();
  initVoices();
  initRecognition();
  applySettingsToUi();
  updateStats();
  renderWordList();
  renderRandomSentence();
  prepareLesson();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

function migrateOldData() {
  if (!localStorage.getItem(STORAGE_PROGRESS)) {
    const old = localStorage.getItem('angielski-pwa-progress-v2');
    if (old) localStorage.setItem(STORAGE_PROGRESS, old);
  }
  if (!localStorage.getItem(STORAGE_CUSTOM_WORDS)) {
    const old = localStorage.getItem('angielski-pwa-custom-words-v2');
    if (old) localStorage.setItem(STORAGE_CUSTOM_WORDS, old);
  }
  if (!localStorage.getItem(STORAGE_SETTINGS)) {
    const old = localStorage.getItem('angielski-pwa-settings-v2');
    if (old) localStorage.setItem(STORAGE_SETTINGS, old);
  }
}

async function loadWords() {
  try {
    const res = await fetch('words.json', { cache: 'no-store' });
    state.baseWords = await res.json();
  } catch (e) {
    state.baseWords = [
      { english: 'house', polish: 'dom', category: 'podstawowe', example: 'This is my house.', sentencePl: 'To jest mój dom.' },
      { english: 'work', polish: 'praca', category: 'podstawowe', example: 'I go to work.', sentencePl: 'Idę do pracy.' }
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
  el('speakBtn').addEventListener('click', speakQuestion);
  el('readAnswerBtn').addEventListener('click', speakAnswer);
  el('listenBtn').addEventListener('click', listenAnswer);
  el('checkTypingBtn').addEventListener('click', checkTyping);
  el('checkSentenceBtn').addEventListener('click', checkSentence);
  el('typingInput').addEventListener('keydown', e => { if (e.key === 'Enter') checkTyping(); });
  el('sentenceInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.ctrlKey) checkSentence();
  });
  el('addWordBtn').addEventListener('click', addCustomWord);
  el('modeSelect').addEventListener('change', startLesson);
  el('categorySelect').addEventListener('change', startLesson);
  el('directionSelect').addEventListener('change', startLesson);
  el('dailyGoalInput').addEventListener('change', updateDailyGoal);
  el('voiceSelect').addEventListener('change', updateVoiceSettings);
  el('rateInput').addEventListener('input', updateVoiceSettings);
  el('recognitionLangSelect').addEventListener('change', updateVoiceSettings);
  el('autoSpeakInput').addEventListener('change', updateVoiceSettings);
  el('exportBtn').addEventListener('click', exportData);
  el('importBtn').addEventListener('click', () => el('importFile').click());
  el('importFile').addEventListener('change', importData);
  el('clearCustomBtn').addEventListener('click', clearCustomWords);
  el('searchInput').addEventListener('input', renderWordList);
  el('randomSentenceBtn').addEventListener('click', renderRandomSentence);
}

function initVoices() {
  if (!('speechSynthesis' in window)) {
    el('voiceSelect').innerHTML = '<option>Brak lektora w tej przeglądarce</option>';
    return;
  }
  const load = () => {
    state.voices = speechSynthesis.getVoices();
    const english = state.voices.filter(v => String(v.lang || '').toLowerCase().startsWith('en'));
    const list = english.length ? english : state.voices;
    el('voiceSelect').innerHTML = list.map(v => `<option value="${escapeHtml(v.name)}">${escapeHtml(v.name)} · ${escapeHtml(v.lang)}</option>`).join('') || '<option>Domyślny głos</option>';
    if (state.settings.voiceName) el('voiceSelect').value = state.settings.voiceName;
  };
  load();
  speechSynthesis.onvoiceschanged = load;
}

function initRecognition() {
  if (!Recognition) {
    el('listenBtn').disabled = true;
    el('listenBtn').textContent = '🎙️ Mikrofon niedostępny';
    return;
  }
  state.recognition = new Recognition();
  state.recognition.continuous = false;
  state.recognition.interimResults = false;
  state.recognition.maxAlternatives = 3;
  state.recognition.onstart = () => {
    state.isListening = true;
    el('listenBtn').classList.add('listening');
    el('listenBtn').textContent = 'Słucham...';
    el('voiceTranscript').textContent = 'Mów teraz...';
  };
  state.recognition.onend = () => {
    state.isListening = false;
    el('listenBtn').classList.remove('listening');
    el('listenBtn').textContent = '🎙️ Odpowiedz głosem';
  };
  state.recognition.onerror = event => {
    setFeedback(`Błąd mikrofonu: ${event.error || 'nieznany'}`, false);
  };
  state.recognition.onresult = event => {
    const transcript = Array.from(event.results[0]).map(r => r.transcript).join(' | ');
    const main = event.results[0][0].transcript;
    el('voiceTranscript').textContent = transcript;
    checkSpokenAnswer(main);
  };
}

function allWords() {
  return [...state.baseWords, ...state.customWords];
}

function sentenceWords() {
  return allWords().filter(w => sentenceEnglish(w) && sentencePolish(w));
}

function fillCategories() {
  const categories = [...new Set(allWords().map(w => w.category || 'inne'))].sort((a, b) => a.localeCompare(b, 'pl'));
  el('categorySelect').innerHTML = '<option value="all">Wszystkie</option>' + categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
}

function startLesson() {
  stopSpeech();
  stopListening();
  state.mode = el('modeSelect').value;
  state.direction = el('directionSelect').value;
  const category = el('categorySelect').value;
  let words = allWords();

  if (['sentence', 'voice', 'listen', 'dictation'].includes(state.mode)) words = sentenceWords();
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
  ['showAnswerBtn', 'rightBtn', 'wrongBtn', 'hardBtn', 'nextBtn', 'speakBtn', 'readAnswerBtn'].forEach(id => el(id).disabled = !enabled);
  if (Recognition) el('listenBtn').disabled = !enabled;
}

function renderCurrentWord() {
  hideAnswer();
  el('feedback').textContent = '';
  el('choiceBox').classList.add('hidden');
  el('typingBox').classList.add('hidden');
  el('sentenceBox').classList.add('hidden');
  el('voiceBox').classList.add('hidden');
  el('voiceTranscript').textContent = '—';

  if (!state.activeWords.length) {
    el('questionLabel').textContent = '';
    el('question').textContent = 'Brak materiału do tego trybu';
    el('progressInfo').textContent = '0 / 0';
    setLessonButtons(false);
    return;
  }

  state.currentWord = state.activeWords[state.currentIndex];
  const q = getQuestion(state.currentWord);
  const a = getAnswer(state.currentWord);

  el('modeBadge').textContent = modeNames[state.mode];
  el('progressInfo').textContent = `${state.currentIndex + 1} / ${state.activeWords.length}`;
  el('questionLabel').textContent = getQuestionLabel();
  el('question').textContent = q;
  el('answer').textContent = a;
  el('example').textContent = getExampleText(state.currentWord);

  setLessonButtons(true);
  el('showAnswerBtn').disabled = ['choice', 'typing', 'sentence', 'voice', 'listen', 'dictation'].includes(state.mode);
  el('rightBtn').disabled = ['choice', 'typing', 'sentence', 'voice', 'listen', 'dictation'].includes(state.mode);
  el('wrongBtn').disabled = ['choice', 'typing', 'sentence', 'voice', 'listen', 'dictation'].includes(state.mode);

  if (state.mode === 'choice') renderChoices(a);
  if (state.mode === 'typing') renderTyping();
  if (state.mode === 'sentence') renderSentence();
  if (state.mode === 'voice') renderVoice();
  if (state.mode === 'listen') renderListen();
  if (state.mode === 'dictation') renderDictation();

  if (state.settings.autoSpeak && ['flashcards', 'choice', 'typing', 'sentence', 'voice', 'listen', 'dictation'].includes(state.mode)) {
    setTimeout(speakQuestion, 250);
  }
}

function getQuestionLabel() {
  if (state.mode === 'sentence') return 'Przetłumacz całe zdanie';
  if (state.mode === 'voice') return 'Odpowiedz głosem';
  if (state.mode === 'listen') return 'Lektor czyta — odpowiedz głosem';
  if (state.mode === 'dictation') return 'Dyktando — wpisz to, co usłyszysz';
  return state.direction === 'en-pl' ? 'Przetłumacz na polski' : 'Przetłumacz na angielski';
}

function getQuestion(word) {
  if (state.mode === 'dictation') return 'Posłuchaj zdania i wpisz po angielsku';
  if (['sentence', 'voice', 'listen'].includes(state.mode)) return sentencePolish(word);
  return state.direction === 'en-pl' ? word.english : word.polish;
}

function getAnswer(word) {
  if (['sentence', 'voice', 'listen', 'dictation'].includes(state.mode)) return sentenceEnglish(word);
  return state.direction === 'en-pl' ? word.polish : word.english;
}

function sentenceEnglish(word) {
  return word.example || word.english || '';
}

function sentencePolish(word) {
  return word.sentencePl || word.polish || '';
}

function getExampleText(word) {
  if (!word) return '';
  if (['sentence', 'voice', 'listen', 'dictation'].includes(state.mode)) return `Wzór: ${sentenceEnglish(word)}`;
  return word.example ? `Przykład: ${word.example}` : '';
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

function renderSentence() {
  el('sentenceBox').classList.remove('hidden');
  el('sentenceInput').value = '';
  el('sentenceInput').placeholder = 'Napisz całe zdanie po angielsku';
  setTimeout(() => el('sentenceInput').focus(), 50);
}

function renderVoice() {
  el('voiceBox').classList.remove('hidden');
}

function renderListen() {
  el('voiceBox').classList.remove('hidden');
  el('question').textContent = 'Posłuchaj lektora i odpowiedz po angielsku';
}

function renderDictation() {
  el('typingBox').classList.remove('hidden');
  el('typingInput').value = '';
  el('typingInput').placeholder = 'Wpisz usłyszane zdanie po angielsku';
  setTimeout(() => el('typingInput').focus(), 50);
}

function checkTyping() {
  if (!state.currentWord) return;
  const typed = el('typingInput').value;
  const ok = isCloseEnough(typed, getAnswer(state.currentWord));
  markAnswer(ok, false, typed);
  showAnswer();
}

function checkSentence() {
  if (!state.currentWord) return;
  const typed = el('sentenceInput').value;
  const ok = isCloseEnough(typed, getAnswer(state.currentWord));
  markAnswer(ok, false, typed);
  showAnswer();
}

function listenAnswer() {
  if (!state.recognition || !state.currentWord) {
    setFeedback('Ta przeglądarka nie obsługuje rozpoznawania mowy.', false);
    return;
  }
  if (state.isListening) {
    stopListening();
    return;
  }
  state.recognition.lang = state.settings.recognitionLang || 'en-US';
  try { state.recognition.start(); }
  catch (e) { setFeedback('Mikrofon jest już aktywny albo przeglądarka zablokowała nagrywanie.', false); }
}

function checkSpokenAnswer(text) {
  const ok = isCloseEnough(text, getAnswer(state.currentWord));
  markAnswer(ok, false, text);
  showAnswer();
}

function showAnswer() {
  el('answer').classList.remove('hidden');
  if (state.currentWord && getExampleText(state.currentWord)) el('example').classList.remove('hidden');
}

function hideAnswer() {
  el('answer').classList.add('hidden');
  el('example').classList.add('hidden');
}

function markAnswer(ok, disableButtons = true, typed = '') {
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
    const typedInfo = typed ? ` Twoja odpowiedź: ${typed}.` : '';
    setFeedback(`Źle.${typedInfo} Poprawnie: ${getAnswer(state.currentWord)}`, false);
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
  stopSpeech();
  stopListening();
  if (!state.activeWords.length) return;
  state.currentIndex += 1;
  if (state.currentIndex >= state.activeWords.length) {
    state.currentIndex = 0;
    state.activeWords = shuffle(state.activeWords);
    setFeedback('Koniec rundy. Zaczynam kolejną.', true);
  }
  renderCurrentWord();
}

function speakQuestion() {
  if (!state.currentWord) return;
  const text = state.mode === 'dictation' ? getAnswer(state.currentWord) : getQuestion(state.currentWord);
  const lang = shouldSpeakEnglish(text) ? 'en-US' : 'pl-PL';
  speak(text, lang);
}

function speakAnswer() {
  if (!state.currentWord) return;
  speak(getAnswer(state.currentWord), 'en-US');
}

function speak(text, lang = 'en-US') {
  if (!text || !('speechSynthesis' in window)) {
    setFeedback('Ta przeglądarka nie obsługuje lektora.', false);
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = Number(state.settings.speechRate) || 0.9;
  const selected = state.voices.find(v => v.name === state.settings.voiceName);
  if (selected) utterance.voice = selected;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function stopSpeech() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function stopListening() {
  if (state.recognition && state.isListening) {
    try { state.recognition.stop(); } catch (e) {}
  }
}

function shouldSpeakEnglish(text) {
  return /[a-z]/i.test(text) && !/[ąćęłńóśźż]/i.test(text);
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
    setFeedback('Wpisz tekst angielski i polskie tłumaczenie.', false);
    return;
  }

  state.customWords.push({ english, polish, category, example, sentencePl: polish });
  saveCustomWords();
  fillCategories();
  renderWordList();
  renderRandomSentence();

  ['newEnglish', 'newPolish', 'newCategory', 'newExample'].forEach(id => el(id).value = '');
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
  const rows = allWords().filter(w => !query || normalize(`${w.english} ${w.polish} ${w.category} ${w.example || ''}`).includes(query)).slice(0, 160);
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
  el('rateInput').value = state.settings.speechRate || 0.9;
  el('recognitionLangSelect').value = state.settings.recognitionLang || 'en-US';
  el('autoSpeakInput').checked = state.settings.autoSpeak !== false;
  if (state.settings.voiceName) el('voiceSelect').value = state.settings.voiceName;
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
