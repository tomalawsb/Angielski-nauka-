'use strict';
(function (global) {
  const FLEXIBLE_WORDS = new Set([
    'today','tomorrow','yesterday','now','later','here','there','please','first','already','still',
    'dzisiaj','jutro','wczoraj','teraz','pozniej','tutaj','tam','prosze','najpierw','juz','nadal'
  ]);

  const CONTRACTIONS = [
    [/\bcan['’]?t\b|\bcant\b|\bcannot\b/gi, 'can not'],
    [/\bwon['’]?t\b|\bwont\b/gi, 'will not'],
    [/\bdon['’]?t\b|\bdont\b/gi, 'do not'],
    [/\bdoesn['’]?t\b|\bdoesnt\b/gi, 'does not'],
    [/\bdidn['’]?t\b|\bdidnt\b/gi, 'did not'],
    [/\bisn['’]?t\b|\bisnt\b/gi, 'is not'],
    [/\baren['’]?t\b|\barent\b/gi, 'are not'],
    [/\bwasn['’]?t\b|\bwasnt\b/gi, 'was not'],
    [/\bweren['’]?t\b|\bwerent\b/gi, 'were not'],
    [/\bhaven['’]?t\b|\bhavent\b/gi, 'have not'],
    [/\bhasn['’]?t\b|\bhasnt\b/gi, 'has not'],
    [/\bhadn['’]?t\b|\bhadnt\b/gi, 'had not'],
    [/\bshouldn['’]?t\b|\bshouldnt\b/gi, 'should not'],
    [/\bwouldn['’]?t\b|\bwouldnt\b/gi, 'would not'],
    [/\bcouldn['’]?t\b|\bcouldnt\b/gi, 'could not'],
    [/\bi['’]?m\b|\bim\b/gi, 'i am'],
    [/\byou['’]?re\b|\byoure\b/gi, 'you are'],
    [/\bwe['’]?re\b/gi, 'we are'],
    [/\bthey['’]?re\b|\btheyre\b/gi, 'they are'],
    [/\bit['’]?s\b/gi, 'it is'],
    [/\bthat['’]?s\b|\bthats\b/gi, 'that is'],
    [/\bthere['’]?s\b|\btheres\b/gi, 'there is'],
    [/\bi['’]?ve\b|\bive\b/gi, 'i have'],
    [/\byou['’]?ve\b|\byouve\b/gi, 'you have'],
    [/\bwe['’]?ve\b|\bweve\b/gi, 'we have'],
    [/\bthey['’]?ve\b|\btheyve\b/gi, 'they have']
  ];


  const SPELLING_VARIANTS = [
    [/\bcolours?\b/gi, match => match.toLowerCase()==='colours'?'colors':'color'],
    [/\bfavourites?\b/gi, match => match.toLowerCase()==='favourites'?'favorites':'favorite'],
    [/\bneighbours?\b/gi, match => match.toLowerCase()==='neighbours'?'neighbors':'neighbor'],
    [/\bneighbourhood\b/gi, 'neighborhood'], [/\bcentres?\b/gi, match => match.toLowerCase()==='centres'?'centers':'center'],
    [/\btheatres?\b/gi, match => match.toLowerCase()==='theatres'?'theaters':'theater'],
    [/\btravelled\b/gi,'traveled'], [/\btravelling\b/gi,'traveling'], [/\btraveller\b/gi,'traveler'],
    [/\bcancelled\b/gi,'canceled'], [/\bcancelling\b/gi,'canceling'],
    [/\borganise(d|s)?\b/gi, match => match.toLowerCase().replace('organis','organiz')], [/\borganising\b/gi,'organizing'],
    [/\borganisations?\b/gi, match => match.toLowerCase()==='organisations'?'organizations':'organization'],
    [/\brealise(d|s)?\b/gi, match => match.toLowerCase().replace('realis','realiz')], [/\brealising\b/gi,'realizing'],
    [/\bgrey\b/gi,'gray'], [/\bprogrammes?\b/gi, match => match.toLowerCase()==='programmes'?'programs':'program'],
    [/\blearnt\b/gi,'learned'], [/\bburnt\b/gi,'burned'], [/\bdreamt\b/gi,'dreamed'],
    [/\bmetres?\b/gi, match => match.toLowerCase()==='metres'?'meters':'meter'],
    [/\blitres?\b/gi, match => match.toLowerCase()==='litres'?'liters':'liter'], [/\bbehaviour\b/gi,'behavior']
  ];

  const CONTRAST_GROUPS = [
    ['today','tomorrow','yesterday'], ['dzisiaj','jutro','wczoraj'],
    ['here','there'], ['tutaj','tam'],
    ['now','later'], ['teraz','pozniej'],
    ['morning','afternoon','evening','night'], ['rano','popoludnie','wieczor','noc'],
    ['before','after'], ['przed','po'],
    ['left','right'], ['lewo','prawo','lewej','prawej'],
    ['on','off'], ['wlaczony','wylaczony'],
    ['open','closed'], ['otwarty','zamkniety'],
    ['more','less'], ['wiecej','mniej'],
    ['high','low'], ['wysoki','niski'],
    ['strong','weak'], ['mocny','slaby'],
    ['better','worse'], ['lepszy','gorszy'],
    ['always','never'], ['zawsze','nigdy']
  ];

  function normalize(text) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ąćęłńóśźż\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function canonicalText(text) {
    let value = String(text || '').toLowerCase().replace(/[’`]/g, "'");
    for (const [pattern, replacement] of CONTRACTIONS) value = value.replace(pattern, replacement);
    for (const [pattern, replacement] of SPELLING_VARIANTS) value = value.replace(pattern, replacement);
    return normalize(value);
  }

  function wordsOf(text) {
    return canonicalText(text).split(' ').filter(Boolean);
  }

  function dl(a, b) {
    a = String(a || ''); b = String(b || '');
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
        }
      }
    }
    return dp[a.length][b.length];
  }

  function isAdjacentTransposition(a, b) {
    if (!a || !b || a.length !== b.length || a.length < 4) return false;
    const differences = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differences.push(i);
    return differences.length === 2
      && differences[1] === differences[0] + 1
      && a[differences[0]] === b[differences[1]]
      && a[differences[1]] === b[differences[0]];
  }

  function isLikelyTypo(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (isAdjacentTransposition(a, b)) return true;
    if (dl(a, b) !== 1 || Math.min(a.length, b.length) < 5) return false;
    return a[0] === b[0] && a[a.length - 1] === b[b.length - 1];
  }

  function tokenSimilarity(a, b) {
    if (a === b) return 1;
    if (!isLikelyTypo(a, b)) return 0;
    return isAdjacentTransposition(a, b) ? 0.94 : 0.88;
  }

  function bagAlignment(answerWords, expectedWords) {
    const used = new Array(expectedWords.length).fill(false);
    const pairs = [];
    for (let ai = 0; ai < answerWords.length; ai++) {
      let best = -1, bestScore = 0;
      for (let ei = 0; ei < expectedWords.length; ei++) {
        if (used[ei]) continue;
        const similarity = tokenSimilarity(answerWords[ai], expectedWords[ei]);
        if (similarity > bestScore) { bestScore = similarity; best = ei; }
      }
      if (best >= 0 && bestScore >= 0.78) {
        used[best] = true;
        pairs.push({ ai, ei: best, score: bestScore });
      }
    }
    return { pairs, used };
  }

  function sequenceScore(answerWords, expectedWords) {
    const aw = answerWords.filter(word => !FLEXIBLE_WORDS.has(word));
    const ew = expectedWords.filter(word => !FLEXIBLE_WORDS.has(word));
    if (!ew.length) return 1;
    const dp = Array.from({ length: aw.length + 1 }, () => Array(ew.length + 1).fill(0));
    for (let i = 1; i <= aw.length; i++) {
      for (let j = 1; j <= ew.length; j++) {
        const sim = tokenSimilarity(aw[i - 1], ew[j - 1]);
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        if (sim >= 0.78) dp[i][j] = Math.max(dp[i][j], dp[i - 1][j - 1] + sim);
      }
    }
    return dp[aw.length][ew.length] / Math.max(ew.length, aw.length, 1);
  }

  function findContrast(tokensA, tokensE) {
    for (const group of CONTRAST_GROUPS) {
      const expected = group.find(word => tokensE.includes(word));
      const answer = group.find(word => tokensA.includes(word));
      if (expected && answer && expected !== answer) return { expected, answer };
    }
    return null;
  }

  function extractNumbers(tokens) {
    const numberWords = new Map([
      ['zero','0'],['one','1'],['two','2'],['three','3'],['four','4'],['five','5'],['six','6'],['seven','7'],['eight','8'],['nine','9'],['ten','10'],
      ['jeden','1'],['jedna','1'],['dwa','2'],['dwie','2'],['trzy','3'],['cztery','4'],['piec','5'],['szesc','6'],['siedem','7'],['osiem','8'],['dziewiec','9'],['dziesiec','10']
    ]);
    return tokens.map(token => /^\d+$/.test(token) ? token : numberWords.get(token)).filter(Boolean);
  }

  function semanticIssues(answerWords, expectedWords) {
    const issues = [];
    const negatives = new Set(['not','never','no','nie','nigdy','bez']);
    const answerNegative = answerWords.some(word => negatives.has(word));
    const expectedNegative = expectedWords.some(word => negatives.has(word));
    if (answerNegative !== expectedNegative) issues.push({ code: 'negation', severe: true, message: 'Zmienione przeczenie lub sens zdania.' });

    const contrast = findContrast(answerWords, expectedWords);
    if (contrast) issues.push({ code: 'meaning', severe: true, message: `Zmienione znaczenie: „${contrast.answer}” zamiast „${contrast.expected}”.` });

    const answerNumbers = extractNumbers(answerWords);
    const expectedNumbers = extractNumbers(expectedWords);
    if (expectedNumbers.length && answerNumbers.join('|') !== expectedNumbers.join('|')) {
      issues.push({ code: 'number', severe: true, message: 'Nie zgadza się liczba lub wartość.' });
    }
    return issues;
  }


  function grammarIssues(answerWords, expectedWords) {
    const issues = [];
    const auxiliaries = [
      ['am','is','are','was','were'], ['do','does','did'], ['have','has','had'],
      ['can','could'], ['will','would'], ['shall','should'], ['may','might'], ['must']
    ];
    for (const group of auxiliaries) {
      const expected = group.find(word => expectedWords.includes(word));
      const answer = group.find(word => answerWords.includes(word));
      if (expected && answer && expected !== answer) {
        issues.push({ code: 'grammar', message: `Nieprawidłowa forma gramatyczna: „${answer}” zamiast „${expected}”.` });
        break;
      }
    }
    const prepositions = new Set(['at','in','on','to','for','from','with','about','of','by','into','over','under','before','after','during','without','within','through']);
    const expectedPreps = expectedWords.filter(word => prepositions.has(word));
    const answerPreps = answerWords.filter(word => prepositions.has(word));
    if (expectedPreps.length && answerPreps.join('|') !== expectedPreps.join('|')) {
      issues.push({ code: 'preposition', message: `Sprawdź przyimek. Oczekiwano: ${expectedPreps.join(', ')}.` });
    }
    const commonStem = (a,b) => {
      const strip = word => word.replace(/(ing|ed|es|s)$/,'');
      const sa=strip(a),sb=strip(b);return sa.length>=3&&sb.length>=3&&(sa===sb||sa.startsWith(sb)||sb.startsWith(sa));
    };
    for (const expected of expectedWords) {
      const answer = answerWords.find(word => word !== expected && commonStem(word, expected));
      if (answer) { issues.push({ code: 'verb_form', message: `Sprawdź formę wyrazu: „${answer}” zamiast „${expected}”.` }); break; }
    }
    return issues;
  }

  function answerScore(answer, expected) {
    const a = canonicalText(answer), e = canonicalText(expected);
    if (!a || !e) return { score: 0, status: 'wrong', label: 'Źle', issues: [{ code: 'empty', message: 'Brak odpowiedzi.' }], expected };
    if (a === e) return { score: 1, status: 'correct', label: 'Dobrze', issues: [], expected };

    const aw = wordsOf(a), ew = wordsOf(e), sentence = ew.length > 1;
    const charSimilarity = 1 - dl(a, e) / Math.max(a.length, e.length, 1);
    const alignment = bagAlignment(aw, ew);
    const matched = alignment.pairs.length;
    const precision = matched / Math.max(aw.length, 1);
    const recall = matched / Math.max(ew.length, 1);
    const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
    const order = sentence ? sequenceScore(aw, ew) : 1;
    const issues = [...semanticIssues(aw, ew), ...grammarIssues(aw, ew)];
    const severe = issues.some(issue => issue.severe);

    const matchedExpected = new Set(alignment.pairs.map(pair => pair.ei));
    const matchedAnswer = new Set(alignment.pairs.map(pair => pair.ai));
    const missing = ew.filter((_, index) => !matchedExpected.has(index));
    const extra = aw.filter((_, index) => !matchedAnswer.has(index));

    if (sentence && recall >= 0.7 && order < 0.62) issues.push({ code: 'order', message: 'Nieprawidłowy szyk. W zdaniu oznajmującym zachowaj zwykle: podmiot + czasownik + reszta.' });
    if (missing.length) {
      const articles = new Set(['a', 'an', 'the']);
      if (missing.every(word => articles.has(word))) issues.push({ code: 'article', message: 'Brakuje rodzajnika a, an lub the.' });
      else issues.push({ code: 'missing', message: `Brakuje: ${missing.join(', ')}.` });
    }
    if (extra.length) issues.push({ code: 'extra', message: `Dodatkowe lub inne słowa: ${extra.join(', ')}.` });

    let score = sentence
      ? (f1 * 0.48 + order * 0.34 + Math.max(0, charSimilarity) * 0.18)
      : Math.max(f1, charSimilarity);
    if (severe) score = Math.min(score, 0.35);

    if (!sentence) {
      if (isLikelyTypo(a, e)) return { score: Math.max(score, 0.88), status: 'correct', label: 'Dobrze', issues, expected };
      if (charSimilarity >= 0.62) return { score: Math.min(score, 0.79), status: 'partial', label: 'Prawie dobrze', issues, expected };
      return { score, status: 'wrong', label: 'Źle', issues, expected };
    }

    const correct = !severe && recall >= 0.9 && precision >= 0.78 && order >= 0.76 && score >= 0.82;
    if (correct) return { score, status: 'correct', label: 'Dobrze', issues: [], expected };
    const partial = !severe && recall >= 0.55 && order >= 0.38 && score >= 0.48;
    if (partial) return { score, status: 'partial', label: 'Prawie dobrze', issues, expected };
    return { score, status: 'wrong', label: 'Źle', issues, expected };
  }

  function bestAnswerScore(answer, variants) {
    const list = [...new Set((Array.isArray(variants) ? variants : [variants]).filter(Boolean).map(String))];
    if (!list.length) return answerScore(answer, '');
    const rank = { wrong: 0, partial: 1, correct: 2 };
    let best = null;
    for (const expected of list) {
      const result = answerScore(answer, expected);
      if (!best || rank[result.status] > rank[best.status] || (rank[result.status] === rank[best.status] && result.score > best.score)) best = result;
    }
    return { ...best, variants: list };
  }

  function defaultProgress(progress = {}) {
    return {
      seen: 0, correct: 0, wrong: 0, streak: 0, mastery: 0, nextReview: null,
      lastAnswer: null, lastSuccessDay: null, successDays: [], status: 'new', intervalIndex: 0,
      lapses: 0, ...progress
    };
  }

  function addDaysKey(dateKey, days) {
    const [year, month, day] = String(dateKey).split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function migrateProgress(progress = {}, currentDateKey = null) {
    const p = defaultProgress(progress);
    const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback;
    p.seen = number(p.seen);
    p.correct = number(p.correct);
    p.wrong = number(p.wrong);
    p.streak = number(p.streak);
    p.lapses = number(p.lapses);
    if (p.seen < p.correct + p.wrong) p.seen = p.correct + p.wrong;

    const days = Array.isArray(p.successDays) ? p.successDays.filter(Boolean).map(String) : [];
    if (p.lastSuccessDay) days.push(String(p.lastSuccessDay));
    p.successDays = [...new Set(days)].sort().slice(-20);
    p.lastSuccessDay = p.successDays.at(-1) || null;
    p.intervalIndex = Math.min(6, number(p.intervalIndex), p.successDays.length);

    const accuracy = p.correct / Math.max(1, p.seen);
    const distinctDays = p.successDays.length;
    p.mastery = Math.max(0, Math.min(100, Math.round(
      accuracy * 55 + Math.min(distinctDays, 5) / 5 * 30 + Math.min(p.intervalIndex, 6) / 6 * 15
    )));
    const mastered = distinctDays >= 5 && p.intervalIndex >= 5 && accuracy >= 0.8;
    p.status = mastered ? 'mastered' : (p.seen === 0 ? 'new' : (p.status === 'weak' ? 'weak' : 'review'));
    if (!mastered && progress.status === 'mastered' && currentDateKey) p.nextReview = currentDateKey;
    if (p.seen > 0 && !p.nextReview && currentDateKey) p.nextReview = currentDateKey;
    return p;
  }

  function advanceProgress(progress, ok, dateKey) {
    const p = defaultProgress(progress);
    p.successDays = Array.isArray(p.successDays) ? [...new Set(p.successDays.filter(Boolean))] : [];
    p.seen += 1;
    p.lastAnswer = dateKey;

    if (ok) {
      p.correct += 1;
      p.streak += 1;
      const firstSuccessToday = p.lastSuccessDay !== dateKey;
      if (firstSuccessToday) {
        p.lastSuccessDay = dateKey;
        if (!p.successDays.includes(dateKey)) p.successDays.push(dateKey);
        p.successDays = p.successDays.slice(-20);
        p.intervalIndex = Math.min((p.intervalIndex || 0) + 1, 6);
        const intervals = [1, 3, 7, 14, 30, 60];
        p.nextReview = addDaysKey(dateKey, intervals[Math.max(0, p.intervalIndex - 1)] || 1);
      }
    } else {
      p.wrong += 1;
      p.lapses = (p.lapses || 0) + 1;
      p.streak = 0;
      p.intervalIndex = Math.max(0, (p.intervalIndex || 0) - 2);
      p.nextReview = addDaysKey(dateKey, 1);
    }

    const accuracy = p.correct / Math.max(1, p.seen);
    const distinctDays = p.successDays.length;
    p.mastery = Math.max(0, Math.min(100, Math.round(accuracy * 55 + Math.min(distinctDays, 5) / 5 * 30 + Math.min(p.intervalIndex, 6) / 6 * 15)));
    if (!ok) p.mastery = Math.max(0, p.mastery - 12);
    p.status = distinctDays >= 5 && p.intervalIndex >= 5 && accuracy >= 0.8 ? 'mastered' : (!ok ? 'weak' : 'review');
    return p;
  }

  global.LearningCore = { normalize, canonicalText, wordsOf, dl, answerScore, bestAnswerScore, migrateProgress, advanceProgress, addDaysKey, isLikelyTypo };
})(window);
