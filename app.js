const APP_VERSION = '4.0.0';
const STORAGE_PROGRESS = 'angielski-pwa-progress-v4';
const STORAGE_CUSTOM_WORDS = 'angielski-pwa-custom-words-v4';
const STORAGE_SETTINGS = 'angielski-pwa-settings-v4';

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
  difficulty: 'all',
  answerLocked: false,
  emptyMessage: '',
  voices: [],
  recognition: null,
  isListening: false,
  settings: {
    dailyGoal: 20,
    voiceName: '',
    speechRate: 0.9,
    recognitionLang: 'en-US',
    autoSpeak: true,
    difficulty: 'all'
  },
  progress: {
    done: 0,
    good: 0,
    bad: 0,
    days: {},
    mistakes: {},
    hard: {},
    perWord: {},
    lastSessionAt: ''
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

document.addEventListener('DOMContentLoaded', () => {
  if (el('startBtn')) init();
});

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
  renderProgressDashboard();

  registerServiceWorker();
}

function migrateOldData() {
  migrateStorageKey(STORAGE_PROGRESS, ['angielski-pwa-progress-v3', 'angielski-pwa-progress-v2']);
  migrateStorageKey(STORAGE_CUSTOM_WORDS, ['angielski-pwa-custom-words-v3', 'angielski-pwa-custom-words-v2']);
  migrateStorageKey(STORAGE_SETTINGS, ['angielski-pwa-settings-v3', 'angielski-pwa-settings-v2']);
}

function migrateStorageKey(targetKey, oldKeys) {
  if (localStorage.getItem(targetKey)) return;
  for (const oldKey of oldKeys) {
    const old = localStorage.getItem(oldKey);
    if (old) {
      localStorage.setItem(targetKey, old);
      return;
    }
  }
}

async function loadWords() {
  try {
    const res = await fetch('words.json', { cache: 'no-store' });
    state.baseWords = (await res.json()).map(normalizeWordItem);
  } catch (e) {
    state.baseWords = [
      normalizeWordItem({ english: 'house', polish: 'dom', category: 'podstawowe', difficulty: 'easy', example: 'This is my house.', sentencePl: 'To jest mój dom.' }),
      normalizeWordItem({ english: 'work', polish: 'praca', category: 'podstawowe', difficulty: 'easy', example: 'I go to work.', sentencePl: 'Idę do pracy.' })
    ];
  }
}

function bindEvents() {
  el('startBtn').addEventListener('click', startLesson);
  el('resetBtn').addEventListener('click', resetProgress);
  el('clearCacheBtn').addEventListener('click', clearAppCacheAndReload);
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
  el('difficultySelect').addEventListener('change', startLesson);
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
  bindNavigationTabs();
  el('searchInput').addEventListener('input', renderWordList);
  el('randomSentenceBtn').addEventListener('click', renderRandomSentence);
}


function bindNavigationTabs() {
  document.querySelectorAll('[data-tab-target]').forEach(button => {
    button.addEventListener('click', () => showTab(button.dataset.tabTarget));
  });
}

function showTab(name) {
  document.querySelectorAll('[data-tab]').forEach(section => {
    section.classList.toggle('active-view', section.dataset.tab === name);
  });
  document.querySelectorAll('[data-tab-target]').forEach(button => {
    button.classList.toggle('active', button.dataset.tabTarget === name);
  });
  if (name === 'progress') renderProgressDashboard();
  if (name === 'words') renderWordList();
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
  return [...state.baseWords, ...state.customWords].map(normalizeWordItem);
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
  state.difficulty = el('difficultySelect').value || 'all';
  state.settings.difficulty = state.difficulty;
  saveSettings();
  state.emptyMessage = '';

  const category = el('categorySelect').value;
  let words = allWords();

  if (['sentence', 'voice', 'listen', 'dictation'].includes(state.mode)) words = sentenceWords();
  if (category !== 'all') words = words.filter(w => w.category === category);
  if (state.difficulty !== 'all') words = words.filter(w => getDifficulty(w) === state.difficulty);

  if (state.mode === 'mistakes') {
    const keys = Object.keys(state.progress.mistakes || {}).filter(key => state.progress.mistakes[key] > 0);
    words = words.filter(w => keys.includes(wordKey(w)));
    if (!words.length) state.emptyMessage = 'Nie ma jeszcze słówek z błędami dla wybranego filtra.';
  }

  if (state.mode === 'hard') {
    const keys = Object.keys(state.progress.hard || {});
    words = words.filter(w => keys.includes(wordKey(w)));
    if (!words.length) state.emptyMessage = 'Nie oznaczono jeszcze trudnych słówek dla wybranego filtra.';
  }

  state.activeWords = state.emptyMessage ? [] : shuffle([...words]);
  state.currentIndex = 0;
  updateLessonSummary(words.length);
  renderCurrentWord();
}
function prepareLesson() {
  el('modeBadge').textContent = modeNames[state.mode];
  el('progressInfo').textContent = '0 / 0';
  updateLessonSummary(0);
  setLessonButtons(false);
}

