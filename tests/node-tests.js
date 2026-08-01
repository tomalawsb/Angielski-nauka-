'use strict';
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');
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
  querySelector(){return null;}
  setAttribute(name,value){this[name]=String(value);}
  removeAttribute(name){delete this[name];}
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
const capturedErrors=[];
const context={
  console:{...console,error:(...args)=>capturedErrors.push(args.map(String).join(' '))},setTimeout,clearTimeout,Date,Math,JSON,Promise,Set,Map,Array,String,Number,RegExp,Blob,
  document,localStorage,navigator:{},location:{protocol:'http:',pathname:'/index.html',replace(){}},
  alert(){},confirm(){return true;},
  addEventListener(type,fn){(windowListeners[type]??=[]).push(fn);}
};
context.window=context;
context.globalThis=context;
vm.createContext(context);
const runtimeFiles=[
  'js/learning-core-v6.6.0.js','js/course-core-v6.6.0.js','data/materials-v6.6.0.js','data/dialogues-v6.6.0.js','data/course-a1-module1-v6.6.0.js','data/course-a1-full-expansion-v6.6.0.js','data/course-a2-full-v6.6.0.js','data/content-quality-v6.6.0.js','data/course-catalog-v6.6.0.js',
  'js/app-state-v6.6.0.js','js/storage-v6.6.0.js','js/pwa-services-v6.6.0.js','js/reminders-v6.6.0.js',
  'js/settings-v6.6.0.js','js/navigation-v6.6.0.js','js/review-engine-v6.6.0.js','js/course-engine-v6.6.0.js','js/course-ui-v6.6.0.js','js/exercise-engine-v6.6.0.js',
  'js/statistics-v6.6.0.js','js/speech-v6.6.0.js','js/car-mode-v6.6.0.js','js/data-io-v6.6.0.js','js/app-v6.6.0.js'
];
for(const file of runtimeFiles){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}
const script=runtimeFiles.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
for(const fn of domListeners.DOMContentLoaded||[])fn();
const T=context.__trainerTests;
const tests=[];
const test=(name,condition)=>tests.push([name,!!condition]);

test('uruchomienie aplikacji bez błędu',capturedErrors.length===0&&!!T&&elements.get('courseHomeTitle').textContent!=='Ładowanie kursu…');
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
test('tryb dialogowy nie wprowadza niepoznanego materiału',T.practiceQueue('dialogues').length===0);
test('tryb samochodowy nie wprowadza niepoznanego materiału',T.practiceQueue('car').length===0);
const initialState=T.getState();
initialState.settings.defaultTrack='all';initialState.settings.trainingTopicVersion=1;
const seedLearned=word=>{if(!word)return;initialState.items[word.id]={seen:1,correct:1,wrong:0,streak:1,mastery:20,nextReview:'2099-01-01',lastAnswer:'2026-07-01',lastSuccessDay:'2026-07-01',successDays:['2026-07-01'],status:'review',intervalIndex:1,lapses:0};if(!initialState.course.introducedMaterialIds.includes(word.id))initialState.course.introducedMaterialIds.push(word.id);};
T.WORDS.filter(word=>word.level==='A1'&&T.DIALOGUE_SCENES[word.id]&&!word.id.startsWith('course_')).forEach(seedLearned);
T.WORDS.filter(word=>word.level==='A1'&&T.isSentenceItem(word)).slice(0,40).forEach(seedLearned);
test('tryb dialogowy tworzy zadania z poznanego materiału',T.practiceQueue('dialogues').length>0);
test('tryb samochodowy tworzy zadania z poznanego materiału',T.practiceQueue('car').length>0);
let p=T.advanceProgress({},true,'2026-07-01');
const same=T.advanceProgress(p,true,'2026-07-01');
test('drugi sukces tego samego dnia nie zwiększa etapu',same.intervalIndex===p.intervalIndex);
for(const day of ['2026-07-02','2026-07-05','2026-07-12','2026-07-26'])p=T.advanceProgress(p,true,day);
test('opanowanie wymaga pięciu dni',p.status==='mastered'&&p.successDays.length===5);
test('wersja interfejsu 6.6.0',html.includes('>6.6.0<')&&script.includes("APP_VERSION='6.6.0'"));
test('każdy wpis ma naturalny przykład',T.sentenceEn(T.WORDS.find(w=>w.english==='person')).includes('waiting outside')&&!fs.readFileSync(path.join(root,'data/materials-v6.6.0.js'),'utf8').includes('This word is useful'));
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
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest-v6.6.0.json'),'utf8'));
test('PWA pozwala na obrót ekranu',manifest.orientation==='any');
const serviceWorker=fs.readFileSync(path.join(root,'service-worker-v6.6.0.js'),'utf8');
test('Service Worker ma wersjonowany cache offline',serviceWorker.includes('english-trainer-v6.6.0')&&serviceWorker.includes("cache:'no-store'")&&serviceWorker.includes("isCode"));
test('Service Worker używa jednego aktualnego adresu aplikacji offline',serviceWorker.includes("const APP_ENTRY='./index.html?app='+VERSION")&&serviceWorker.includes('cache.match(APP_ENTRY)')&&serviceWorker.includes('openWindow(APP_ENTRY)')&&!serviceWorker.includes('6.6.0-p4\'')&&!serviceWorker.includes('6.6.0-p4"'));
test('Service Worker nie udaje dokładnego budzika',!serviceWorker.includes('periodicsync')&&script.includes('checkReminderTime'));


const state=T.getState();
state.settings.defaultLevel='B1';state.settings.defaultTrack='all';
T.WORDS.filter(word=>word.level==='B1'&&(T.isVocabularyItem(word)||T.isSentenceItem(word))).slice(0,60).forEach(seedLearned);
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
test('filtr słówek używa prawidłowych granic wyrazów',!Buffer.from(script).includes(Buffer.from([8])));
const css=fs.readFileSync(path.join(root,'css/styles-v6.6.0.css'),'utf8');
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
test('ustawienia są podzielone na sekcje', ['Nauka','Powiadomienia','Wygląd','Dźwięk i mowa','Tryb samochodowy','Kopia i przywracanie danych','Zaawansowane'].every(label=>new RegExp('<h2(?: [^>]*)?>'+label+'</h2>').test(html)));
test('dolna nawigacja chowa się przy klawiaturze',css.includes('body.keyboard-open .bottomnav')&&css.includes('body:has(input:focus,textarea:focus) .bottomnav')&&script.includes('setupKeyboardHandling'));
test('tryb Pisanie ma jednoznaczny opis',html.includes('<strong>Pisanie</strong><span>Wpisuj odpowiedzi bez podpowiedzi.</span>'));

state.settings.defaultLevel='A1';state.settings.defaultTrack='all';


