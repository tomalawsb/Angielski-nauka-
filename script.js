'use strict';

const APP_VERSION='5.8.2';
const WORDS=window.TRAINER_WORDS||[];
const DIALOGUE_SCENES=window.DIALOGUE_SCENES||{};
const WORD_ALIASES=window.TRAINER_WORD_ALIASES||{};
const Core=window.LearningCore;
if(!Core)throw new Error('Brak modułu learning-core.js');
const {normalize,wordsOf,dl,answerScore,bestAnswerScore,migrateProgress,advanceProgress}=Core;

const STORAGE_KEY='angielski_daily_trainer_state_v582';
const OLD_KEYS=['angielski_daily_trainer_state_v581','angielski_daily_trainer_state_v58','angielski_daily_trainer_state_v53','angielski_daily_trainer_state_v5','englishPwaProgressV4','angielski-pwa-progress-v4','angielskiPwaProgress'];
const MAX_IMPORT_SIZE=1024*1024;
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
let state=null;
let session=null;
let selectedChoice=null;
let checked=false;
let recognition=null;
let carRecognition=null;
let lastSpeechText='';
let carAutoTimer=null;
let carCommandMode=false;
let carSilenceRetries=0;
let toastTimer=null;
let onboardingStep=1;
let retrySnapshot=null;

const $=id=>document.getElementById(id);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const percent=(a,b)=>b?Math.round(a/b*100)+'%':'0%';
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const deepClone=value=>JSON.parse(JSON.stringify(value));

function err(message){const box=$('errorBox');if(box){box.style.display='block';box.textContent=String(message);}}
window.addEventListener('error',event=>err('Błąd JS: '+(event.message||event.error||event)));
window.addEventListener('unhandledrejection',event=>err('Błąd promise: '+(event.reason?.message||event.reason||event)));

function notify(message,type='info'){
  const box=$('toast');
  if(!box)return;
  clearTimeout(toastTimer);
  box.textContent=message;
  box.className='toast show'+(type==='error'?' error':type==='success'?' success':'');
  toastTimer=setTimeout(()=>box.className='toast',3200);
}

function safeGet(key){try{return localStorage.getItem(key);}catch(error){console.error('Odczyt localStorage:',error);return null;}}
function safeSet(key,value){try{localStorage.setItem(key,value);return true;}catch(error){console.error('Zapis localStorage:',error);return false;}}
function safeRemove(key){try{localStorage.removeItem(key);return true;}catch(error){console.error('Usuwanie localStorage:',error);return false;}}

function todayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function addDays(days,base=new Date()){
  const date=typeof base==='string'?new Date(...base.split('-').map((value,index)=>index===1?Number(value)-1:Number(value)),12):new Date(base);
  date.setHours(12,0,0,0);
  date.setDate(date.getDate()+days);
  return todayKey(date);
}
function isValidDateKey(value){if(!DATE_RE.test(String(value||'')))return false;const [y,m,d]=String(value).split('-').map(Number);const date=new Date(y,m-1,d,12);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d;}

function defState(){
  return {
    version:APP_VERSION,
    createdAt:new Date().toISOString(),
    settings:{
      dailyGoal:20,dailyNew:7,dailyReview:18,defaultLevel:'A1',defaultTrack:'all',
      themeMode:'system',fontSize:'normal',animationsEnabled:true,
      voiceEnabled:true,voiceLang:'en-US',voiceName:'',voiceRate:.9,voiceRepeat:1,autoSpeak:false,preferExample:true,
      carPause:3,carAutoNext:true,carWarningDismissed:false,
      reminderEnabled:false,reminderTime:'19:00',reminderLastDay:null,notificationSound:true,
      onboardingComplete:false
    },
    user:{xp:0,level:1,streakDays:0,lastActiveDay:null,totalCorrect:0,totalWrong:0,bestAnswerStreak:0,currentAnswerStreak:0},
    items:{},days:{},mistakes:{},modeStats:{},sessions:[],activeSession:null,recentWordIds:[]
  };
}

function mergeProgress(a={},b={}){
  const days=[...(a.successDays||[]),...(b.successDays||[])];
  return migrateProgress({...a,...b,seen:Math.max(Number(a.seen)||0,Number(b.seen)||0),correct:Math.max(Number(a.correct)||0,Number(b.correct)||0),wrong:Math.max(Number(a.wrong)||0,Number(b.wrong)||0),streak:Math.max(Number(a.streak)||0,Number(b.streak)||0),lapses:Math.max(Number(a.lapses)||0,Number(b.lapses)||0),intervalIndex:Math.max(Number(a.intervalIndex)||0,Number(b.intervalIndex)||0),successDays:days,lastAnswer:[a.lastAnswer,b.lastAnswer].filter(Boolean).sort().at(-1)||null,lastSuccessDay:[a.lastSuccessDay,b.lastSuccessDay].filter(Boolean).sort().at(-1)||null,nextReview:[a.nextReview,b.nextReview].filter(Boolean).sort()[0]||null},todayKey());
}

function migrate(source){
  const freshState=defState();
  if(!source||typeof source!=='object'||Array.isArray(source))return freshState;
  const sourceItems=source.items||source.wordProgress||{};
  const items={};
  for(const [id,progress] of Object.entries(sourceItems)){
    const targetId=WORD_ALIASES[id]||id;
    items[targetId]=mergeProgress(items[targetId],progress);
  }
  return {
    ...freshState,...source,version:APP_VERSION,
    settings:{...freshState.settings,...(source.settings||{})},
    user:{...freshState.user,...(source.user||{})},
    items,days:source.days||source.daily||{},mistakes:source.mistakes||{},modeStats:source.modeStats||{},
    sessions:Array.isArray(source.sessions)?source.sessions.slice(0,100):[],
    activeSession:source.activeSession&&typeof source.activeSession==='object'?source.activeSession:null,
    recentWordIds:Array.isArray(source.recentWordIds)?source.recentWordIds.filter(id=>WORDS.some(word=>word.id===(WORD_ALIASES[id]||id))).map(id=>WORD_ALIASES[id]||id).slice(-120):[]
  };
}