function updateLessonSummary(count) {
  const mode = modeNames[state.mode] || 'Nauka';
  const categoryNode = el('categorySelect');
  const category = categoryNode?.options[categoryNode.selectedIndex]?.text || 'Wszystkie';
  const level = difficultyName(state.difficulty || state.settings.difficulty || 'all');
  const summary = `${mode} · ${category} · ${level}`;
  const lessonFilterSummary = el('lessonFilterSummary');
  const bankCount = el('bankCount');
  if (lessonFilterSummary) lessonFilterSummary.textContent = summary;
  if (bankCount) bankCount.textContent = count;
}

function setLessonButtons(enabled) {
  ['showAnswerBtn', 'rightBtn', 'wrongBtn', 'hardBtn', 'nextBtn', 'speakBtn', 'readAnswerBtn'].forEach(id => el(id).disabled = !enabled);
  if (Recognition) el('listenBtn').disabled = !enabled;
}

function renderCurrentWord() {
  state.answerLocked = false;
  setAnswerControlsLocked(false);
  hideAnswer();
  el('feedback').textContent = '';
  el('choiceBox').classList.add('hidden');
  el('typingBox').classList.add('hidden');
  el('sentenceBox').classList.add('hidden');
  el('voiceBox').classList.add('hidden');
  el('voiceTranscript').textContent = '—';

  if (!state.activeWords.length) {
    el('questionLabel').textContent = '';
    el('question').textContent = state.emptyMessage || 'Brak materiału do tego trybu';
    el('progressInfo').textContent = '0 / 0';
    setLessonButtons(false);
    return;
  }

  state.currentWord = state.activeWords[state.currentIndex];
  const q = getQuestion(state.currentWord);
  const a = getAnswer(state.currentWord);

  el('modeBadge').textContent = `${modeNames[state.mode]} · ${difficultyName(getDifficulty(state.currentWord))}`;
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
  if (!state.currentWord || state.answerLocked) return;
  const typed = el('typingInput').value;
  const ok = isCloseEnough(typed, getAnswer(state.currentWord));
  markAnswer(ok, false, typed);
  showAnswer();
}

function checkSentence() {
  if (!state.currentWord || state.answerLocked) return;
  const typed = el('sentenceInput').value;
  const ok = isCloseEnough(typed, getAnswer(state.currentWord));
  markAnswer(ok, false, typed);
  showAnswer();
}

function listenAnswer() {
  if (state.answerLocked) return;
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
  if (state.answerLocked) return;
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

function setAnswerControlsLocked(locked) {
  ['checkTypingBtn', 'checkSentenceBtn', 'listenBtn'].forEach(id => {
    const node = el(id);
    if (node) node.disabled = locked || (id === 'listenBtn' && !Recognition);
  });
  if (locked) {
    el('rightBtn').disabled = true;
    el('wrongBtn').disabled = true;
    [...el('choiceBox').querySelectorAll('button')].forEach(button => button.disabled = true);
  }
}

function markAnswer(ok, disableButtons = true, typed = '') {
  if (!state.currentWord) return;
  if (state.answerLocked) {
    setFeedback('Ta odpowiedź została już oceniona. Kliknij „Dalej”.', false);
    return;
  }
  state.answerLocked = true;
  setAnswerControlsLocked(true);

  const day = todayKey();
  if (!state.progress.days) state.progress.days = {};
  if (!state.progress.days[day]) state.progress.days[day] = { done: 0, good: 0, bad: 0 };

  state.progress.done += 1;
  state.progress.days[day].done += 1;
  state.progress.lastSessionAt = new Date().toISOString();
  updateWordProgress(state.currentWord, ok);

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
  renderProgressDashboard();
  renderWordList();
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

function updateWordProgress(word, ok) {
  if (!state.progress.perWord) state.progress.perWord = {};
  const key = wordKey(word);
  const item = state.progress.perWord[key] || { done: 0, good: 0, bad: 0, streak: 0, mastered: false, last: '' };
  item.done += 1;
  item.last = new Date().toISOString();
  if (ok) {
    item.good += 1;
    item.streak += 1;
  } else {
    item.bad += 1;
    item.streak = 0;
    item.mastered = false;
  }
  if (item.done >= 3 && item.streak >= 3) item.mastered = true;
  state.progress.perWord[key] = item;
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