// script is the concatenation of all runtime modules (defined above).
test('dolne menu ma dokładnie cztery zakładki',navs.length===4&&['today','study','progress','more'].every(id=>navs.some(n=>n.dataset.nav===id)));
test('ekran główny ma jeden dominujący start',(()=>{const section=html.slice(html.indexOf('<section id="todayScreen"'),html.indexOf('<section id="courseScreen"'));return (section.match(/primary primary-hero/g)||[]).length===1&&section.includes('id="courseContinueBtn"');})());
test('onboarding ma pięć kroków',(html.match(/class="onboarding-step/g)||[]).length===5);
test('funkcje techniczne są tylko w ustawieniach',html.includes('<h2>Zaawansowane</h2>')&&html.includes('Odśwież pliki aplikacji')&&!html.match(/<header[\s\S]*Odśwież pliki aplikacji[\s\S]*<\/header>/));
test('brak systemowych alertów i confirmów',!(/\balert\s*\(/.test(script))&&!(/\bconfirm\s*\(/.test(script)));
test('import odrzuca ujemne XP',(()=>{try{T.validateImportedState(JSON.stringify({version:'6.6.0',user:{xp:-1}}));return false}catch(e){return /user\.xp/.test(e.message)}})());
test('import odrzuca nieznane pola',(()=>{try{T.validateImportedState(JSON.stringify({version:'6.6.0',hacker:true}));return false}catch(e){return /Nieznane pola/.test(e.message)}})());
test('import akceptuje poprawny stan',(()=>{try{return T.validateImportedState(JSON.stringify({version:'6.6.0',settings:{dailyGoal:20},user:{xp:10}})).user.xp===10}catch(e){return false}})());
test('losowanie używa Fishera-Yatesa',script.includes('for(let index=result.length-1;index>0;index--)')&&!script.includes('.sort(()=>Math.random'));
test('pasek i licznik sesji są stale dostępne',['lessonProgress','lessonRemaining','lessonCorrect','lessonMode'].every(id=>html.includes('id="'+id+'"')));
test('podsumowanie sesji pokazuje wynik i XP',['sumAccuracy','sumCorrect','sumWrong','sumXp','sumStreak','nextReviewInfo'].every(id=>html.includes('id="'+id+'"')));
test('baza zawiera rzeczywisty materiał B2',T.WORDS.filter(w=>w.level==='B2').length>=30);
test('materiały zawierają informacje gramatyczne',T.WORDS.filter(w=>w.grammar&&w.grammar.partOfSpeech).length>=400);
test('CSP i zewnętrzny CSS są włączone',html.includes('Content-Security-Policy')&&html.includes('href="css/styles-v6.6.0.css"')&&!html.includes('<style>'));
test('responsywność ma układ tabletowy',css.includes('@media(min-width:700px)')&&css.includes('@media(min-width:940px)'));


test('import odrzuca XP zapisane jako tekst',(()=>{try{T.validateImportedState(JSON.stringify({version:'6.6.0',user:{xp:'10'}}));return false;}catch(_){return true;}})());
test('import odrzuca przyszłą wersję',(()=>{try{T.validateImportedState(JSON.stringify({version:'6.999.999'}));return false;}catch(_){return true;}})());
test('import odrzuca nieznane pole postępu',(()=>{try{T.validateImportedState(JSON.stringify({version:'6.6.0',items:{[T.WORDS[0].id]:{seen:1,hack:true}}}));return false;}catch(_){return true;}})());
test('import odrzuca błędne statystyki trybu',(()=>{try{T.validateImportedState(JSON.stringify({version:'6.6.0',modeStats:{word_write:{correct:'1',wrong:0,xp:0}}}));return false;}catch(_){return true;}})());
test('import odrzuca uszkodzoną aktywną sesję',(()=>{try{T.validateImportedState(JSON.stringify({version:'6.6.0',activeSession:{queue:[{wordId:'brak',kind:'new',mode:'word_write'}],index:0,correct:0,wrong:0,xp:0,practice:'writing',startedAt:new Date().toISOString()}}));return false;}catch(_){return true;}})());
const levelCounts=T.WORDS.reduce((out,word)=>(out[word.level]=(out[word.level]||0)+1,out),{});
test('każdy poziom ma co najmniej 45 materiałów',['A1','A2','B1','B2'].every(level=>(levelCounts[level]||0)>=45));
test('pełny A1 dominuje bazę, ale poziomy A2–B2 pozostają dostępne',(levelCounts.A1+levelCounts.A2)>T.WORDS.length*0.8&&['A1','A2','B1','B2'].every(level=>(levelCounts[level]||0)>=45));
test('proste słowa nie są oznaczone jako B2',!T.WORDS.some(word=>word.level==='B2'&&['signal','access','warranty'].includes(T.normalize(word.english))));
test('wszystkie wpisy mają konkretną część mowy',T.WORDS.every(word=>word.grammar?.partOfSpeech&&word.grammar.partOfSpeech!=='słowo'));
test('baza pokazuje poziom specjalistyczności',T.WORDS.every(word=>['ogólne','techniczne','zawodowe'].includes(word.specialism)));
test('co najmniej 150 wpisów ma kolokacje',T.WORDS.filter(word=>word.collocations?.length).length>=150);
test('co najmniej 50 wpisów ma typowe przyimki',T.WORDS.filter(word=>word.grammar?.typicalPrepositions).length>=50);
test('co najmniej 40 wpisów opisuje częste błędy',T.WORDS.filter(word=>word.commonMistakes?.length).length>=40);
test('baza nie zawiera szablonu końcowej kontroli',!fs.readFileSync(path.join(root,'data/materials-v6.6.0.js'),'utf8').includes('During the final check'));
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




test('zasoby uruchomieniowe mają unikalne nazwy wersji',html.includes('js/bootstrap-v6.6.0.js')&&html.includes('js/app-v6.6.0.js')&&html.includes('css/styles-v6.6.0.css'));
test('Service Worker pobiera kod network-first bez cache HTTP',serviceWorker.includes("cache:'no-store'")&&serviceWorker.includes("isDocument||isCode"));
test('aktualizacja Service Workera wymusza jedno przeładowanie',fs.readFileSync(path.join(root,'js/bootstrap-v6.6.0.js'),'utf8').includes('controllerchange')&&script.includes('controllerchange'));

// Regresje v6.6.0: ponowienia, wersje, daty i jakość materiału.
test('import odrzuca nowszą poprawkę tej samej wersji',(()=>{try{T.validateImportedState(JSON.stringify({version:'6.6.99'}));return false;}catch(_){return true;}})());
test('import odrzuca datę zapisaną słownie',(()=>{try{T.validateImportedState(JSON.stringify({version:'6.6.0',createdAt:'July 29, 2026'}));return false;}catch(_){return true;}})());
test('import odrzuca niemożliwą datę kalendarzową',(()=>{try{T.validateImportedState(JSON.stringify({version:'6.6.0',createdAt:'2026-02-30T12:00:00Z'}));return false;}catch(_){return true;}})());
test('import akceptuje poprawną datę ISO',(()=>{try{return !!T.validateImportedState(JSON.stringify({version:'6.6.0',createdAt:'2026-07-29T12:00:00.000Z'}));}catch(_){return false;}})());

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


// Pakiet 1: porządkowanie kodu bez zmiany funkcjonalnej.
const modularFiles=runtimeFiles.filter(file=>file.startsWith('js/')&&!file.includes('learning-core'));
test('główny kod jest rozdzielony na moduły',modularFiles.length===16&&modularFiles.every(file=>fs.existsSync(path.join(root,file))));
test('nie pozostał monolityczny plik aplikacji',!fs.existsSync(path.join(root,'script-v6.6.0.js')));
test('migracja zachowuje klucz zapisu wersji 5.8.5',script.includes("angielski_daily_trainer_state_v585"));
test('migracja zachowuje klucz zapisu wersji 5.8.3',script.includes("angielski_daily_trainer_state_v583"));
test('Service Worker buforuje wszystkie moduły uruchomieniowe',runtimeFiles.every(file=>serviceWorker.includes("'./"+file+"'")));
const localResources=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1].split('?')[0]).filter(value=>value&&!/^(?:data:|https?:|#)/.test(value));
test('wszystkie lokalne zasoby z index.html istnieją',localResources.every(value=>fs.existsSync(path.join(root,value))));
test('audyt zawiera pełną listę 456 materiałów',fs.readFileSync(path.join(root,'docs/AUDYT_456_MATERIALOW_v5_8_4.csv'),'utf8').split(/\r?\n/).filter(Boolean).length===457);


// Pakiet 2: model kursu, cztery rodzaje sesji i zaliczanie lekcji.
const catalogAudit=T.courseCatalogStatus();
test('katalog kursu przechodzi walidację schematu',catalogAudit.valid&&catalogAudit.errors.length===0);
const a1Blueprints=T.CourseCore.flattenLessons(T.COURSE_CATALOG).filter(lesson=>lesson.moduleId==='a1-m01');
test('katalog zawiera dziesięć opublikowanych lekcji pilotażowych A1',a1Blueprints.length===10&&a1Blueprints.every(lesson=>lesson.status==='published'));
test('pierwsza lekcja kursu jest odblokowana',T.publishedCourseLessons().length===115&&T.getState().course.unlockedLessonIds.includes('a1-m01-l01')&&T.getState().course.unlockedLessonIds.includes('a2-m01-l01')&&T.canStartCourseLesson('a1-m01-l01'));

const fixtureWords=T.WORDS.filter(word=>word.level==='A1').slice(0,3),fixtureIds=fixtureWords.map(word=>word.id);
const fixtureLesson=(id,order,materialIds,moduleId='fixture-m01')=>({id,level:'A1',moduleId,order,title:'Lekcja '+order,goal:'Potrafię wykonać zadanie '+order,estimatedMinutes:10,status:'published',materialIds,reviewMaterialIds:[],stages:['introduction','recognition','writing','finalTask'],finalTask:{mode:'writing',instruction:'Napisz powitanie i pożegnanie.',acceptedAnswers:[],minimumWords:2,requiredKeywords:[['hello','hi'],['goodbye','bye']],minimumKeywordGroups:2},completionRules:{minimumAccuracy:70,requiredFinalTask:true,requiredMaterialIds:[],minimumMaterialAccuracy:50}});
const fixtureCatalog={schemaVersion:1,levels:[{id:'A1',title:'A1',order:1,modules:[{id:'fixture-m01',level:'A1',order:1,title:'Fixture 1',lessons:[fixtureLesson('fixture-l01',1,fixtureIds.slice(0,2))]},{id:'fixture-m02',level:'A1',order:2,title:'Fixture 2',lessons:[fixtureLesson('fixture-l02',1,fixtureIds.slice(2),'fixture-m02')]}]}]};
const fixtureAudit=T.CourseCore.validateCatalog(fixtureCatalog,T.WORDS.map(word=>word.id));
test('opublikowany katalog testowy wymaga poprawnych materiałów i przechodzi walidację',fixtureAudit.valid);
const fixtureMap=new Map(T.WORDS.map(word=>[word.id,word]));
const fixtureTasks=T.CourseCore.buildCourseTasks(T.CourseCore.lessonById(fixtureCatalog,'fixture-l01'),{introducedMaterialIds:[],dueMaterialIds:[],wordMap:fixtureMap,isVocabularyItem:T.isVocabularyItem,isSentenceItem:T.isSentenceItem});
test('lekcja kursu zachowuje kolejność wprowadzenie przed aktywnym użyciem',fixtureIds.slice(0,2).every(id=>fixtureTasks.findIndex(task=>task.mode==='course_intro_group'&&(task.materialIds||[]).includes(id))<fixtureTasks.findIndex(task=>task.wordId===id&&['word_write','sentence_translate'].includes(task.mode))));
test('zadanie końcowe jest ostatnim etapem lekcji',fixtureTasks.at(-1)?.mode==='course_final'&&fixtureTasks.at(-1)?.stage==='finalTask');
const knownFixtureTasks=T.CourseCore.buildCourseTasks(T.CourseCore.lessonById(fixtureCatalog,'fixture-l01'),{introducedMaterialIds:[fixtureIds[0]],wordMap:fixtureMap,isVocabularyItem:T.isVocabularyItem,isSentenceItem:T.isSentenceItem});
test('poznany materiał nie jest ponownie przedstawiany jako nowy',!knownFixtureTasks.some(task=>task.mode==='course_intro_group'&&(task.materialIds||[]).includes(fixtureIds[0]))&&knownFixtureTasks.some(task=>task.mode==='course_intro_group'&&(task.materialIds||[]).includes(fixtureIds[1])));
const foreignDue=T.WORDS.find(word=>word.level==='B1')||T.WORDS.find(word=>!fixtureIds.includes(word.id));
const scopedTasks=T.CourseCore.buildCourseTasks(T.CourseCore.lessonById(fixtureCatalog,'fixture-l01'),{introducedMaterialIds:[foreignDue.id],dueMaterialIds:[foreignDue.id],wordMap:fixtureMap,isVocabularyItem:T.isVocabularyItem,isSentenceItem:T.isSentenceItem});
test('kurs nie pobiera zaległego materiału spoza bieżącej lekcji',!scopedTasks.some(task=>task.wordId===foreignDue.id));

const attemptResults=(correct,total,finalStatus='correct')=>{
  const values=[{taskId:'intro',wordId:null,materialIds:[fixtureIds[0]],stage:'introduction',mode:'course_intro_group',status:'completed',score:0,counted:false,required:true,completed:true}];
  const finalCorrect=finalStatus==='correct'?1:0;
  const writingCorrect=Math.max(0,correct-finalCorrect);
  for(let i=0;i<total-1;i++){
    const ok=i<writingCorrect;
    values.push({taskId:'r'+i,wordId:fixtureIds[i%fixtureIds.length],stage:'writing',mode:'word_write',status:ok?'correct':'wrong',score:ok?1:0,counted:true,required:true,completed:true});
  }
  values.push({taskId:'final',wordId:null,stage:'finalTask',mode:'course_final',status:finalStatus,score:finalCorrect,counted:true,required:true,completed:true});
  return values;
};
const evalLesson={...T.CourseCore.lessonById(fixtureCatalog,'fixture-l01'),stages:['introduction','writing','finalTask']};
const resultMastered=T.CourseCore.evaluateLessonAttempt({taskResults:attemptResults(10,10)},evalLesson);
const resultCompleted=T.CourseCore.evaluateLessonAttempt({taskResults:attemptResults(7,10)},evalLesson);
const resultReview=T.CourseCore.evaluateLessonAttempt({taskResults:attemptResults(6,10)},evalLesson);
const resultRetry=T.CourseCore.evaluateLessonAttempt({taskResults:attemptResults(3,10)},evalLesson);
const keyLesson={...evalLesson,completionRules:{minimumAccuracy:70,requiredFinalTask:true,requiredMaterialIds:[fixtureIds[0]],minimumMaterialAccuracy:70}};
const keyResults=attemptResults(9,10).map(result=>result.wordId===fixtureIds[0]?{...result,status:'wrong',score:0}:result);
const resultKeyFailed=T.CourseCore.evaluateLessonAttempt({taskResults:keyResults},keyLesson);
test('wynik co najmniej 90 procent daje opanowanie',resultMastered.outcome==='mastered'&&resultMastered.unlockNext);
test('wynik co najmniej 70 procent zalicza lekcję',resultCompleted.outcome==='completed'&&resultCompleted.unlockNext);
test('wynik poniżej progu może zaliczyć z obowiązkową powtórką',resultReview.outcome==='review_required'&&resultReview.unlockNext);
test('bardzo niski wynik nie odblokowuje następnej lekcji',resultRetry.outcome==='retry'&&!resultRetry.unlockNext);
test('niezaliczony kluczowy materiał blokuje ukończenie lekcji',resultKeyFailed.outcome==='retry'&&!resultKeyFailed.requiredMaterialsPassed&&resultKeyFailed.failedRequiredMaterialIds.includes(fixtureIds[0]));
const initialCourse=T.CourseCore.defaultCourseState(fixtureCatalog),afterCourse=T.CourseCore.applyLessonResult(initialCourse,fixtureCatalog,'fixture-l01',resultCompleted,'2026-07-30T08:00:00.000Z');
test('stan kursu zapisuje odblokowane moduły',initialCourse.schemaVersion===2&&initialCourse.unlockedModuleIds.includes('fixture-m01'));
test('zaliczenie odblokowuje następną lekcję',afterCourse.unlockedLessonIds.includes('fixture-l02')&&afterCourse.lessons['fixture-l02'].status==='available');
test('zaliczenie odblokowuje również następny moduł',afterCourse.unlockedModuleIds.includes('fixture-m01')&&afterCourse.unlockedModuleIds.includes('fixture-m02'));

const migrated584=T.migrate({version:'5.8.4',user:{xp:321,streakDays:4},items:{[fixtureIds[0]]:{seen:2,correct:2,wrong:0,status:'review',successDays:['2026-07-20'],lastSuccessDay:'2026-07-20',intervalIndex:1,nextReview:'2026-07-21'}}});
test('migracja 5.8.4 zachowuje statystyki i dodaje stan kursu',migrated584.user.xp===321&&migrated584.user.streakDays===4&&migrated584.course&&migrated584.course.introducedMaterialIds.includes(fixtureIds[0]));
test('kod szuka zapisu wersji 5.8.4',script.includes('angielski_daily_trainer_state_v584'));
test('import akceptuje stan kursu 6.6.0',(()=>{try{return !!T.validateImportedState(JSON.stringify(migrated584));}catch(_){return false;}})());
test('import odrzuca nieznaną lekcję kursu',(()=>{try{T.validateImportedState(JSON.stringify({version:'6.6.0',course:{schemaVersion:1,lessons:{nieznana:{status:'completed'}}}}));return false;}catch(_){return true;}})());
const openFinal=T.scoreTaskAnswer('kot pies stół',null,'course_final',{minimumWords:3,acceptedAnswers:[],requiredKeywords:[['hello','hi'],['goodbye','bye']],minimumKeywordGroups:2});
const validOpenFinal=T.scoreTaskAnswer('hello and goodbye',null,'course_final',{minimumWords:3,acceptedAnswers:[],requiredKeywords:[['hello','hi'],['goodbye','bye']],minimumKeywordGroups:2});
test('otwarte zadanie końcowe nie zalicza przypadkowych słów',openFinal.status!=='correct'&&validOpenFinal.status==='correct');
test('zadanie końcowe bez kryteriów nie może zostać automatycznie zaliczone',T.scoreTaskAnswer('one two three',null,'course_final',{minimumWords:3,acceptedAnswers:[]}).status==='wrong');
const allCarKnown=T.practiceQueue('car').every(task=>T.getState().items[task.wordId]?.seen>0);
const allWritingKnown=T.practiceQueue('writing').every(task=>T.getState().items[task.wordId]?.seen>0);
const allSpeakingKnown=T.practiceQueue('speaking').every(task=>T.getState().items[task.wordId]?.seen>0);
test('samochód, pisanie i mówienie korzystają tylko z poznanego materiału',allCarKnown&&allWritingKnown&&allSpeakingKnown);
const smartTasks=T.practiceQueue('test');
test('nowy materiał w mieszanej nauce zaczyna się od rozpoznawania',smartTasks.filter(task=>task.kind==='new').every(task=>task.mode==='word_choice'));
test('Service Worker buforuje model, katalog i silnik kursu',['js/course-core-v6.6.0.js','data/course-catalog-v6.6.0.js','js/course-engine-v6.6.0.js','js/course-ui-v6.6.0.js'].every(file=>serviceWorker.includes("'./"+file+"'")));




// Pakiet 4: pełny pilotaż A1, rozszerzona baza i integracja samochodu.
const courseCounts=context.COURSE_A1_MODULE1_COUNTS||{};
const courseMaterials=T.WORDS.filter(word=>Array.isArray(word.lessonIds)&&word.lessonIds.some(id=>/^a1-m01-l0[1-8]$/.test(id)));
test('baza zawiera pełny A1 bez utraty wcześniejszych 606 materiałów',T.WORDS.length===606+(context.COURSE_A1_EXPANSION_COUNTS?.materials||0)+(context.COURSE_A2_COUNTS?.materials||0)&&new Set(T.WORDS.map(word=>word.id)).size===T.WORDS.length);
test('pakiet dodaje 90 słów i zwrotów, 50 zdań oraz 10 dialogów',courseCounts.terms===90&&courseCounts.sentences===50&&courseCounts.dialogues===10&&courseCounts.total===150&&courseMaterials.length===150);
test('każda lekcja pilotażowa ma gramatykę, etapy i materiały samochodowe',a1Blueprints.every(lesson=>lesson.grammarNote?.title&&lesson.stages.includes('finalTask')&&lesson.carMaterialIds.length>0&&Object.keys(lesson.stageMaterialIds||{}).length>=4));
test('każda scena kursowa ma co najmniej dwa warianty odpowiedzi i kontekst',courseMaterials.filter(word=>word.courseType==='dialogue').every(word=>T.DIALOGUE_SCENES[word.id]?.accepted?.length>=2&&/^Client:/i.test(T.DIALOGUE_SCENES[word.id]?.prompt||'')&&/^Client:/i.test(word.examples?.[0]?.en||'')));
const firstCourseQueue=T.buildCourseLessonQueue('a1-m01-l01');
test('pierwsza lekcja zawiera grupowe wprowadzenie, gramatykę i zadanie końcowe',firstCourseQueue.some(task=>task.mode==='course_intro_group')&&firstCourseQueue.some(task=>task.mode==='course_grammar')&&firstCourseQueue.some(task=>task.mode==='dialogue')&&firstCourseQueue.at(-1)?.mode==='course_final');
test('wprowadzenie poprzedza aktywne użycie nowego materiału',(()=>{const id=T.courseLesson('a1-m01-l01').stageMaterialIds.writing[0],intro=firstCourseQueue.findIndex(task=>task.mode==='course_intro_group'&&(task.materialIds||[]).includes(id)),active=firstCourseQueue.findIndex(task=>task.wordId===id&&task.stage==='writing');return intro>=0&&active>intro;})());
test('zadania wyboru używają podpowiedzi tylko z bieżącej lekcji',firstCourseQueue.filter(task=>task.mode==='word_choice').every(task=>(task.choicePoolIds||[]).every(id=>T.courseLesson('a1-m01-l01').materialIds.includes(id))));
const finalMinimums={"a1-m01-l01":3,"a1-m01-l02":7,"a1-m01-l03":8,"a1-m01-l04":4,"a1-m01-l05":3,"a1-m01-l06":7,"a1-m01-l07":12,"a1-m01-l08":8,"a1-m01-l09":12,"a1-m01-l10":16};
test('zadania końcowe mają progi dopasowane do polecenia',a1Blueprints.every(lesson=>lesson.finalTask.minimumWords===finalMinimums[lesson.id]));
test('poprawne przykładowe zadania końcowe przechodzą ocenę',a1Blueprints.every(lesson=>T.scoreTaskAnswer(lesson.finalTask.exampleAnswer,null,'course_final',T.buildCourseLessonQueue(lesson.id).at(-1)).status==='correct'));
test('przykład zadania końcowego nie omija wymaganych elementów treści',a1Blueprints.every(lesson=>{const task=T.buildCourseLessonQueue(lesson.id).at(-1);return task.expectedAnswer===''&&task.exampleAnswer===lesson.finalTask.exampleAnswer;}));
test('przypadkowa wypowiedź nie zalicza zadania końcowego A1',T.scoreTaskAnswer('kot pies stół samochód',null,'course_final',T.buildCourseLessonQueue('a1-m01-l01').at(-1)).status!=='correct');
const firstLesson=T.courseLesson('a1-m01-l01');
for(const id of firstLesson.carMaterialIds){const progress=T.getState().items[id]||{};T.getState().items[id]={...progress,seen:1,correct:1,wrong:0,status:'review',nextReview:'2099-01-01'};if(!T.getState().course.introducedMaterialIds.includes(id))T.getState().course.introducedMaterialIds.push(id);}
const firstCarQueue=T.buildLessonCarQueue('a1-m01-l01');
test('lekcja przygotowuje głosową sesję samochodową z poznanego materiału',firstCarQueue.length>0&&firstCarQueue.length<=T.getState().settings.carTaskCount&&firstCarQueue.every(task=>firstLesson.carMaterialIds.includes(task.wordId)&&T.getState().items[task.wordId]?.seen>0));
test('ustawienia pozwalają wybrać od 5 do 30 zadań samochodowych',html.includes('id="carTaskCount"')&&T.getState().settings.carTaskCount>=5&&T.getState().settings.carTaskCount<=30);
test('Service Worker buforuje pełną zawartość A1',serviceWorker.includes("'./data/course-a1-module1-v6.6.0.js'")&&serviceWorker.includes("'./data/course-a1-full-expansion-v6.6.0.js'"));

// Pakiet 3: ekran kursu, uproszczony ekran główny i statystyki rzeczywistego postępu.
const todayMarkup=html.slice(html.indexOf('<section id="todayScreen"'),html.indexOf('<section id="courseScreen"'));
test('ekran główny pokazuje kartę kontynuowania kursu',html.includes('id="courseContinueBtn"')&&html.includes('id="courseHomeProgressText"'));
test('tryby ćwiczeń zostały usunięte z ekranu głównego',!todayMarkup.includes('data-practice='));
test('osobny ekran planu kursu zawiera moduły i wybór poziomu',html.includes('id="courseScreen"')&&html.includes('id="courseModuleList"')&&html.includes('id="courseLevelSelect"'));
test('dolna nawigacja nazywa ćwiczenia treningiem',html.includes('<span>Trening</span>'));
test('postęp kursu jest oddzielony od karty XP',html.includes('id="courseProgressPercent"')&&html.includes('id="statXp"')&&html.indexOf('id="courseProgressPercent"')<html.indexOf('id="statXp"'));
const plannedSnapshot=T.courseDashboard('A1');
test('pełny A1 jest widoczny jako opublikowany kurs',plannedSnapshot.plannedLessonCount===55&&plannedSnapshot.publishedLessonCount===55&&plannedSnapshot.progressPercent===0&&plannedSnapshot.currentLesson?.id==='a1-m01-l01');
const fixtureUiSnapshot=T.CourseUiCore.buildSnapshot(fixtureCatalog,afterCourse,T.WORDS,T.getState().items,[{source:'car',practice:'car',correct:8,wrong:2}], 'A1');
test('statystyki kursu liczą ukończone lekcje i moduły',fixtureUiSnapshot.publishedLessonCount===2&&fixtureUiSnapshot.completedLessonCount===1&&fixtureUiSnapshot.completedModuleCount===1&&fixtureUiSnapshot.progressPercent===50);
test('statystyki kursu wskazują następną dostępną lekcję',fixtureUiSnapshot.currentLesson?.id==='fixture-l02');
test('statystyki trybu samochodowego liczą sesje i skuteczność',fixtureUiSnapshot.carSessionCount===1&&fixtureUiSnapshot.carAccuracy===80);
test('Service Worker buforuje moduł interfejsu kursu',serviceWorker.includes("'./js/course-ui-v6.6.0.js'"));

// Korekta Pakietu 4: zadania końcowe wymagają faktycznego podania własnego imienia.
const finalL02=T.buildCourseLessonQueue('a1-m01-l02').at(-1);
const finalL08=T.buildCourseLessonQueue('a1-m01-l08').at(-1);
const finalL09=T.buildCourseLessonQueue('a1-m01-l09').at(-1);
const finalL10=T.buildCourseLessonQueue('a1-m01-l10').at(-1);
test('lekcja 2 nie uznaje samopoczucia za podanie imienia',T.scoreTaskAnswer('I am very happy today. What is your name?',null,'course_final',finalL02).status!=='correct');
test('lekcja 8 wymaga przedstawienia się, nie samego I am',T.scoreTaskAnswer('Hello. I am very happy today. Nice to meet you.',null,'course_final',finalL08).status!=='correct');
test('lekcja 9 nie zalicza kompletu danych bez imienia',T.scoreTaskAnswer('I am thirty years old. I am from Poland. I live in Warsaw. I am very happy today.',null,'course_final',finalL09).status!=='correct');
test('lekcja 10 nie zalicza kompletu danych bez imienia',T.scoreTaskAnswer('I am thirty years old. I am from Poland. I live in Warsaw. I have one brother and I am very happy today.',null,'course_final',finalL10).status!=='correct');
test('naturalne przedstawienie I am Tom nadal jest akceptowane',T.scoreTaskAnswer('I am Tom. What is your name?',null,'course_final',finalL02).status==='correct');
test('cztery wskazane lekcje mają aktywną kontrolę podania imienia',[finalL02,finalL08,finalL09,finalL10].every(task=>task.requiredChecks?.includes('self_name')));
test('I am computer nie jest uznawane za podanie imienia',T.scoreTaskAnswer('I am computer. What is your name?',null,'course_final',finalL02).status!=='correct');
test('My name is router nie jest uznawane za podanie imienia',T.scoreTaskAnswer('My name is router. What is your name?',null,'course_final',finalL02).status!=='correct');
test('kraj i miasto z materiału nie są uznawane za imię',!T.hasSelfName('My name is Poland')&&!T.hasSelfName('I am Warsaw'));
test('rola zawodowa nie jest uznawana za imię',!T.hasSelfName('I am technician')&&!T.hasSelfName('My name is teacher'));
test('polskie imię Tomasz jest akceptowane',T.hasSelfName('I am Tomasz')&&T.hasSelfName('My name is Tomasz'));
test('imię jest rozpoznawane także w dłuższym zdaniu',T.hasSelfName('I am Tom and I live in Warsaw')&&T.hasSelfName('My name is Anna and I am from Poland'));
test('rzadkie imię w jednoznacznej konstrukcji jest akceptowane',T.hasSelfName('My name is Borysław'));
test('imię pokrywające się ze słowem jest akceptowane z listy imion',T.hasSelfName('My name is Rose')&&T.hasSelfName('I am Mark'));


// Pakiet 5: rozszerzone testy techniczne i poprawki ergonomii pilotażu.
const css591=fs.readFileSync(path.join(root,'css/styles-v6.6.0.css'),'utf8');
const nav660=fs.readFileSync(path.join(root,'js/navigation-v6.6.0.js'),'utf8');
const appState591=fs.readFileSync(path.join(root,'js/app-state-v6.6.0.js'),'utf8');
test('wersja danych Pakietu 5 używa nowego klucza zapisu',appState591.includes("STORAGE_KEY='angielski_daily_trainer_state_v660'")&&appState591.includes("'angielski_daily_trainer_state_v600'"));
test('migracja 5.9.0 zachowuje postęp kursu i ustawienia',(()=>{const migrated=T.migrate({version:'5.9.0',settings:{...T.getState().settings,carTaskCount:23,onboardingComplete:true},user:{xp:321,streakDays:4},course:T.getState().course});return migrated.version==='6.6.0'&&migrated.settings.carTaskCount===23&&migrated.user.xp===321&&migrated.user.streakDays===4&&!!migrated.course;})());
test('zmiana liczby zadań samochodowych jest podpięta do zapisu',nav660.includes("'carTaskCount','carPause'")&&Array.isArray(elements.get('carTaskCount')?.listeners?.change)&&elements.get('carTaskCount').listeners.change.length>0);
const oldCarTaskCount=T.getState().settings.carTaskCount;elements.get('carTaskCount').value='25';for(const listener of elements.get('carTaskCount').listeners.change||[])listener({target:elements.get('carTaskCount')});
test('zmiana liczby zadań samochodowych faktycznie aktualizuje stan',T.getState().settings.carTaskCount===25);
T.getState().settings.carTaskCount=oldCarTaskCount;
test('okna dialogowe mieszczą się na małych ekranach dzięki przewijaniu',css591.includes('max-height:calc(100dvh - 20px)')&&css591.includes('overflow-y:auto')&&css591.includes('overscroll-behavior:contain'));
test('przyciski onboardingu pozostają dostępne przy bardzo dużym tekście',css591.includes('.onboarding-actions{position:sticky'));
test('Service Worker Pakietu 6 ma nowy, spójny cache',serviceWorker.includes("VERSION='6.6.0-p8-topic-fix1'")&&serviceWorker.includes("CACHE_NAME='english-trainer-v6.6.0-p8-topic-fix1'")&&serviceWorker.includes("APP_ENTRY='./index.html?app='+VERSION"));
test('manifest i wszystkie zasoby uruchomieniowe wskazują wersję 6.6.0',html.includes('manifest-v6.6.0.json')&&html.includes('styles-v6.6.0.css')&&runtimeFiles.every(file=>file.includes('v6.6.0')));


// Pakiet 8: pełna ścieżka A1.
const a1Level=T.COURSE_CATALOG.levels.find(level=>level.id==='A1');
const fullA1Lessons=T.CourseCore.flattenLessons(T.COURSE_CATALOG,{includeDraft:false}).filter(lesson=>lesson.level==='A1');
test('pełny A1 ma 12 opublikowanych modułów',a1Level.modules.length===12&&a1Level.modules.every(module=>module.status==='published'));
test('pełny A1 ma 55 opublikowanych lekcji',fullA1Lessons.length===55&&fullA1Lessons.every(lesson=>lesson.status==='published'));
test('moduły 2–11 mają po cztery lekcje',a1Level.modules.filter(module=>module.order>=2&&module.order<=11).every(module=>module.lessons.length===4));
test('moduł końcowy ma pięć części egzaminu',a1Level.modules.find(module=>module.id==='a1-m12')?.lessons.length===5);
test('baza pełnego A1 przekracza tysiąc unikalnych materiałów',T.WORDS.length>=1000&&new Set(T.WORDS.map(word=>word.id)).size===T.WORDS.length);
test('katalog pełnego A1 jest poprawny',T.courseCatalogStatus().valid&&T.courseCatalogStatus().errors.length===0);
test('każda nowa lekcja ma cel, materiały i zadanie końcowe',fullA1Lessons.filter(lesson=>lesson.moduleId!=='a1-m01').every(lesson=>lesson.goal.startsWith('Potrafię')&&T.CourseCore.lessonMaterialIds(lesson).length>=4&&!!lesson.finalTask));
test('każda tematyczna lekcja 2–11 ćwiczy wybór, pisanie, słuchanie, mówienie i dialog',fullA1Lessons.filter(lesson=>/^a1-m(?:0[2-9]|1[01])-/.test(lesson.id)).every(lesson=>['recognition','writing','listening','speaking','dialogue','finalTask'].every(stage=>lesson.stages.includes(stage))));
test('przykładowe zadania końcowe pełnego A1 przechodzą ocenę',fullA1Lessons.every(lesson=>{const task=T.buildCourseLessonQueue(lesson.id).at(-1);return task?.mode==='course_final'&&T.scoreTaskAnswer(lesson.finalTask.exampleAnswer,null,'course_final',task).status==='correct';}));
test('losowa odpowiedź nie zalicza nowych zadań końcowych',fullA1Lessons.filter(lesson=>lesson.moduleId!=='a1-m01').every(lesson=>T.scoreTaskAnswer('random router table dog',null,'course_final',T.buildCourseLessonQueue(lesson.id).at(-1)).status!=='correct'));
test('końcowy moduł obejmuje słownictwo, słuchanie, czytanie, dialog, pisanie i mówienie',(()=>{const m=a1Level.modules.find(module=>module.id==='a1-m12');const joined=m.lessons.map(l=>l.title+' '+l.goal+' '+l.stages.join(' ')).join(' ').toLowerCase();return joined.includes('słownict')&&joined.includes('słuch')&&joined.includes('czyt')&&joined.includes('dialog')&&joined.includes('pis')&&(joined.includes('mów')||joined.includes('speaking'));})());
test('migracja ukończonego modułu 1 odblokowuje pierwszy moduł 2',(()=>{const old=T.CourseCore.defaultCourseState({...T.COURSE_CATALOG,levels:T.COURSE_CATALOG.levels.map(level=>level.id==='A1'?{...level,modules:[level.modules[0]]}:level)});for(const lesson of a1Level.modules[0].lessons){old.lessons[lesson.id].status='completed';old.unlockedLessonIds.push(lesson.id);}const migrated=T.CourseCore.migrateCourseState(old,T.COURSE_CATALOG,T.WORDS.map(w=>w.id));return migrated.unlockedLessonIds.includes('a1-m02-l01')&&migrated.unlockedModuleIds.includes('a1-m02');})());
test('Service Worker buforuje rozszerzenie pełnego A1',serviceWorker.includes("'./data/course-a1-full-expansion-v6.6.0.js'")&&serviceWorker.includes("VERSION='6.6.0-p8-topic-fix1'"));
test('manifest opisuje pełny kurs A1',manifest.version==='6.6.0'&&manifest.description.includes('115 lekcjami'));


// Korekta Pakietu 6: liczba zdań, osób i czynności w zadaniach końcowych.
const structuredFinalTasks={
  'a1-m02-l02':{minimumSentences:2},
  'a1-m02-l03':{minimumPeople:2},
  'a1-m02-l04':{minimumSentences:3},
  'a1-m03-l02':{minimumSentences:2},
  'a1-m03-l04':{minimumSentences:3},
  'a1-m04-l04':{minimumSentences:4},
  'a1-m11-l02':{minimumActions:3},
  'a1-m12-l01':{minimumSentences:3},
  'a1-m12-l04':{minimumSentences:4}
};
const finalTaskFor=id=>T.buildCourseLessonQueue(id).at(-1);
test('dziewięć zadań końcowych ma dodatkowe kryteria struktury',Object.entries(structuredFinalTasks).every(([id,expected])=>{const task=finalTaskFor(id);return Object.entries(expected).every(([key,value])=>task?.[key]===value);}));
test('przykłady dziewięciu poprawionych zadań nadal przechodzą',Object.keys(structuredFinalTasks).every(id=>{const lesson=T.CourseCore.lessonById(T.COURSE_CATALOG,id);return T.scoreTaskAnswer(lesson.finalTask.exampleAnswer,null,'course_final',finalTaskFor(id)).status==='correct';}));
test('mówienie bez interpunkcji nadal pozwala rozpoznać kilka zdań',['a1-m02-l02','a1-m02-l04','a1-m03-l04','a1-m04-l04'].every(id=>{const lesson=T.CourseCore.lessonById(T.COURSE_CATALOG,id);const transcript=lesson.finalTask.exampleAnswer.replace(/[.!?]/g,'');return T.scoreTaskAnswer(transcript,null,'course_final',finalTaskFor(id)).status==='correct';}));
test('jedno zdanie nie zalicza lekcji 2.2',T.scoreTaskAnswer('My friend is friendly, funny and very helpful.',null,'course_final',finalTaskFor('a1-m02-l02')).status!=='correct');
test('jedna osoba nie zalicza lekcji 2.3',T.scoreTaskAnswer('This is my friend Anna. Her name is Anna and our friend is kind.',null,'course_final',finalTaskFor('a1-m02-l03')).status!=='correct');
test('jedno zdanie nie zalicza lekcji 2.4',T.scoreTaskAnswer('There are my parents, my brother and my sister in my family.',null,'course_final',finalTaskFor('a1-m02-l04')).status!=='correct');
test('jedno zdanie nie zalicza lekcji 3.2',T.scoreTaskAnswer('The chair is next to the table and my bag is under the bed.',null,'course_final',finalTaskFor('a1-m03-l02')).status!=='correct');
test('jedno zdanie nie zalicza lekcji 3.4',T.scoreTaskAnswer('There is a clean kitchen, bedroom and bathroom in my tidy flat.',null,'course_final',finalTaskFor('a1-m03-l04')).status!=='correct');
test('jedno zdanie nie zalicza lekcji 4.4',T.scoreTaskAnswer('Every day in the morning, afternoon and evening I work, and at night I go to bed.',null,'course_final',finalTaskFor('a1-m04-l04')).status!=='correct');
test('przypadkowe słowa help, work i have nie udają trzech czynności zawodowych',T.scoreTaskAnswer('I need help because the shower does not work and I have a fever.',null,'course_final',finalTaskFor('a1-m11-l02')).status!=='correct');
test('jedno zdanie nie zalicza powtórki słownictwa A1',T.scoreTaskAnswer('My flat is near work and every day in the morning I eat bread and drink coffee.',null,'course_final',finalTaskFor('a1-m12-l01')).status!=='correct');
test('jedno zdanie nie zalicza wypowiedzi o wyjeździe',T.scoreTaskAnswer('I go to Krakow by train and stay in a hotel where I would like dinner and local food.',null,'course_final',finalTaskFor('a1-m12-l04')).status!=='correct');
test('Service Worker korekty Pakietu 6 ma świeży spójny cache',serviceWorker.includes("VERSION='6.6.0-p8-topic-fix1'")&&serviceWorker.includes("CACHE_NAME='english-trainer-v6.6.0-p8-topic-fix1'")&&serviceWorker.includes("APP_ENTRY='./index.html?app='+VERSION"));
test('import zachowuje nowe kryteria w niedokończonej lekcji',(()=>{const payload=JSON.parse(JSON.stringify(T.getState()));payload.activeSession={queue:[finalTaskFor('a1-m11-l02')],index:0,correct:0,wrong:0,xp:0,practice:'course',source:'course',startedAt:'2026-07-30T12:00:00Z',lessonId:'a1-m11-l02',moduleId:'a1-m11',lessonTitle:'Podstawowe zadania w pracy',lessonGoal:'Potrafię opisać podstawowe obowiązki.',taskResults:[],stageProgress:{},finalTaskCompleted:false};try{const imported=T.validateImportedState(JSON.stringify(payload));return imported.activeSession.queue[0].minimumActions===3&&imported.activeSession.queue[0].actionGroups.length>=3;}catch(_){return false;}})());
test('jedna osoba opisana jako matka i nauczyciel nie udaje dwóch osób',T.scoreTaskAnswer('This is my mother Anna. She is a teacher.',null,'course_final',finalTaskFor('a1-m02-l03')).status!=='correct');
test('dwie różne osoby nadal zaliczają zadanie przedstawiania',T.scoreTaskAnswer('This is my friend Anna. Her brother is our neighbour.',null,'course_final',finalTaskFor('a1-m02-l03')).status==='correct');
test('czynność check my email jest liczona poprawnie',T.scoreTaskAnswer('I start work at eight. I check my email. I help customers.',null,'course_final',finalTaskFor('a1-m11-l02')).status==='correct');
test('katalog i Service Worker mają oznaczenie wersji finalnej Pakietu 8',T.COURSE_CATALOG.catalogVersion==='2026.07-a1-a2-stable-p8'&&serviceWorker.includes("VERSION='6.6.0-p8-topic-fix1'"));


// Pakiet 7: pełny poziom A2.
const a2Level=T.COURSE_CATALOG.levels.find(level=>level.id==='A2');
const fullA2Lessons=T.CourseCore.flattenLessons(T.COURSE_CATALOG,{includeDraft:false}).filter(lesson=>lesson.level==='A2');
test('pełny A2 ma 12 opublikowanych modułów',a2Level?.modules.length===12&&a2Level.modules.every(module=>module.status==='published'));
test('pełny A2 ma 60 opublikowanych lekcji',fullA2Lessons.length===60&&fullA2Lessons.every(lesson=>lesson.status==='published'));
test('każdy moduł A2 ma pięć lekcji',a2Level?.modules.every(module=>module.lessons.length===5));
test('A2 ma ponad sześćset własnych materiałów',T.WORDS.filter(word=>word.level==='A2'&&String(word.id).startsWith('course_a2_')).length>=600);
test('katalog A1-A2 jest poprawny',T.courseCatalogStatus().valid&&T.courseCatalogStatus().errors.length===0);
test('każda tematyczna lekcja A2 ma pełny zestaw etapów',fullA2Lessons.filter(lesson=>lesson.moduleId!=='a2-m12').every(lesson=>['review','introduction','recognition','writing','listening','speaking','dialogue','finalTask'].every(stage=>lesson.stages.includes(stage))));
test('przykładowe zadania końcowe A2 przechodzą ocenę',fullA2Lessons.every(lesson=>{const task=T.buildCourseLessonQueue(lesson.id).at(-1);return task?.mode==='course_final'&&T.scoreTaskAnswer(lesson.finalTask.exampleAnswer,null,'course_final',task).status==='correct';}));
test('przypadkowa odpowiedź nie zalicza zadań końcowych A2',fullA2Lessons.every(lesson=>T.scoreTaskAnswer('random router table dog',null,'course_final',T.buildCourseLessonQueue(lesson.id).at(-1)).status!=='correct'));
test('pierwsza lekcja A2 jest dostępna niezależnie od ukończenia A1',T.CourseCore.defaultCourseState(T.COURSE_CATALOG).unlockedLessonIds.includes('a2-m01-l01'));
test('ukończenie ostatniej lekcji A1 nadal odblokowuje A2',(()=>{const state=T.CourseCore.defaultCourseState(T.COURSE_CATALOG);const last='a1-m12-l05';state.lessons[last].status='completed';state.unlockedLessonIds.push(last);const migrated=T.CourseCore.migrateCourseState(state,T.COURSE_CATALOG,T.WORDS.map(w=>w.id));return migrated.unlockedLessonIds.includes('a2-m01-l01');})());
test('tryb samochodowy A2 używa wyłącznie pełnych zdań',fullA2Lessons.every(lesson=>(lesson.carMaterialIds||[]).every(id=>{const w=T.WORDS.find(item=>item.id===id);return w&&w.level==='A2'&&w.carModeEligible!==false&&String(w.english).trim().split(/\s+/).length>=2;})));
test('Service Worker buforuje pełny A2',serviceWorker.includes("'./data/course-a2-full-v6.6.0.js'")&&serviceWorker.includes("VERSION='6.6.0-p8-topic-fix1'"));
test('manifest opisuje kompletne A1 i A2',manifest.version==='6.6.0'&&manifest.description.includes('A1 i A2')&&manifest.description.includes('115 lekcjami'));
test('migracja 6.0.0 zachowuje postęp A1 i dodaje A2',(()=>{const old={...T.getState(),version:'6.0.0'};const migrated=T.migrate(old);return migrated.version==='6.6.0'&&migrated.course.lessons['a1-m01-l01']&&migrated.course.lessons['a2-m01-l01'];})());


// Korekta Pakietu 7: prawdziwe dialogi, przykłady i semantyczne zadania końcowe.
const ownA2=T.WORDS.filter(word=>word.level==='A2'&&String(word.id).startsWith('course_a2_'));
const thematicA2=fullA2Lessons.filter(lesson=>lesson.moduleId!=='a2-m12');
test('każda tematyczna lekcja A2 ma prawdziwą scenę dialogową',thematicA2.every(lesson=>{const id=lesson.stageMaterialIds.dialogue?.[0],scene=T.DIALOGUE_SCENES[id];return !!id&&!!scene&&scene.total===5&&scene.turn===lesson.order&&Array.isArray(scene.accepted)&&scene.accepted.length>0&&!scene.prompt.includes('Respond naturally');}));
test('A2 zawiera 55 nowych scen dialogowych',Object.keys(T.DIALOGUE_SCENES).filter(id=>id.startsWith('course_a2_')).length===55);
test('każdy własny materiał A2 ma przykład użycia',ownA2.every(word=>Array.isArray(word.examples)&&word.examples.length>0&&String(word.examples[0].en||'').trim().length>=3));
test('sałatka słów kluczowych nie zalicza tematycznych zadań A2',thematicA2.every(lesson=>{const task=T.buildCourseLessonQueue(lesson.id).at(-1);const salad=(task.requiredKeywords||[]).map(group=>group[0]).join(' ')+'. Cat dog table router. Coffee weather phone internet.';return T.scoreTaskAnswer(salad,null,'course_final',task).status!=='correct';}));
test('konkretny bezsens z pierwszej lekcji A2 jest odrzucany',T.scoreTaskAnswer('Last weekend visited watched cooked. Cat dog table router. Coffee weather phone internet.',null,'course_final',T.buildCourseLessonQueue('a2-m01-l01').at(-1)).status!=='correct');
test('katalog A1-A2 i Service Worker są z wersji finalnej',T.COURSE_CATALOG.catalogVersion==='2026.07-a1-a2-stable-p8'&&serviceWorker.includes("VERSION='6.6.0-p8-topic-fix1'")&&serviceWorker.includes("CACHE_NAME='english-trainer-v6.6.0-p8-topic-fix1'"));


// Korekta 2 Pakietu 7: słowa kluczowe muszą tworzyć treść w kilku zdaniach.
test('zadania A2 wymagają rozłożenia treści na co najmniej dwa zdania',thematicA2.every(lesson=>{const task=T.buildCourseLessonQueue(lesson.id).at(-1);return Number(task.minimumSentences)<2||Number(task.minimumKeywordSentences)===2;}));
test('skupiona sałatka słów nie zalicza żadnej tematycznej lekcji A2',thematicA2.every(lesson=>{const task=T.buildCourseLessonQueue(lesson.id).at(-1),salad=(task.requiredKeywords||[]).map(group=>group[0]).join(' ')+'. I am happy. It is good. We like it. This is useful. Because and but then.';return T.scoreTaskAnswer(salad,null,'course_final',task).status!=='correct';}));
test('sałatka z pierwszej lekcji A2 nadal jest odrzucana po korekcie 2',T.scoreTaskAnswer('Last weekend visited watched cooked stayed because and but then. I am happy. It is good.',null,'course_final',T.buildCourseLessonQueue('a2-m01-l01').at(-1)).status!=='correct');
test('import przerwanej lekcji zachowuje wymóg rozłożenia treści',(()=>{const payload=JSON.parse(JSON.stringify(T.getState())),task=T.buildCourseLessonQueue('a2-m01-l01').at(-1);payload.activeSession={queue:[task],index:0,correct:0,wrong:0,xp:0,practice:'course',source:'course',startedAt:'2026-07-30T20:00:00Z',lessonId:'a2-m01-l01',moduleId:'a2-m01',lessonTitle:'Co robiłeś w weekend?',lessonGoal:'Potrafię opowiedzieć o minionym weekendzie.',taskResults:[],stageProgress:{},finalTaskCompleted:false};try{return T.validateImportedState(JSON.stringify(payload)).activeSession.queue[0].minimumKeywordSentences===2;}catch(_){return false;}})());
test('wersja finalna zachowuje poprawki 2 Pakietu 7',T.COURSE_CATALOG.catalogVersion==='2026.07-a1-a2-stable-p8'&&serviceWorker.includes("VERSION='6.6.0-p8-topic-fix1'")&&serviceWorker.includes("CACHE_NAME='english-trainer-v6.6.0-p8-topic-fix1'"));



// Korekta 3 Pakietu 7: relacje znaczeniowe w 12 podatnych zadaniach A2.
const semanticA2Cases=[
  ['a2-m01-l01','I like last weekend and visited and watched because it is useful. We use cooked and stayed because it is good.','Last weekend I stayed at home and cooked dinner. On Sunday I watched a film with my family.'],
  ['a2-m01-l02','I like went and met and had because it is useful. We use saw and bought and took because it is good.','Yesterday I went to the city. I met my friend and we had lunch near the station.'],
  ['a2-m01-l04','I like broke down and missed and cancelled because it is useful. We use lost and called for help and arrived late because it is good.','Our bus broke down near the airport. We called for help and arrived late at the hotel.'],
  ['a2-m02-l03','I like have been to and has gone to because it is useful. We use not come back yet because it is good.','I have been to Prague twice. My brother has gone to the supermarket and he has not come back yet.'],
  ['a2-m05-l04','I like does not work and is leaking and could you because it is useful. We use repair and as soon as possible because it is good.','The heating does not work and the bathroom tap is leaking. Could you send someone to repair them as soon as possible?'],
  ['a2-m06-l01','I like return ticket and to because it is useful. We use direct train and change trains because it is good.','Could I have a return ticket to London, please? Is there a direct train or do I need to change trains?'],
  ['a2-m06-l03','I like could you tell me and go past because it is useful. We use take the second turning and traffic lights because it is good.','Could you tell me how to get to the museum? So I go past the bank and take the second turning at the traffic lights.'],
  ['a2-m06-l04','I like delayed and miss my connection because it is useful. We use alternative route and refund because it is good.','My train is delayed, so I will miss my connection. Is there an alternative route or can I get a refund?'],
  ['a2-m07-l01','I like have had and for and since because it is useful. We use getting worse and felt dizzy because it is good.','I have had a cough for three days. I have felt dizzy since yesterday and I also have a headache.'],
  ['a2-m09-l02','I like cotton and too tight and larger size because it is useful. We use different material and try because it is good.','This blue cotton shirt is too tight. Could I try a larger size or a different material, please?'],
  ['a2-m09-l03','I like placed an order and not arrived yet because it is useful. We use tracking number and estimated delivery date because it is good.','I have placed an order, but the parcel has not arrived yet. Could you send me the tracking number and confirm the estimated delivery date?'],
  ['a2-m11-l02','I like was and when and were and while because it is useful. We use rang and heard and started because it is good.','I was cooking when the phone rang. We were driving home when we heard a loud noise.']
];
test('korekta semantyczna obejmuje dokładnie 12 podatnych lekcji A2',semanticA2Cases.length===12&&new Set(semanticA2Cases.map(([id])=>id)).size===12);
for(const [id,bad] of semanticA2Cases)test(`semantyczna sałatka jest odrzucana w ${id}`,T.scoreTaskAnswer(bad,null,'course_final',T.buildCourseLessonQueue(id).at(-1)).status!=='correct');
test('naturalne alternatywne odpowiedzi nadal zaliczają 12 poprawionych lekcji',semanticA2Cases.every(([id,,good])=>T.scoreTaskAnswer(good,null,'course_final',T.buildCourseLessonQueue(id).at(-1)).status==='correct'));
test('wzmocniona sałatka nie zalicza żadnej z 55 lekcji tematycznych A2',thematicA2.every(lesson=>{const task=T.buildCourseLessonQueue(lesson.id).at(-1),words=(task.requiredKeywords||[]).map(group=>group[0]),half=Math.ceil(words.length/2),bad=`I like ${words.slice(0,half).join(' and ')} because it is useful. We use ${words.slice(half).join(' and ')||words[0]} because it is good.`;return T.scoreTaskAnswer(bad,null,'course_final',task).status!=='correct';}));
test('import przerwanej lekcji zachowuje korektę semantyczną',(()=>{const payload=JSON.parse(JSON.stringify(T.getState())),task=T.buildCourseLessonQueue('a2-m01-l01').at(-1),bad=semanticA2Cases[0][1];payload.activeSession={queue:[task],index:0,correct:0,wrong:0,xp:0,practice:'course',source:'course',startedAt:'2026-07-31T06:00:00Z',lessonId:'a2-m01-l01',moduleId:'a2-m01',lessonTitle:'Co robiłeś w weekend?',lessonGoal:'Potrafię opowiedzieć o minionym weekendzie.',taskResults:[],stageProgress:{},finalTaskCompleted:false};try{const imported=T.validateImportedState(JSON.stringify(payload));return T.scoreTaskAnswer(bad,null,'course_final',imported.activeSession.queue[0]).status!=='correct';}catch(_){return false;}})());
test('wersja finalna zachowuje poprawki 3 Pakietu 7',T.COURSE_CATALOG.catalogVersion==='2026.07-a1-a2-stable-p8'&&serviceWorker.includes("VERSION='6.6.0-p8-topic-fix1'")&&serviceWorker.includes("CACHE_NAME='english-trainer-v6.6.0-p8-topic-fix1'"));



// Korekta 4 Pakietu 7: wspólny walidator znaczeniowy dla wszystkich 55 lekcji tematycznych A2.
const semanticProfiles=T.A2_SEMANTIC_VALIDATORS||{};
test('walidator znaczeniowy obejmuje wszystkie 55 lekcji tematycznych A2',Object.keys(semanticProfiles).length===55&&thematicA2.every(lesson=>semanticProfiles[lesson.id]));
const firstRequiredPhrase=group=>String((Array.isArray(group)?group:[group])[0]||'').trim();
const metaSentenceTemplates=[
  phrase=>`I can say ${phrase} because this exercise helps me practise English every day.`,
  phrase=>`We can write ${phrase} because the lesson helps us learn useful words.`,
  phrase=>`My friend can use ${phrase} when we study English together at home.`,
  phrase=>`The teacher can read ${phrase} and explain it clearly to the class.`,
  phrase=>`They can repeat ${phrase} because it is useful in this lesson.`
];
for(const lesson of thematicA2){
  const task=T.buildCourseLessonQueue(lesson.id).at(-1),example=lesson.finalTask.exampleAnswer,minimum=Math.max(2,Number(task.minimumSentences)||2),groups=task.requiredKeywords||[];
  const metaSentences=[];
  for(let index=0;index<Math.max(minimum,groups.length);index++)metaSentences.push(metaSentenceTemplates[index%metaSentenceTemplates.length](firstRequiredPhrase(groups[index%groups.length])));
  const metaAttack=metaSentences.join(' ');
  const offTopic=Array(minimum).fill(0).map((_,index)=>`The weather is pleasant today and my neighbour reads a newspaper in the garden ${index+1}.`).join(' ');
  const firstSentence=String(example).split(/[.!?]+/).map(value=>value.trim()).find(Boolean)+'.';
  const repeated=Array(minimum).fill(firstSentence).join(' ');
  const naturalExtension=example+' That is all.';
  test(`${lesson.id}: odpowiedź wzorcowa jest zaliczana`,T.scoreTaskAnswer(example,null,'course_final',task).status==='correct');
  test(`${lesson.id}: naturalnie rozszerzona odpowiedź jest zaliczana`,T.scoreTaskAnswer(naturalExtension,null,'course_final',task).status==='correct');
  test(`${lesson.id}: metajęzykowa sałatka słów jest odrzucana`,T.scoreTaskAnswer(metaAttack,null,'course_final',task).status!=='correct');
  test(`${lesson.id}: poprawny gramatycznie tekst nie na temat jest odrzucany`,T.scoreTaskAnswer(offTopic,null,'course_final',task).status!=='correct');
  test(`${lesson.id}: odpowiedź zbyt krótka jest odrzucana`,T.scoreTaskAnswer(firstSentence,null,'course_final',task).status!=='correct');
  test(`${lesson.id}: powtarzanie jednego zdania jest odrzucane`,T.scoreTaskAnswer(repeated,null,'course_final',task).status!=='correct');
}
test('import przerwanej lekcji zachowuje pełny walidator 55 lekcji A2',(()=>{const payload=JSON.parse(JSON.stringify(T.getState())),task=T.buildCourseLessonQueue('a2-m10-l01').at(-1),bad='I can say first because this exercise helps me practise English. We can write next because the lesson is useful. The teacher can read then in class. They can repeat finally every day.';payload.activeSession={queue:[task],index:0,correct:0,wrong:0,xp:0,practice:'course',source:'course',startedAt:'2026-07-31T09:30:00Z',lessonId:'a2-m10-l01',moduleId:'a2-m10',lessonTitle:'Prosty przepis',lessonGoal:'Potrafię podać prosty przepis.',taskResults:[],stageProgress:{},finalTaskCompleted:false};try{const imported=T.validateImportedState(JSON.stringify(payload));return T.scoreTaskAnswer(bad,null,'course_final',imported.activeSession.queue[0]).status!=='correct';}catch(_){return false;}})());
test('wersja finalna zachowuje walidator 55 lekcji A2',T.COURSE_CATALOG.catalogVersion==='2026.07-a1-a2-stable-p8'&&serviceWorker.includes("VERSION='6.6.0-p8-topic-fix1'")&&serviceWorker.includes("CACHE_NAME='english-trainer-v6.6.0-p8-topic-fix1'"));



// Pakiet 8: końcowy audyt, wersjonowanie treści, dostępność i prywatność.
const package8Examples=T.WORDS.flatMap(word=>(word.examples||[]).map(example=>({word,example})));
const package8ExampleKeys=package8Examples.map(({example})=>T.normalize(example.en+'|'+example.pl));
test('Pakiet 8 ma wersję programu 6.6.0 i stabilny katalog',T.COURSE_CATALOG.schemaVersion===3&&T.COURSE_CATALOG.catalogVersion==='2026.07-a1-a2-stable-p8');
test('katalog ma wersję treści A1-A2',T.CONTENT_VERSION==='a1-a2-2026.07-r1'&&T.COURSE_CATALOG.contentVersion===T.CONTENT_VERSION);
test('audyt treści obejmuje wszystkie 1713 materiałów',T.CONTENT_QUALITY.materialCount===1713&&T.WORDS.length===1713&&T.CONTENT_QUALITY.examplesComplete===true);
test('każdy materiał ma dwujęzyczny przykład',package8Examples.length>=T.WORDS.length&&T.WORDS.every(word=>word.examples?.some(example=>example.en?.trim()&&example.pl?.trim())));
test('przykłady po audycie są unikalne',new Set(package8ExampleKeys).size===package8ExampleKeys.length);
test('pisownia brytyjska i amerykańska jest równoważna',T.answerScore('My favourite colour is grey.','My favorite color is gray.').status==='correct'&&T.answerScore('We travelled to the city centre.','We traveled to the city center.').status==='correct');
const flatMaterial=T.WORDS.find(word=>T.normalize(word.english)==='flat');
test('popularne warianty leksykalne są akceptowane',!!flatMaterial&&T.bestAnswerScore('apartment',T.acceptedAnswers(flatMaterial,'word_write')).status==='correct');
test('migracja 6.5.0 ustawia bieżącą wersję programu i treści',(()=>{const migrated=T.migrate({version:'6.5.0',contentVersion:'a1-a2-old'});return migrated.version==='6.6.0'&&migrated.contentVersion===T.CONTENT_VERSION;})());
test('klucz 6.5.0 pozostaje źródłem migracji',script.includes("const STORAGE_KEY='angielski_daily_trainer_state_v660'")&&script.includes("'angielski_daily_trainer_state_v650'"));
test('eksport zapisuje wersję programu i treści',(()=>{const data=JSON.parse(T.exportPayload());return data.version==='6.6.0'&&data.contentVersion===T.CONTENT_VERSION&&T.backupFileName().includes('6.6.0');})());
test('interfejs obsługuje pobranie i wybór pliku JSON',html.includes('id="chooseImportFileBtn"')&&html.includes('id="importFileInput"')&&html.includes('accept="application/json,.json"')&&html.includes('id="prepareExportBtn"'));
test('polityka prywatności opisuje lokalny zapis i brak analityki',html.includes('Polityka prywatności')&&html.includes('nie zawiera reklam ani analityki')&&html.includes('zapisywane lokalnie'));
test('informacja o mikrofonie wyjaśnia rolę usług systemowych',html.includes('Mikrofon i rozpoznawanie mowy')&&html.includes('nie zapisuje plików dźwiękowych')&&html.includes('usługi rozpoznawania mowy'));
test('ostrzeżenie samochodowe opisuje blokadę ekranu i zakaz obsługi',html.includes('Podczas prowadzenia nie patrz na ekran i nie obsługuj telefonu')&&html.includes('po zablokowaniu ekranu'));
test('dostępność ma pominięcie nawigacji i widoczny fokus',html.includes('class="skip-link"')&&html.includes('href="#mainContent"')&&css.includes(':focus-visible'));
test('paski postępu i statusy mają atrybuty ARIA',html.includes('role="progressbar"')&&html.includes('aria-valuemin="0"')&&script.includes("aria-valuenow"));
test('ograniczenie animacji respektuje ustawienie systemowe',css.includes('@media(prefers-reduced-motion:reduce)')&&css.includes('data-animations="off"'));
const shellMatch=serviceWorker.match(/const APP_SHELL=\[([\s\S]*?)\];/),shellEntries=shellMatch?[...shellMatch[1].matchAll(/(?:APP_ENTRY|'([^']+)')/g)].length:0;
test('Service Worker ma ścisły kompletny cache 30 zasobów',shellEntries===30&&serviceWorker.includes('await Promise.all(APP_SHELL.map')&&serviceWorker.includes('await caches.delete(CACHE_NAME);throw error'));
test('manifest ma język, identyfikator i kategorię edukacyjną',manifest.id==='./'&&manifest.lang==='pl'&&manifest.categories?.includes('education')&&manifest.content_version===T.CONTENT_VERSION);



// Korekta Pakietu 8: rzeczywista tematyka treningu i brak przecieku materiałów technicznych.
test('trening ma własne selektory poziomu i tematyki',html.includes('id="trainingLevel"')&&html.includes('id="trainingTopic"')&&html.includes('Tematyka treningu dodatkowego'));
test('interfejs nie nazywa tematyki treningu ścieżką',!html.includes('<span>Ścieżka</span><select id="defaultTrack"')&&!html.includes('aria-label="Ścieżka materiałów"'));
const topicOptions=T.trainingTopicOptions();
test('domyślna tematyka wskazuje materiał bieżącego kursu',topicOptions[0]?.[0]==='course'&&/zalecane/i.test(topicOptions[0]?.[1]||''));
test('opcja wszystkich materiałów ostrzega o technice',topicOptions.some(([value,label])=>value==='all'&&/techniczne/i.test(label)));
test('migracja starego ustawienia Wszystkie przechodzi na kurs',(()=>{const migrated=T.migrate({version:'6.6.0',settings:{defaultLevel:'A1',defaultTrack:'all'}});return migrated.settings.defaultTrack==='course'&&migrated.settings.trainingTopicVersion===1;})());
test('migracja zachowuje świadomy wybór techniczny',T.migrate({version:'6.6.0',settings:{defaultLevel:'A1',defaultTrack:'Techniczne'}}).settings.defaultTrack==='Techniczne');

const topicStateTarget=T.getState(),topicStateBackup=JSON.parse(JSON.stringify(topicStateTarget));
const restoreTopicState=()=>{for(const key of Object.keys(topicStateTarget))delete topicStateTarget[key];Object.assign(topicStateTarget,JSON.parse(JSON.stringify(topicStateBackup)));};
const resetTopicState=(level,topic)=>{
  topicStateTarget.settings={...topicStateBackup.settings,defaultLevel:level,defaultTrack:topic,trainingTopicVersion:1,dailyGoal:20,dailyNew:20,dailyReview:50};
  topicStateTarget.items={};topicStateTarget.recentWordIds=[];topicStateTarget.activeSession=null;
  topicStateTarget.course=T.CourseCore.defaultCourseState(T.COURSE_CATALOG);
};
resetTopicState('A1','course');
const currentCourseIds=T.courseTopicMaterialIds('A1'),courseTopicQueue=T.practiceQueue('test');
test('tematyka kursowa tworzy niepustą kolejkę',courseTopicQueue.length>0);
test('tematyka kursowa nie wpuszcza starej bazy technicznej ani zawodowej',courseTopicQueue.every(item=>currentCourseIds.has(item.wordId)&&!['Techniczne','Praca'].includes(T.WORDS.find(word=>word.id===item.wordId)?.track)));
const lateA1=T.CourseCore.flattenLessons(T.COURSE_CATALOG).find(lesson=>lesson.id==='a1-m12-l05');
const lateA1Id=lateA1?[...T.courseTopicMaterialIds('A1')].find(()=>false):null;
test('tematyka kursowa nie pobiera materiału z zablokowanej końcowej lekcji',(()=>{const lateIds=lateA1?[...(lateA1.materialIds||[]),...Object.values(lateA1.stageMaterialIds||{}).flat()]:[];return lateIds.length>0&&lateIds.every(id=>!currentCourseIds.has(id));})());

resetTopicState('A1','Ogólny');
const generalWords=T.activeWords(),generalQueue=T.practiceQueue('test');
test('wybór Ogólny daje wyłącznie materiał ogólny',generalWords.length>0&&generalWords.every(word=>word.track==='Ogólny')&&generalQueue.every(item=>T.WORDS.find(word=>word.id===item.wordId)?.track==='Ogólny'));
resetTopicState('A1','Techniczne');
const technicalWords=T.activeWords(),technicalQueue=T.practiceQueue('test');
test('materiał techniczny pojawia się dopiero po wyborze Techniczne',technicalWords.length>0&&technicalWords.every(word=>word.track==='Techniczne')&&technicalQueue.every(item=>T.WORDS.find(word=>word.id===item.wordId)?.track==='Techniczne'));

resetTopicState('A1','Ogólny');
const dueGeneral=T.WORDS.find(word=>word.level==='A1'&&word.track==='Ogólny'),dueTechnical=T.WORDS.find(word=>word.level==='A1'&&word.track==='Techniczne');
const dueProgress={seen:3,correct:1,wrong:2,streak:0,mastery:15,nextReview:'2020-01-01',lastAnswer:'2020-01-01',lastSuccessDay:null,successDays:[],status:'weak',intervalIndex:0,lapses:1};
topicStateTarget.items[dueGeneral.id]={...dueProgress};topicStateTarget.items[dueTechnical.id]={...dueProgress};
test('powtórki respektują tematykę i odcinają stare techniczne błędy',T.due().some(word=>word.id===dueGeneral.id)&&!T.due().some(word=>word.id===dueTechnical.id));

resetTopicState('A1','Techniczne');
T.startSession([{wordId:dueTechnical.id,kind:'review',mode:'word_write'}],'writing',{source:'practice'});
const changedPractice=T.applyTrainingFilters('A1','Ogólny');
test('zmiana tematyki usuwa zapisaną i bieżącą sesję treningową',changedPractice.changed&&changedPractice.cleared&&T.getState().activeSession===null&&T.getSession()===null);

resetTopicState('A1','course');
const firstCourseWord=T.WORDS.find(word=>T.courseTopicMaterialIds('A1').has(word.id));
T.startSession([{wordId:firstCourseWord.id,kind:'new',mode:'word_choice'}],'course',{source:'course',lessonId:'a1-m01-l01'});
const courseFilterChange=T.applyTrainingFilters('A1','Techniczne');
test('zmiana tematyki nie usuwa głównej lekcji kursu',courseFilterChange.changed&&!courseFilterChange.cleared&&T.getState().activeSession?.source==='course'&&T.getSession()?.source==='course');

resetTopicState('A1','course');
topicStateTarget.activeSession={queue:[{wordId:dueTechnical.id,kind:'review',mode:'word_write'}],index:0,correct:0,wrong:0,xp:0,practice:'writing',source:'practice',startedAt:'2026-07-31T10:00:00Z'};
test('stara techniczna sesja jest wykrywana jako niezgodna z tematyką kursową',T.practiceSessionMatchesFilters(topicStateTarget.activeSession)===false);
test('uruchomienie może automatycznie usunąć niezgodną starą sesję',T.discardIncompatiblePracticeSession({persist:false})===true&&topicStateTarget.activeSession===null);

resetTopicState('A1','all');
test('technika pozostaje dostępna po świadomym wyborze wszystkich materiałów',T.activeWords().some(word=>word.track==='Techniczne'));
restoreTopicState();

test('Service Worker korekty tematyki ma świeży cache',serviceWorker.includes("VERSION='6.6.0-p8-topic-fix1'")&&serviceWorker.includes("CACHE_NAME='english-trainer-v6.6.0-p8-topic-fix1'"));

const failed=tests.filter(([,ok])=>!ok);
console.log(tests.map(([name,ok])=>(ok?'PASS ':'FAIL ')+name).join('\n'));
console.log(`Wynik: ${tests.length-failed.length}/${tests.length}`);
process.exit(failed.length?1:0);