function validateImportedState(rawText){
  if(typeof rawText!=='string'||!rawText.trim())throw new Error('Wklej dane JSON do pola importu.');
  if(new Blob([rawText]).size>MAX_IMPORT_SIZE)throw new Error('Plik importu jest za duży. Maksymalny rozmiar to 1 MB.');
  let parsed;try{parsed=JSON.parse(rawText);}catch(_){throw new Error('Plik nie zawiera poprawnego JSON-u.');}
  const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const assertObject=(value,name)=>{if(value!==undefined&&!isObject(value))throw new Error(`Pole ${name} ma nieprawidłowy typ.`);};
  const assertKnown=(value,allowed,name)=>{const unknown=Object.keys(value||{}).filter(key=>!allowed.has(key));if(unknown.length)throw new Error(`Nieznane pola w ${name}: ${unknown.slice(0,5).join(', ')}.`);};
  const number=(value,min,max,name,integer=true)=>{if(value===undefined||value===null)return;if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw new Error(`Nieprawidłowa wartość lub typ pola ${name}.`);};
  const string=(value,name,max=200)=>{if(value!==undefined&&value!==null&&(typeof value!=='string'||value.length>max))throw new Error(`Nieprawidłowy typ pola ${name}.`);};
  const bool=(value,name)=>{if(value!==undefined&&typeof value!=='boolean')throw new Error(`Nieprawidłowy typ pola ${name}.`);};
  const isoDate=(value,name)=>{
    if(value===undefined||value===null)return;
    if(typeof value!=='string')throw new Error(`Nieprawidłowa data ${name}.`);
    const match=value.match(/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/);
    if(!match)throw new Error(`Nieprawidłowa data ${name}. Wymagany jest format ISO 8601.`);
    const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),calendarDate=new Date(Date.UTC(year,month-1,day));
    if(calendarDate.getUTCFullYear()!==year||calendarDate.getUTCMonth()!==month-1||calendarDate.getUTCDate()!==day||!Number.isFinite(Date.parse(value)))throw new Error(`Nieprawidłowa data ${name}.`);
  };
  if(!isObject(parsed))throw new Error('Główny element importu musi być obiektem.');
  const allowedTop=new Set(['version','createdAt','settings','user','items','wordProgress','days','daily','mistakes','modeStats','sessions','activeSession','recentWordIds']);
  assertKnown(parsed,allowedTop,'imporcie');
  if(parsed.version!==undefined){
    if(typeof parsed.version!=='string'||!/^\d+\.\d+\.\d+$/.test(parsed.version))throw new Error('Nieprawidłowy numer wersji danych.');
    const imported=parsed.version.split('.').map(Number),current=APP_VERSION.split('.').map(Number);
    const compare=(left,right)=>left[0]-right[0]||left[1]-right[1]||left[2]-right[2];
    if(imported[0]<4||compare(imported,current)>0)throw new Error('Nieobsługiwana wersja danych: '+parsed.version+'.');
  }
  isoDate(parsed.createdAt,'utworzenia zapisu');
  assertObject(parsed.settings,'settings');assertObject(parsed.user,'user');assertObject(parsed.items??parsed.wordProgress,'items');assertObject(parsed.days??parsed.daily,'days');assertObject(parsed.mistakes,'mistakes');assertObject(parsed.modeStats,'modeStats');
  const defaults=defState(),settings=parsed.settings||{},user=parsed.user||{},items=parsed.items||parsed.wordProgress||{},days=parsed.days||parsed.daily||{};
  assertKnown(settings,new Set(Object.keys(defaults.settings)),'settings');assertKnown(user,new Set(Object.keys(defaults.user)),'user');
  for(const [field,min,max,int] of [['dailyGoal',5,100,true],['dailyNew',1,50,true],['dailyReview',1,100,true],['voiceRate',.5,1.4,false],['voiceRepeat',1,4,true],['carPause',1,8,true]])number(settings[field],min,max,field,int);
  for(const field of ['animationsEnabled','voiceEnabled','autoSpeak','preferExample','carAutoNext','carWarningDismissed','reminderEnabled','notificationSound','onboardingComplete'])bool(settings[field],field);
  for(const field of ['voiceLang','voiceName'])string(settings[field],field,120);
  if(settings.reminderTime!==undefined&&(typeof settings.reminderTime!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.reminderTime)))throw new Error('Nieprawidłowa godzina przypomnienia.');
  if(settings.reminderLastDay!==undefined&&settings.reminderLastDay!==null&&!isValidDateKey(settings.reminderLastDay))throw new Error('Nieprawidłowa data ostatniego przypomnienia.');
  if(settings.defaultLevel!==undefined&&!['all',...levels()].includes(settings.defaultLevel))throw new Error('Nieznany poziom nauki.');
  if(settings.defaultTrack!==undefined&&!['all',...tracks()].includes(settings.defaultTrack))throw new Error('Nieznana ścieżka nauki.');
  if(settings.themeMode!==undefined&&!['system','light','dark'].includes(settings.themeMode))throw new Error('Nieznany motyw.');
  if(settings.fontSize!==undefined&&!['small','normal','large','xlarge'].includes(settings.fontSize))throw new Error('Nieznany rozmiar tekstu.');
  for(const [field,min,max] of [['xp',0,100000000],['level',1,100000],['streakDays',0,100000],['totalCorrect',0,100000000],['totalWrong',0,100000000],['bestAnswerStreak',0,1000000],['currentAnswerStreak',0,1000000]])number(user[field],min,max,'user.'+field);
  if(user.lastActiveDay!==undefined&&user.lastActiveDay!==null&&!isValidDateKey(user.lastActiveDay))throw new Error('Nieprawidłowa data ostatniej aktywności.');
  const validIds=new Set([...WORDS.map(word=>word.id),...Object.keys(WORD_ALIASES)]),progressFields=new Set(['seen','correct','wrong','streak','mastery','nextReview','lastAnswer','lastSuccessDay','successDays','status','intervalIndex','lapses']);
  if(Object.keys(items).length>WORDS.length+Object.keys(WORD_ALIASES).length)throw new Error('Import zawiera zbyt wiele wpisów postępu.');
  for(const [id,progress] of Object.entries(items)){
    if(!validIds.has(id))throw new Error('Nieznany identyfikator materiału: '+id+'.');assertObject(progress,'postęp '+id);assertKnown(progress,progressFields,'postępie '+id);
    for(const field of ['seen','correct','wrong','streak','lapses'])number(progress[field],0,100000,`${id}.${field}`);number(progress.mastery,0,100,`${id}.mastery`);number(progress.intervalIndex,0,6,`${id}.intervalIndex`);
    for(const field of ['nextReview','lastAnswer','lastSuccessDay'])if(progress[field]!==undefined&&progress[field]!==null&&!isValidDateKey(progress[field]))throw new Error(`Nieprawidłowa data ${id}.${field}.`);
    if(progress.status!==undefined&&!['new','review','weak','mastered'].includes(progress.status))throw new Error('Nieprawidłowy status materiału '+id+'.');
    if(progress.successDays!==undefined&&(!Array.isArray(progress.successDays)||progress.successDays.length>100||progress.successDays.some(day=>typeof day!=='string'||!isValidDateKey(day))))throw new Error('Nieprawidłowa lista successDays dla '+id+'.');
  }
  if(Object.keys(days).length>2000)throw new Error('Import zawiera zbyt długą historię dni.');
  for(const [date,entry] of Object.entries(days)){if(!isValidDateKey(date))throw new Error('Nieprawidłowa data historii: '+date+'.');assertObject(entry,'historia dnia '+date);assertKnown(entry,new Set(['correct','wrong','xp']),'historii dnia '+date);for(const f of ['correct','wrong','xp'])number(entry[f],0,1000000,`${date}.${f}`);}
  for(const [id,count] of Object.entries(parsed.mistakes||{})){if(!validIds.has(id))throw new Error('Nieznany materiał w mistakes: '+id+'.');number(count,0,1000000,'mistakes.'+id);}
  const validModes=new Set(['word_choice','word_write','sentence_translate','listening_write','speaker_repeat','speaking','dialogue','car_voice','en_pl','mixed','test','reviews','vocab','sentences','writing','listening','lector','car','dialogues']);
  for(const [mode,entry] of Object.entries(parsed.modeStats||{})){if(!validModes.has(mode))throw new Error('Nieznany tryb w statystykach: '+mode+'.');assertObject(entry,'modeStats.'+mode);assertKnown(entry,new Set(['correct','wrong','xp']),'modeStats.'+mode);for(const f of ['correct','wrong','xp'])number(entry[f],0,100000000,`modeStats.${mode}.${f}`);}
  const validateTask=(task,name)=>{assertObject(task,name);assertKnown(task,new Set(['wordId','kind','mode']),name);if(!validIds.has(task.wordId))throw new Error('Nieznany materiał w '+name+'.');if(!['new','review','weak'].includes(task.kind))throw new Error('Nieprawidłowy rodzaj zadania w '+name+'.');if(!validModes.has(task.mode))throw new Error('Nieprawidłowy tryb zadania w '+name+'.');};
  if(parsed.sessions!==undefined){if(!Array.isArray(parsed.sessions)||parsed.sessions.length>500)throw new Error('Nieprawidłowa historia sesji.');parsed.sessions.forEach((entry,index)=>{assertObject(entry,'sessions['+index+']');assertKnown(entry,new Set(['date','practice','correct','wrong','xp','total']),'sessions['+index+']');isoDate(entry.date,`sessions[${index}].date`);if(typeof entry.practice!=='string'||!validModes.has(entry.practice))throw new Error('Nieprawidłowy tryb sesji.');for(const f of ['correct','wrong','xp','total'])number(entry[f],0,1000000,`sessions[${index}].${f}`);if(entry.total!==undefined&&entry.correct!==undefined&&entry.wrong!==undefined&&entry.correct+entry.wrong>entry.total)throw new Error('Niespójny wynik sesji.');});}
  if(parsed.activeSession!==undefined&&parsed.activeSession!==null){const a=parsed.activeSession;assertObject(a,'activeSession');assertKnown(a,new Set(['queue','index','correct','wrong','xp','practice','startedAt']),'activeSession');if(!Array.isArray(a.queue)||!a.queue.length||a.queue.length>200)throw new Error('Nieprawidłowa kolejka aktywnej sesji.');a.queue.forEach((task,index)=>validateTask(task,`activeSession.queue[${index}]`));number(a.index,0,a.queue.length,'activeSession.index');for(const f of ['correct','wrong','xp'])number(a[f],0,1000000,'activeSession.'+f);if(typeof a.practice!=='string'||!validModes.has(a.practice))throw new Error('Nieprawidłowy tryb aktywnej sesji.');isoDate(a.startedAt,'activeSession.startedAt');}
  if(parsed.recentWordIds!==undefined&&(!Array.isArray(parsed.recentWordIds)||parsed.recentWordIds.length>120||parsed.recentWordIds.some(id=>typeof id!=='string'||!validIds.has(id))))throw new Error('Nieprawidłowa lista ostatnich materiałów.');
  return migrate(parsed);
}

function loadState(){
  for(const key of [STORAGE_KEY,...OLD_KEYS]){
    const raw=safeGet(key);
    if(!raw)continue;
    try{return migrate(JSON.parse(raw));}catch(error){console.warn('Pominięto uszkodzony zapis',key,error);}
  }
  return defState();
}
function save(options={}){
  const ok=safeSet(STORAGE_KEY,JSON.stringify(state));
  if(!ok&&!options.silent)notify('Nie udało się zapisać postępu. Wyeksportuj dane, aby ich nie stracić.','error');
  return ok;
}

async function clearAppCaches(){
  if(!('caches'in window))return true;
  try{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('english-trainer-')).map(key=>caches.delete(key)));return true;}
  catch(error){console.error('Usuwanie cache:',error);notify('Nie udało się odświeżyć plików aplikacji.','error');return false;}
}
async function registerServiceWorker(){
  if(!('serviceWorker'in navigator)||!/^https?:$/.test(location.protocol))return null;
  try{return await navigator.serviceWorker.register('./service-worker.js?v='+APP_VERSION,{scope:'./'});}catch(error){console.warn('Service Worker:',error);return null;}
}
async function configureReminders(askPermission=false){
  if(!state.settings.reminderEnabled||!('Notification'in window))return;
  let permission=Notification.permission;
  if(permission==='default'&&askPermission)permission=await Notification.requestPermission();
  if(permission!=='granted'&&askPermission){state.settings.reminderEnabled=false;syncSettings();save();notify('Przeglądarka nie zezwoliła na powiadomienia.','error');}
}
async function showLearningReminder(){
  if(!state.settings.reminderEnabled||!('Notification'in window)||Notification.permission!=='granted')return;
  const options={body:'Masz krótką sesję lub powtórki do zrobienia.',icon:'./icon-192.png',badge:'./icon-192.png',tag:'daily-learning-reminder',silent:!state.settings.notificationSound};
  try{const registration=('serviceWorker'in navigator)?await navigator.serviceWorker.getRegistration():null;if(registration)await registration.showNotification('Czas na angielski',options);else new Notification('Czas na angielski',options);}catch(error){console.warn('Powiadomienie:',error);}
}
function checkReminderTime(){
  if(!state?.settings?.reminderEnabled)return;
  const now=new Date(),day=todayKey(now),time=state.settings.reminderTime||'19:00';
  const current=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  if(current>=time&&state.settings.reminderLastDay!==day){state.settings.reminderLastDay=day;if(save({silent:true}))showLearningReminder();}
}
function startReminderClock(){if(!('Notification'in window))return;checkReminderTime();setInterval(checkReminderTime,60000);}

