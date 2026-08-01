'use strict';

/**
 * Angielski Daily Trainer 6.6.0
 * Sesje, renderowanie zadań, ocenianie i ponawianie błędów.
 * Rozszerzone o etapy kursu, zadanie końcowe i zapis wyniku lekcji.
 */

async function startPractice(kind){
  if(kind==='car'&&!state.settings.carWarningDismissed){const allowed=await showCarWarning();if(!allowed)return;}
  const tasks=practiceQueue(kind);
  if(!tasks.length){const learnedOnly=['sentences','writing','listening','lector','speaking','dialogues','car'].includes(kind);const message=learnedOnly?'Najpierw poznaj materiał w głównej nauce. Ten tryb korzysta tylko z wcześniej przedstawionych treści.':kind==='vocab'?'Brak pojedynczych słów dla wybranego poziomu i tematyki.':'Brak zadań dla wybranego poziomu i tematyki.';notify(message,'error');return;}
  startSession(tasks,kind,{source:kind==='car'?'car':'practice'});
}
function startSmart(){const today=state.days[todayKey()]||{correct:0,wrong:0};const done=(today.correct||0)+(today.wrong||0);const remaining=Math.max(5,(state.settings.dailyGoal||20)-done);const tasks=practiceQueue('test').slice(0,remaining);if(!tasks.length){notify('Brak zadań. Zmień poziom, tematykę albo limity w ustawieniach.','error');return;}startSession(tasks,'test',{source:'practice'});}
function startReviews(){const tasks=queue(true);if(!tasks.length){notify('Nie masz zaległych powtórek.','success');return;}startSession(tasks,'reviews',{source:'review'});}
function startSession(tasks,practice='mixed',meta={}){const previous=deepClone(state),preserveOrder=practice==='dialogues'||meta.source==='course',prepared=preserveOrder?[...tasks]:shuffle(tasks);session={queue:prepared,index:0,correct:0,wrong:0,xp:0,practice,source:meta.source||'practice',startedAt:new Date().toISOString(),...meta};state.recentWordIds=[...new Set([...(state.recentWordIds||[]),...prepared.map(item=>item.wordId).filter(Boolean)])].slice(-120);checked=false;selectedChoice=null;retrySnapshot=null;if(!snapshotSession()){state=previous;session=null;return;}$('emptyLesson')?.classList.add('hidden');$('summary')?.classList.add('hidden');$('lessonCard')?.classList.remove('hidden');show('learn');renderLesson();}
function snapshotSession(saveNow=true){state.activeSession=session?deepClone(session):null;return saveNow?save():true;}
function resumeSession(){const saved=state.activeSession;if(!saved||!Array.isArray(saved.queue)||!saved.queue.length){notify('Nie ma sesji do wznowienia.','error');return;}if(saved.source!=='course'&&!practiceSessionMatchesFilters(saved)){state.activeSession=null;save({silent:true});renderToday();notify('Ta sesja używała poprzedniej tematyki. Została usunięta, aby nie mieszać materiałów.','error');return;}session=JSON.parse(JSON.stringify(saved));checked=false;selectedChoice=null;retrySnapshot=null;$('emptyLesson')?.classList.add('hidden');$('summary')?.classList.add('hidden');$('lessonCard')?.classList.remove('hidden');show('learn');renderLesson();}
async function discardSavedSession(){if(!await askConfirm('Usunąć niedokończoną lekcję?','Dotychczasowy wynik tej sesji nie zostanie dopisany do historii.','Usuń'))return;const previous=deepClone(state.activeSession);state.activeSession=null;if(!save()){state.activeSession=previous;return;}renderToday();}
async function endSessionSafely(){if(!session)return;const ok=await askConfirm('Przerwać lekcję?','Bieżący stan zostanie zapisany i będzie można wznowić lekcję z ekranu Dzisiaj.','Przerwij');if(!ok)return;pauseSession();}
function pauseSession(){stopCarRecognition();clearCarTimer();if(checked)session.index=Math.min(session.index+1,session.queue.length);retrySnapshot=null;if(!snapshotSession())return;$('lessonCard')?.classList.add('hidden');$('emptyLesson')?.classList.remove('hidden');session=null;checked=false;selectedChoice=null;show('today');notify('Lekcja została zapisana do wznowienia.','success');}
function curTask(){return session?.queue?.[session.index]||null;}
function curWord(){const current=curTask();return current?WORDS.find(word=>word.id===current.wordId):null;}
function modeLabel(value){return {course_intro:'wprowadzenie',course_intro_group:'nowy materiał',course_grammar:'gramatyka',course_final:'zadanie końcowe',word_choice:'wybór słówka',word_write:'pisanie',sentence_translate:'zdania',listening_write:'słuchanie',speaker_repeat:'słuchaj i powtarzaj',speaking:'mówienie',dialogue:'dialog',car_voice:'samochód',en_pl:'angielski → polski'}[value]||value;}
function dialogueScene(word){return word?DIALOGUE_SCENES[word.id]||null:null;}
function expected(word,taskMode,current=curTask()){
  if(taskMode==='course_final')return current?.expectedAnswer||current?.exampleAnswer||current?.acceptedAnswers?.[0]||'';
  if(taskMode==='course_intro')return word?.english||'';
  if(taskMode==='course_intro_group'||taskMode==='course_grammar')return'';
  if(!word)return'';
  if(taskMode==='dialogue'){const scene=dialogueScene(word);if(scene?.accepted?.length)return scene.accepted[0];}
  return (taskMode==='en_pl'||taskMode==='word_choice')?word.polish:(['sentence_translate','listening_write','speaker_repeat','speaking','car_voice'].includes(taskMode)?sentenceEn(word):word.english);
}
function acceptedAnswers(word,taskMode,current=curTask()){
  if(taskMode==='course_final')return [...new Set([current?.expectedAnswer,...(current?.acceptedAnswers||[])].filter(Boolean).map(String))];
  const answers=[expected(word,taskMode,current)],scene=taskMode==='dialogue'?dialogueScene(word):null;if(scene?.accepted)answers.push(...scene.accepted);if(Array.isArray(word?.acceptedAnswers))answers.push(...word.acceptedAnswers);if(word?.acceptedAnswers&&Array.isArray(word.acceptedAnswers[taskMode]))answers.push(...word.acceptedAnswers[taskMode]);return [...new Set(answers.filter(Boolean).map(String))];
}
const COMMON_FIRST_NAMES=new Set([
  'adam','adrian','agnieszka','aleksander','aleksandra','alex','alice','alicia','alicja','amelia','amy','andrew','andrzej','anna','anthony','antoni','antonina','barbara','bartosz','beata','ben','benjamin','blazej','bogdan','bruno','carol','caroline','charles','chris','christopher','david','dawid','dominika','dorota','edward','eliza','elizabeth','ewa','frank','franciszek','gabriel','gabriela','grace','grzegorz','hanna','helen','helena','henry','igor','iza','izabela','jacob','jakub','jan','jane','janina','jason','jerzy','joanna','john','joseph','julia','julian','justyna','kamil','karol','karolina','kate','katarzyna','kevin','krystyna','krzysztof','laura','lena','leon','lidia','lucy','lukasz','magdalena','maja','marcin','maria','mariusz','mark','marta','martin','mary','mateusz','michal','michael','monika','natalia','nathan','nicole','nikola','olga','oliver','oliwia','oscar','patricia','patryk','paul','pawel','peter','piotr','rafal','richard','robert','rose','ryszard','sam','samuel','sandra','sarah','sebastian','simon','sofia','sophia','stanislaw','stefan','steven','susan','sylwia','teresa','thomas','tom','tomasz','urszula','victor','victoria','will','william','wojciech','zofia','zbigniew','zuzanna'
]);
const EXPLICIT_NON_NAMES=new Set([
  'animal','boy','camera','cat','child','client','computer','customer','device','dog','engineer','family','father','friend','girl','home','house','human','husband','internet','man','mother','phone','person','robot','router','server','sister','student','teacher','technician','television','tv','wife','woman','worker'
]);
let selfNameBlockedWords=null;
function blockedNameWords(){
  if(selfNameBlockedWords)return selfNameBlockedWords;
  const blocked=new Set([
    ...EXPLICIT_NON_NAMES,
    'very','happy','fine','good','well','tired','hungry','thirsty','sad','angry','busy','ready','sorry','from','in','near','at','years','year','old','polish','english','german','twenty','thirty','one','two','three','four','five','six','seven','eight','nine','ten'
  ]);
  for(const item of (Array.isArray(WORDS)?WORDS:[])){
    for(const value of [item?.english,item?.polish]){
      for(const term of wordsOf(value))if(/^[a-ząćęłńóśźż]{2,24}$/i.test(term))blocked.add(term);
    }
  }
  for(const name of COMMON_FIRST_NAMES)blocked.delete(name);
  selfNameBlockedWords=blocked;
  return blocked;
}
function hasSelfName(answer){
  const blocked=blockedNameWords();
  const raw=String(answer||'').replace(/[’`]/g,"'").replace(/\bi['’]?m\b/gi,'I am');
  const cleanCandidate=value=>String(value||'').trim().replace(/^[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+|[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż'-]+$/g,'').trim();
  const isPlausible=(value,{explicit=false}={})=>{
    const cleaned=cleanCandidate(value),normalized=normalize(cleaned);
    if(!/^[a-ząćęłńóśźż]{2,24}$/i.test(normalized))return false;
    if(blocked.has(normalized)&&!COMMON_FIRST_NAMES.has(normalized))return false;
    if(explicit)return true;
    return COMMON_FIRST_NAMES.has(normalized)||/^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(cleaned);
  };
  const explicitPattern=/\bmy name is\s+([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż'-]*)/gi;
  for(const match of raw.matchAll(explicitPattern)){if(isPlausible(match[1],{explicit:true}))return true;}
  const selfPattern=/\bi am\s+([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż'-]*)/gi;
  for(const match of raw.matchAll(selfPattern)){if(isPlausible(match[1]))return true;}
  return false;
}
function isMeaningfulSentenceUnit(value){
  const raw=String(value||'').trim();if(!raw)return false;
  const normalized=normalize(raw);const tokens=wordsOf(raw);if(!tokens.length)return false;
  if(/^(hello|hi|good morning\b|good afternoon\b|good evening\b|good night\b|nice to meet you\b|excuse me\b|dear\b|goodbye\b|bye\b|see you\b|kind regards\b|best regards\b|yours sincerely\b|yours faithfully\b|yes\b|no\b|of course\b|certainly\b|sure\b|thank you\b|thanks\b|sorry\b)/.test(normalized))return true;
  let cleaned=normalized.replace(/^(?:first|then|next|after that|finally|later|at first|in the end|a few minutes later|however|luckily|unfortunately|fortunately|suddenly|maybe|please|according to the news|every day|in the morning|in the afternoon|in the evening|at night|at eight yesterday|at nine yesterday|at ten yesterday|last weekend|last year|next summer|this morning|this afternoon|this evening|yesterday|today|tomorrow|years ago|now|so|if|when|while|on sunday|on monday|on tuesday|on wednesday|on thursday|on friday|on saturday)\s*,?\s*/,'');
  cleaned=cleaned.replace(/\b(?:don t|dont)\b/g,'do not').replace(/\b(?:doesn t|doesnt)\b/g,'does not').replace(/\b(?:didn t|didnt)\b/g,'did not').replace(/\b(?:isn t|isnt)\b/g,'is not').replace(/\b(?:aren t|arent)\b/g,'are not').replace(/\b(?:wasn t|wasnt)\b/g,'was not').replace(/\b(?:weren t|werent)\b/g,'were not').replace(/\b(?:haven t|havent)\b/g,'have not').replace(/\b(?:hasn t|hasnt)\b/g,'has not').replace(/\b(?:can t|cant)\b/g,'cannot').replace(/\b(?:won t|wont)\b/g,'will not');
  const subjectStart=/^(?:i|you|he|she|it|we|they|there|this|that|these|those|my|your|his|her|its|our|their|the|a|an)\b/;
  const verbToken=/(?:^|\s)(?:am|is|are|was|were|have|has|had|do|does|did|will|would|can|cannot|could|should|must|need|needs|want|wants|live|lives|work|works|worked|go|goes|went|stay|stays|stayed|eat|eats|ate|drink|drinks|start|starts|started|finish|finishes|finished|check|checks|checked|help|helps|helped|repair|repairs|repaired|read|reads|come|comes|came|get|gets|got|wake|wakes|listen|listens|play|plays|visit|visits|visited|wear|wears|look|looks|leave|leaves|left|study|studies|studied|teach|teaches|taught|ask|asks|asked|watch|watched|cook|cooked|clean|cleaned|see|saw|buy|bought|take|took|meet|met|book|booked|arrive|arrived|learn|learned|learnt|improve|improved|complete|completed|pass|passed|move|moved|sign|signed|pay|paid|wait|waited|order|ordered|bring|brought|call|called|hear|heard|say|said|tell|told|become|became|stop|stopped|change|changed|choose|chose|prefer|preferred|travel|travelled|traveled|try|tried|ride|rode|win|won|lose|lost|break|broke|miss|missed|cancel|cancelled|canceled|forget|forgot|find|found|send|sent|make|made|apply|applied|write|wrote|return|returned|exchange|exchanged|compare|compared|decide|decided|feel|feels|felt|like|likes|liked|love|loves|loved|hate|hates|hated|hurt|hurts|rain|rains|rained|snow|snows|snowed|drive|drives|drove|walk|walks|walked|sleep|sleeps|slept|answer|answers|answered|prepare|prepares|prepared|attend|attends|attended|deal|deals|dealt|manage|manages|managed|solve|solves|solved|practise|practises|practised|practice|practices|practiced|keep|keeps|kept|speak|speaks|spoke|use|uses|used|cost|costs|contain|contains|allow|allows|allowed|damage|damages|damaged|hit|hits|put|puts|cut|cuts|add|adds|mix|mixes|serve|serves|served|pack|packs|packed|heat|heats|heated)\b/;
  if(/^(?:what|where|when|who|why|how|which)\s+(?:do|does|did|am|is|are|was|were|have|has|will|would|can|could|should|must)\s+/.test(cleaned))return true;
  if(/^(?:do|does|did|am|is|are|was|were|have|has|will|would|can|could|should|must)\s+/.test(cleaned))return true;
  if(/^(?:[a-z]+\s+)?(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+(?:fifteen|thirty|forty five))?\s+(?:am|is|are|was|were)\b/.test(cleaned))return true;
  if(/^(?:go|visit|watch|clean|cook|stay|miss|lose|cancel|forget|arrive|travel|try|ride|win|book|pay|call|move|find|compare|choose|check|replace|follow|ask|tell|leave|take|bring|order|return|exchange|work|practise|practice|learn|improve|make|keep|apply|send|write|buy|look|cut|add|mix|put|serve|turn|wait|contact|heat|pack)\b/.test(cleaned)&&tokens.length>=2)return true;
  if(/\bplease\b/.test(normalized)&&tokens.length>=2)return true;
  if(subjectStart.test(cleaned)&&verbToken.test(' '+cleaned))return true;
  const first=cleaned.split(/\s+/)[0];
  const blocked=new Set(['last','yesterday','today','tomorrow','weekend','coffee','weather','phone','internet','cat','dog','table','router']);
  if(!blocked.has(first)&&tokens.length>=3&&verbToken.test(' '+cleaned))return true;
  return false;
}
function countSentenceUnits(answer){
  const raw=String(answer||'').trim();if(!raw)return 0;
  if(/[.!?]/.test(raw))return raw.split(/[.!?]+/).map(part=>part.trim()).filter(isMeaningfulSentenceUnit).length;
  const normalized=normalize(raw);
  const subject='(?:i|you|he|she|it|we|they|there|this|that|these|those|(?:my|your|his|her|our|their|the|a|an)\\s+[a-ząćęłńóśźż]+(?:\\s+[a-ząćęłńóśźż]+)?)';
  const verb='(?:am|is|are|was|were|have|has|had|can|could|should|must|will|would|do|does|did|live|lives|work|works|go|goes|went|stay|stays|stayed|eat|eats|ate|drink|drinks|start|starts|started|finish|finishes|finished|check|checks|checked|help|helps|helped|repair|repairs|read|reads|come|comes|came|get|gets|got|wake|wakes|listen|listens|play|plays|visit|visits|visited|watch|watched|cook|cooked|clean|cleaned|see|saw|buy|bought|take|took|meet|met|book|booked|arrive|arrived|learn|learned|learnt|improve|improved|complete|completed|pass|passed|move|moved|sign|signed|pay|paid|wait|waited|order|ordered|bring|brought|call|called|hear|heard|say|said|tell|told|become|became|stop|stopped|change|changed|choose|chose|prefer|preferred|travel|travelled|traveled|try|tried|ride|rode|win|won|lose|lost|break|broke|miss|missed|cancel|cancelled|canceled|forget|forgot|find|found|send|sent|make|made|apply|applied|write|wrote|return|returned|exchange|exchanged|compare|compared|decide|decided|feel|feels|felt|like|likes|liked|love|loves|loved|hate|hates|hated|hurt|hurts|rain|rains|rained|snow|snows|snowed|drive|drives|drove|walk|walks|walked|sleep|sleeps|slept)';
  const statements=[...normalized.matchAll(new RegExp('\\b'+subject+'\\s+(?:(?:do|does|did|will|would|can|could|should|must|have|has|had)\\s+)?'+verb+'\\b','gi'))].length;
  const questions=[...normalized.matchAll(/\b(?:what|where|when|who|why|how|which)\s+(?:do|does|did|am|is|are|was|were|have|has|will|would|can|could|should|must)\s+(?:i|you|he|she|it|we|they)\b/g)].length;
  return Math.max(1,statements+questions);
}
function countPeopleReferences(answer){
  const raw=String(answer||'').replace(/[’`]/g,"'"),normalized=normalize(raw);
  const names=new Set(wordsOf(raw).map(normalize).filter(name=>COMMON_FIRST_NAMES.has(name)));
  const roleNames='friend|brother|sister|mother|mum|father|dad|parent|parents|grandmother|grandfather|grandparent|grandparents|husband|wife|son|daughter|child|children|uncle|aunt|cousin|colleague|neighbour|neighbor';
  const namedRoles=new Set();
  const roleBeforeName=new RegExp('\\b('+roleNames+')\\s+([a-ząćęłńóśźż]+)\\b','gi');
  for(const match of normalized.matchAll(roleBeforeName))if(COMMON_FIRST_NAMES.has(normalize(match[2])))namedRoles.add(normalize(match[1]));
  const nameBeforeRole=new RegExp('\\b([a-ząćęłńóśźż]+)\\s+(?:is|is also|is my|is our|is his|is her|is their)\\s+(?:my|your|his|her|our|their|a|the)?\\s*('+roleNames+')\\b','gi');
  for(const match of normalized.matchAll(nameBeforeRole))if(COMMON_FIRST_NAMES.has(normalize(match[1])))namedRoles.add(normalize(match[2]));
  const subjectRoles=new Set(),sentences=raw.split(/[.!?]+/).map(value=>normalize(value)).filter(Boolean);
  const subjectPattern=new RegExp('(?:^|\\b(?:and|but)\\s+)(?:(?:this|that)\\s+is\\s+)?(?:my|your|his|her|our|their|a|the)?\\s*('+roleNames+')\\b','gi');
  for(const sentence of sentences){
    for(const match of sentence.matchAll(subjectPattern))subjectRoles.add(normalize(match[1]));
  }
  for(const role of namedRoles)subjectRoles.delete(role);
  return names.size+subjectRoles.size;
}
function answerSentenceUnits(answer){
  const raw=String(answer||'').trim();if(!raw)return [];
  const punctuated=raw.split(/[.!?]+/).map(value=>value.trim()).filter(Boolean);
  if(punctuated.length>1||/[.!?]/.test(raw))return punctuated;
  // Rozpoznawanie mowy często usuwa interpunkcję. Dzielimy wtedy wypowiedź
  // przed kolejnymi wyraźnymi podmiotami, ale nie rozrywamy krótkich pytań.
  return raw.split(/\s+(?=(?:I|You|He|She|It|We|They|There|This|That|My|Your|His|Her|Our|Their|The|A|An)\s+)/g).map(value=>value.trim()).filter(Boolean);
}
function meaningfulAnswerUnits(answer){
  return answerSentenceUnits(answer).filter(isMeaningfulSentenceUnit);
}
function phraseOccursInUnit(unit,value){
  const normalized=' '+normalize(unit)+' ',phrase=normalize(value);
  return !!phrase&&normalized.includes(' '+phrase+' ');
}
function matchedPhraseGroups(answer,groups,{meaningfulOnly=false}={}){
  const units=meaningfulOnly?meaningfulAnswerUnits(answer):answerSentenceUnits(answer);
  return (groups||[]).filter(group=>(Array.isArray(group)?group:[group]).some(value=>units.some(unit=>phraseOccursInUnit(unit,value)))).length;
}
function keywordSentenceCount(answer,groups){
  const units=meaningfulAnswerUnits(answer),normalizedGroups=(groups||[]).map(group=>Array.isArray(group)?group:[group]),usedGroups=new Set();
  let count=0;
  for(const unit of units){
    const fresh=[];
    normalizedGroups.forEach((group,index)=>{if(!usedGroups.has(index)&&group.some(value=>phraseOccursInUnit(unit,value)))fresh.push(index);});
    if(fresh.length){count++;fresh.forEach(index=>usedGroups.add(index));}
  }
  return count;
}
function semanticNormalize(value){
  return normalize(value).replace(/\b(?:hasn t|hasnt)\b/g,'has not').replace(/\b(?:haven t|havent)\b/g,'have not').replace(/\b(?:doesn t|doesnt)\b/g,'does not').replace(/\b(?:isn t|isnt)\b/g,'is not').replace(/\b(?:aren t|arent)\b/g,'are not').replace(/\b(?:couldn t|couldnt)\b/g,'could not').replace(/\b(?:won t|wont)\b/g,'will not').replace(/\b(?:didn t|didnt)\b/g,'did not').replace(/\b(?:wasn t|wasnt)\b/g,'was not').replace(/\b(?:weren t|werent)\b/g,'were not');
}
function semanticKeywordPhrases(current={}){
  return (current.requiredKeywords||[]).flatMap(group=>Array.isArray(group)?group:[group]).map(semanticNormalize).filter(Boolean);
}
function isMetaKeywordUnit(unit,current={}){
  const text=semanticNormalize(unit),phrases=semanticKeywordPhrases(current);
  if(!phrases.length)return false;
  const containsKeyword=phrases.some(phrase=>(' '+text+' ').includes(' '+phrase+' '));
  if(!containsKeyword)return false;
  if(/\b(?:this|the)\s+(?:exercise|lesson|word|phrase|expression|keyword|example)\b/.test(text))return true;
  if(/\b(?:i|we|you|they|he|she)\s+(?:can\s+|could\s+|will\s+)?(?:say|write|read|use|repeat|spell|translate|mention)\b/.test(text)&&/\b(?:because|to)\b/.test(text))return true;
  if(/\b(?:helps?|helped)\s+(?:me|us|you|students?)\s+(?:practise|practice|learn|study|remember|use)\b/.test(text))return true;
  if(/\b(?:because|so)\s+it\s+is\s+(?:good|useful|important|helpful|easy|interesting)\b/.test(text))return true;
  if(/\b(?:learn|practise|practice|study)\s+(?:useful\s+)?(?:english|words|vocabulary|grammar|phrases)\b/.test(text)&&!/\bmy goal\b/.test(text))return true;
  return false;
}
function semanticUnits(answer,current={}){
  return meaningfulAnswerUnits(answer).map(semanticNormalize).filter(unit=>unit&&!isMetaKeywordUnit(unit,current));
}
function semanticClauses(answer,current={}){
  return answerSentenceUnits(answer).flatMap(unit=>String(unit).split(/\s*(?:,|;|\band\b|\bbut\b)\s*/i)).map(semanticNormalize).filter(unit=>unit&&!isMetaKeywordUnit(unit,current));
}
function countUnitsMatching(units,pattern){return units.filter(unit=>pattern.test(unit)).length;}
function countDistinctMatches(value,patterns){return patterns.filter(pattern=>pattern.test(value)).length;}
function hasUnit(units,pattern){return units.some(unit=>pattern.test(unit));}
function unitIndex(units,pattern){return units.findIndex(unit=>pattern.test(unit));}
function orderedUnits(units,patterns){let last=-1;for(const pattern of patterns){const next=units.findIndex((unit,index)=>index>last&&pattern.test(unit));if(next<0)return false;last=next;}return true;}
function countDistinctSubjects(units,pattern){
  const subjects=new Set();
  for(const unit of units){const match=unit.match(pattern);if(match?.[1])subjects.add(match[1]);}
  return subjects.size;
}
const A2_PAST_ACTION=/\b(?:i|we|he|she|they|(?:my|our|his|her|their)\s+(?:friend|family|brother|sister|mother|father|train|car|bus|flight)|the\s+[a-z]+)\s+(?:visited|watched|cooked|stayed|went|met|had|saw|bought|took|cleaned|played|worked|travelled|traveled|made|ate|drank|drove|walked|helped|called|arrived|booked|found|lost|missed|packed|left|stopped|started|heard|felt|returned|explored)\b/;
const A2_BASE_ACTION='(?:start|visit|save|meet|see|leave|fly|have|work|study|travel|buy|call|help|book|change|go|stay|cook|watch|clean|exercise|reduce|sleep|listen|practise|practice|review|prepare|attend|solve|manage|answer|repair|pay|return|exchange|order|cut|heat|add|mix|serve|eat|drink|rest|drive|print|show|check|write|send|confirm|move|live|learn|improve|use|become)';
const A2_SEMANTIC_VALIDATORS={
  'a2-m01-l01':{message:'Opisz rzeczywiste czynności z minionego weekendu w co najmniej dwóch pełnych zdaniach.',check:({units,text})=>/\b(?:last weekend|at the weekend|over the weekend|on saturday|on sunday)\b/.test(text)&&countUnitsMatching(units,A2_PAST_ACTION)>=2},
  'a2-m01-l02':{message:'Opowiedz o konkretnym dniu z przeszłości i użyj co najmniej dwóch czasowników nieregularnych jako orzeczeń.',check:({units,text})=>/\b(?:yesterday|last\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|ago|in\s+\d{4}|on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/.test(text)&&countUnitsMatching(units,/\b(?:i|we|he|she|they)\s+(?:went|met|had|saw|bought|took|came|got|made|ate|drank|drove|wrote|read|found|left|felt|heard|said|told)\b/)>=2},
  'a2-m01-l03':{message:'Zadaj co najmniej trzy pełne pytania w Past Simple o wyjazd rozmówcy.',check:({units})=>countUnitsMatching(units,/^(?:where|what|when|who|why|how)\s+did you\b|^did you\b/)>=3},
  'a2-m01-l04':{message:'Najpierw opisz konkretny problem w podróży, a potem czynność podjętą w odpowiedzi.',check:({units})=>hasUnit(units,/(?:\b(?:my|our|the|a)\s+(?:car|bus|train|flight|coach|engine|suitcase)\s+(?:broke down|was cancelled|was canceled|was delayed|did not arrive)\b|\b(?:i|we)\s+(?:missed|lost)\s+(?:my|our|the|a)\s+[a-z]+|\b(?:i|we)\s+got lost\b)/)&&hasUnit(units,/\b(?:i|we)\s+(?:called|asked|waited|took|caught|booked|found|contacted|arrived|went|stayed)\b/)},
  'a2-m01-l05':{message:'Zbuduj czteroczęściową historię: użyj słów porządkujących na początku zdań i opisz wydarzenia w przeszłości.',check:({units})=>[/^first\b/,/^then\b/,/^suddenly\b/,/^finally\b/].filter(pattern=>hasUnit(units,pattern)).length>=3&&countUnitsMatching(units,A2_PAST_ACTION)>=4},

  'a2-m02-l01':{message:'Zadaj dwa pytania „Have you ever…?” i dodaj własne zdanie „I have never…”.',check:({units})=>countUnitsMatching(units,/^have you ever\s+[a-z]+/)>=2&&hasUnit(units,/^i have never\s+[a-z]+/)},
  'a2-m02-l02':{message:'Użyj osobno „have just”, „have already” oraz przeczenia z „yet” do opisania wykonanych czynności.',check:({units})=>hasUnit(units,/\b(?:i|we|you|they)\s+have just\s+[a-z]+(?:ed|en|t)\b|\b(?:he|she)\s+has just\s+[a-z]+(?:ed|en|t)\b/)&&hasUnit(units,/\b(?:i|we|you|they)\s+have already\s+[a-z]+(?:ed|en|t)\b|\b(?:he|she)\s+has already\s+[a-z]+(?:ed|en|t)\b/)&&hasUnit(units,/\b(?:i|we|you|they)\s+have not\s+[a-z]+(?:ed|en|t)\b.*\byet\b|\b(?:he|she)\s+has not\s+[a-z]+(?:ed|en|t)\b.*\byet\b/)},
  'a2-m02-l03':{message:'Użyj „have been to” o swoim doświadczeniu oraz „has gone to … has not come back yet” o innej osobie.',check:({text})=>/\b(?:i|we)\s+have been to\s+(?!it\b|the\b|a\b|an\b)[a-z]+/.test(text)&&/\b(?:he|she|my\s+(?:sister|brother|mother|father|friend|colleague|wife|husband)|[a-z]+)\s+has gone to\s+(?:(?:the|a|an)\s+)?(?!it\b)[a-z]+/.test(text)&&/\b(?:he|she|my\s+(?:sister|brother|mother|father|friend|colleague|wife|husband)|[a-z]+)\s+has not\s+(?:come back|returned)(?:\s+[a-z]+){0,3}\s+yet\b/.test(text)},
  'a2-m02-l04':{message:'Podaj co najmniej trzy konkretne osiągnięcia lub postępy w Present Perfect.',check:({units})=>countUnitsMatching(units,/\b(?:i|we)\s+have\s+(?:completed|improved|learned|learnt|passed|made|finished|achieved)\b(?:\s+(?!because\b|and\b)[a-z]+){1,8}/)>=3},
  'a2-m02-l05':{message:'Rozdziel doświadczenia w Present Perfect od dwóch konkretnych wydarzeń w Past Simple z określonym czasem.',check:({units})=>countUnitsMatching(units,/\b(?:i|we)\s+have\s+(?:visited|learned|learnt|seen|tried|travelled|traveled|been|done|finished)\b/)>=2&&countUnitsMatching(units,/\b(?:i|we)\s+(?:went|stayed|visited|learned|travelled|traveled|saw|met|finished)\b.*\b(?:yesterday|last\s+(?:week|month|year|summer|winter)|ago|in\s+\d{4}|for\s+(?:a|one|two|three|four|five|six|seven|\d+)\s+(?:day|days|week|weeks|month|months))\b|\b(?:yesterday|last\s+(?:week|month|year|summer|winter)|\d+\s+years?\s+ago)\b.*\b(?:i|we)\s+(?:went|stayed|visited|learned|travelled|traveled|saw|met|finished)\b/)>=2},

  'a2-m03-l01':{message:'Podaj co najmniej trzy konkretne plany z konstrukcją „be going to” i czasownikami czynności.',check:({units})=>countUnitsMatching(units,new RegExp('\\b(?:i am|we are|he is|she is|they are)\\s+(?:also\\s+)?going to\\s+'+A2_BASE_ACTION+'\\b'))>=3},
  'a2-m03-l02':{message:'Podaj trzy ustalone spotkania lub podróże w Present Continuous wraz z terminami.',check:({units})=>countUnitsMatching(units,/\b(?:i am|we are|he is|she is|they are)\s+(?:meeting|seeing|leaving|flying|having|travelling|traveling|visiting)\b.*\b(?:on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|at\s+\d|tomorrow|next\s+week|this\s+weekend)\b/)>=3},
  'a2-m03-l03':{message:'Podaj trzy rzeczywiste przewidywania z „will” i użyj co najmniej jednego wyrażenia opinii lub prawdopodobieństwa.',check:({units,text})=>countUnitsMatching(units,new RegExp('\\b(?:i think\\s+|maybe\\s+)?(?:people|cars|cities|technology|life|we|they|it|the\\s+[a-z]+)\\s+will\\s+(?:probably\\s+|maybe\\s+)?(?:'+A2_BASE_ACTION+'|become)\\b'))>=3&&/\b(?:i think|probably|maybe|perhaps)\b/.test(text)},
  'a2-m03-l04':{message:'Zaproponuj konkretną pomoc, podejmij natychmiastową decyzję i złóż obietnicę.',check:({units})=>hasUnit(units,/\bi will help\b.*\b(?:you|him|her|them|with)\b/)&&hasUnit(units,/\bi will\s+(?:call|book|find|bring|carry|take|buy|check|send)\b.*\b(?:now|right now|immediately|today)\b/)&&hasUnit(units,/\bi promise\b.*\b(?:i|we)\s+will\b/)},
  'a2-m03-l05':{message:'Podaj miejsce i czas spotkania, zaplanowaną aktywność, obowiązek oraz wariant na wypadek deszczu.',check:({units})=>hasUnit(units,/\b(?:we are|i am)\s+meeting\b.*\b(?:at|on)\b/)&&hasUnit(units,/\b(?:we are|i am)\s+going to\s+[a-z]+\b/)&&hasUnit(units,/\bi will\s+(?:buy|book|bring|prepare|call|take)\b/)&&hasUnit(units,/\bif it rains\b.*\b(?:will|can|are going to)\b|\b(?:will|can)\b.*\bif it rains\b/)},

  'a2-m04-l01':{message:'Porównaj dwa środki transportu za pomocą co najmniej trzech poprawnych porównań.',check:({units,text})=>countDistinctMatches(text,[/\btrain\b/,/\bbus\b/,/\bcar\b/,/\bplane\b/,/\bcoach\b/,/\bbike\b/])>=2&&countUnitsMatching(units,/\b(?:is|are)\s+(?:also\s+)?(?:much\s+|a little\s+)?(?:faster|slower|cheaper|more comfortable|more expensive|safer|better|worse)\b(?:\s+than\b)?/)>=3},
  'a2-m04-l02':{message:'Opisz jedno miejsce za pomocą co najmniej trzech stopni najwyższych.',check:({units,text})=>/\b(?:park|city|place|hotel|beach|building|museum|restaurant|area|town|village)\b/.test(text)&&countUnitsMatching(units,/\b(?:the\s+(?:biggest|best|worst|smallest|quietest|oldest|newest)|the most\s+[a-z]+)\b/)>=3},
  'a2-m04-l03':{message:'Podaj jedno podobieństwo i dwie różnice między konkretnymi przedmiotami.',check:({text})=>/\b(?:phone|car|computer|laptop|camera|model|device|item|one)\b/.test(text)&&/\bas\s+[a-z]+\s+as\b/.test(text)&&/\bnot as\s+[a-z]+(?:\s+as\b)?/.test(text)&&/\b(?:different from|similar to)\b/.test(text)},
  'a2-m04-l04':{message:'Odrzuć dwie opcje z konkretnych powodów i wskaż trzecią, która spełnia wymagania.',check:({units,text})=>hasUnit(units,/\b(?:first|one|hotel|room|option)\b.*\btoo\s+(?:expensive|small|noisy|far|old)\b/)&&hasUnit(units,/\b(?:second|other|hotel|room|option)\b.*\bnot\s+[a-z]+\s+enough\b/)&&hasUnit(units,/\b(?:third|this|that|hotel|room|option)\b.*\b(?:is|has)\b.*\benough\b/)},
  'a2-m04-l05':{message:'Porównaj dwie opcje, podaj co najmniej dwa konkretne kryteria i jasno wybierz jedną.',check:({units,text})=>countUnitsMatching(units,/\b(?:first|second|option|one|it)\b.*\b(?:cheaper|faster|more comfortable|too expensive|safer|better|closer|quieter)\b/)>=2&&/\b(?:i prefer|i choose|i would choose|so i will take)\b/.test(text)},

  'a2-m05-l01':{message:'Opisz przeprowadzkę lub nowe mieszkanie, odnosząc się do umowy lub kaucji oraz lokalizacji.',check:({units,text})=>/\b(?:i|we)\s+(?:moved|am moving|are moving)\b|\bnew\s+(?:flat|apartment|house)\b/.test(text)&&/\b(?:signed|sign)\s+(?:a|the)\s+contract\b|\bpaid?\s+(?:a|the)\s+deposit\b/.test(text)&&/\b(?:live|located|near|centre|center|area|neighbourhood|neighborhood)\b/.test(text)},
  'a2-m05-l02':{message:'Porównaj okolicę dawniej i dziś, używając konstrukcji „there was/were” oraz „there is/are”.',check:({text})=>/\b(?:years ago|in the past|before)\b.*\bthere (?:was|were)\b|\bthere (?:was|were)\b.*\b(?:years ago|in the past|before)\b/.test(text)&&/\b(?:today|now)\b.*\bthere (?:is|are)\b|\bthere (?:is|are)\b.*\b(?:today|now)\b/.test(text)},
  'a2-m05-l03':{message:'Opisz mieszkanie i użyj poprawnie co najmniej czterech różnych określeń ilości.',check:({text})=>/\b(?:flat|apartment|house|room|rooms|furniture|shelves|space|light|kitchen)\b/.test(text)&&countDistinctMatches(text,[/\bmany\s+[a-z]+/,/\ba lot of\s+[a-z]+/,/\bmuch\s+[a-z]+/,/\ba few\s+[a-z]+/,/\ba little\s+[a-z]+/])>=4},
  'a2-m05-l04':{message:'Zgłoś dwie konkretne usterki i sformułuj uprzejmą, pilną prośbę o naprawę.',check:({clauses,units,text})=>clauses.filter(clause=>/\b(?:the|my|our|this|that)\s+(?:[a-z]+\s+){0,3}(?:does not work|is not working|is leaking|is broken|has stopped working)\b/.test(clause)).length>=2&&hasUnit(units,/\b(?:could|can|would)\s+you\b.*\b(?:repair|fix|send|check)\b/)&&/\b(?:as soon as possible|quickly|today|immediately|urgent)\b/.test(text)},
  'a2-m05-l05':{message:'Opisz dzielnicę, podaj co najmniej dwie konkretne zalety i jedną wadę.',check:({units,text})=>/\b(?:area|neighbourhood|neighborhood|district|street|place)\b/.test(text)&&countUnitsMatching(units,/\b(?:quiet|safe|close|near|within walking distance|park|shops|schools|good transport|friendly|clean)\b/)>=2&&hasUnit(units,/\b(?:however|but|unfortunately)\b.*\b(?:not|no|too|poor|bad|far|noisy|expensive|infrequent)\b/)},

  'a2-m06-l01':{message:'Poproś o konkretny bilet do miejsca docelowego i zadaj pytanie o pociąg bezpośredni lub przesiadkę.',check:({units})=>hasUnit(units,/(?:\b(?:could|can|may)\s+i\s+(?:have|buy|get)\b|\bi would like\b).*\b(?:return|single|one way|round trip)?\s*ticket\b.*\bto\s+(?!it\b|the\b|a\b|an\b)[a-z]+/)&&hasUnit(units,/(?:\bis there\s+(?:a\s+)?direct train\b|\bdo i\s+(?:need|have)\s+to change trains\b|\bwhere do i change trains\b)/)},
  'a2-m06-l02':{message:'Podaj kolejne etapy odprawy: stanowisko odprawy, kontrolę bezpieczeństwa oraz bramkę lub kartę pokładową.',check:({units})=>orderedUnits(units,[/\b(?:go|report)\s+to\s+the\s+check in desk\b/,/\bgo through security\b/,/\b(?:boarding pass|gate\s+\w+|go to gate)\b/])},
  'a2-m06-l03':{message:'Najpierw uprzejmie zapytaj o drogę, a następnie powtórz co najmniej dwa konkretne elementy trasy.',check:({units,text})=>hasUnit(units,/^(?:please\s+)?(?:could|can)\s+you\s+tell me\s+(?:how to get to|where|the way to)|^how do i get to\b/)&&countDistinctMatches(text,[/\b(?:i|we|you)\s+go past\b/,/\b(?:i|we|you)\s+take the\s+(?:first|second|third)\s+turning\b/,/\b(?:i|we|you)\s+turn\s+(?:left|right)\b/,/\b(?:at|by)\s+the traffic lights\b/,/\b(?:i|we|you)\s+cross\b/,/\b(?:i|we|you)\s+continue\b/])>=2},
  'a2-m06-l04':{message:'Połącz informację o opóźnieniu z jego skutkiem i zadaj konkretne pytanie o rozwiązanie.',check:({units,text})=>/\b(?:my|our|the)\s+(?:train|bus|flight|coach)\s+(?:is|was|has been)\s+delayed\b|\bthere is\s+(?:a\s+)?delay\b/.test(text)&&/(?:\bso\b|\bbecause\b|\btherefore\b).{0,80}\b(?:miss|late|cannot|will not)\b|\b(?:i|we)\s+will\s+miss\s+(?:my|our|the)\s+connection\b/.test(text)&&hasUnit(units,/^(?:is there|are there|can i|could i|could you|can you|may i)\b.*\b(?:alternative route|refund|another train|other train|new ticket)\b/)},
  'a2-m06-l05':{message:'Podaj dwie konkretne rzeczy obowiązkowe, jeden zakaz i jedną rzecz nieobowiązkową.',check:({units})=>countUnitsMatching(units,/\b(?:you|passengers|we)\s+(?:must|have to)\s+[a-z]+\b/)>=2&&hasUnit(units,/\b(?:you|passengers|we)\s+must not\s+[a-z]+\b/)&&hasUnit(units,/\b(?:you|passengers|we)\s+do not have to\s+[a-z]+\b/)},

  'a2-m07-l01':{message:'Wymień co najmniej dwa konkretne objawy i określ czas ich trwania za pomocą „for” lub „since”.',check:({text})=>countDistinctMatches(text,[/\bcough\b/,/\bheadache\b/,/\bfever\b/,/\bsore throat\b/,/\bstomach ache\b/,/\bback pain\b/,/\bchest pain\b/,/\bdizz(?:y|iness)\b/,/\bnauseous\b/,/\brunny nose\b/,/\btemperature\b/])>=2&&/\b(?:for\s+(?:\w+\s+){0,2}(?:hour|hours|day|days|week|weeks|month|months)|since\s+(?:this|last|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|\d{1,2}))\b/.test(text)},
  'a2-m07-l02':{message:'Udziel trzech konkretnych rad i dodaj jedną rzecz, której chora osoba nie powinna robić.',check:({text})=>countDistinctMatches(text,[/\byou should rest\b/,/\bdrink plenty of water\b/,/\byou should see\b/,/\byou should take\b/,/\byou should stay\b/,/\byou should call\b/])>=3&&/\byou should not\s+[a-z]+\b/.test(text)},
  'a2-m07-l03':{message:'Podaj powód wizyty, zapytaj o termin i zaakceptuj lub zmień zaproponowaną godzinę.',check:({units,text})=>/\b(?:i would like to make|can i make|i need)\s+(?:an\s+)?appointment\b/.test(text)&&/\bbecause\b.*\b(?:pain|cough|fever|sick|problem|check up|checkup|sore throat)\b/.test(text)&&hasUnit(units,/^(?:is the doctor available|is there|are there|do you have|could i have|what time|when)\b.*\b(?:appointment|available|free|time|tuesday|monday|wednesday|thursday|friday)\b/)&&/\b(?:that time is fine|that is fine|i can come|could i change|another time|later|earlier|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+(?:fifteen|thirty|forty five))?\s+is fine)\b/.test(text)},
  'a2-m07-l04':{message:'Podaj trzy konkretne zmiany zdrowotne oraz jedną rzecz, której nie musisz robić.',check:({units,text})=>countDistinctMatches(text,[/\bi have to\s+(?:exercise|sleep|eat|drink|reduce|stop|walk)\b/,/\bi need to\s+(?:exercise|sleep|eat|drink|reduce|stop|walk|get)\b/,/\bi am going to\s+(?:exercise|sleep|eat|drink|reduce|stop|walk|change)\b/])>=3&&hasUnit(units,/\bi do not have to\s+[a-z]+\b/)},
  'a2-m07-l05':{message:'Poproś o lek na konkretny problem, podaj ważną informację medyczną i opisz warunek wezwania pomocy.',check:({units,text})=>hasUnit(units,/\b(?:i need|could i have|do you have)\s+something for\s+(?:a\s+)?(?:cough|headache|fever|sore throat|pain|cold)\b/)&&/\bi am allergic to\s+[a-z]+\b/.test(text)&&/\bif\s+(?:i|the\s+[a-z]+)\b.*\b(?:cannot breathe|gets worse|faints|stops breathing|severe)\b.*\b(?:i|we)\s+will call\s+(?:emergency services|an ambulance|112)\b/.test(text)},

  'a2-m08-l01':{message:'Opisz co najmniej cztery konkretne obowiązki zawodowe w pełnych zdaniach.',check:({units})=>countUnitsMatching(units,/\b(?:i|we)\s+(?:answer|prepare|attend|deal with|manage|solve|check|repair|help|install|write|organise|organize|support)\b|\b(?:i am|we are)\s+responsible for\b/)>=4},
  'a2-m08-l02':{message:'Podaj stanowisko i czas pracy, co najmniej dwa obowiązki oraz powód odejścia.',check:({units,text})=>/\bi worked as\s+(?:a|an)?\s*[a-z]+\b.*\bfor\s+(?:\w+\s+){0,2}(?:year|years|month|months)\b/.test(text)&&countDistinctMatches(text,[/\bi solved\b/,/\b(?:i\s+)?managed\s+[a-z]+/,/\bi prepared\b/,/\bi answered\b/,/\bi installed\b/,/\bi repaired\b/,/\bi helped\b/,/\bi (?:organised|organized)\b/,/\bi dealt with\b/,/\bi worked with\b/,/\bi was responsible for\b/,/\bi supported\b/,/\bi checked\b/])>=2&&/\bi left\b.*\bbecause\b/.test(text)},
  'a2-m08-l03':{message:'Napisz wiadomość służbową z celem, uprzejmą prośbą, terminem i zakończeniem.',check:({units,text})=>/^(?:hello|hi|dear)\b/.test(units[0]||'')&&/\bi am writing about\b/.test(text)&&/\bcould you please\s+[a-z]+\b/.test(text)&&/\b(?:before|by)\s+(?:\w+|\d)\b/.test(text)&&/\b(?:kind regards|best regards|thank you)\b/.test(text)},
  'a2-m08-l04':{message:'Przedstaw doświadczenie, dwie konkretne umiejętności, mocną stronę i dostępność.',check:({units,text})=>/\bi have experience in\s+[a-z]+/.test(text)&&countUnitsMatching(units,/\bi can\s+(?:communicate|solve|manage|organise|organize|repair|support|work|learn|use|prepare)\b/)>=1&&/\b(?:and|also)\s+(?:can\s+)?(?:communicate|solve|manage|organise|organize|repair|support|work|learn|use|prepare)\b/.test(text)&&/\bmy (?:main )?strength is\b/.test(text)&&/\bi am available to start\b/.test(text)},
  'a2-m08-l05':{message:'Podaj konkretny cel językowy i co najmniej trzy różne działania prowadzące do jego osiągnięcia.',check:({units,text})=>/\bmy goal is to\s+[a-z]+\b/.test(text)&&countUnitsMatching(units,/\bi\s+(?:practise|practice|listen|read|write|review|keep|watch|speak|study|use)\b/)>=3},

  'a2-m09-l01':{message:'Podaj prośbę o zwrot, czas zakupu, konkretną wadę oraz oczekiwany zwrot pieniędzy lub wymianę.',check:({units,text})=>/\bi would like to return\s+(?:this|the)\s+(?:item|product|phone|device|shirt|jacket)\b/.test(text)&&/\bi bought (?:it|this|the\s+[a-z]+)\b.*\b(?:yesterday|last\s+week|on\s+\w+)\b/.test(text)&&/\b(?:it|the\s+[a-z]+)\s+(?:is faulty|does not work|is broken|has a problem)\b/.test(text)&&/\b(?:receipt|refund|exchange)\b/.test(text)},
  'a2-m09-l02':{message:'Opisz konkretne ubranie i problem z dopasowaniem, a potem poproś o inny rozmiar lub materiał.',check:({units,text})=>/\b(?:this|that|the|my)\s+(?:[a-z]+\s+){0,3}(?:shirt|t shirt|dress|jacket|coat|trousers|jeans|skirt|jumper|sweater|shoes|boots)\b/.test(text)&&/\b(?:shirt|t shirt|dress|jacket|coat|trousers|jeans|skirt|jumper|sweater|shoes|boots)\s+(?:is|are)\s+too\s+(?:tight|loose|small|big|short|long)\b|\bdoes not fit\b/.test(text)&&hasUnit(units,/^(?:could|can)\s+i\s+(?:try|have|get)\b.*\b(?:larger size|smaller size|different size|different material|another one)\b/)},
  'a2-m09-l03':{message:'Podaj, że złożyłeś zamówienie i przesyłka nie dotarła, a następnie poproś o numer śledzenia oraz termin dostawy.',check:({units,text})=>/\b(?:i|we)\s+(?:have\s+)?(?:placed|made)\s+an order\b|\b(?:i|we)\s+ordered\b/.test(text)&&/\b(?:the\s+)?(?:parcel|package|order|it)\s+has not\s+(?:arrived|been delivered)(?:\s+[a-z]+){0,3}\s+yet\b/.test(text)&&hasUnit(units,/^(?:could|can|would)\s+you\b.*\btracking number\b.*\b(?:estimated delivery date|delivery date|when it will arrive)\b|^(?:could|can|would)\s+you\b.*\b(?:estimated delivery date|delivery date|when it will arrive)\b.*\btracking number\b/)},
  'a2-m09-l04':{message:'Wyjaśnij odrzuconą płatność i zaproponuj co najmniej dwie konkretne alternatywy.',check:({units,text})=>/\b(?:my|the)\s+(?:contactless\s+)?payment\s+was declined\b|\bmy card was declined\b/.test(text)&&countDistinctMatches(text,[/\benter the pin\b/,/\bpay in cash\b/,/\bpay by card\b/,/\bbank transfer\b/,/\bsplit the bill\b/,/\buse another card\b/])>=2},
  'a2-m09-l05':{message:'Złóż uprzejmą skargę, opisz dwa konkretne problemy i wskaż oczekiwane rozwiązanie.',check:({units,text})=>/\b(?:i am afraid|unfortunately|i would like to complain)\b/.test(text)&&countUnitsMatching(units,/\b(?:poor|wrong|broken|late|did not|has not|nobody|no one|unhelpful|rude|damaged)\b/)>=2&&/\b(?:refund|replacement|speak to the manager|solve the problem|repair|exchange)\b/.test(text)},

  'a2-m10-l01':{message:'Podaj co najmniej cztery uporządkowane kroki przepisu z konkretnymi czynnościami kuchennymi.',check:({units})=>[/^first\b/,/^next\b/,/^then\b/,/^finally\b/].filter(pattern=>hasUnit(units,pattern)).length>=3&&countUnitsMatching(units,/\b(?:cut|heat|add|mix|cook|serve|pour|wash|chop|boil|fry|bake|put)\b.*\b(?:vegetables|oil|water|ingredients|pan|pot|oven|minutes|dish|salad|soup|food|everything)\b/)>=4},
  'a2-m10-l02':{message:'Utwórz zaproszenie z miejscem i czasem oraz naturalną odpowiedź przyjmującą lub odmawiającą.',check:({units,text})=>hasUnit(units,/^would you like to come\b.*\b(?:dinner|lunch|party|meal|visit)\b/)&&/\b(?:at my house|at our house|at the restaurant|at home|in the garden)\b/.test(text)&&/\b(?:on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|at\s+(?:\d|seven|eight|six|nine))\b/.test(text)&&/\b(?:i would love to|that sounds great|sorry i cannot|i cannot make it|i am afraid i cannot)\b/.test(text)},
  'a2-m10-l03':{message:'Podaj ofertę przy stole, konkretną prośbę i uprzejmą odpowiedź.',check:({units})=>hasUnit(units,/^would you like some\s+[a-z]+/)&&hasUnit(units,/^could i have\s+(?:a little|some|more|the)\s+[a-z]+/)&&hasUnit(units,/^(?:yes please|no thank you|of course|certainly|help yourself)\b/)},
  'a2-m10-l04':{message:'Zgłoś dwa konkretne problemy z zamówionym posiłkiem i poproś o określone rozwiązanie.',check:({units,text})=>/\bi ordered\s+(?:the|a|an)\s+[a-z]+/.test(text)&&countDistinctMatches(text,[/\bwrong dish\b|\bbrought the wrong\b/,/\bfood is(?: also)? cold\b|\bmeal is(?: also)? cold\b/,/\bmissing\b/,/\bovercooked\b/,/\braw\b/])>=2&&hasUnit(units,/\b(?:could|can|would)\s+you\b.*\b(?:replace|bring|remove|change|heat)\b|\b(?:replace|remove it from the bill)\b/)},
  'a2-m10-l05':{message:'Podaj trzy różne warunki i połącz każdy z konkretnym skutkiem za pomocą „will”.',check:({units})=>countUnitsMatching(units,/\bif\s+[^.]{2,70},?\s+(?:i|we|they|everyone|the\s+[a-z]+)\s+will\s+[a-z]+\b|\b(?:i|we|they)\s+will\s+[a-z]+\b.*\bif\s+[^.]+/)>=3},

  'a2-m11-l01':{message:'Podaj konkretną godzinę i opisz w Past Continuous czynności co najmniej trzech różnych osób.',check:({units,text})=>/\b(?:at\s+(?:eight|nine|ten|\d{1,2})|yesterday at\s+\w+)\b/.test(text)&&countUnitsMatching(units,/\b(?:i|he|she|we|they|my\s+(?:wife|husband|friend|mother|father)|the\s+(?:children|students|workers))\s+(?:was|were)\s+[a-z]+ing\b/)>=3&&countDistinctSubjects(units,/\b(i|he|she|we|they|my\s+(?:wife|husband|friend|mother|father)|the\s+(?:children|students|workers))\s+(?:was|were)\s+[a-z]+ing\b/)>=3},
  'a2-m11-l02':{message:'Podaj dwie pełne sytuacje z czynnością w Past Continuous i krótszym wydarzeniem, które ją przerwało.',check:({units})=>units.filter(unit=>/(?:\b(?:i|he|she|we|they)\s+(?:was|were)\s+[a-z]+ing\b.*\b(?:when|while)\b.*\b(?:rang|heard|started|stopped|arrived|called|knocked|broke|came|saw|went|happened)\b|\bwhile\s+(?:i|he|she|we|they)\s+(?:was|were)\s+[a-z]+ing\b.*\b(?:rang|heard|started|stopped|arrived|called|knocked|broke|came|saw|went|happened)\b)/.test(unit)).length>=2},
  'a2-m11-l03':{message:'Zbuduj pięcioczęściową historię z początkiem, wydarzeniem, problemem, reakcją i zakończeniem.',check:({units,text})=>units.length>=5&&countDistinctMatches(text,[/\bat first\b/,/\b(?:a few minutes )?later\b/,/\bhowever\b/,/\bluckily\b/,/\bin the end\b/])>=4&&hasUnit(units,/\b(?:stopped|broke down|lost|missed|could not|had no|problem|wrong)\b/)&&hasUnit(units,/\b(?:helped|called|found|repaired|waited|took|arrived)\b/)},
  'a2-m11-l04':{message:'Podaj tożsamość dzwoniącego, powód telefonu, osobę odbierającą wiadomość i prośbę o oddzwonienie.',check:({text})=>/\bthis is\s+[a-z]+(?:\s+[a-z]+)?\b/.test(text)&&/\bi am calling about\s+[a-z]+/.test(text)&&/\bplease tell\s+[a-z]+\b/.test(text)&&/\b(?:ask (?:him|her|them) to|please)\s+call me back\b/.test(text)},
  'a2-m11-l05':{message:'Przekaż wiadomość: źródło informacji, wydarzenie i czas, uczestników oraz konkretny rezultat.',check:({units,text})=>/\baccording to the news\b/.test(text)&&/\b(?:storm|fire|accident|flood|power cut|earthquake)\b.*\b(?:last night|yesterday|this morning|on\s+\w+)\b|\b(?:last night|yesterday|this morning)\b.*\b(?:storm|fire|accident|flood|power cut|earthquake)\b/.test(text)&&/\b(?:residents|people|drivers|passengers|emergency services|firefighters|police)\b/.test(text)&&/\b(?:damage|nobody was hurt|no one was hurt|injured|destroyed|closed|repaired)\b/.test(text)}
};
function semanticTaskResult(answer,current={}){
  const lessonId=String(current.taskId||'').replace(/:final$/,''),units=semanticUnits(answer,current),text=semanticNormalize(answer),clauses=semanticClauses(answer,current);
  if(!lessonId.startsWith('a2-'))return {ok:true};
  const issue=message=>({ok:false,message});
  const validator=A2_SEMANTIC_VALIDATORS[lessonId];
  if(!validator){
    // Testy końcowe A2 mają osobne, ściśle określone odpowiedzi lub wieloelementowe kryteria.
    if(lessonId.startsWith('a2-m12-'))return {ok:true};
    return issue('To zadanie nie ma kompletnego profilu znaczeniowego. Zaktualizuj aplikację przed zaliczeniem lekcji.');
  }
  if(units.length<Math.max(1,Number(current.minimumSentences)||1))return issue('Napisz wymagane pełne zdania związane bezpośrednio z tematem zadania.');
  try{return validator.check({answer,current,units,text,clauses})?{ok:true}:issue(validator.message);}catch(error){console.error('Błąd walidatora A2',lessonId,error);return issue('Nie udało się potwierdzić sensu odpowiedzi. Spróbuj napisać ją prostszymi, pełnymi zdaniami.');}
}

