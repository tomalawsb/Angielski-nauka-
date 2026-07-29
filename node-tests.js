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
  console,setTimeout,clearTimeout,Date,Math,JSON,Promise,Set,Map,Array,String,Number,RegExp,
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
test('wersja interfejsu 5.7.4',html.includes('v5.7.4'));
test('sztuczny przykład nie trafia do ćwiczeń zdań',T.sentenceEn(T.WORDS.find(w=>w.english==='person'))==='person');
test('użyteczny dłuższy przykład pozostaje',T.sentenceEn(T.WORDS.find(w=>w.id==='praca_a1_0003_i_need_to_check_the_cable')).includes('before installation'));
const carTasks=T.practiceQueue('car');
const carKeys=carTasks.map(t=>{const w=T.WORDS.find(x=>x.id===t.wordId);return T.normalize(w.english+'|'+w.polish);});
test('kolejka nie zawiera duplikatów treści',new Set(carKeys).size===carKeys.length);
test('dialog ma numerowane kroki',T.DIALOGUE_SCENES.scene_a1_003.turn===1&&T.DIALOGUE_SCENES.scene_a1_007.turn===3);
const dialogueTasks=T.practiceQueue('dialogues');
const dialogueTurns=dialogueTasks.map(task=>T.DIALOGUE_SCENES[task.wordId]?.turn).filter(Boolean);
test('dialog A1 idzie kolejno 1-2-3',dialogueTurns.join(',')==='1,2,3');
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
for(let first=0;first<T.WORDS.length;first++)for(let second=first+1;second<T.WORDS.length;second++){
  const a=T.WORDS[first].english,b=T.WORDS[second].english;
  if(T.normalize(a)!==T.normalize(b)&&T.answerScore(a,b).status==='correct')confusedTargets++;
}
test('różne hasła z bazy nie są zaliczane jako to samo',confusedTargets===0);
test('brak rodzajnika jest wyjaśniony',T.answerScore('I restart router','I restart the router').issues.some(i=>i.code==='article'));
test('ustawienia zawierają przypomnienia',html.includes('id="reminderEnabled"')&&html.includes('id="reminderTime"'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
test('PWA pozwala na obrót ekranu',manifest.orientation==='any');
const serviceWorker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
test('Service Worker ma cache offline',serviceWorker.includes('english-trainer-v5.7.4')&&serviceWorker.includes('cache.addAll'));
test('Service Worker obsługuje przypomnienia okresowe',serviceWorker.includes('periodicsync'));


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
test('ciemny motyw ma komplet zmiennych kolorów',html.includes('html[data-theme="dark"]')&&html.includes('--surface:#111827')&&html.includes('--text:#f8fafc')&&html.includes('--border:#334155'));

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
test('ustawienia są podzielone na sekcje', ['Nauka','Wygląd','Dźwięk i mowa','Tryb samochodowy','Przypomnienia','Dane'].every(label=>html.includes('<h3>'+label+'</h3>')));
test('dolna nawigacja chowa się przy klawiaturze',html.includes('body.keyboard-open .bottomnav')&&html.includes('body:has(input:focus,textarea:focus) .bottomnav')&&fs.readFileSync(path.join(root,'script.js'),'utf8').includes('setupKeyboardHandling'));
test('etykieta Pisanie słówek jest jednoznaczna',html.includes('Pisanie słówek'));

state.settings.defaultLevel='A1';state.settings.defaultTrack='all';

const failed=tests.filter(([,ok])=>!ok);
console.log(tests.map(([name,ok])=>(ok?'PASS ':'FAIL ')+name).join('\n'));
console.log(`Wynik: ${tests.length-failed.length}/${tests.length}`);
if(failed.length)process.exit(1);