function levels(){return [...new Set(WORDS.map(word=>word.level).filter(Boolean))].sort((a,b)=>['A1','A2','B1','B2','C1','C2'].indexOf(a)-['A1','A2','B1','B2','C1','C2'].indexOf(b));}
function tracks(){return [...new Set(WORDS.map(word=>word.track).filter(Boolean))].sort();}
function fillSelect(id,options){const element=$(id);if(element)element.innerHTML=options.map(option=>`<option value="${esc(option[0])}">${esc(option[1])}</option>`).join('');}

function boot(){
  state=loadState();
  applyAppearance();
  bind();
  setupKeyboardHandling();
  setupSystemThemeListener();
  setupFilters();
  setupVoices();
  syncSettings();
  renderAll();
  show('today');
  registerServiceWorker().then(()=>configureReminders(false));
  startReminderClock();
  if(!state.settings.onboardingComplete)setTimeout(openOnboarding,200);
}

function setupSystemThemeListener(){
  if(typeof matchMedia!=='function')return;
  const media=matchMedia('(prefers-color-scheme: dark)');
  const refresh=()=>{if(state?.settings?.themeMode==='system')applyAppearance();};
  if(typeof media.addEventListener==='function')media.addEventListener('change',refresh);else if(typeof media.addListener==='function')media.addListener(refresh);
}
function setupKeyboardHandling(){
  const body=document.body;if(!body)return;
  const isTypingField=element=>!!element&&['INPUT','TEXTAREA'].includes(element.tagName)&&element.type!=='checkbox';
  const activate=event=>{if(!isTypingField(event.target))return;body.classList.add('input-active');setTimeout(()=>event.target?.scrollIntoView?.({block:'center',behavior:'smooth'}),180);};
  const deactivate=event=>{if(!isTypingField(event.target))return;setTimeout(()=>{if(!isTypingField(document.activeElement))body.classList.remove('input-active');},120);};
  document.addEventListener('focusin',activate);document.addEventListener('focus',activate,true);document.addEventListener('focusout',deactivate);document.addEventListener('blur',deactivate,true);
  if(window.visualViewport){const update=()=>body.classList.toggle('keyboard-open',window.visualViewport.height<window.innerHeight-140);window.visualViewport.addEventListener('resize',update);window.visualViewport.addEventListener('scroll',update);update();}
}

function bind(){
  document.querySelectorAll('[data-nav]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.nav)));
  document.querySelectorAll('[data-practice]').forEach(button=>button.addEventListener('click',()=>startPractice(button.dataset.practice)));
  document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>handleAction(button.dataset.action)));
  $('startBtn')?.addEventListener('click',startSmart);$('reviewBtn')?.addEventListener('click',startReviews);$('checkBtn')?.addEventListener('click',checkAnswer);$('retryBtn')?.addEventListener('click',retryCurrent);$('micBtn')?.addEventListener('click',startSpeechAnswer);$('nextBtn')?.addEventListener('click',nextCard);$('dontKnowBtn')?.addEventListener('click',()=>mark(false,'Nie wiem'));$('speakBtn')?.addEventListener('click',()=>speak());$('refreshBtn')?.addEventListener('click',hardRefresh);$('endSessionBtn')?.addEventListener('click',endSessionSafely);
  $('resumeSessionBtn')?.addEventListener('click',resumeSession);$('discardSessionBtn')?.addEventListener('click',discardSavedSession);
  ['searchInput','levelFilter','trackFilter'].forEach(id=>$(id)?.addEventListener('input',renderBase));['levelFilter','trackFilter'].forEach(id=>$(id)?.addEventListener('change',renderBase));
  ['dailyGoal','dailyNew','dailyReview','defaultLevel','defaultTrack','themeMode','fontSize','animationsEnabled','voiceEnabled','voiceLang','voiceName','voiceRate','voiceRepeat','autoSpeak','preferExample','carPause','carAutoNext','reminderTime','notificationSound'].forEach(id=>$(id)?.addEventListener('change',saveSettings));
  ['themeMode','fontSize'].forEach(id=>$(id)?.addEventListener('input',saveSettings));
  $('reminderEnabled')?.addEventListener('change',async()=>{saveSettings();await configureReminders(true);});
  $('exportBtn')?.addEventListener('click',exportData);$('importBtn')?.addEventListener('click',importData);$('resetBtn')?.addEventListener('click',resetProgress);
  $('onboardingNext')?.addEventListener('click',nextOnboardingStep);$('onboardingBack')?.addEventListener('click',previousOnboardingStep);
  document.addEventListener('click',event=>{const command=event.target.closest?.('[data-car]');if(command){handleCarCommand(command.dataset.car);return;}const choice=event.target.closest?.('.choice');if(!choice||checked)return;document.querySelectorAll('.choice').forEach(item=>item.classList.remove('selected'));choice.classList.add('selected');selectedChoice=choice.dataset.choice;});
  document.addEventListener('keydown',event=>{if(!session||event.key!=='Enter'||!$('learnScreen')?.classList.contains('active'))return;const tag=event.target?.tagName?.toLowerCase();if(tag==='textarea')return;event.preventDefault();if(!$('nextBtn')?.classList.contains('hidden'))nextCard();else checkAnswer();});
  if('speechSynthesis'in window)speechSynthesis.onvoiceschanged=setupVoices;
}

function handleAction(action){
  if(action==='smart'){startSmart();return;}
  if(action==='export'){show('settings');setTimeout(()=>{exportData();$('dataSettings')?.scrollIntoView?.({behavior:'smooth'});},80);return;}
  if(action==='import'){show('settings');setTimeout(()=>{$('dataSettings')?.scrollIntoView?.({behavior:'smooth'});$('dataBox')?.focus?.();},80);}
}

function setupFilters(){
  const levelOptions=[['all','Wszystkie poziomy'],...levels().map(value=>[value,value])];
  const trackOptions=[['all','Wszystkie ścieżki'],...tracks().map(value=>[value,value])];
  fillSelect('levelFilter',levelOptions);fillSelect('trackFilter',trackOptions);fillSelect('defaultLevel',levelOptions);fillSelect('defaultTrack',trackOptions);fillSelect('onboardingLevel',levels().map(value=>[value,value]));fillSelect('onboardingTrack',trackOptions);
  fillSelect('voiceLang',[['en-US','Angielski USA'],['en-GB','Angielski UK'],['en-AU','Angielski Australia'],['en-CA','Angielski Kanada']]);
}
function setupVoices(){const select=$('voiceName');if(!select)return;const voices=('speechSynthesis'in window)?speechSynthesis.getVoices().filter(voice=>/^en/i.test(voice.lang)):[];const current=state?.settings?.voiceName||'';select.innerHTML='<option value="">Domyślny głos</option>'+voices.map(voice=>`<option value="${esc(voice.name)}">${esc(voice.name)} — ${esc(voice.lang)}</option>`).join('');select.value=[...select.options].some(option=>option.value===current)?current:'';}
function setValue(id,value){const element=$(id);if(element)element.value=value;}
function setChecked(id,value){const element=$(id);if(element)element.checked=!!value;}
function syncSettings(){
  setValue('dailyGoal',state.settings.dailyGoal);setValue('dailyNew',state.settings.dailyNew);setValue('dailyReview',state.settings.dailyReview);setValue('defaultLevel',state.settings.defaultLevel||'all');setValue('defaultTrack',state.settings.defaultTrack||'all');setValue('themeMode',state.settings.themeMode||'system');setValue('fontSize',state.settings.fontSize||'normal');setChecked('animationsEnabled',state.settings.animationsEnabled!==false);setChecked('voiceEnabled',state.settings.voiceEnabled);setValue('voiceLang',state.settings.voiceLang||'en-US');setValue('voiceName',state.settings.voiceName||'');setValue('voiceRate',state.settings.voiceRate??.9);setValue('voiceRepeat',state.settings.voiceRepeat||1);setChecked('autoSpeak',state.settings.autoSpeak);setChecked('preferExample',state.settings.preferExample!==false);setValue('carPause',state.settings.carPause||3);setChecked('carAutoNext',state.settings.carAutoNext!==false);setChecked('reminderEnabled',state.settings.reminderEnabled);setValue('reminderTime',state.settings.reminderTime||'19:00');setChecked('notificationSound',state.settings.notificationSound!==false);applyAppearance();
}
function saveSettings(){
  const previous=deepClone(state.settings);
  state.settings.dailyGoal=clamp(parseInt($('dailyGoal')?.value)||20,5,100);state.settings.dailyNew=clamp(parseInt($('dailyNew')?.value)||7,1,50);state.settings.dailyReview=clamp(parseInt($('dailyReview')?.value)||18,1,100);state.settings.defaultLevel=$('defaultLevel')?.value||'all';state.settings.defaultTrack=$('defaultTrack')?.value||'all';state.settings.themeMode=$('themeMode')?.value||'system';state.settings.fontSize=$('fontSize')?.value||'normal';state.settings.animationsEnabled=$('animationsEnabled')?.checked!==false;state.settings.voiceEnabled=!!$('voiceEnabled')?.checked;state.settings.voiceLang=$('voiceLang')?.value||'en-US';state.settings.voiceName=$('voiceName')?.value||'';state.settings.voiceRate=clamp(parseFloat($('voiceRate')?.value)||.9,.5,1.4);state.settings.voiceRepeat=clamp(parseInt($('voiceRepeat')?.value)||1,1,4);state.settings.autoSpeak=!!$('autoSpeak')?.checked;state.settings.preferExample=$('preferExample')?.checked!==false;state.settings.carPause=clamp(parseInt($('carPause')?.value)||3,1,8);state.settings.carAutoNext=$('carAutoNext')?.checked!==false;state.settings.reminderEnabled=!!$('reminderEnabled')?.checked;state.settings.reminderTime=$('reminderTime')?.value||'19:00';state.settings.notificationSound=$('notificationSound')?.checked!==false;applyAppearance();
  if(!save()){state.settings=previous;syncSettings();applyAppearance();return false;}notify('Ustawienia zapisane.','success');renderAll();return true;
}
function applyAppearance(){const root=$('appRoot');if(root){root.dataset.theme=state?.settings?.themeMode||'system';root.dataset.fontSize=state?.settings?.fontSize||'normal';root.dataset.animations=state?.settings?.animationsEnabled===false?'off':'on';}const meta=$('themeColorMeta');if(meta){let dark=state?.settings?.themeMode==='dark';if(state?.settings?.themeMode==='system'&&typeof matchMedia==='function')dark=matchMedia('(prefers-color-scheme: dark)').matches;meta.content=dark?'#0f172a':'#2563eb';}}