function semanticUnitSignature(unit){
  return semanticNormalize(unit)
    .replace(/^(?:first|then|next|after that|finally|later|at first|in the end|however|luckily|unfortunately|suddenly)\s+/,'')
    .replace(/\b(?:yesterday|today|tomorrow|last weekend|last week|last month|last year|this morning|this afternoon|this evening)\b/g,'')
    .replace(/\s+/g,' ').trim();
}
function repeatedSemanticContent(answer,current={}){
  const units=semanticUnits(answer,current),minimum=Math.max(0,Number(current.minimumSentences)||0);
  if(minimum<2||units.length<2)return false;
  const signatures=units.map(semanticUnitSignature).filter(Boolean),unique=new Set(signatures);
  return unique.size<Math.min(2,minimum);
}
function finalTaskChecks(answer,current={}){
  const failed=[];
  for(const check of current.requiredChecks||[])if(check==='self_name'&&!hasSelfName(answer))failed.push({code:'self_name',message:'Podaj swoje imię, np. „My name is Anna” albo „I am Tom”.'});
  const minimumSentences=Math.max(0,Number(current.minimumSentences)||0),sentenceCount=countSentenceUnits(answer);
  if(minimumSentences&&sentenceCount<minimumSentences)failed.push({code:'minimum_sentences',message:`Wypowiedź powinna zawierać co najmniej ${minimumSentences} ${minimumSentences===2?'zdania':'zdania'}. Obecnie rozpoznano: ${sentenceCount}.`});
  const minimumKeywordSentences=Math.max(0,Number(current.minimumKeywordSentences)||0),keywordSentences=keywordSentenceCount(answer,current.requiredKeywords||[]);
  if(minimumKeywordSentences&&keywordSentences<minimumKeywordSentences)failed.push({code:'keyword_distribution',message:`Wymagane elementy treści powinny wystąpić w co najmniej ${minimumKeywordSentences} pełnych zdaniach. Obecnie rozpoznano: ${keywordSentences}.`});
  const minimumPeople=Math.max(0,Number(current.minimumPeople)||0),peopleCount=countPeopleReferences(answer);
  if(minimumPeople&&peopleCount<minimumPeople)failed.push({code:'minimum_people',message:`Przedstaw co najmniej ${minimumPeople} różne osoby. Obecnie rozpoznano: ${peopleCount}.`});
  const minimumActions=Math.max(0,Number(current.minimumActions)||0),actionCount=matchedPhraseGroups(answer,current.actionGroups||[]);
  if(minimumActions&&actionCount<minimumActions)failed.push({code:'minimum_actions',message:`Wymień co najmniej ${minimumActions} różne czynności związane z pracą. Obecnie rozpoznano: ${actionCount}.`});
  if(String(current.taskId||'').startsWith('a2-')&&repeatedSemanticContent(answer,current))failed.push({code:'repeated_content',message:'Nie powtarzaj tego samego zdania. Każde zdanie powinno wnosić nową informację.'});
  const semantic=semanticTaskResult(answer,current);
  if(!semantic.ok)failed.push({code:'semantic_content',message:semantic.message});
  return failed;
}
function scoreTaskAnswer(answer,word,taskMode,current=curTask()){
  if(taskMode==='course_final'){
    const variants=acceptedAnswers(word,taskMode,current);if(variants.length)return bestAnswerScore(answer,variants);
    const count=wordsOf(answer).length,minimum=Math.max(1,Number(current?.minimumWords)||1),groups=(Array.isArray(current?.requiredKeywords)?current.requiredKeywords:[]).map(group=>[...new Set((Array.isArray(group)?group:[group]).filter(Boolean).map(String))]).filter(group=>group.length);
    if(!groups.length)return {score:0,status:'wrong',label:'Brak kryteriów',issues:[{code:'missing_criteria',message:'Zadanie końcowe nie ma jeszcze zdefiniowanych kryteriów automatycznej oceny.'}],expected:'',variants:[]};
    const matched=matchedPhraseGroups(answer,groups,{meaningfulOnly:true}),minimumGroups=Math.min(groups.length,Math.max(1,Number(current?.minimumKeywordGroups)||groups.length)),lengthOk=count>=minimum,keywordsOk=matched>=minimumGroups,issues=[],checkIssues=finalTaskChecks(answer,current||{}),checksOk=!checkIssues.length;
    if(!lengthOk)issues.push({code:'minimum_words',message:`Wypowiedź powinna zawierać co najmniej ${minimum} słowa.`});
    if(!keywordsOk)issues.push({code:'required_keywords',message:`Odpowiedź spełnia ${matched} z ${minimumGroups} wymaganych elementów treści.`});
    issues.push(...checkIssues);
    const keywordScore=minimumGroups?Math.min(1,matched/minimumGroups):1,checkScore=checksOk?1:0,score=Math.min(1,((Math.min(1,count/minimum))+keywordScore+checkScore)/3);
    if(lengthOk&&keywordsOk&&checksOk)return {score:1,status:'correct',label:'Dobrze',issues:[],expected:'',variants:[]};
    if(count>0)return {score,status:'partial',label:'Prawie dobrze',issues,expected:'',variants:[]};
    return {score:0,status:'wrong',label:'Źle',issues:[{code:'empty',message:'Brak odpowiedzi.'}],expected:'',variants:[]};
  }
  return bestAnswerScore(answer,acceptedAnswers(word,taskMode,current));
}
function promptFor(word,taskMode,current=curTask()){
  if(taskMode==='course_intro_group')return {label:'Poznaj nowy materiał',prompt:'Nowe słowa i zwroty',hint:'Przeczytaj, odsłuchaj wybrane przykłady i przejdź dalej.'};
  if(taskMode==='course_grammar')return {label:'Gramatyka w praktyce',prompt:current?.grammarNote?.title||'Krótka zasada',hint:'Najpierw zrozum przykład, później użyjesz konstrukcji w zadaniach.'};
  if(taskMode==='course_intro')return {label:'Poznaj nowy materiał',prompt:word?.english||'',hint:[word?.polish,hasQualityExample(word)?`${sentenceEn(word)} — ${sentencePl(word)}`:''].filter(Boolean).join(' • ')};
  if(taskMode==='course_final')return {label:'Zadanie końcowe',prompt:current?.prompt||'Wykonaj zadanie końcowe.',hint:current?.hint||'Odpowiedz samodzielnie. To zadanie jest wymagane do zaliczenia lekcji.'};
  if(taskMode==='word_choice'||taskMode==='en_pl')return {label:taskMode==='word_choice'?'Wybierz znaczenie słowa':'Przetłumacz słowo na polski',prompt:word.english,hint:''};
  if(taskMode==='sentence_translate')return {label:'Przetłumacz zdanie na angielski',prompt:sentencePl(word),hint:''};
  if(taskMode==='listening_write')return {label:'Posłuchaj i wpisz po angielsku',prompt:'Kliknij „Odsłuchaj” i wpisz to, co usłyszysz.',hint:'Ćwiczysz rozumienie ze słuchu i dokładny zapis.'};
  if(taskMode==='speaker_repeat')return {label:'Słuchaj i powtarzaj',prompt:sentencePl(word),hint:'Odsłuchaj, powtórz na głos i wpisz po angielsku.'};
  if(taskMode==='speaking')return {label:'Mówienie',prompt:sentencePl(word),hint:'Aplikacja sprawdza tekst rozpoznany przez przeglądarkę, nie jakość wymowy.'};
  if(taskMode==='dialogue'){const scene=dialogueScene(word);const clientLine=scene?.prompt?`Klient mówi: ${scene.prompt}`:'';return {label:`${scene?.conversation||'Scenka'} • krok ${scene?.turn||1}/${scene?.total||1}`,prompt:scene?.promptPl||sentencePl(word),hint:[scene?.role||'Rozmowa',clientLine,scene?.context].filter(Boolean).join(' • ')};}
  if(taskMode==='car_voice')return {label:'Tryb samochodowy',prompt:sentencePl(word),hint:'Słuchaj i odpowiadaj bez pisania. Komendy: dalej, powtórz, wolniej, nie wiem, zakończ.'};
  return {label:'Przetłumacz słowo na angielski',prompt:word.polish,hint:''};
}
function renderLesson(){
  const current=curTask(),word=curWord(),wordless=['course_final','course_intro_group','course_grammar'].includes(current?.mode);if(!current||(!word&&!wordless))return finish();
  checked=false;selectedChoice=null;clearCarTimer();
  const infoTask=['course_intro','course_intro_group','course_grammar'].includes(current.mode);
  $('lessonCard')?.classList.toggle('car-active',current.mode==='car_voice');
  if($('lessonMode'))$('lessonMode').textContent=(session.source==='course'?(session.lessonTitle||'Kurs'):(current.kind==='new'?'nowe':current.kind==='weak'?'do powtórki':'powtórka'))+' • '+modeLabel(current.mode);
  if($('lessonProgress'))$('lessonProgress').textContent=`${session.index+1} / ${session.queue.length}`;
  if($('lessonRemaining'))$('lessonRemaining').textContent=Math.max(0,session.queue.length-session.index-1);
  if($('lessonCorrect'))$('lessonCorrect').textContent=session.correct;
  setProgress($('bar'),Math.round(session.index/session.queue.length*100));
  const feedbackBox=$('feedback');if(feedbackBox){feedbackBox.className='feedback hidden';feedbackBox.textContent='';}
  $('checkBtn')?.classList.toggle('hidden',infoTask);$('nextBtn')?.classList.toggle('hidden',!infoTask);$('retryBtn')?.classList.add('hidden');if($('dontKnowBtn')){$('dontKnowBtn').disabled=false;$('dontKnowBtn').classList.toggle('hidden',infoTask);}$('micBtn')?.classList.toggle('hidden',!(current.mode==='speaking'||(current.mode==='course_final'&&current.answerMode==='speaking')));$('micStatus')?.classList.add('hidden');lastSpeechText='';
  const prompt=promptFor(word,current.mode,current);if($('promptLabel'))$('promptLabel').textContent=prompt.label;if($('prompt'))$('prompt').textContent=prompt.prompt;if($('hint'))$('hint').textContent=[word?.level,word?.track,word?.category,session.source==='course'?session.lessonGoal:'',prompt.hint].filter(Boolean).join(' • ');if($('answerArea'))$('answerArea').innerHTML=answerHtml(word,current.mode,current);
  const wrap=$('questionWrap');if(wrap){wrap.classList.remove('question-enter');void wrap.offsetWidth;wrap.classList.add('question-enter');}
  if(current.mode==='car_voice'){setCarStatus('Przygotowanie...');setTimeout(()=>carAskCurrent(),350);return;}
  if(!infoTask)setTimeout(()=>{const answer=document.querySelector('.answer');if(answer){answer.focus();document.body?.classList.add('input-active');}},60);
  if(state.settings.voiceEnabled&&state.settings.autoSpeak&&['listening_write','speaker_repeat','speaking'].includes(current.mode))setTimeout(()=>speak(),250);
}
function answerHtml(word,taskMode,current=curTask()){
  if(taskMode==='course_intro_group'){const rows=(current?.materialIds||[]).map(id=>WORDS.find(item=>item.id===id)).filter(Boolean);return `<div class="course-intro-grid">${rows.map(item=>`<article class="course-intro-item"><strong>${esc(item.english)}</strong><span>${esc(item.polish)}</span>${hasQualityExample(item)?`<small>${esc(sentenceEn(item))}<br>${esc(sentencePl(item))}</small>`:''}<button type="button" class="text-btn course-listen" data-speak-material="${esc(item.id)}">Odsłuchaj</button></article>`).join('')}</div>`;}
  if(taskMode==='course_grammar'){const note=current?.grammarNote||{};return `<div class="course-grammar-card"><p>${esc(note.explanation||'')}</p>${Array.isArray(note.examples)&&note.examples.length?`<ul>${note.examples.map(example=>`<li>${esc(example)}</li>`).join('')}</ul>`:''}</div>`;}
  if(taskMode==='course_intro')return `<div class="course-intro"><strong>${esc(word?.english||'')}</strong><span>${esc(word?.polish||'')}</span>${hasQualityExample(word)?`<p>${esc(sentenceEn(word))}<br><small>${esc(sentencePl(word))}</small></p>`:''}</div>`;
  if(taskMode==='course_final')return `<textarea class="answer" rows="4" autocomplete="off" placeholder="Wpisz lub podyktuj swoją odpowiedź"></textarea><div id="speechTranscript" class="transcript hidden"></div>`;
  if(taskMode==='car_voice')return `<div class="car-panel"><div id="carStatus" class="car-status">Start trybu samochodowego</div><div class="car-prompt">${esc(sentencePl(word))}</div><input class="answer hidden" autocomplete="off"><div id="speechTranscript" class="transcript hidden"></div><div class="car-command-grid"><button class="car-command primary-car" data-car="listen">Mów teraz</button><button class="car-command" data-car="repeat">Powtórz</button><button class="car-command" data-car="skip">Dalej</button><button class="car-command" data-car="slower">Wolniej</button><button class="car-command stop-car" data-car="stop">Stop</button></div><div class="car-tip">Komendy: dalej, powtórz, wolniej, nie wiem, zakończ. Po dwóch nieudanych próbach aplikacja poda poprawną odpowiedź.</div></div>`;
  if(taskMode==='speaking')return `<div class="micline"><input class="answer" autocomplete="off" placeholder="Tu pojawi się rozpoznana mowa — możesz poprawić tekst ręcznie"></div><div id="speechTranscript" class="transcript hidden"></div>`;
  if(taskMode==='word_choice'){const configured=(current?.choicePoolIds||[]).map(id=>WORDS.find(item=>item.id===id)).filter(item=>item&&item.id!==word.id);const pool=(configured.length?configured:activeWords().filter(item=>item.id!==word.id&&item.level===word.level&&isVocabularyItem(item)));const choices=shuffle([word,...shuffle(pool).slice(0,3)]);return `<div class="choices">${choices.map(choice=>`<button class="choice" data-choice="${esc(choice.polish)}">${esc(choice.polish)}</button>`).join('')}</div>`;}
  return '<input class="answer" autocomplete="off" placeholder="Wpisz odpowiedź">';
}
function checkAnswer(){if(checked)return;const word=curWord(),current=curTask(),wordless=['course_final','course_intro_group','course_grammar'].includes(current?.mode);if(!current||(!word&&!wordless))return;const answer=current.mode==='word_choice'?(selectedChoice||''):(document.querySelector('.answer')?.value||'');if(!answer.trim()){notify('Najpierw wpisz albo wybierz odpowiedź.','error');return;}const result=scoreTaskAnswer(answer,word,current.mode,current);mark(result.status==='correct',answer,result);}
function mark(ok,answer,result=null){
  if(checked)return;const word=curWord(),current=curTask(),wordless=['course_final','course_intro_group','course_grammar'].includes(current?.mode);if(!current||(!word&&!wordless))return;
  const previousState=deepClone(state),previousSession=deepClone(session);checked=true;
  result=result||scoreTaskAnswer(answer,word,current.mode,current);const partial=result.status==='partial',progressOk=ok;
  if(word)updateProg(word,progressOk);else{if(progressOk){state.user.totalCorrect++;state.user.currentAnswerStreak++;state.user.bestAnswerStreak=Math.max(state.user.bestAnswerStreak,state.user.currentAnswerStreak);}else{state.user.totalWrong++;state.user.currentAnswerStreak=0;}}
  session[progressOk?'correct':'wrong']++;
  const xp=progressOk?(current.mode==='course_final'?20:(current.kind==='new'?12:8)):0;session.xp+=xp;state.user.xp+=xp;state.user.level=1+Math.floor(state.user.xp/250);
  const day=todayKey();if(!state.days[day])state.days[day]={correct:0,wrong:0,xp:0};state.days[day][progressOk?'correct':'wrong']++;state.days[day].xp+=xp;updateStreak(day);
  const modeKey=current.mode||session.practice||'mixed';if(!state.modeStats[modeKey])state.modeStats[modeKey]={correct:0,wrong:0,xp:0};state.modeStats[modeKey][progressOk?'correct':'wrong']++;state.modeStats[modeKey].xp+=xp;if(!progressOk&&word)state.mistakes[word.id]=(state.mistakes[word.id]||0)+1;
  if(session.source==='course')recordCourseTaskResult(current,result);
  state.activeSession={...deepClone(session),index:Math.min(session.index+1,session.queue.length)};
  if(!save()){state=previousState;session=previousSession;checked=false;retrySnapshot=null;return;}
  retrySnapshot=progressOk?null:{state:previousState,session:previousSession};
  feedback(progressOk,word,answer,result);if(current.mode==='car_voice')carAfterMark(progressOk,word,answer,result);
  $('checkBtn')?.classList.add('hidden');$('nextBtn')?.classList.remove('hidden');$('retryBtn')?.classList.toggle('hidden',progressOk);if($('dontKnowBtn'))$('dontKnowBtn').disabled=true;if($('lessonCorrect'))$('lessonCorrect').textContent=session.correct;setProgress($('bar'),Math.round((session.index+1)/session.queue.length*100));renderTopMetrics();
}
function updateProg(word,ok){state.items[word.id]=advanceProgress(prog(word.id),ok,todayKey());if(ok){state.user.totalCorrect++;state.user.currentAnswerStreak++;state.user.bestAnswerStreak=Math.max(state.user.bestAnswerStreak,state.user.currentAnswerStreak);}else{state.user.totalWrong++;state.user.currentAnswerStreak=0;}}
function updateStreak(day){if(state.user.lastActiveDay===day)return;const yesterday=addDays(-1,day);state.user.streakDays=state.user.lastActiveDay===yesterday?state.user.streakDays+1:1;state.user.lastActiveDay=day;}
function diffMarkup(answer,expected){
  const a=String(answer||'').trim().split(/\s+/),e=String(expected||'').trim().split(/\s+/),an=a.map(normalize),en=e.map(normalize),dp=Array.from({length:a.length+1},()=>Array(e.length+1).fill(0));
  for(let i=1;i<=a.length;i++)for(let j=1;j<=e.length;j++)dp[i][j]=an[i-1]===en[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);
  const keepA=new Set(),keepE=new Set();let i=a.length,j=e.length;while(i&&j){if(an[i-1]===en[j-1]){keepA.add(--i);keepE.add(--j);}else if(dp[i-1][j]>=dp[i][j-1])i--;else j--;}
  const paint=(tokens,keep)=>tokens.map((token,index)=>keep.has(index)?esc(token):`<mark>${esc(token)}</mark>`).join(' ');
  return {answer:paint(a,keepA),expected:paint(e,keepE)};
}
function retryCurrent(){
  if(!session||!checked||!retrySnapshot)return;
  const failedState=deepClone(state),failedSession=deepClone(session),snapshot=retrySnapshot;
  state=deepClone(snapshot.state);session=deepClone(snapshot.session);state.activeSession=deepClone(session);
  if(!save()){state=failedState;session=failedSession;return;}
  retrySnapshot=null;checked=false;selectedChoice=null;renderLesson();notify('Powtórz to samo zadanie. Poprzednia próba nie liczy się do wyniku.','info');
}
function feedback(ok,word,answer,result=null){
  const current=curTask(),primary=expected(word,current?.mode||'word_write',current),box=$('feedback');if(!box)return;
  result=result||scoreTaskAnswer(answer,word,current?.mode||'word_write',current);const partial=result.status==='partial',accepted=result.expected||primary,issues=(result.issues||[]).slice(0,4),details=issues.length?`<ul class="feedback-details">${issues.map(issue=>`<li>${esc(issue.message)}</li>`).join('')}</ul>`:'';box.className='feedback '+(ok?'ok':partial?'feedback-partial':'bad');
  if(current?.mode==='course_final'&&!accepted){
    if(ok)box.innerHTML='<b>Zadanie końcowe wykonane.</b><br>Odpowiedź została zapisana.';
    else box.innerHTML=`<b>${partial?'Rozwiń odpowiedź.':'Do poprawy.'}</b>${details}<br><small>Zadanie końcowe jest wymagane do zaliczenia lekcji.</small>`;
    return;
  }
  const diff=diffMarkup(answer,accepted);
  if(ok){const variant=normalize(accepted)!==normalize(primary)?`<br>Zaakceptowany wariant: <b>${esc(accepted)}</b>`:'';box.innerHTML=`<b>Dobrze.</b><br>Wzorcowa odpowiedź: <b>${esc(primary)}</b>${variant}`;}
  else if(partial)box.innerHTML=`<b>Prawie dobrze.</b><br>Twoja odpowiedź: ${diff.answer}<br>Poprawna odpowiedź: <b>${diff.expected}</b>${details}<br><small>Podświetlone fragmenty wymagają zmiany. Możesz od razu spróbować ponownie.</small>`;
  else box.innerHTML=`<b>Do poprawy.</b><br>Twoja odpowiedź: ${diff.answer}<br>Poprawna odpowiedź: <b>${diff.expected}</b>${details}<br><small>Podświetlone fragmenty wymagają zmiany. Zadanie wróci też do powtórki.</small>`;
}
function nextCard(){
  if(!session)return;stopCarRecognition();clearCarTimer();retrySnapshot=null;
  const current=curTask(),previousState=deepClone(state),previousSession=deepClone(session);
  if(['course_intro','course_intro_group','course_grammar'].includes(current?.mode)&&!checked)completeCourseInfoTask();
  const previousIndex=session.index;session.index++;
  if(!snapshotSession()){state=previousState;session=previousSession;session.index=previousIndex;return;}renderLesson();
}
function finish(){
  stopCarRecognition();clearCarTimer();$('lessonCard')?.classList.remove('car-active');if(!session)return;
  $('lessonCard')?.classList.add('hidden');$('summary')?.classList.remove('hidden');
  retrySnapshot=null;const completed=deepClone(session),previousState=deepClone(state),courseResult=finalizeCourseAttempt(completed);
  if($('sumCorrect'))$('sumCorrect').textContent=completed.correct;if($('sumWrong'))$('sumWrong').textContent=completed.wrong;if($('sumXp'))$('sumXp').textContent='+'+completed.xp;if($('sumAccuracy'))$('sumAccuracy').textContent=courseResult?courseResult.accuracy+'%':percent(completed.correct,completed.correct+completed.wrong);if($('sumStreak'))$('sumStreak').textContent=state.user.streakDays+' dni';
  const today=state.days[todayKey()]||{correct:0,wrong:0},done=(today.correct||0)+(today.wrong||0),goal=state.settings.dailyGoal||20;if($('summaryMessage'))$('summaryMessage').textContent=courseResult?currentCourseSummary(courseResult):(done>=goal?'Dzisiejszy cel został osiągnięty.':'Wykonano '+done+' z '+goal+' zadań dzisiejszego celu.');
  const reviewDates=completed.queue.map(item=>item.wordId?prog(item.wordId).nextReview:null).filter(Boolean).sort();if($('nextReviewInfo'))$('nextReviewInfo').textContent=reviewDates.length?`Najbliższa powtórka: ${formatDate(reviewDates[0])}.`:'Następna powtórka zostanie ustalona po kolejnej sesji.';
  const carButton=$('summaryCarBtn');if(carButton){const lessonId=completed.source==='course'?completed.lessonId:null,eligible=lessonId&&courseResult&&courseResult.outcome!=='retry'&&buildLessonCarQueue(lessonId).length>0;carButton.classList.toggle('hidden',!eligible);carButton.dataset.lessonId=eligible?lessonId:'';}
  state.sessions=state.sessions||[];const history={date:new Date().toISOString(),practice:completed.practice,source:completed.source||'practice',...(completed.originLessonId?{originLessonId:completed.originLessonId}:{}),correct:completed.correct,wrong:completed.wrong,xp:completed.xp,total:completed.queue.filter(item=>item.counted!==false).length};if(completed.source==='course'){Object.assign(history,{lessonId:completed.lessonId,moduleId:completed.moduleId,lessonTitle:completed.lessonTitle,courseResult:courseResult?.outcome||'retry',courseAccuracy:courseResult?.accuracy||0,finalTaskCompleted:!!courseResult?.finalTaskCompleted});}state.sessions.unshift(history);state.sessions=state.sessions.slice(0,100);state.activeSession=null;
  if(!save()){state=previousState;session=completed;$('summary')?.classList.add('hidden');$('lessonCard')?.classList.remove('hidden');return;}session=null;renderAll();
}
function formatDate(dateKey){if(dateKey===todayKey())return'dzisiaj';if(dateKey===addDays(1))return'jutro';const [year,month,day]=dateKey.split('-');return `${day}.${month}.${year}`;}
