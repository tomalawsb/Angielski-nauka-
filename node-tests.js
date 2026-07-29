'use strict';
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=__dirname;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

class ClassList{
  constructor(classes=''){this.set=new Set(String(classes).split(/\s+/).filter(Boolean));}
  add(...xs){xs.forEach(x=>this.set.add(x));}
  remove(...xs){xs.forEach(x=>this.set.delete(x));}
  contains(x){return this.set.has(x);}
  toggle(x,force){if(force===undefined){if(this.set.has(x)){this.set.delete(x);return false;}this.set.add(x);return true;}force?this.set.add(x):this.set.delete(x);return !!force;}
}
class Element{
  constructor({id='',classes='',dataset={}}={}){this.id=id;this.classList=new ClassList(classes);this.dataset=dataset;this.style={display:'none',width:''};this.value='';this.checked=false;this.disabled=false;this.textContent='';this.listeners={};this._innerHTML='';this.options=[];this.tagName='DIV';}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  set innerHTML(value){this._innerHTML=String(value);this.options=[...this._innerHTML.matchAll(/<option value="([^"]*)"/g)].map(m=>({value:m[1]}));}
  get innerHTML(){return this._innerHTML;}
  closest(){return null;}
  focus(){}
}
const elements=new Map();
for(const match of html.matchAll(/<([a-z0-9]+)([^>]*?)id="([^"]+)"([^>]*)>/gi)){
  const attrs=(match[2]||'')+(match[4]||'');
  const cls=(attrs.match(/class="([^"]*)"/)||[])[1]||'';
  const el=new Element({id:match[3],classes:cls});
  el.tagName=match[1].toUpperCase();
  elements.set(el.id,el);
}
const navs=[...html.matchAll(/<button class="nav[^"]*" data-nav="([^"]+)"/g)].map(m=>new Element({classes:'nav',dataset:{nav:m[1]}}));
const practices=[...html.matchAll(/<button class="practice[^"]*" data-practice="([^"]+)"/g)].map(m=>new Element({classes:'practice',dataset:{practice:m[1]}}));
const screens=[...elements.values()].filter(el=>el.classList.contains('screen'));
const domListeners={};
const document={
  getElementById:id=>elements.get(id)||null,
  querySelectorAll(selector){
    if(selector==='[data-nav]')return navs;
    if(selector==='[data-practice]')return practices;
    if(selector==='.screen')return screens;
    if(selector==='.nav')return navs;
    if(selector==='.choice')return [];
    return [];
  },
  querySelector(){return null;},
  addEventListener(type,fn){(domListeners[type]??=[]).push(fn);}
};
const storage=new Map();
const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
const windowListeners={};
const context={
  console,setTimeout,clearTimeout,Date,Math,JSON,Promise,Set,Map,Array,String,Number,RegExp,Blob,
  document,localStorage,navigator:{},location:{protocol:'http:',pathname:'/index.html',replace(){}},
  alert(){},confirm(){return true;},
  addEventListener(type,fn){(windowListeners[type]??=[]).push(fn);}
};
context.window=context;
context.globalThis=context;
vm.createContext(context);
for(const file of ['learning-core.js','data.js','dialogues.js','script.js']){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}
for(const fn of domListeners.DOMContentLoaded||[])fn();
const T=context.__trainerTests;
const tests=[];
const test=(name,condition)=>tests.push([name,!!condition]);

test('uruchomienie aplikacji bez błędu',!!T&&elements.get('headline').textContent!=='Ładowanie...');
test('baza zawiera co najmniej 390 unikalnych wpisów',T.WORDS.length>=390);
test('zły szyk jest błędem',T.answerScore('router the restart I','I restart the router').status==='wrong');
test('zmiana przeczenia jest błędem',T.answerScore('I cannot come tomorrow','I can come tomorrow').status==='wrong');
test('zmiana czasu today/tomorrow jest błędem',T.answerScore('I will send it tomorrow','I will send it today').status==='wrong');
test('skróty są akceptowane',T.answerScore("I'm calling",'I am calling').status==='correct');
test('literówka chargre jest akceptowana',T.answerScore('chargre','charger').status==='correct');
test('dog/dig nie jest poprawne',T.answerScore('dog','dig').status!=='correct');
test('table/cable nie jest poprawne',T.answerScore('table','cable').status!=='correct');
test('tower/power nie jest poprawne',T.answerScore('tower','power').status!=='correct');
test('drive/driver nie jest poprawne',T.answerScore('drive','driver').status!=='correct');
test('here/there zmienia znaczenie',T.answerScore('The signal is better there','The signal is better here').status==='wrong');
test('brak rodzajnika nie jest pełnym sukcesem',T.answerScore('I restart router','I restart the router').status!=='correct');
test('alternatywa dialogowa jest akceptowana',T.bestAnswerScore('Could we move the appointment to Friday?',T.DIALOGUE_SCENES.scene_b1_001.accepted).status==='correct');
test('tryb dialogowy tworzy zadania',T.practiceQueue('dialogues').length>0);
test('tryb samochodowy tworzy zadania',T.practiceQueue('car').length>0);
let p=T.advanceProgress({},true,'2026-07-01');
const same=T.advanceProgress(p,true,'2026-07-01');
test('drugi sukces tego samego dnia nie zwiększa etapu',same.intervalIndex===p.intervalIndex);
for(const day of ['2026-07-02','2026-07-05','2026-07-12','2026-07-26'])p=T.advanceProgress(p,true,day);
test('opanowanie wymaga pięciu dni',p.status==='mastered'&&p.successDays.length===5);
test('wersja interfejsu 5.8.2',html.includes('>5.8.2<')&&fs.readFileSync(path.join(root,'script.js'),'utf8').includes("APP_VERSION='5.8.2'"));
test('każdy wpis ma naturalny przykład',T.sentenceEn(T.WORDS.find(w=>w.english==='person')).includes('waiting outside')&&!fs.readFileSync(path.join(root,'data.js'),'utf8').includes('This word is useful'));
test('użyteczny dłuższy przykład pozostaje',T.sentenceEn(T.WORDS.find(w=>w.id==='praca_a1_0003_i_need_to_check_the_cable')).includes('before I begin the repair'));
const carTasks=T.practiceQueue('car');
const carKeys=carTasks.map(t=>{const w=T.WORDS.find(x=>x.id===t.wordId);return T.normalize(w.english+'|'+w.polish);});
test('kolejka nie zawiera duplikatów treści',new Set(carKeys).size===carKeys.length);
test('dialog ma numerowane kroki',T.DIALOGUE_SCENES.scene_a1_003.turn===1&&T.DIALOGUE_SCENES.scene_a1_007.turn===2&&T.DIALOGUE_SCENES.scene_a1_019.turn===5);
const dialogueTasks=T.practiceQueue('dialogues');
const dialogueTurns=dialogueTasks.map(task=>T.DIALOGUE_SCENES[task.wordId]?.turn).filter(Boolean);
test('dialog A1 idzie kolejno 1-2-3-4-5',dialogueTurns.join(',')==='1,2,3,4,5');
const oldState=T.migrate({items:{legacy:{seen:10,correct:10,status:'mastered',intervalIndex:6}}});
test('stare fałszywe opanowanie wraca do powtórki',oldState.items.legacy.status==='review'&&oldState.items.legacy.successDays.length===0&&oldState.items.legacy.nextReview===T.todayKey());
const aliasId=Object.keys(T.WORD_ALIASES)[0],canonicalId=T.WORD_ALIASES[aliasId];
const aliasedState=T.migrate({items:{[aliasId]:{seen:3,correct:3,status:'review',lastSuccessDay:'2026-07-20',successDays:['2026-07-20'],intervalIndex:1}}});
test('postęp duplikatu przechodzi na właściwe hasło',!aliasedState.items[aliasId]&&aliasedState.items[canonicalId]?.seen===3);
test('tryb samochodowy wymusza lektora',T.isVoiceAllowed(false,true)===true);
const wordKeys=T.WORDS.map(word=>T.normalize(word.english+'|'+word.polish));
test('aktywna baza nie ma powtórzonych haseł',new Set(wordKeys).size===wordKeys.length);
const exampleKeys=T.WORDS.flatMap(word=>(word.examples||[]).map(example=>T.normalize(example.en+'|'+example.pl)));
test('aktywna baza nie ma powtórzonych przykładów',new Set(exampleKeys).size===exampleKeys.length);
let confusedTargets=0;
const confusionSample=T.WORDS.filter((_,index)=>index%3===0).slice(0,160);
for(let first=0;first<confusionSample.length;first++)for(let second=first+1;second<confusionSample.length;second++){
  const a=confusionSample[first].english,b=confusionSample[second].english;
  if(T.normalize(a)!==T.normalize(b)&&T.answerScore(a,b).status==='correct')confusedTargets++;
}
test('różne hasła z bazy nie są zaliczane jako to samo',confusedTargets===0);
test('brak rodzajnika jest wyjaśniony',T.answerScore('I restart router','I restart the router').issues.some(i=>i.code==='article'));
test('ustawienia zawierają przypomnienia',html.includes('id="reminderEnabled"')&&html.includes('id="reminderTime"'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
test('PWA pozwala na obrót ekranu',manifest.orientation==='any');
const serviceWorker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
test('Service Worker ma wersjonowany cache offline',serviceWorker.includes('english-trainer-v5.8.2')&&serviceWorker.includes('cache.addAll')&&serviceWorker.includes('safeCachePut'));
test('Service Worker nie udaje dokładnego budzika',!serviceWorker.includes('periodicsync')&&fs.readFileSync(path.join(root,'script.js'),'utf8').includes('checkReminderTime'));


const state=T.getState();
state.settings.defaultLevel='B1';state.settings.defaultTrack='all';
const a1Word=T.WORDS.find(w=>w.level==='A1');
const b1Word=T.WORDS.find(w=>w.level==='B1');
state.items[a1Word.id]={seen:3,correct:1,wrong:2,status:'weak',nextReview:T.todayKey(),successDays:[]};
state.items[b1Word.id]={seen:3,correct:1,wrong:2,status:'weak',nextReview:T.todayKey(),successDays:[]};
const b1Due=T.due();
test('B1 nie pobiera zaległych A1',b1Due.every(w=>w.level==='B1')&&b1Due.some(w=>w.id===b1Word.id)&&!b1Due.some(w=>w.id===a1Word.id));
const b1Vocab=T.practiceQueue('vocab');
test('tryb słówek respektuje B1',b1Vocab.length>0&&b1Vocab.every(task=>T.WORDS.find(w=>w.id===task.wordId)?.level==='B1'));
test('tryb słówek nie zawiera pełnych zdań',b1Vocab.every(task=>T.isVocabularyItem(T.WORDS.find(w=>w.id===task.wordId))));
test('krótkie zdania nie są słówkami',[
  'I suggest','I recommend','I noticed','it depends','let me check','before we start'
].every(english=>!T.isVocabularyItem({id:'test_'+english,english,polish:'test'})));
test('filtr słówek używa prawidłowych granic wyrazów',!fs.readFileSync(path.join(root,'script.js')).includes(Buffer.from([8])));
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
test('ciemny motyw ma komplet zmiennych kolorów',css.includes('html[data-theme="dark"]')&&css.includes('--surface:#111827')&&css.includes('--text:#f8fafc')&&css.includes('--border:#334155'));

test('usunięto zbędne opisy trybów',!html.includes('wybór tłumaczenia i krótkie odpowiedzi')&&!html.includes('tryby nauki'));

test('ustawienia zawierają motyw i wielkość czcionki',html.includes('id="themeMode"')&&html.includes('id="fontSize"'));
state.settings.themeMode='dark';state.settings.fontSize='large';T.applyAppearance();
test('motyw i rozmiar czcionki są stosowane',elements.get('appRoot').dataset.theme==='dark'&&elements.get('appRoot').dataset.fontSize==='large');

const strictVocab=T.practiceQueue('vocab');
test('każde zadanie Słówka ma dokładnie jedno angielskie słowo',strictVocab.every(task=>T.wordsOf(T.WORDS.find(w=>w.id===task.wordId)?.english).length===1));
const sentenceTasks=T.practiceQueue('sentences');
test('każde zadanie Zdania ma pełne zdanie',sentenceTasks.length>0&&sentenceTasks.every(task=>T.isSentenceItem(T.WORDS.find(w=>w.id===task.wordId))));
const writingTasks=T.practiceQueue('writing');
test('Pisanie słówek nie pobiera zdań',writingTasks.length>0&&writingTasks.every(task=>T.wordsOf(T.WORDS.find(w=>w.id===task.wordId)?.english).length===1));
test('ustawienia są podzielone na sekcje', ['Nauka','Powiadomienia','Wygląd','Dźwięk i mowa','Tryb samochodowy','Dane','Zaawansowane'].every(label=>html.includes('<h2>'+label+'</h2>')));
test('dolna nawigacja chowa się przy klawiaturze',css.includes('body.keyboard-open .bottomnav')&&css.includes('body:has(input:focus,textarea:focus) .bottomnav')&&fs.readFileSync(path.join(root,'script.js'),'utf8').includes('setupKeyboardHandling'));
test('tryb Pisanie ma jednoznaczny opis',html.includes('<strong>Pisanie</strong><span>Przetłumacz słowo i wpisz odpowiedź.</span>'));

state.settings.defaultLevel='A1';state.settings.defaultTrack='all';


const script=fs.readFileSync(path.join(root,'script.js'),'utf8');
test('dolne menu ma dokładnie cztery zakładki',navs.length===4&&['today','study','progress','more'].every(id=>navs.some(n=>n.dataset.nav===id)));
test('ekran główny ma jeden dominujący start',html.includes('Rozpocznij dzisiejszą naukę')&&html.includes('class="primary primary-hero"'));
test('onboarding ma pięć kroków',(html.match(/class="onboarding-step/g)||[]).length===5);
test('funkcje techniczne są tylko w ustawieniach',html.includes('<h2>Zaawansowane</h2>')&&html.includes('Odśwież pliki aplikacji')&&!html.match(/<header[\s\S]*Odśwież pliki aplikacji[\s\S]*<\/header>/));
test('brak systemowych alertów i confirmów',!(/\balert\s*\(/.test(script))&&!(/\bconfirm\s*\(/.test(script)));
test('import odrzuca ujemne XP',(()=>{try{T.validateImportedState(JSON.stringify({version:'5.8.2',user:{xp:-1}}));return false}catch(e){return /user\.xp/.test(e.message)}})());
test('import odrzuca nieznane pola',(()=>{try{T.validateImportedState(JSON.stringify({version:'5.8.2',hacker:true}));return false}catch(e){return /Nieznane pola/.test(e.message)}})());
test('import akceptuje poprawny stan',(()=>{try{return T.validateImportedState(JSON.stringify({version:'5.8.2',settings:{dailyGoal:20},user:{xp:10}})).user.xp===10}catch(e){return false}})());
test('losowanie używa Fishera-Yatesa',script.includes('for(let index=result.length-1;index>0;index--)')&&!script.includes('.sort(()=>Math.random'));
test('pasek i licznik sesji są stale dostępne',['lessonProgress','lessonRemaining','lessonCorrect','lessonMode'].every(id=>html.includes('id="'+id+'"')));
test('podsumowanie sesji pokazuje wynik i XP',['sumAccuracy','sumCorrect','sumWrong','sumXp','sumStreak','nextReviewInfo'].every(id=>html.includes('id="'+id+'"')));
test('baza zawiera rzeczywisty materiał B2',T.WORDS.filter(w=>w.level==='B2').length>=30);
test('materiały zawierają informacje gramatyczne',T.WORDS.filter(w=>w.grammar&&w.grammar.partOfSpeech).length>=400);
test('CSP i zewnętrzny CSS są włączone',html.includes('Content-Security-Policy')&&html.includes('href="styles.css?v=5.8.2"')&&!html.includes('<style>'));
test('responsywność ma układ tabletowy',css.includes('@media(min-width:700px)')&&css.includes('@media(min-width:940px)'));


test('import odrzuca XP zapisane jako tekst',(()=>{try{T.validateImportedState(JSON.stringify({version:'5.8.2',user:{xp:'10'}}));return false;}catch(_){return true;}})());
test('import odrzuca przyszłą wersję',(()=>{try{T.validateImportedState(JSON.stringify({version:'5.999.999'}));return false;}catch(_){return true;}})());
test('import odrzuca nieznane pole postępu',(()=>{try{T.validateImportedState(JSON.stringify({version:'5.8.2',items:{[T.WORDS[0].id]:{seen:1,hack:true}}}));return false;}catch(_){return true;}})());
test('import odrzuca błędne statystyki trybu',(()=>{try{T.validateImportedState(JSON.stringify({version:'5.8.2',modeStats:{word_write:{correct:'1',wrong:0,xp:0}}}));return false;}catch(_){return true;}})());
test('import odrzuca uszkodzoną aktywną sesję',(()=>{try{T.validateImportedState(JSON.stringify({version:'5.8.2',activeSession:{queue:[{wordId:'brak',kind:'new',mode:'word_write'}],index:0,correct:0,wrong:0,xp:0,practice:'writing',startedAt:new Date().toISOString()}}));return false;}catch(_){return true;}})());
const levelCounts=T.WORDS.reduce((out,word)=>(out[word.level]=(out[word.level]||0)+1,out),{});
test('każdy poziom ma co najmniej 45 materiałów',['A1','A2','B1','B2'].every(level=>(levelCounts[level]||0)>=45));
test('żaden poziom nie zawiera ponad połowy bazy',Object.values(levelCounts).every(count=>count/T.WORDS.length<.5));
test('proste słowa nie są oznaczone jako B2',!T.WORDS.some(word=>word.level==='B2'&&['signal','access','warranty'].includes(T.normalize(word.english))));
test('wszystkie wpisy mają konkretną część mowy',T.WORDS.every(word=>word.grammar?.partOfSpeech&&word.grammar.partOfSpeech!=='słowo'));
test('baza pokazuje poziom specjalistyczności',T.WORDS.every(word=>['ogólne','techniczne','zawodowe'].includes(word.specialism)));
test('co najmniej 150 wpisów ma kolokacje',T.WORDS.filter(word=>word.collocations?.length).length>=150);
test('co najmniej 50 wpisów ma typowe przyimki',T.WORDS.filter(word=>word.grammar?.typicalPrepositions).length>=50);
test('co najmniej 40 wpisów opisuje częste błędy',T.WORDS.filter(word=>word.commonMistakes?.length).length>=40);
test('baza nie zawiera szablonu końcowej kontroli',!fs.readFileSync(path.join(root,'data.js'),'utf8').includes('During the final check'));
const dialogueGroups=Object.values(T.DIALOGUE_SCENES).reduce((map,scene)=>{(map[scene.conversation]??=[]).push(scene);return map;},{});
test('dialogi zawierają co najmniej 8 pełnych rozmów',Object.keys(dialogueGroups).length>=8);
test('każda rozmowa ma komplet kolejnych kroków',Object.values(dialogueGroups).every(group=>{const total=group[0].total,turns=group.map(scene=>scene.turn).sort((a,b)=>a-b);return group.length===total&&turns.join(',')===Array.from({length:total},(_,i)=>i+1).join(',');}));
test('każdy dialog ma tablicę poprawnych odpowiedzi',Object.values(T.DIALOGUE_SCENES).every(scene=>Array.isArray(scene.accepted)&&scene.accepted.length>=2));
test('polecenia dialogów są po polsku',Object.values(T.DIALOGUE_SCENES).every(scene=>typeof scene.promptPl==='string'&&scene.promptPl.length>10&&!/^Client:/i.test(scene.promptPl)));
test('dialog pokazuje wypowiedź klienta',Object.values(T.DIALOGUE_SCENES).every(scene=>/^Client:/i.test(scene.prompt))&&script.includes('Klient mówi: ${scene.prompt}'));
test('odpowiedź wzorcowa dialogu odpowiada materiałowi',T.WORDS.filter(word=>T.DIALOGUE_SCENES[word.id]).every(word=>T.normalize(T.DIALOGUE_SCENES[word.id].accepted[0])===T.normalize(word.english)));
const queueSignatures=new Set(Array.from({length:6},()=>T.practiceQueue('test').map(item=>item.wordId).join('|')));
test('kolejność planu jest rzeczywiście losowana',queueSignatures.size>1);
test('interfejs pozwala natychmiast powtórzyć błąd',html.includes('id="retryBtn"')&&script.includes('function retryCurrent'));
test('błędne fragmenty są podświetlane',typeof T.diffMarkup==='function'&&T.diffMarkup('I go tomorrow','I went tomorrow').answer.includes('<mark>'));
test('błąd formy gramatycznej jest wyjaśniany',T.answerScore('He work here','He works here').issues.some(issue=>issue.code==='verb_form'));
test('zapis odpowiedzi ma wycofanie zmian po błędzie',script.includes('state=previousState;session=previousSession;checked=false'));

const rollbackWord=T.WORDS.find(word=>T.isVocabularyItem(word));
T.startSession([{wordId:rollbackWord.id,kind:'new',mode:'word_write'}],'writing');
const rollbackBefore={xp:T.getState().user.xp,correct:T.getSession().correct,seen:T.getState().items[rollbackWord.id]?.seen||0};
const originalSetItem=context.localStorage.setItem,originalConsoleError=context.console.error;context.localStorage.setItem=()=>{throw new Error('quota');};context.console.error=()=>{};
T.mark(true,rollbackWord.english,{score:1,status:'correct',label:'Dobrze',issues:[],expected:rollbackWord.english});
const rollbackAfter={xp:T.getState().user.xp,correct:T.getSession().correct,seen:T.getState().items[rollbackWord.id]?.seen||0};
context.localStorage.setItem=originalSetItem;context.console.error=originalConsoleError;
test('nieudany zapis faktycznie wycofuje naliczenie wyniku',JSON.stringify(rollbackBefore)===JSON.stringify(rollbackAfter));



// Regresje v5.8.2: ponowienia, wersje, daty i jakość materiału.
test('import odrzuca nowszą poprawkę tej samej wersji',(()=>{try{T.validateImportedState(JSON.stringify({version:'5.8.99'}));return false;}catch(_){return true;}})());
test('import odrzuca datę zapisaną słownie',(()=>{try{T.validateImportedState(JSON.stringify({version:'5.8.2',createdAt:'July 29, 2026'}));return false;}catch(_){return true;}})());
test('import odrzuca niemożliwą datę kalendarzową',(()=>{try{T.validateImportedState(JSON.stringify({version:'5.8.2',createdAt:'2026-02-30T12:00:00Z'}));return false;}catch(_){return true;}})());
test('import akceptuje poprawną datę ISO',(()=>{try{return !!T.validateImportedState(JSON.stringify({version:'5.8.2',createdAt:'2026-07-29T12:00:00.000Z'}));}catch(_){return false;}})());

const retryWord=T.WORDS.find(word=>T.isVocabularyItem(word));
T.startSession([{wordId:retryWord.id,kind:'new',mode:'word_write'}],'writing');
const retryBaseState=JSON.parse(JSON.stringify(T.getState())),retryBaseSession=JSON.parse(JSON.stringify(T.getSession()));
T.mark(false,'całkowicie błędna odpowiedź',{score:0,status:'wrong',label:'Źle',issues:[],expected:retryWord.english});
const wrongAttemptState=JSON.parse(JSON.stringify(T.getState())),wrongAttemptSession=JSON.parse(JSON.stringify(T.getSession()));
test('błędna próba nie przyznaje XP',wrongAttemptState.user.xp===retryBaseState.user.xp&&wrongAttemptSession.xp===retryBaseSession.xp);
T.retryCurrent();
const restoredState=JSON.parse(JSON.stringify(T.getState())),restoredSession=JSON.parse(JSON.stringify(T.getSession()));
test('ponowienie cofa błąd i statystyki zadania',restoredSession.correct===retryBaseSession.correct&&restoredSession.wrong===retryBaseSession.wrong&&restoredState.user.totalWrong===retryBaseState.user.totalWrong);
T.mark(true,retryWord.english,{score:1,status:'correct',label:'Dobrze',issues:[],expected:retryWord.english});
const retriedState=JSON.parse(JSON.stringify(T.getState())),retriedSession=JSON.parse(JSON.stringify(T.getSession()));
test('zadanie po ponowieniu liczy się tylko raz',retriedSession.correct-retryBaseSession.correct===1&&retriedSession.wrong-retryBaseSession.wrong===0);
test('po ponowieniu eksport przechodzi własną walidację',(()=>{try{return !!T.validateImportedState(JSON.stringify(retriedState));}catch(_){return false;}})());

const badCollocationFragments=['good morning how','the battery is','the wireless network is','the firmware update may','final price depends','needs permission to','is diagnosis','use payment'];
const allCollocations=T.WORDS.flatMap(word=>word.collocations||[]).map(value=>T.normalize(value));
test('kolokacje nie zawierają automatycznie uciętych zdań',badCollocationFragments.every(fragment=>!allCollocations.includes(T.normalize(fragment))));
test('przykłady dialogowe zawierają realny kontekst',!T.WORDS.some(word=>(word.examples||[]).some(example=>/in this conversation, a technician says/i.test(example.en||'')))&&T.WORDS.filter(word=>T.DIALOGUE_SCENES[word.id]).every(word=>word.examples?.[0]?.en?.includes('Client:')));

test('ukończona sesja pozostaje możliwa do wznowienia',script.includes('saved.index<=saved.queue.length'));

const failed=tests.filter(([,ok])=>!ok);
console.log(tests.map(([name,ok])=>(ok?'PASS ':'FAIL ')+name).join('\n'));
console.log(`Wynik: ${tests.length-failed.length}/${tests.length}`);
process.exit(failed.length?1:0);