function show(name){
  const mainNames=new Set(['today','study','progress','more']);
  if(name!=='learn'){document.body?.classList.remove('input-active','keyboard-open');stopCarRecognition();clearCarTimer();try{if('speechSynthesis'in window)speechSynthesis.cancel();}catch(_){}}
  document.querySelectorAll('.screen').forEach(screen=>screen.classList.remove('active'));
  document.querySelectorAll('.nav').forEach(nav=>nav.classList.toggle('active',nav.dataset.nav===(mainNames.has(name)?name:(name==='learn'?'study':'more'))));
  const screen=$(name+'Screen');if(screen)screen.classList.add('active');
  renderAll();
  window.scrollTo?.({top:0,behavior:'instant'});
}

function prog(id){const targetId=WORD_ALIASES[id]||id;state.items[targetId]=migrateProgress(state.items[targetId]||{},todayKey());return state.items[targetId];}
function matchesStudyFilters(word){return !!word&&(state.settings.defaultLevel==='all'||word.level===state.settings.defaultLevel)&&(state.settings.defaultTrack==='all'||word.track===state.settings.defaultTrack);}
function due(){const today=todayKey();return WORDS.filter(word=>{if(!matchesStudyFilters(word))return false;const progress=prog(word.id);return progress.nextReview&&progress.nextReview<=today;});}
function weak(){return WORDS.filter(word=>matchesStudyFilters(word)&&prog(word.id).status==='weak').sort((a,b)=>prog(b.id).wrong-prog(a.id).wrong);}
function fresh(){return WORDS.filter(word=>matchesStudyFilters(word)&&prog(word.id).seen===0);}
function uniqueTasks(tasks){const seen=new Set();return tasks.filter(taskItem=>{const word=WORDS.find(item=>item.id===taskItem.wordId);if(!word)return false;const key=normalize(word.english+'|'+word.polish);if(seen.has(key))return false;seen.add(key);return true;});}
function preferNotRecent(words){const recent=new Set(state.recentWordIds||[]);return shuffle(words).sort((a,b)=>(recent.has(a.id)?1:0)-(recent.has(b.id)?1:0));}
function orderedReviews(words){const recent=new Set(state.recentWordIds||[]);return shuffle(words).sort((a,b)=>String(prog(a.id).nextReview||'9999').localeCompare(String(prog(b.id).nextReview||'9999'))||(prog(b.id).wrong-prog(a.id).wrong)||((recent.has(a.id)?1:0)-(recent.has(b.id)?1:0)));}
function queue(reviewOnly=false){const reviews=orderedReviews(due()).slice(0,state.settings.dailyReview).map(word=>task(word,'review'));if(reviewOnly)return uniqueTasks(reviews);const dueIds=new Set(reviews.map(item=>item.wordId));const weakTasks=preferNotRecent(weak().filter(word=>!dueIds.has(word.id))).sort((a,b)=>prog(b.id).wrong-prog(a.id).wrong).slice(0,5).map(word=>task(word,'weak'));const newTasks=preferNotRecent(fresh()).slice(0,state.settings.dailyNew).map(word=>task(word,'new'));return uniqueTasks([...reviews,...weakTasks,...newTasks]);}
function task(word,kind,taskMode=null){return {wordId:word.id,kind,mode:taskMode||mode(word,kind)};}
function mode(word,kind){const progress=prog(word.id);if(kind==='new'||progress.seen===0)return 'word_choice';if(progress.streak>=2&&sentenceEn(word))return 'sentence_translate';return progress.seen%3===0?'word_write':'en_pl';}
function activeWords(){const seen=new Set();return WORDS.filter(word=>{if(!matchesStudyFilters(word))return false;const key=normalize(word.english+'|'+word.polish);if(seen.has(key))return false;seen.add(key);return true;});}
function isVocabularyItem(word){if(!word)return false;const text=String(word.english||'').trim();return !!text&&wordsOf(text).length===1&&!/[.!?,;:]/.test(text);}
function isSentenceItem(word){if(!word)return false;return wordsOf(sentenceEn(word)).length>=3;}
function practiceBase(predicate,target){const selected=[],ids=new Set();const add=(word,kind)=>{if(!word||ids.has(word.id)||!predicate(word))return;selected.push(task(word,kind));ids.add(word.id);};due().filter(predicate).slice(0,state.settings.dailyReview).forEach(word=>add(word,'review'));weak().filter(predicate).slice(0,5).forEach(word=>add(word,'weak'));fresh().filter(predicate).slice(0,state.settings.dailyNew).forEach(word=>add(word,'new'));for(const word of preferNotRecent(activeWords())){if(selected.length>=target)break;add(word,prog(word.id).seen?'review':'new');}return selected.slice(0,target);}
function hasQualityExample(word){const en=String(word.examples?.[0]?.en||'').trim(),pl=String(word.examples?.[0]?.pl||'').trim();if(!en||!pl||en.split(/\s+/).length<4)return false;if(/^this word is useful\b/i.test(en))return false;if(normalize(en)===normalize(word.english))return false;return true;}
function sentenceEn(word){return hasQualityExample(word)?word.examples[0].en:word.english;}
function sentencePl(word){return hasQualityExample(word)?word.examples[0].pl:word.polish;}

function practiceQueue(kind){
  const target=Math.max(6,state.settings.dailyGoal||20);
  let base=shuffle(queue(false));if(!base.length)base=preferNotRecent(activeWords()).slice(0,target).map(word=>task(word,'new'));
  if(kind==='vocab')return practiceBase(isVocabularyItem,target).map(item=>({...item,mode:item.kind==='new'?'word_choice':'word_write'}));
  if(kind==='sentences')return practiceBase(isSentenceItem,target).map(item=>({...item,mode:'sentence_translate'}));
  if(kind==='writing')return practiceBase(isVocabularyItem,target).map(item=>({...item,mode:'word_write'}));
  if(kind==='listening')return base.slice(0,target).map(item=>({...item,mode:'listening_write'}));
  if(kind==='lector')return base.slice(0,target).map(item=>({...item,mode:'speaker_repeat'}));
  if(kind==='speaking')return practiceBase(isSentenceItem,target).map(item=>({...item,mode:'speaking'}));
  if(kind==='car'){
    const carBase=activeWords().filter(word=>sentenceEn(word).includes(' ')),seen=new Set();
    const mixed=[...base.map(item=>WORDS.find(word=>word.id===item.wordId)).filter(Boolean),...carBase].filter(word=>{const key=normalize(sentencePl(word)+'|'+sentenceEn(word));if(seen.has(key))return false;seen.add(key);return true;});
    return mixed.slice(0,target).map(word=>task(word,prog(word.id).seen?'review':'new','car_voice'));
  }
  if(kind==='dialogues'){
    const conversationOrder=new Map();let nextConversation=0;for(const scene of Object.values(DIALOGUE_SCENES))if(!conversationOrder.has(scene.conversation))conversationOrder.set(scene.conversation,nextConversation++);
    const scenes=WORDS.filter(word=>DIALOGUE_SCENES[word.id]&&matchesStudyFilters(word)).sort((a,b)=>{const first=DIALOGUE_SCENES[a.id],second=DIALOGUE_SCENES[b.id];return (conversationOrder.get(first.conversation)??999)-(conversationOrder.get(second.conversation)??999)||(first.turn||1)-(second.turn||1)||a.id.localeCompare(b.id);});
    const groups=[];for(let index=0;index<scenes.length;){const conversation=DIALOGUE_SCENES[scenes[index].id].conversation,group=[];while(index<scenes.length&&DIALOGUE_SCENES[scenes[index].id].conversation===conversation)group.push(scenes[index++]);groups.push(group);}const selected=[];for(const group of shuffle(groups)){if(selected.length>=target)break;selected.push(...group);}return selected.map(word=>task(word,prog(word.id).seen?'review':'new','dialogue'));
  }
  if(kind==='test')return shuffle(base).slice(0,target).map((item,index)=>({...item,mode:['word_choice','word_write','sentence_translate','listening_write','speaking'][index%5]}));
  return base.slice(0,target);
}

async function startPractice(kind){
  if(kind==='car'&&!state.settings.carWarningDismissed){const allowed=await showCarWarning();if(!allowed)return;}
  const tasks=practiceQueue(kind);
  if(!tasks.length){const message=kind==='vocab'||kind==='writing'?'Brak pojedynczych słów dla wybranego poziomu i ścieżki.':kind==='sentences'||kind==='speaking'?'Brak pełnych zdań dla wybranego poziomu i ścieżki.':'Brak zadań dla wybranego poziomu i ścieżki.';notify(message,'error');return;}
  startSession(tasks,kind);
}
function startSmart(){const today=state.days[todayKey()]||{correct:0,wrong:0};const done=(today.correct||0)+(today.wrong||0);const remaining=Math.max(5,(state.settings.dailyGoal||20)-done);const tasks=practiceQueue('test').slice(0,remaining);if(!tasks.length){notify('Brak zadań. Zmień poziom, ścieżkę albo limity w ustawieniach.','error');return;}startSession(tasks,'test');}
function startReviews(){const tasks=queue(true);if(!tasks.length){notify('Nie masz zaległych powtórek.','success');return;}startSession(tasks,'reviews');}
function startSession(tasks,practice='mixed'){const previous=deepClone(state),prepared=practice==='dialogues'?tasks:shuffle(tasks);session={queue:prepared,index:0,correct:0,wrong:0,xp:0,practice,startedAt:new Date().toISOString()};state.recentWordIds=[...new Set([...(state.recentWordIds||[]),...prepared.map(item=>item.wordId)])].slice(-120);checked=false;selectedChoice=null;retrySnapshot=null;if(!snapshotSession()){state=previous;session=null;return;}$('emptyLesson')?.classList.add('hidden');$('summary')?.classList.add('hidden');$('lessonCard')?.classList.remove('hidden');show('learn');renderLesson();}
function snapshotSession(saveNow=true){state.activeSession=session?deepClone(session):null;return saveNow?save():true;}
function resumeSession(){const saved=state.activeSession;if(!saved||!Array.isArray(saved.queue)||!saved.queue.length){notify('Nie ma sesji do wznowienia.','error');return;}session=JSON.parse(JSON.stringify(saved));checked=false;selectedChoice=null;retrySnapshot=null;$('emptyLesson')?.classList.add('hidden');$('summary')?.classList.add('hidden');$('lessonCard')?.classList.remove('hidden');show('learn');renderLesson();}
async function discardSavedSession(){if(!await askConfirm('Usunąć niedokończoną lekcję?','Dotychczasowy wynik tej sesji nie zostanie dopisany do historii.','Usuń'))return;const previous=deepClone(state.activeSession);state.activeSession=null;if(!save()){state.activeSession=previous;return;}renderToday();}
async function endSessionSafely(){if(!session)return;const ok=await askConfirm('Przerwać lekcję?','Bieżący stan zostanie zapisany i będzie można wznowić lekcję z ekranu Dzisiaj.','Przerwij');if(!ok)return;pauseSession();}
function pauseSession(){stopCarRecognition();clearCarTimer();if(checked)session.index=Math.min(session.index+1,session.queue.length);retrySnapshot=null;if(!snapshotSession())return;$('lessonCard')?.classList.add('hidden');$('emptyLesson')?.classList.remove('hidden');session=null;checked=false;selectedChoice=null;show('today');notify('Lekcja została zapisana do wznowienia.','success');}
function curTask(){return session?.queue?.[session.index]||null;}
function curWord(){const current=curTask();return current?WORDS.find(word=>word.id===current.wordId):null;}
function modeLabel(value){return {word_choice:'wybór słówka',word_write:'pisanie',sentence_translate:'zdania',listening_write:'słuchanie',speaker_repeat:'słuchaj i powtarzaj',speaking:'mówienie',dialogue:'dialog',car_voice:'samochód',en_pl:'angielski → polski'}[value]||value;}
function dialogueScene(word){return word?DIALOGUE_SCENES[word.id]||null:null;}
function expected(word,taskMode){if(taskMode==='dialogue'){const scene=dialogueScene(word);if(scene?.accepted?.length)return scene.accepted[0];}return (taskMode==='en_pl'||taskMode==='word_choice')?word.polish:(['sentence_translate','listening_write','speaker_repeat','speaking','car_voice'].includes(taskMode)?sentenceEn(word):word.english);}
function acceptedAnswers(word,taskMode){const answers=[expected(word,taskMode)],scene=taskMode==='dialogue'?dialogueScene(word):null;if(scene?.accepted)answers.push(...scene.accepted);if(Array.isArray(word?.acceptedAnswers))answers.push(...word.acceptedAnswers);if(word?.acceptedAnswers&&Array.isArray(word.acceptedAnswers[taskMode]))answers.push(...word.acceptedAnswers[taskMode]);return [...new Set(answers.filter(Boolean).map(String))];}
function scoreTaskAnswer(answer,word,taskMode){return bestAnswerScore(answer,acceptedAnswers(word,taskMode));}
function promptFor(word,taskMode){
  if(taskMode==='word_choice'||taskMode==='en_pl')return {label:taskMode==='word_choice'?'Wybierz znaczenie słowa':'Przetłumacz słowo na polski',prompt:word.english,hint:''};
  if(taskMode==='sentence_translate')return {label:'Przetłumacz zdanie na angielski',prompt:sentencePl(word),hint:''};
  if(taskMode==='listening_write')return {label:'Posłuchaj i wpisz po angielsku',prompt:'Kliknij „Odsłuchaj” i wpisz to, co usłyszysz.',hint:'Ćwiczysz rozumienie ze słuchu i dokładny zapis.'};
  if(taskMode==='speaker_repeat')return {label:'Słuchaj i powtarzaj',prompt:sentencePl(word),hint:'Odsłuchaj, powtórz na głos i wpisz po angielsku.'};
  if(taskMode==='speaking')return {label:'Mówienie',prompt:sentencePl(word),hint:'Aplikacja sprawdza tekst rozpoznany przez przeglądarkę, nie jakość wymowy.'};
  if(taskMode==='dialogue'){const scene=dialogueScene(word);const clientLine=scene?.prompt?`Klient mówi: ${scene.prompt}`:'';return {label:`${scene?.conversation||'Scenka'} • krok ${scene?.turn||1}/${scene?.total||1}`,prompt:scene?.promptPl||sentencePl(word),hint:[scene?.role||'Rozmowa',clientLine,scene?.context].filter(Boolean).join(' • ')};}
  if(taskMode==='car_voice')return {label:'Tryb samochodowy',prompt:sentencePl(word),hint:'Słuchaj i odpowiadaj bez pisania. Komendy: next, repeat, slower, stop.'};
  return {label:'Przetłumacz słowo na angielski',prompt:word.polish,hint:''};
}
function renderLesson(){
  const current=curTask(),word=curWord();if(!current||!word)return finish();
  checked=false;selectedChoice=null;clearCarTimer();
  $('lessonCard')?.classList.toggle('car-active',current.mode==='car_voice');
  if($('lessonMode'))$('lessonMode').textContent=(current.kind==='new'?'nowe':current.kind==='weak'?'do powtórki':'powtórka')+' • '+modeLabel(current.mode);
  if($('lessonProgress'))$('lessonProgress').textContent=`${session.index+1} / ${session.queue.length}`;
  if($('lessonRemaining'))$('lessonRemaining').textContent=Math.max(0,session.queue.length-session.index-1);
  if($('lessonCorrect'))$('lessonCorrect').textContent=session.correct;
  setProgress($('bar'),Math.round(session.index/session.queue.length*100));
  const feedbackBox=$('feedback');if(feedbackBox){feedbackBox.className='feedback hidden';feedbackBox.textContent='';}
  $('checkBtn')?.classList.remove('hidden');$('nextBtn')?.classList.add('hidden');$('retryBtn')?.classList.add('hidden');if($('dontKnowBtn'))$('dontKnowBtn').disabled=false;$('micBtn')?.classList.toggle('hidden',current.mode!=='speaking');$('micStatus')?.classList.add('hidden');lastSpeechText='';
  const prompt=promptFor(word,current.mode);if($('promptLabel'))$('promptLabel').textContent=prompt.label;if($('prompt'))$('prompt').textContent=prompt.prompt;if($('hint'))$('hint').textContent=[word.level,word.track,word.category,prompt.hint].filter(Boolean).join(' • ');if($('answerArea'))$('answerArea').innerHTML=answerHtml(word,current.mode);
  const wrap=$('questionWrap');if(wrap){wrap.classList.remove('question-enter');void wrap.offsetWidth;wrap.classList.add('question-enter');}
  if(current.mode==='car_voice'){setCarStatus('Przygotowanie...');setTimeout(()=>carAskCurrent(),350);return;}
  setTimeout(()=>{const answer=document.querySelector('.answer');if(answer){answer.focus();document.body?.classList.add('input-active');}},60);
  if(state.settings.voiceEnabled&&state.settings.autoSpeak&&['listening_write','speaker_repeat','speaking'].includes(current.mode))setTimeout(()=>speak(),250);
}
function answerHtml(word,taskMode){
  if(taskMode==='car_voice')return `<div class="car-panel"><div id="carStatus" class="car-status">Start trybu samochodowego</div><div class="car-prompt">${esc(sentencePl(word))}</div><input class="answer hidden" autocomplete="off"><div id="speechTranscript" class="transcript hidden"></div><div class="car-command-grid"><button class="car-command primary-car" data-car="listen">Mów teraz</button><button class="car-command" data-car="repeat">Powtórz</button><button class="car-command" data-car="skip">Dalej</button><button class="car-command" data-car="slower">Wolniej</button><button class="car-command stop-car" data-car="stop">Stop</button></div><div class="car-tip">Komendy: next, repeat, slower, stop, show answer. Po dwóch nieudanych próbach aplikacja poda poprawną odpowiedź.</div></div>`;
  if(taskMode==='speaking')return `<div class="micline"><input class="answer" autocomplete="off" placeholder="Tu pojawi się rozpoznana mowa — możesz poprawić tekst ręcznie"></div><div id="speechTranscript" class="transcript hidden"></div>`;
  if(taskMode==='word_choice'){const pool=activeWords().filter(item=>item.id!==word.id&&item.level===word.level&&isVocabularyItem(item));const choices=shuffle([word,...shuffle(pool).slice(0,3)]);return `<div class="choices">${choices.map(choice=>`<button class="choice" data-choice="${esc(choice.polish)}">${esc(choice.polish)}</button>`).join('')}</div>`;}
  return '<input class="answer" autocomplete="off" placeholder="Wpisz odpowiedź">';
}
function checkAnswer(){if(checked)return;const word=curWord(),current=curTask();if(!word||!current)return;const answer=current.mode==='word_choice'?(selectedChoice||''):(document.querySelector('.answer')?.value||'');if(!answer.trim()){notify('Najpierw wpisz albo wybierz odpowiedź.','error');return;}const result=scoreTaskAnswer(answer,word,current.mode);mark(result.status==='correct',answer,result);}
function mark(ok,answer,result=null){
  if(checked)return;const word=curWord(),current=curTask();if(!word||!current)return;
  const previousState=deepClone(state),previousSession=deepClone(session);checked=true;
  result=result||scoreTaskAnswer(answer,word,current.mode);const partial=result.status==='partial',progressOk=ok;
  updateProg(word,progressOk);session[progressOk?'correct':'wrong']++;
  const xp=progressOk?(current.kind==='new'?12:8):0;session.xp+=xp;state.user.xp+=xp;state.user.level=1+Math.floor(state.user.xp/250);
  const day=todayKey();if(!state.days[day])state.days[day]={correct:0,wrong:0,xp:0};state.days[day][progressOk?'correct':'wrong']++;state.days[day].xp+=xp;updateStreak(day);
  const modeKey=current.mode||session.practice||'mixed';if(!state.modeStats[modeKey])state.modeStats[modeKey]={correct:0,wrong:0,xp:0};state.modeStats[modeKey][progressOk?'correct':'wrong']++;state.modeStats[modeKey].xp+=xp;if(!progressOk)state.mistakes[word.id]=(state.mistakes[word.id]||0)+1;
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
  const current=curTask(),primary=expected(word,current?.mode||'word_write'),box=$('feedback');if(!box)return;
  result=result||scoreTaskAnswer(answer,word,current?.mode||'word_write');const partial=result.status==='partial',accepted=result.expected||primary,issues=(result.issues||[]).slice(0,4),diff=diffMarkup(answer,accepted);const details=issues.length?`<ul class="feedback-details">${issues.map(issue=>`<li>${esc(issue.message)}</li>`).join('')}</ul>`:'';box.className='feedback '+(ok?'ok':partial?'feedback-partial':'bad');
  if(ok){const variant=normalize(accepted)!==normalize(primary)?`<br>Zaakceptowany wariant: <b>${esc(accepted)}</b>`:'';box.innerHTML=`<b>Dobrze.</b><br>Wzorcowa odpowiedź: <b>${esc(primary)}</b>${variant}`;}
  else if(partial)box.innerHTML=`<b>Prawie dobrze.</b><br>Twoja odpowiedź: ${diff.answer}<br>Poprawna odpowiedź: <b>${diff.expected}</b>${details}<br><small>Podświetlone fragmenty wymagają zmiany. Możesz od razu spróbować ponownie.</small>`;
  else box.innerHTML=`<b>Do poprawy.</b><br>Twoja odpowiedź: ${diff.answer}<br>Poprawna odpowiedź: <b>${diff.expected}</b>${details}<br><small>Podświetlone fragmenty wymagają zmiany. Zadanie wróci też do powtórki.</small>`;
}
function nextCard(){if(!session)return;stopCarRecognition();clearCarTimer();retrySnapshot=null;const previousIndex=session.index;session.index++;if(!snapshotSession()){session.index=previousIndex;return;}renderLesson();}
function finish(){
  stopCarRecognition();clearCarTimer();$('lessonCard')?.classList.remove('car-active');if(!session)return;
  $('lessonCard')?.classList.add('hidden');$('summary')?.classList.remove('hidden');
  retrySnapshot=null;const completed={...session};
  if($('sumCorrect'))$('sumCorrect').textContent=completed.correct;if($('sumWrong'))$('sumWrong').textContent=completed.wrong;if($('sumXp'))$('sumXp').textContent='+'+completed.xp;if($('sumAccuracy'))$('sumAccuracy').textContent=percent(completed.correct,completed.correct+completed.wrong);if($('sumStreak'))$('sumStreak').textContent=state.user.streakDays+' dni';
  const today=state.days[todayKey()]||{correct:0,wrong:0};const done=(today.correct||0)+(today.wrong||0),goal=state.settings.dailyGoal||20;if($('summaryMessage'))$('summaryMessage').textContent=done>=goal?'Dzisiejszy cel został osiągnięty.':'Wykonano '+done+' z '+goal+' zadań dzisiejszego celu.';
  const reviewDates=completed.queue.map(item=>prog(item.wordId).nextReview).filter(Boolean).sort();if($('nextReviewInfo'))$('nextReviewInfo').textContent=reviewDates.length?`Najbliższa powtórka: ${formatDate(reviewDates[0])}.`:'Następna powtórka zostanie ustalona po kolejnej sesji.';
  const previousState=deepClone(state);state.sessions=state.sessions||[];state.sessions.unshift({date:new Date().toISOString(),practice:completed.practice,correct:completed.correct,wrong:completed.wrong,xp:completed.xp,total:completed.queue.length});state.sessions=state.sessions.slice(0,100);state.activeSession=null;if(!save()){state=previousState;session=completed;$('summary')?.classList.add('hidden');$('lessonCard')?.classList.remove('hidden');return;}session=null;renderAll();
}
function formatDate(dateKey){if(dateKey===todayKey())return'dzisiaj';if(dateKey===addDays(1))return'jutro';const [year,month,day]=dateKey.split('-');return `${day}.${month}.${year}`;}

function renderAll(){renderToday();renderReviews();renderProgress();renderBase();}
function renderTopMetrics(){if($('topXp'))$('topXp').textContent=state.user.xp;if($('topStreak'))$('topStreak').textContent=state.user.streakDays;}
function renderToday(){
  renderTopMetrics();
  const tasks=queue(false),dueCount=due().length,today=state.days[todayKey()]||{correct:0,wrong:0},done=(today.correct||0)+(today.wrong||0),goal=state.settings.dailyGoal||20;
  if($('headline'))$('headline').textContent=done>=goal?'Dzisiejszy cel wykonany.':dueCount?`Masz ${dueCount} ${dueCount===1?'powtórkę':'powtórek'} do zrobienia.`:'Gotowy na krótką lekcję?';
  if($('subline'))$('subline').textContent=done>=goal?'Możesz zakończyć naukę albo wybrać dodatkowy tryb.':'Program dobierze zadania do poziomu, zaległych powtórek i ustawionego celu.';
  if($('goalText'))$('goalText').textContent=`${Math.min(done,goal)} z ${goal} zadań`;setProgress($('goalBar'),Math.round(done/Math.max(goal,1)*100));
  if($('queueBadge'))$('queueBadge').textContent=tasks.length+' zadań';if($('queueList'))$('queueList').innerHTML=tasks.slice(0,10).map(itemData=>item(WORDS.find(word=>word.id===itemData.wordId),itemData)).join('')||'<p class="muted">Brak zadań według bieżących ustawień.</p>';
  const resume=$('resumeCard');if(resume){const saved=state.activeSession,valid=saved&&Array.isArray(saved.queue)&&saved.index<=saved.queue.length;resume.classList.toggle('hidden',!valid);if(valid&&$('resumeInfo'))$('resumeInfo').textContent=saved.index===saved.queue.length?`Lekcja ukończona • poprawne: ${saved.correct||0}. Otwórz podsumowanie.`:`Zadanie ${saved.index+1} z ${saved.queue.length} • poprawne: ${saved.correct||0}.`; }
}
function item(word,taskData){if(!word)return'';return `<div class="item"><div><strong>${esc(word.english)}</strong><div class="muted">${esc(word.polish)}</div><div class="minirow"><span class="mini">${esc(word.level)}</span><span class="mini">${esc(word.track)}</span><span class="mini amber">${esc(taskData.kind==='weak'?'do powtórki':taskData.kind==='new'?'nowe':'powtórka')}</span></div></div><span class="badge">${prog(word.id).mastery}%</span></div>`;}
function wordItem(word){const progress=prog(word.id),statusClass=progress.status==='mastered'?'green':progress.status==='weak'?'red':'amber',g=word.grammar||{},grammar=g.partOfSpeech||word.partOfSpeech||'',meaning=Array.isArray(word.meanings)&&word.meanings.length>1?`Inne znaczenie: ${word.meanings.slice(1).map(item=>item.pl||item).join(', ')}`:'',example=word.examples?.[0]?.en&&hasQualityExample(word)?`Przykład: ${word.examples[0].en}`:'',forms=[g.plural&&g.plural!=='—'?`lm. ${g.plural}`:'',g.past?`Past: ${g.past}`:'',g.pastParticiple?`PP: ${g.pastParticiple}`:'',g.typicalPrepositions?`przyimki: ${g.typicalPrepositions}`:'',g.structure?`konstrukcja: ${g.structure}`:''].filter(Boolean).join(' • '),collocations=word.collocations?.length?`Połączenia: ${word.collocations.join(', ')}`:'',mistakes=word.commonMistakes?.length?`Uwaga: ${word.commonMistakes[0]}`:'';return `<div class="item"><div><strong>${esc(word.english)}</strong><div class="muted">${esc(word.polish)}</div><div class="minirow"><span class="mini">${esc(word.level)}</span><span class="mini">${esc(word.track)}</span>${word.specialism?`<span class="mini">${esc(word.specialism)}</span>`:''}${grammar?`<span class="mini">${esc(grammar)}</span>`:''}<span class="mini ${statusClass}">${esc(status(progress.status))}</span></div>${[example,forms,collocations,meaning,mistakes].filter(Boolean).map(text=>`<div class="material-extra">${esc(text)}</div>`).join('')}</div><span class="badge">${progress.mastery}%</span></div>`;}
function renderReviews(){const list=[...due(),...weak()].filter((word,index,array)=>array.findIndex(item=>item.id===word.id)===index).slice(0,60);if($('reviewsList'))$('reviewsList').innerHTML=list.map(wordItem).join('')||'<p class="muted">Brak zaległych powtórek.</p>';}
function renderProgress(){const progresses=WORDS.map(word=>prog(word.id));if($('mastered'))$('mastered').textContent=progresses.filter(progress=>progress.status==='mastered').length;if($('learning'))$('learning').textContent=progresses.filter(progress=>progress.seen>0&&progress.status!=='mastered'&&progress.status!=='weak').length;if($('weak'))$('weak').textContent=progresses.filter(progress=>progress.status==='weak').length;if($('bestStreak'))$('bestStreak').textContent=state.user.bestAnswerStreak;if($('statXp'))$('statXp').textContent=state.user.xp;if($('statLevel'))$('statLevel').textContent='Poziom '+state.user.level;if($('statStreak'))$('statStreak').textContent=state.user.streakDays+' dni';if($('statAcc'))$('statAcc').textContent=percent(state.user.totalCorrect,state.user.totalCorrect+state.user.totalWrong);const mostMistakes=Object.entries(state.mistakes).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([id])=>WORDS.find(word=>word.id===id)).filter(Boolean);if($('mistakes'))$('mistakes').innerHTML=mostMistakes.map(wordItem).join('')||'<p class="muted">Brak błędów.</p>';renderModeStats();renderHistory14();}
function widthClass(value){return'w-'+clamp(Math.round(Number(value)/5)*5,0,100);}
function setProgress(element,value){if(!element)return;for(let width=0;width<=100;width+=5)element.classList.remove('w-'+width);element.classList.add(widthClass(value));element.setAttribute?.('aria-valuenow',String(clamp(Math.round(value),0,100)));}
function renderModeStats(){const labels={word_choice:'wybór',word_write:'pisanie',sentence_translate:'zdania',listening_write:'słuchanie',speaker_repeat:'lektor',speaking:'mówienie',dialogue:'dialog',car_voice:'samochód'};const entries=Object.entries(state.modeStats||{});if($('modeStats'))$('modeStats').innerHTML=entries.length?entries.map(([key,value])=>{const total=(value.correct||0)+(value.wrong||0),accuracy=total?Math.round((value.correct||0)/total*100):0;return `<div><div class="barline"><strong>${esc(labels[key]||key)}</strong><div class="bartrack"><div class="barfill ${widthClass(accuracy)}"></div></div><span class="badge">${accuracy}%</span></div><div class="muted">${total} odpowiedzi, XP: ${value.xp||0}</div></div>`;}).join(''):'<p class="muted">Brak danych z trybów. Zrób jedną sesję.</p>';}
function renderHistory14(){const days=[];for(let index=13;index>=0;index--)days.push(addDays(-index));if($('history14'))$('history14').innerHTML=days.map(day=>{const entry=state.days[day]||{correct:0,wrong:0,xp:0},total=(entry.correct||0)+(entry.wrong||0);return `<div class="daybox"><strong>${day.slice(5)}</strong><span>${total} odp.</span><span>${entry.xp||0} XP</span></div>`;}).join('');}
function renderBase(){if(!$('baseList'))return;const query=normalize($('searchInput')?.value||''),level=$('levelFilter')?.value||'all',track=$('trackFilter')?.value||'all';const filtered=WORDS.filter(word=>(level==='all'||word.level===level)&&(track==='all'||word.track===track)&&(!query||normalize(`${word.english} ${word.polish} ${word.category} ${word.examples?.[0]?.en||''}`).includes(query)));if($('baseCount'))$('baseCount').textContent=filtered.length+' / '+WORDS.length;$('baseList').innerHTML=filtered.slice(0,240).map(wordItem).join('')||'<p class="muted">Nic nie znaleziono.</p>';}
function status(value){return {new:'nowe',review:'w nauce',weak:'do powtórki',mastered:'opanowane'}[value]||value;}

function isCloseEnough(answer,expectedValue){return answerScore(answer,expectedValue).status==='correct';}
function speechApi(){return window.SpeechRecognition||window.webkitSpeechRecognition||null;}
function startSpeechAnswer(){const SpeechRecognition=speechApi(),input=document.querySelector('.answer');if(!input){notify('Brak pola odpowiedzi.','error');return;}if(!SpeechRecognition){$('micStatus')?.classList.remove('hidden');if($('micStatus'))$('micStatus').textContent='Ta przeglądarka nie udostępnia rozpoznawania mowy. Wpisz odpowiedź ręcznie.';return;}try{if(recognition)recognition.abort();recognition=new SpeechRecognition();recognition.lang=state.settings.voiceLang||'en-US';recognition.interimResults=true;recognition.continuous=false;$('micStatus')?.classList.remove('hidden');if($('micStatus'))$('micStatus').textContent='Słucham... powiedz zdanie po angielsku.';recognition.onresult=event=>{let text='';for(let index=event.resultIndex;index<event.results.length;index++)text+=event.results[index][0].transcript+' ';lastSpeechText=text.trim();input.value=lastSpeechText;const box=$('speechTranscript');if(box){box.classList.remove('hidden');box.textContent='Rozpoznano: '+lastSpeechText;}};recognition.onerror=event=>{if($('micStatus'))$('micStatus').textContent='Błąd mikrofonu: '+(event.error||'nieznany')+'. Możesz wpisać odpowiedź ręcznie.';};recognition.onend=()=>{if($('micStatus')?.textContent.startsWith('Słucham'))$('micStatus').textContent=lastSpeechText?'Gotowe. Sprawdź odpowiedź.':'Nie rozpoznano mowy. Spróbuj jeszcze raz albo wpisz ręcznie.';};recognition.start();}catch(error){$('micStatus')?.classList.remove('hidden');if($('micStatus'))$('micStatus').textContent='Nie udało się uruchomić mikrofonu: '+error.message;}}
function isVoiceAllowed(voiceEnabled,force=false){return !!voiceEnabled||!!force;}
function speak(text=null,options={}){const word=curWord();if(!('speechSynthesis'in window)||!isVoiceAllowed(state.settings.voiceEnabled,options.force))return Promise.resolve();const current=curTask(),taskMode=current?.mode||'word_write',message=text||((taskMode==='speaker_repeat'&&state.settings.preferExample!==false)?sentenceEn(word):expected(word,taskMode));if(!message)return Promise.resolve();speechSynthesis.cancel();const voices=speechSynthesis.getVoices(),language=options.lang||state.settings.voiceLang||'en-US',base=language.split('-')[0].toLowerCase(),selected=voices.find(voice=>voice.name===state.settings.voiceName),selectedMatches=selected&&String(selected.lang||'').toLowerCase().startsWith(base),chosen=(selectedMatches?selected:null)||voices.find(voice=>voice.lang===language)||voices.find(voice=>String(voice.lang||'').toLowerCase().startsWith(base)),repeat=clamp(parseInt(options.repeat??state.settings.voiceRepeat)||1,1,4),rate=clamp(parseFloat(options.rate??state.settings.voiceRate)||.9,.5,1.4);return new Promise(resolve=>{let left=repeat;const run=()=>{const utterance=new SpeechSynthesisUtterance(message);utterance.lang=language;utterance.rate=rate;if(chosen)utterance.voice=chosen;utterance.onend=()=>{left--;left>0?run():resolve();};utterance.onerror=()=>resolve();speechSynthesis.speak(utterance);};run();});}

function setCarStatus(text){if($('carStatus'))$('carStatus').textContent=text;}
function clearCarTimer(){if(carAutoTimer){clearTimeout(carAutoTimer);carAutoTimer=null;}}
function stopCarRecognition(){try{if(carRecognition)carRecognition.abort();}catch(_){}carRecognition=null;carCommandMode=false;}
function isCarLessonActive(){return !!(session&&curTask()?.mode==='car_voice'&&!checked&&$('learnScreen')?.classList.contains('active')&&$('lessonCard')?.classList.contains('car-active'));}
function stopCarSession(){stopCarRecognition();clearCarTimer();try{if('speechSynthesis'in window)speechSynthesis.cancel();}catch(_){}pauseSession();}
async function carAskCurrent(){const current=curTask(),word=curWord();if(!current||!word||!isCarLessonActive())return;stopCarRecognition();clearCarTimer();carSilenceRetries=0;setCarStatus('Słuchaj pytania');await speak('Przetłumacz na angielski: '+sentencePl(word),{lang:'pl-PL',repeat:1,rate:.95,force:true});if(!isCarLessonActive())return;setCarStatus('Mów teraz');startCarListening(false);}
async function handleCarNoSpeech(reason='Nie rozpoznano odpowiedzi.'){if(!isCarLessonActive())return;carSilenceRetries++;if(carSilenceRetries<=2){setCarStatus(`Nie usłyszałem. Próba ${carSilenceRetries} z 2.`);await speak('Nie usłyszałem odpowiedzi. Spróbuj jeszcze raz.',{lang:'pl-PL',repeat:1,rate:.95,force:true});if(isCarLessonActive()){setCarStatus('Mów teraz');startCarListening(false);}return;}mark(false,'Brak odpowiedzi',{score:0,status:'wrong',label:'Źle',issues:[{code:'silence',message:reason}],expected:expected(curWord(),'car_voice')});}
function startCarListening(commandOnly=false){const SpeechRecognition=speechApi(),input=document.querySelector('.answer');if(!isCarLessonActive())return;if(!SpeechRecognition){setCarStatus('Brak rozpoznawania mowy w tej przeglądarce');return;}stopCarRecognition();carCommandMode=commandOnly;lastSpeechText='';let failed=false;try{carRecognition=new SpeechRecognition();carRecognition.lang=commandOnly?'pl-PL':(state.settings.voiceLang||'en-US');carRecognition.interimResults=true;carRecognition.continuous=false;carRecognition.onresult=event=>{let text='';for(let index=event.resultIndex;index<event.results.length;index++)text+=event.results[index][0].transcript+' ';lastSpeechText=text.trim();if(input)input.value=lastSpeechText;const box=$('speechTranscript');if(box){box.classList.remove('hidden');box.textContent='Rozpoznano: '+lastSpeechText;}};carRecognition.onerror=event=>{if(!isCarLessonActive())return;failed=true;const code=event.error||'błąd';if(['no-speech','audio-capture'].includes(code))handleCarNoSpeech('Mikrofon nie zarejestrował odpowiedzi.');else setCarStatus('Mikrofon: '+code+'. Użyj przycisku „Mów teraz” albo „Powtórz”.');};carRecognition.onend=()=>{if(!isCarLessonActive()||failed)return;const text=(lastSpeechText||'').trim();if(!text){handleCarNoSpeech();return;}carSilenceRetries=0;if(handleVoiceCommand(text))return;const current=curTask(),word=curWord();if(!current||!word||!isCarLessonActive())return;const result=scoreTaskAnswer(text,word,current.mode);mark(result.status==='correct',text,result);};carRecognition.start();}catch(error){setCarStatus('Nie udało się uruchomić mikrofonu: '+error.message);}}
function handleVoiceCommand(text){const value=normalize(text);if(!value)return false;const has=(...phrases)=>phrases.some(phrase=>value.includes(phrase));if(has('powtorz','powtor','potworz','repeat','again')){handleCarCommand('repeat');return true;}if(has('dalej','dale','daly','next','skip')){handleCarCommand('skip');return true;}if(has('wolniej','slow','slower')){state.settings.voiceRate=clamp((parseFloat(state.settings.voiceRate)||.9)-.1,.5,1.4);syncSettings();save();handleCarCommand('repeat');return true;}if(has('zatrzymaj','stop','pauza','pause')){handleCarCommand('stop');return true;}if(has('pokaz odpowiedz','pokaż odpowiedź','nie wiem','no idea','show answer')){if(session&&!checked)mark(false,'Nie wiem');return true;}return false;}
function handleCarCommand(command){if(command==='listen'){setCarStatus('Mów teraz');startCarListening(false);return;}if(command==='repeat'){carAskCurrent();return;}if(command==='slower'){state.settings.voiceRate=clamp((parseFloat(state.settings.voiceRate)||.9)-.1,.5,1.4);syncSettings();save();carAskCurrent();return;}if(command==='skip'){if(!session)return;if(checked)nextCard();else mark(false,'Pominięto',{score:0,status:'wrong',label:'Źle',issues:[{code:'skip',message:'Zadanie zostało pominięte.'}],expected:expected(curWord(),curTask()?.mode)});return;}if(command==='stop')stopCarSession();}
async function carAfterMark(ok,word,answer,result=null){stopCarRecognition();clearCarTimer();result=result||scoreTaskAnswer(answer,word,'car_voice');const partial=result.status==='partial';setCarStatus(ok?'Dobrze':partial?'Prawie dobrze':'Do poprawy');const expectedAnswer=result.expected||expected(word,'car_voice');await speak(ok?'Dobrze.':partial?'Prawie dobrze. Posłuchaj poprawnej odpowiedzi.':'Do poprawy. Posłuchaj poprawnej odpowiedzi.',{lang:'pl-PL',repeat:1,rate:.95,force:true});await speak(expectedAnswer,{lang:state.settings.voiceLang||'en-US',repeat:1,rate:Math.max(.65,(parseFloat(state.settings.voiceRate)||.9)-.05),force:true});if(!session||curTask()?.mode!=='car_voice'||!checked||!$('learnScreen')?.classList.contains('active'))return;if(state.settings.carAutoNext!==false){const pause=clamp(parseInt(state.settings.carPause)||3,1,8)*1000;carAutoTimer=setTimeout(()=>{if(session&&checked&&$('learnScreen')?.classList.contains('active'))nextCard();},pause);}}

async function hardRefresh(){if(!await askConfirm('Odświeżyć pliki aplikacji?','Postęp pozostanie zachowany. Program usunie wyłącznie pliki z pamięci podręcznej i pobierze aktualną wersję.','Odśwież'))return;const cleared=await clearAppCaches();if(!cleared)return;try{if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.getRegistration();if(registration)await registration.update();}}catch(error){console.warn('Aktualizacja Service Workera:',error);}location.replace(location.pathname+'?v='+APP_VERSION+'&reload='+Date.now());}
function exportData(){const box=$('dataBox');if(!box)return;box.value=JSON.stringify(state,null,2);$('dataStatus').textContent='Kopia jest gotowa. Zapisz zawartość pola w bezpiecznym miejscu.';box.focus();box.select?.();notify('Dane eksportu zostały przygotowane.','success');}
function importData(){const previous=state;try{const imported=validateImportedState($('dataBox')?.value||'');state=imported;if(!save()){state=previous;return;}syncSettings();renderAll();$('dataStatus').textContent='Import zakończony poprawnie.';notify('Import zakończony.','success');}catch(error){console.error('Import:',error);$('dataStatus').textContent=error.message;notify(error.message,'error');}}
async function resetProgress(){const confirmed=await askConfirm('Usunąć cały postęp?','Zostaną usunięte: postęp, statystyki, ustawienia, historia sesji i dane starszych wersji. Operacji nie można cofnąć.','Usuń wszystko');if(!confirmed)return;for(const key of [STORAGE_KEY,...OLD_KEYS])safeRemove(key);try{for(let index=localStorage.length-1;index>=0;index--){const key=localStorage.key(index);if(key&&(/angielski|english.*trainer/i.test(key)))safeRemove(key);}}catch(error){console.warn('Czyszczenie starszych kluczy:',error);}state=defState();session=null;save({silent:true});syncSettings();renderAll();show('today');notify('Cały postęp został usunięty.','success');setTimeout(openOnboarding,250);}

function askConfirm(title,message,confirmLabel='Potwierdź'){
  const dialog=$('confirmDialog');if(!dialog||typeof dialog.showModal!=='function')return Promise.resolve(true);
  $('confirmTitle').textContent=title;$('confirmMessage').textContent=message;$('confirmOk').textContent=confirmLabel;
  return new Promise(resolve=>{const close=()=>{dialog.removeEventListener('close',close);resolve(dialog.returnValue==='ok');};dialog.addEventListener('close',close);dialog.showModal();});
}
function showCarWarning(){
  const dialog=$('carWarningDialog');if(!dialog||typeof dialog.showModal!=='function')return Promise.resolve(true);
  $('carWarningDismiss').checked=false;
  return new Promise(resolve=>{const close=()=>{dialog.removeEventListener('close',close);const allowed=dialog.returnValue==='ok';if(allowed&&$('carWarningDismiss').checked){state.settings.carWarningDismissed=true;save();}resolve(allowed);};dialog.addEventListener('close',close);dialog.showModal();});
}
function openOnboarding(){onboardingStep=1;fillOnboardingValues();renderOnboarding();const dialog=$('onboardingDialog');if(dialog&&typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();}
function fillOnboardingValues(){setValue('onboardingLevel',state.settings.defaultLevel==='all'?(levels()[0]||'A1'):state.settings.defaultLevel);setValue('onboardingTrack',state.settings.defaultTrack||'all');setValue('onboardingGoal',state.settings.dailyGoal||20);}
function renderOnboarding(){document.querySelectorAll('.onboarding-step').forEach(section=>section.classList.toggle('hidden',Number(section.dataset.step)!==onboardingStep));setProgress($('onboardingBar'),onboardingStep*20);$('onboardingBack')?.classList.toggle('hidden',onboardingStep===1);if($('onboardingNext'))$('onboardingNext').textContent=onboardingStep===5?'Rozpocznij pierwszą lekcję':'Dalej';}
function nextOnboardingStep(){if(onboardingStep<5){onboardingStep++;renderOnboarding();return;}state.settings.defaultLevel=$('onboardingLevel')?.value||'A1';state.settings.defaultTrack=$('onboardingTrack')?.value||'all';state.settings.dailyGoal=clamp(parseInt($('onboardingGoal')?.value)||20,5,100);state.settings.onboardingComplete=true;if(!save())return;syncSettings();$('onboardingDialog')?.close?.();renderAll();startSmart();}
function previousOnboardingStep(){if(onboardingStep>1){onboardingStep--;renderOnboarding();}}

function shuffle(array){const result=[...array];for(let index=result.length-1;index>0;index--){const swap=Math.floor(Math.random()*(index+1));[result[index],result[swap]]=[result[swap],result[index]];}return result;}

window.__trainerTests={normalize,todayKey,addDays,isCloseEnough,answerScore,bestAnswerScore,migrateProgress,advanceProgress,migrate,validateImportedState,isVoiceAllowed,acceptedAnswers,scoreTaskAnswer,wordsOf,dl,WORDS,WORD_ALIASES,practiceQueue,modeLabel,expected,handleVoiceCommand,matchesStudyFilters,isVocabularyItem,isSentenceItem,practiceBase,due,weak,activeWords,getState:()=>state,applyAppearance,DIALOGUE_SCENES,hasQualityExample,sentenceEn,uniqueTasks,shuffle,diffMarkup,preferNotRecent,orderedReviews,startSession,mark,retryCurrent,getSession:()=>session};
document.addEventListener('DOMContentLoaded',()=>{try{boot();}catch(error){console.error(error);err(error.message||error);}});
