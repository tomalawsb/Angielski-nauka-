
'use strict';
const APP_VERSION='5.7.1';
const WORDS=window.TRAINER_WORDS||[];
const DIALOGUE_SCENES=window.DIALOGUE_SCENES||{};
const WORD_ALIASES=window.TRAINER_WORD_ALIASES||{};
const Core=window.LearningCore;
if(!Core)throw new Error('Brak modułu learning-core.js');
const {normalize,wordsOf,dl,answerScore,bestAnswerScore,migrateProgress,advanceProgress}=Core;

const STORAGE_KEY='angielski_daily_trainer_state_v53';
const OLD_KEYS=['angielski_daily_trainer_state_v5','englishPwaProgressV4','angielski-pwa-progress-v4','angielskiPwaProgress'];
const DAY=86400000;
let state=null, session=null, selectedChoice=null, checked=false, recognition=null, carRecognition=null, lastSpeechText="", carAutoTimer=null, carCommandMode=false, carSilenceRetries=0;
const $=id=>document.getElementById(id);
function err(msg){const b=$('errorBox'); if(b){b.style.display='block'; b.textContent=String(msg);}}
window.addEventListener('error',e=>err('Błąd JS: '+(e.message||e.error||e)));
window.addEventListener('unhandledrejection',e=>err('Błąd promise: '+(e.reason?.message||e.reason||e)));
function safeGet(k){try{return localStorage.getItem(k)}catch(_ ){return null}}
function safeSet(k,v){try{localStorage.setItem(k,v)}catch(_ ){}}
function safeRemove(k){try{localStorage.removeItem(k)}catch(_ ){}}
function todayKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function addDays(n,base=new Date()){const d=new Date(base);d.setDate(d.getDate()+n);return todayKey(d);}

function defState(){return {version:APP_VERSION,createdAt:new Date().toISOString(),settings:{dailyNew:7,dailyReview:18,defaultLevel:'A1',defaultTrack:'all',voiceEnabled:true,voiceLang:'en-US',voiceName:'',voiceRate:.9,voiceRepeat:1,autoSpeak:false,preferExample:true,carPause:3,carAutoNext:true,reminderEnabled:false,reminderTime:'19:00',reminderLastDay:null},user:{xp:0,level:1,streakDays:0,lastActiveDay:null,totalCorrect:0,totalWrong:0,bestAnswerStreak:0,currentAnswerStreak:0},items:{},days:{},mistakes:{},modeStats:{},sessions:[]};}
function mergeProgress(a={},b={}){
  const days=[...(a.successDays||[]),...(b.successDays||[])];
  return migrateProgress({
    ...a,...b,
    seen:Math.max(Number(a.seen)||0,Number(b.seen)||0),
    correct:Math.max(Number(a.correct)||0,Number(b.correct)||0),
    wrong:Math.max(Number(a.wrong)||0,Number(b.wrong)||0),
    streak:Math.max(Number(a.streak)||0,Number(b.streak)||0),
    lapses:Math.max(Number(a.lapses)||0,Number(b.lapses)||0),
    intervalIndex:Math.max(Number(a.intervalIndex)||0,Number(b.intervalIndex)||0),
    successDays:days,
    lastAnswer:[a.lastAnswer,b.lastAnswer].filter(Boolean).sort().at(-1)||null,
    lastSuccessDay:[a.lastSuccessDay,b.lastSuccessDay].filter(Boolean).sort().at(-1)||null,
    nextReview:[a.nextReview,b.nextReview].filter(Boolean).sort()[0]||null
  },todayKey());
}
function migrate(s){
  const f=defState(); if(!s||typeof s!=='object')return f;
  const sourceItems=s.items||s.wordProgress||{};
  const items={};
  for(const [id,progress] of Object.entries(sourceItems)){
    const targetId=WORD_ALIASES[id]||id;
    items[targetId]=mergeProgress(items[targetId],progress);
  }
  return {...f,...s,version:APP_VERSION,settings:{...f.settings,...(s.settings||{})},user:{...f.user,...(s.user||{})},items,days:s.days||s.daily||{},mistakes:s.mistakes||{},modeStats:s.modeStats||{},sessions:Array.isArray(s.sessions)?s.sessions:[]};
}
function loadState(){for(const k of [STORAGE_KEY,...OLD_KEYS]){const raw=safeGet(k); if(raw){try{return migrate(JSON.parse(raw));}catch(_ ){}}} return defState();}
function save(){safeSet(STORAGE_KEY,JSON.stringify(state));}
async function clearAppCaches(){
  try{if('caches'in window){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('english-trainer-')).map(k=>caches.delete(k)));}}catch(_ ){}
}
async function registerServiceWorker(){
  if(!('serviceWorker'in navigator)||!/^https?:$/.test(location.protocol))return;
  try{return await navigator.serviceWorker.register('./service-worker.js?v='+APP_VERSION,{scope:'./'});}catch(e){console.warn('Service Worker:',e);return null;}
}
async function configureReminders(askPermission=false){
  let registration=null;
  try{registration=('serviceWorker'in navigator)?await navigator.serviceWorker.getRegistration():null;}catch(_ ){}
  if(!state?.settings?.reminderEnabled){
    try{if(registration?.periodicSync)await registration.periodicSync.unregister('daily-learning-reminder');}catch(_ ){}
    return;
  }
  if(!('Notification'in window))return;
  let permission=Notification.permission;
  if(permission==='default'&&askPermission)permission=await Notification.requestPermission();
  if(permission!=='granted'){
    if(askPermission){state.settings.reminderEnabled=false;syncSettings();save();alert('Przeglądarka nie zezwoliła na powiadomienia.');}
    return;
  }
  try{if(registration?.periodicSync)await registration.periodicSync.register('daily-learning-reminder',{minInterval:24*60*60*1000});}
  catch(e){console.warn('Przypomnienia okresowe:',e);}
}
async function showLearningReminder(){
  if(!state.settings.reminderEnabled||!('Notification'in window)||Notification.permission!=='granted')return;
  const title='Czas na angielski';
  const options={body:'Masz krótką sesję lub powtórki do zrobienia.',icon:'./icon-192.png',badge:'./icon-192.png',tag:'daily-learning-reminder'};
  try{
    const registration=('serviceWorker'in navigator)?await navigator.serviceWorker.getRegistration():null;
    if(registration)await registration.showNotification(title,options);else new Notification(title,options);
  }catch(e){console.warn('Powiadomienie:',e);}
}
function checkReminderTime(){
  if(!state?.settings?.reminderEnabled)return;
  const now=new Date(),day=todayKey(now),time=state.settings.reminderTime||'19:00';
  const current=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  if(current>=time&&state.settings.reminderLastDay!==day){state.settings.reminderLastDay=day;save();showLearningReminder();}
}
function startReminderClock(){
  if(!('Notification'in window))return;
  checkReminderTime();
  setInterval(checkReminderTime,60000);
}
function levels(){return [...new Set(WORDS.map(w=>w.level).filter(Boolean))].sort((a,b)=>['A1','A2','B1','B2','C1','C2'].indexOf(a)-['A1','A2','B1','B2','C1','C2'].indexOf(b));}
function tracks(){return [...new Set(WORDS.map(w=>w.track).filter(Boolean))].sort();}
function fillSelect(id,opts){const el=$(id); if(el)el.innerHTML=opts.map(o=>`<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('');}
function boot(){state=loadState();bind();setupFilters();setupVoices();syncSettings();renderAll();show('today');registerServiceWorker().then(()=>configureReminders(false));startReminderClock();}
function bind(){document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.nav)));document.querySelectorAll('[data-practice]').forEach(b=>b.addEventListener('click',()=>startPractice(b.dataset.practice)));
$('startBtn')?.addEventListener('click',startSmart);$('reviewBtn')?.addEventListener('click',startReviews);$('checkBtn')?.addEventListener('click',checkAnswer);$('micBtn')?.addEventListener('click',startSpeechAnswer);$('nextBtn')?.addEventListener('click',nextCard);$('dontKnowBtn')?.addEventListener('click',()=>mark(false,'Nie wiem'));$('speakBtn')?.addEventListener('click',speak);$('refreshBtn')?.addEventListener('click',hardRefresh);
['searchInput','levelFilter','trackFilter'].forEach(id=>$(id)?.addEventListener('input',renderBase));['levelFilter','trackFilter'].forEach(id=>$(id)?.addEventListener('change',renderBase));
['dailyNew','dailyReview','defaultLevel','defaultTrack','voiceEnabled','voiceLang','voiceName','voiceRate','voiceRepeat','autoSpeak','preferExample','carPause','carAutoNext','reminderTime'].forEach(id=>$(id)?.addEventListener('change',saveSettings));
$('reminderEnabled')?.addEventListener('change',async()=>{saveSettings();await configureReminders(true);});
$('exportBtn')?.addEventListener('click',()=>{$('dataBox').value=JSON.stringify(state,null,2)});$('importBtn')?.addEventListener('click',importData);$('resetBtn')?.addEventListener('click',resetProgress);
document.addEventListener('click',e=>{const cmd=e.target.closest('[data-car]'); if(cmd){handleCarCommand(cmd.dataset.car);return;} const c=e.target.closest('.choice'); if(!c||checked)return; document.querySelectorAll('.choice').forEach(x=>x.classList.remove('selected')); c.classList.add('selected'); selectedChoice=c.dataset.choice;});
document.addEventListener('keydown',e=>{if(!session||e.key!=='Enter')return; if(!$('learnScreen').classList.contains('active'))return; const tag=e.target?.tagName?.toLowerCase(); if(tag==='textarea')return; e.preventDefault(); if(!$('nextBtn').classList.contains('hidden'))nextCard(); else checkAnswer();});
if('speechSynthesis'in window)speechSynthesis.onvoiceschanged=setupVoices;
}
function setupFilters(){fillSelect('levelFilter',[['all','Wszystkie poziomy'],...levels().map(x=>[x,x])]);fillSelect('trackFilter',[['all','Wszystkie ścieżki'],...tracks().map(x=>[x,x])]);fillSelect('defaultLevel',[['all','Wszystkie poziomy'],...levels().map(x=>[x,x])]);fillSelect('defaultTrack',[['all','Wszystkie ścieżki'],...tracks().map(x=>[x,x])]);fillSelect('voiceLang',[['en-US','Angielski USA'],['en-GB','Angielski UK'],['en-AU','Angielski Australia'],['en-CA','Angielski Kanada']]);}
function setupVoices(){const sel=$('voiceName');if(!sel)return;const vs=('speechSynthesis'in window)?speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang)):[];const cur=state?.settings?.voiceName||'';sel.innerHTML='<option value="">Domyślny głos</option>'+vs.map(v=>`<option value="${esc(v.name)}">${esc(v.name)} — ${esc(v.lang)}</option>`).join('');sel.value=[...sel.options].some(o=>o.value===cur)?cur:'';}
function syncSettings(){$('dailyNew').value=state.settings.dailyNew;$('dailyReview').value=state.settings.dailyReview;$('defaultLevel').value=state.settings.defaultLevel||'all';$('defaultTrack').value=state.settings.defaultTrack||'all';$('voiceEnabled').checked=!!state.settings.voiceEnabled;$('voiceLang').value=state.settings.voiceLang||'en-US';$('voiceName').value=state.settings.voiceName||'';$('voiceRate').value=state.settings.voiceRate??.9;$('voiceRepeat').value=state.settings.voiceRepeat||1;$('autoSpeak').checked=!!state.settings.autoSpeak;$('preferExample').checked=state.settings.preferExample!==false;$('carPause').value=state.settings.carPause||3;$('carAutoNext').checked=state.settings.carAutoNext!==false;$('reminderEnabled').checked=!!state.settings.reminderEnabled;$('reminderTime').value=state.settings.reminderTime||'19:00';}
function saveSettings(){state.settings.dailyNew=clamp(parseInt($('dailyNew').value)||7,1,50);state.settings.dailyReview=clamp(parseInt($('dailyReview').value)||18,1,100);state.settings.defaultLevel=$('defaultLevel').value;state.settings.defaultTrack=$('defaultTrack').value;state.settings.voiceEnabled=$('voiceEnabled').checked;state.settings.voiceLang=$('voiceLang').value;state.settings.voiceName=$('voiceName').value;state.settings.voiceRate=clamp(parseFloat($('voiceRate').value)||.9,.5,1.4);state.settings.voiceRepeat=clamp(parseInt($('voiceRepeat').value)||1,1,4);state.settings.autoSpeak=$('autoSpeak').checked;state.settings.preferExample=$('preferExample').checked;state.settings.carPause=clamp(parseInt($('carPause').value)||3,1,8);state.settings.carAutoNext=$('carAutoNext').checked;state.settings.reminderEnabled=$('reminderEnabled').checked;state.settings.reminderTime=$('reminderTime').value||'19:00';save();renderAll();}
function show(name){if(name!=='learn'){stopCarRecognition();clearCarTimer();try{if('speechSynthesis'in window)speechSynthesis.cancel();}catch(_ ){}}document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.nav===name));const s=$(name+'Screen');if(s){s.classList.add('active');$('title').textContent=s.dataset.title||'Angielski';} renderAll();}
function prog(id){
  const targetId=WORD_ALIASES[id]||id;
  state.items[targetId]=migrateProgress(state.items[targetId]||{},todayKey());
  return state.items[targetId];
}
function due(){const t=todayKey();return WORDS.filter(w=>{const p=prog(w.id);return p.nextReview&&p.nextReview<=t;});}
function weak(){return WORDS.filter(w=>prog(w.id).status==='weak').sort((a,b)=>prog(b.id).wrong-prog(a.id).wrong);}
function fresh(){return WORDS.filter(w=>{const p=prog(w.id); if(p.seen>0)return false; if(state.settings.defaultLevel!=='all'&&w.level!==state.settings.defaultLevel)return false; if(state.settings.defaultTrack!=='all'&&w.track!==state.settings.defaultTrack)return false; return true;});}
function uniqueTasks(tasks){
  const seen=new Set();
  return tasks.filter(t=>{const w=WORDS.find(x=>x.id===t.wordId);if(!w)return false;const key=normalize(w.english+'|'+w.polish);if(seen.has(key))return false;seen.add(key);return true;});
}
function queue(reviewOnly=false){
  const reviews=due().slice(0,state.settings.dailyReview).map(w=>task(w,'review'));
  if(reviewOnly)return uniqueTasks(reviews);
  const dueIds=new Set(reviews.map(t=>t.wordId));
  const weakTasks=weak().filter(w=>!dueIds.has(w.id)).slice(0,5).map(w=>task(w,'weak'));
  const newTasks=fresh().slice(0,state.settings.dailyNew).map(w=>task(w,'new'));
  return uniqueTasks([...reviews,...weakTasks,...newTasks]);
}
function task(w,k,m=null){return {wordId:w.id,kind:k,mode:m||mode(w,k)};}
function mode(w,k){const p=prog(w.id); if(k==='new'||p.seen===0)return 'word_choice'; if(p.streak>=2&&sentenceEn(w))return 'sentence_translate'; return p.seen%3===0?'word_write':'en_pl';}
function activeWords(){
  const seen=new Set();
  return WORDS.filter(w=>{
    if((state.settings.defaultLevel!=='all'&&w.level!==state.settings.defaultLevel)||(state.settings.defaultTrack!=='all'&&w.track!==state.settings.defaultTrack))return false;
    const key=normalize(w.english+'|'+w.polish);if(seen.has(key))return false;seen.add(key);return true;
  });
}
function hasQualityExample(w){
  const en=String(w.examples?.[0]?.en||'').trim();
  const pl=String(w.examples?.[0]?.pl||'').trim();
  if(!en||!pl||en.split(/\s+/).length<4)return false;
  if(/^this word is useful\b/i.test(en))return false;
  if(/^i need to\b/i.test(en)&&en.split(/\s+/).length<=7)return false;
  return true;
}
function sentenceEn(w){return hasQualityExample(w)?w.examples[0].en:w.english;}
function sentencePl(w){return hasQualityExample(w)?w.examples[0].pl:w.polish;}
function practiceQueue(kind){
  let base=queue(false);
  if(!base.length)base=activeWords().slice(0,state.settings.dailyNew+state.settings.dailyReview).map(w=>task(w,'new'));
  if(kind==='vocab')return base.map(t=>({...t,mode:t.kind==='new'?'word_choice':'word_write'}));
  if(kind==='sentences')return base.filter(t=>sentenceEn(WORDS.find(w=>w.id===t.wordId)).includes(' ')).map(t=>({...t,mode:'sentence_translate'}));
  if(kind==='writing')return base.map(t=>({...t,mode:'word_write'}));
  if(kind==='listening')return base.map(t=>({...t,mode:'listening_write'}));
  if(kind==='lector')return base.map(t=>({...t,mode:'speaker_repeat'}));
  if(kind==='speaking')return base.filter(t=>sentenceEn(WORDS.find(w=>w.id===t.wordId)).includes(' ')).map(t=>({...t,mode:'speaking'}));
  if(kind==='car'){
    const carBase=activeWords().filter(w=>sentenceEn(w).includes(' '));
    const seen=new Set();
    const mixed=[...base.map(t=>WORDS.find(w=>w.id===t.wordId)).filter(Boolean),...carBase].filter(w=>{const key=normalize(sentencePl(w)+'|'+sentenceEn(w));if(seen.has(key))return false;seen.add(key);return true;});
    return mixed.slice(0,Math.max(8,state.settings.dailyNew+state.settings.dailyReview)).map(w=>task(w,prog(w.id).seen?'review':'new','car_voice'));
  }
  if(kind==='dialogues'){
    const conversationOrder=new Map();
    let nextConversation=0;
    for(const scene of Object.values(DIALOGUE_SCENES))if(!conversationOrder.has(scene.conversation))conversationOrder.set(scene.conversation,nextConversation++);
    const scenes=WORDS
      .filter(w=>DIALOGUE_SCENES[w.id]&&(state.settings.defaultLevel==='all'||w.level===state.settings.defaultLevel))
      .sort((a,b)=>{
        const first=DIALOGUE_SCENES[a.id],second=DIALOGUE_SCENES[b.id];
        return (conversationOrder.get(first.conversation)??999)-(conversationOrder.get(second.conversation)??999)
          || (first.turn||1)-(second.turn||1)
          || a.id.localeCompare(b.id);
      });
    const target=Math.max(8,state.settings.dailyNew+state.settings.dailyReview);
    const selected=[];
    for(let index=0;index<scenes.length;){
      const conversation=DIALOGUE_SCENES[scenes[index].id].conversation;
      const group=[];
      while(index<scenes.length&&DIALOGUE_SCENES[scenes[index].id].conversation===conversation)group.push(scenes[index++]);
      if(selected.length>=target)break;
      selected.push(...group);
    }
    return selected.map(w=>task(w,prog(w.id).seen?'review':'new','dialogue'));
  }
  if(kind==='test')return base.map((t,i)=>({...t,mode:['word_choice','word_write','sentence_translate','listening_write','speaking'][i%5]}));
  return base;
}
function startPractice(kind){const q=practiceQueue(kind); if(!q.length){alert('Brak zadań dla tego trybu przy obecnym poziomie/ścieżce.');return;} startSession(q,kind);}
function startSmart(){const q=practiceQueue('test'); if(!q.length){alert('Brak zadań. Zmień poziom/ścieżkę albo zwiększ limit nowych słówek.');return;} startSession(q,'test');}
function startReviews(){const q=queue(true); if(!q.length){alert('Nie masz zaległych powtórek.');return;} startSession(q,'reviews');}
function startSession(q,practice='mixed'){session={queue:q,index:0,correct:0,wrong:0,xp:0,practice};checked=false;selectedChoice=null;$('emptyLesson').classList.add('hidden');$('summary').classList.add('hidden');$('lessonCard').classList.remove('hidden');show('learn');renderLesson();}
function curTask(){return session?.queue?.[session.index]||null;} function curWord(){const t=curTask();return t?WORDS.find(w=>w.id===t.wordId):null;}
function modeLabel(m){return {word_choice:'wybór słówka',word_write:'pisanie słówka',sentence_translate:'zdania',listening_write:'słuchanie',speaker_repeat:'lektor',speaking:'rozpoznawanie mowy',dialogue:'scenka dialogowa',car_voice:'samochód',en_pl:'angielski → polski'}[m]||m;}
function dialogueScene(w){return w?DIALOGUE_SCENES[w.id]||null:null;}
function expected(w,m){
  if(m==='dialogue'){const scene=dialogueScene(w);if(scene?.accepted?.length)return scene.accepted[0];}
  return (m==='en_pl'||m==='word_choice')?w.polish:(m==='sentence_translate'||m==='listening_write'||m==='speaker_repeat'||m==='speaking'||m==='car_voice')?sentenceEn(w):w.english;
}
function acceptedAnswers(w,m){
  const answers=[expected(w,m)];
  const scene=m==='dialogue'?dialogueScene(w):null;
  if(scene?.accepted)answers.push(...scene.accepted);
  if(Array.isArray(w?.acceptedAnswers))answers.push(...w.acceptedAnswers);
  if(w?.acceptedAnswers&&Array.isArray(w.acceptedAnswers[m]))answers.push(...w.acceptedAnswers[m]);
  return [...new Set(answers.filter(Boolean).map(String))];
}
function scoreTaskAnswer(answer,w,m){return bestAnswerScore(answer,acceptedAnswers(w,m));}
function promptFor(w,m){
  if(m==='word_choice'||m==='en_pl')return {label:m==='word_choice'?'Wybierz tłumaczenie':'Przetłumacz na polski',prompt:w.english,hint:'Wybierz lub wpisz polskie znaczenie.'};
  if(m==='sentence_translate')return {label:'Przetłumacz całe zdanie na angielski',prompt:sentencePl(w),hint:'Liczy się znaczenie, kompletność i prawidłowy szyk.'};
  if(m==='listening_write')return {label:'Posłuchaj i wpisz po angielsku',prompt:'Kliknij „Odsłuchaj” i wpisz to, co usłyszysz.',hint:'Ćwiczysz rozumienie ze słuchu i dokładny zapis.'};
  if(m==='speaker_repeat')return {label:'Z lektorem',prompt:sentencePl(w),hint:'Odsłuchaj, powtórz na głos i wpisz po angielsku.'};
  if(m==='speaking')return {label:'Rozpoznawanie odpowiedzi głosowej',prompt:sentencePl(w),hint:'Aplikacja sprawdza tekst rozpoznany przez przeglądarkę, nie jakość wymowy.'};
  if(m==='dialogue'){
    const scene=dialogueScene(w);
    return {label:`${scene?.conversation||'Scenka'} • krok ${scene?.turn||1}/${scene?.total||1}`,prompt:scene?.promptPl||sentencePl(w),hint:`${scene?.role||'Rozmowa'} — ${scene?.context||'Odpowiedz naturalnym pełnym zdaniem po angielsku.'}`};
  }
  if(m==='car_voice')return {label:'Tryb samochodowy',prompt:sentencePl(w),hint:'Słuchaj i odpowiadaj bez pisania. Komendy podczas angielskiego nasłuchu: next, repeat, slower, stop.'};
  return {label:'Przetłumacz na angielski',prompt:w.polish,hint:'Wpisz odpowiedź po angielsku.'};
}
function renderLesson(){const t=curTask(),w=curWord(); if(!t||!w)return finish(); checked=false; selectedChoice=null;clearCarTimer();$('lessonCard').classList.toggle('car-active',t.mode==='car_voice');$('lessonMode').textContent=(t.kind==='new'?'nowe':t.kind==='weak'?'słabe':'powtórka')+' • '+modeLabel(t.mode);$('lessonProgress').textContent=`${session.index+1} / ${session.queue.length}`;$('bar').style.width=`${Math.round(session.index/session.queue.length*100)}%`;$('feedback').className='feedback hidden';$('feedback').textContent='';$('checkBtn').classList.remove('hidden');$('nextBtn').classList.add('hidden');$('dontKnowBtn').disabled=false;$('micBtn')?.classList.toggle('hidden',!['speaking'].includes(t.mode));$('micStatus')?.classList.add('hidden');lastSpeechText=''; const p=promptFor(w,t.mode);$('promptLabel').textContent=p.label;$('prompt').textContent=p.prompt;$('hint').textContent=`${w.level} • ${w.track} • ${w.category} — ${p.hint}`;$('answerArea').innerHTML=answerHtml(w,t.mode);if(t.mode==='car_voice'){setCarStatus('Przygotowanie...');setTimeout(()=>carAskCurrent(),350);return;}setTimeout(()=>document.querySelector('.answer')?.focus(),60);if(state.settings.voiceEnabled&&state.settings.autoSpeak&&['listening_write','speaker_repeat','speaking'].includes(t.mode))setTimeout(()=>speak(),250);}
function answerHtml(w,m){if(m==='car_voice')return `<div class="car-panel"><div id="carStatus" class="car-status">Start trybu samochodowego</div><div class="car-prompt">${esc(sentencePl(w))}</div><input class="answer hidden" autocomplete="off"><div id="speechTranscript" class="transcript hidden"></div><div class="car-command-grid"><button class="car-command primary-car" data-car="listen">Mów teraz</button><button class="car-command" data-car="repeat">Powtórz</button><button class="car-command" data-car="skip">Dalej</button><button class="car-command" data-car="slower">Wolniej</button><button class="car-command stop-car" data-car="stop">Stop</button></div><div class="car-tip">Komendy podczas angielskiego nasłuchu: next, repeat, slower, stop, show answer. Po dwóch nieudanych próbach aplikacja poda poprawną odpowiedź i przejdzie dalej.</div></div>`; if(m==='speaking')return `<div class="micline"><input class="answer" autocomplete="off" placeholder="Tu pojawi się rozpoznana mowa — możesz poprawić ręcznie"></div><div id="speechTranscript" class="transcript hidden"></div>`; if(m==='word_choice'){const ch=shuffle([w,...shuffle(WORDS.filter(x=>x.id!==w.id&&x.level===w.level)).slice(0,3)]);return `<div class="choices">${ch.map(c=>`<button class="choice" data-choice="${esc(c.polish)}">${esc(c.polish)}</button>`).join('')}</div>`;} return `<input class="answer" autocomplete="off" placeholder="Wpisz odpowiedź">`;}
function checkAnswer(){if(checked)return;const w=curWord(),t=curTask();if(!w||!t)return;const ans=t.mode==='word_choice'?(selectedChoice||''):(document.querySelector('.answer')?.value||'');if(!ans.trim()){alert('Najpierw wpisz albo wybierz odpowiedź.');return;}const result=scoreTaskAnswer(ans,w,t.mode);mark(result.status==='correct',ans,result);}
function mark(ok,ans,result=null){
  if(checked)return;
  checked=true;
  const w=curWord(),t=curTask();if(!w||!t)return;
  result=result||scoreTaskAnswer(ans,w,t.mode);
  const partial=result.status==='partial';
  const progressOk=ok;
  updateProg(w,progressOk);
  session[progressOk?'correct':'wrong']++;
  const xp=progressOk?(t.kind==='new'?12:8):(partial?4:2);
  session.xp+=xp;state.user.xp+=xp;state.user.level=1+Math.floor(state.user.xp/250);
  const day=todayKey();if(!state.days[day])state.days[day]={correct:0,wrong:0,xp:0};
  state.days[day][progressOk?'correct':'wrong']++;state.days[day].xp+=xp;updateStreak(day);
  const modeKey=t.mode||session.practice||'mixed';if(!state.modeStats[modeKey])state.modeStats[modeKey]={correct:0,wrong:0,xp:0};
  state.modeStats[modeKey][progressOk?'correct':'wrong']++;state.modeStats[modeKey].xp+=xp;
  if(!progressOk)state.mistakes[w.id]=(state.mistakes[w.id]||0)+1;
  save();feedback(progressOk,w,ans,result);
  if(t.mode==='car_voice')carAfterMark(progressOk,w,ans,result);
  $('checkBtn').classList.add('hidden');$('nextBtn').classList.remove('hidden');$('dontKnowBtn').disabled=true;
  $('bar').style.width=`${Math.round((session.index+1)/session.queue.length*100)}%`;
}
function updateProg(w,ok){
  state.items[w.id]=advanceProgress(prog(w.id),ok,todayKey());
  if(ok){state.user.totalCorrect++;state.user.currentAnswerStreak++;state.user.bestAnswerStreak=Math.max(state.user.bestAnswerStreak,state.user.currentAnswerStreak);}
  else{state.user.totalWrong++;state.user.currentAnswerStreak=0;}
}
function updateStreak(d){if(state.user.lastActiveDay===d)return; const y=todayKey(new Date(Date.now()-DAY)); state.user.streakDays=state.user.lastActiveDay===y?state.user.streakDays+1:1; state.user.lastActiveDay=d;}
function feedback(ok,w,ans,result=null){
  const t=curTask();const primary=expected(w,t?.mode||'word_write');const b=$('feedback');
  result=result||scoreTaskAnswer(ans,w,t?.mode||'word_write');
  const partial=result.status==='partial';const accepted=result.expected||primary;
  const issues=(result.issues||[]).slice(0,3);
  const details=issues.length?`<ul class="feedback-details">${issues.map(issue=>`<li>${esc(issue.message)}</li>`).join('')}</ul>`:'';
  b.className='feedback '+(ok?'ok':(partial?'feedback-partial':'bad'));
  if(ok){
    const variant=normalize(accepted)!==normalize(primary)?`<br>Zaakceptowany wariant: <b>${esc(accepted)}</b>`:'';
    b.innerHTML=`<b>Dobrze.</b><br>Wzorcowa odpowiedź: <b>${esc(primary)}</b>${variant}`;
  }else if(partial){
    b.innerHTML=`<b>Prawie dobrze.</b><br>Twoja odpowiedź: ${esc(ans)}<br>Najbliższa poprawna odpowiedź: <b>${esc(accepted)}</b>${details}`;
  }else{
    b.innerHTML=`<b>Do poprawy.</b><br>Twoja odpowiedź: ${esc(ans)}<br>Najbliższa poprawna odpowiedź: <b>${esc(accepted)}</b>${details}`;
  }
}
function nextCard(){if(!session)return;stopCarRecognition();clearCarTimer();session.index++;renderLesson();}
function finish(){stopCarRecognition();clearCarTimer();$('lessonCard')?.classList.remove('car-active');if(!session)return;$('lessonCard').classList.add('hidden');$('summary').classList.remove('hidden');$('sumCorrect').textContent=session.correct;$('sumWrong').textContent=session.wrong;$('sumXp').textContent=session.xp;$('sumAccuracy').textContent=percent(session.correct,session.correct+session.wrong);state.sessions=state.sessions||[];state.sessions.unshift({date:new Date().toISOString(),practice:session.practice,correct:session.correct,wrong:session.wrong,xp:session.xp,total:session.queue.length});state.sessions=state.sessions.slice(0,80);save();session=null;renderAll();}
function renderAll(){renderToday();renderReviews();renderProgress();renderBase();}
function renderToday(){const q=queue(false);$('headline').textContent=due().length?`Masz ${due().length} powtórek do zrobienia`:'Dzisiaj możesz zrobić sesję';$('subline').textContent=`Plan: do ${state.settings.dailyReview} powtórek i do ${state.settings.dailyNew} nowych. Baza: ${WORDS.length}.`;$('queueBadge').textContent=q.length+' zadań';$('queueList').innerHTML=q.slice(0,8).map(t=>item(WORDS.find(w=>w.id===t.wordId),t)).join('')||'<p class="muted">Brak zadań według ustawień.</p>';$('statXp').textContent=state.user.xp;$('statLevel').textContent=state.user.level;$('statStreak').textContent=state.user.streakDays+' dni';$('statAcc').textContent=percent(state.user.totalCorrect,state.user.totalCorrect+state.user.totalWrong);}
function item(w,t){if(!w)return'';return `<div class="item"><div><strong>${esc(w.english)}</strong><div class="muted">${esc(w.polish)}</div><div class="minirow"><span class="mini">${esc(w.level)}</span><span class="mini">${esc(w.track)}</span><span class="mini amber">${t.kind}</span></div></div><span class="badge">${prog(w.id).mastery}%</span></div>`;}
function wordItem(w){const p=prog(w.id);const cls=p.status==='mastered'?'green':p.status==='weak'?'red':'amber';return `<div class="item"><div><strong>${esc(w.english)}</strong><div class="muted">${esc(w.polish)}</div><div class="minirow"><span class="mini">${esc(w.level)}</span><span class="mini">${esc(w.track)}</span><span class="mini ${cls}">${esc(status(p.status))}</span></div></div><span class="badge">${p.mastery}%</span></div>`;}
function renderReviews(){const l=[...due(),...weak()].filter((w,i,a)=>a.findIndex(x=>x.id===w.id)===i).slice(0,60);$('reviewsList').innerHTML=l.map(wordItem).join('')||'<p class="muted">Brak powtórek.</p>';}
function renderProgress(){const ps=WORDS.map(w=>prog(w.id));$('mastered').textContent=ps.filter(p=>p.status==='mastered').length;$('learning').textContent=ps.filter(p=>p.seen>0&&p.status!=='mastered'&&p.status!=='weak').length;$('weak').textContent=ps.filter(p=>p.status==='weak').length;$('bestStreak').textContent=state.user.bestAnswerStreak;const ms=Object.entries(state.mistakes).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([id])=>WORDS.find(w=>w.id===id)).filter(Boolean);$('mistakes').innerHTML=ms.map(wordItem).join('')||'<p class="muted">Brak błędów.</p>';renderModeStats();renderHistory14();}
function renderModeStats(){const labels={word_choice:'wybór',word_write:'pisanie',sentence_translate:'zdania',listening_write:'słuchanie',speaker_repeat:'lektor',speaking:'mówienie',dialogue:'dialog',car_voice:'samochód'};const entries=Object.entries(state.modeStats||{});$('modeStats').innerHTML=entries.length?entries.map(([k,v])=>{const total=(v.correct||0)+(v.wrong||0),acc=percent(v.correct||0,total);return `<div class="barline"><strong>${esc(labels[k]||k)}</strong><div class="bartrack"><div class="barfill" style="width:${acc}"></div></div><span class="badge">${acc}</span></div><div class="muted">${total} odpowiedzi, XP: ${v.xp||0}</div>`}).join(''):'<p class="muted">Brak danych z trybów. Zrób jedną sesję.</p>';}
function renderHistory14(){const days=[];for(let i=13;i>=0;i--)days.push(todayKey(new Date(Date.now()-i*DAY)));$('history14').innerHTML=days.map(d=>{const x=state.days[d]||{correct:0,wrong:0,xp:0};const total=(x.correct||0)+(x.wrong||0);return `<div class="daybox"><strong>${d.slice(5)}</strong><span>${total} odp.</span><span>${x.xp||0} XP</span></div>`;}).join('');}
function renderBase(){const q=normalize($('searchInput')?.value||''),lev=$('levelFilter')?.value||'all',tr=$('trackFilter')?.value||'all';const f=WORDS.filter(w=>(lev==='all'||w.level===lev)&&(tr==='all'||w.track===tr)&&(!q||normalize(`${w.english} ${w.polish} ${w.category}`).includes(q)));$('baseCount').textContent=f.length+' / '+WORDS.length;$('baseList').innerHTML=f.slice(0,180).map(wordItem).join('')||'<p class="muted">Nic nie znaleziono.</p>';}
function status(s){return {new:'nowe',review:'powtórka',weak:'słabe',mastered:'opanowane'}[s]||s;}

function isCloseEnough(a,e){return answerScore(a,e).status==='correct';}

function speechApi(){return window.SpeechRecognition||window.webkitSpeechRecognition||null;}
function startSpeechAnswer(){const SR=speechApi();const input=document.querySelector('.answer');if(!input){alert('Brak pola odpowiedzi.');return;}if(!SR){$('micStatus').classList.remove('hidden');$('micStatus').textContent='Ta przeglądarka nie udostępnia rozpoznawania mowy. Wpisz odpowiedź ręcznie.';return;}try{if(recognition)recognition.abort();recognition=new SR();recognition.lang=state.settings.voiceLang||'en-US';recognition.interimResults=true;recognition.continuous=false;$('micStatus').classList.remove('hidden');$('micStatus').textContent='Słucham... powiedz zdanie po angielsku.';recognition.onresult=e=>{let txt='';for(let i=e.resultIndex;i<e.results.length;i++)txt+=e.results[i][0].transcript+' ';lastSpeechText=txt.trim();input.value=lastSpeechText;const box=$('speechTranscript');if(box){box.classList.remove('hidden');box.textContent='Rozpoznano: '+lastSpeechText;}};recognition.onerror=e=>{$('micStatus').textContent='Błąd mikrofonu: '+(e.error||'nieznany')+'. Możesz wpisać odpowiedź ręcznie.';};recognition.onend=()=>{if($('micStatus').textContent.startsWith('Słucham'))$('micStatus').textContent=lastSpeechText?'Gotowe. Sprawdź odpowiedź.':'Nie rozpoznano mowy. Spróbuj jeszcze raz albo wpisz ręcznie.';};recognition.start();}catch(e){$('micStatus').classList.remove('hidden');$('micStatus').textContent='Nie udało się uruchomić mikrofonu: '+e.message;}}
function isVoiceAllowed(voiceEnabled,force=false){return !!voiceEnabled||!!force;}
function speak(text=null,opts={}){
  const w=curWord();
  if(!('speechSynthesis'in window)||!isVoiceAllowed(state.settings.voiceEnabled,opts.force))return Promise.resolve();
  const t=curTask(),m=t?.mode||'word_write';
  const msg=text||((m==='speaker_repeat'&&state.settings.preferExample!==false)?sentenceEn(w):expected(w,m));
  if(!msg)return Promise.resolve();
  speechSynthesis.cancel();
  const voices=speechSynthesis.getVoices();
  const lang=opts.lang||state.settings.voiceLang||'en-US';
  const langBase=lang.split('-')[0].toLowerCase();
  const selected=voices.find(v=>v.name===state.settings.voiceName);
  const selectedMatches=selected&&String(selected.lang||'').toLowerCase().startsWith(langBase);
  const chosen=(selectedMatches?selected:null)||voices.find(v=>v.lang===lang)||voices.find(v=>String(v.lang||'').toLowerCase().startsWith(langBase));
  const repeat=clamp(parseInt(opts.repeat??state.settings.voiceRepeat)||1,1,4);
  const rate=clamp(parseFloat(opts.rate??state.settings.voiceRate)||.9,.5,1.4);
  return new Promise(resolve=>{let left=repeat;const run=()=>{const utterance=new SpeechSynthesisUtterance(msg);utterance.lang=lang;utterance.rate=rate;if(chosen)utterance.voice=chosen;utterance.onend=()=>{left--;left>0?run():resolve();};utterance.onerror=()=>resolve();speechSynthesis.speak(utterance);};run();});
}
function setCarStatus(txt){const el=$('carStatus'); if(el)el.textContent=txt;}
function clearCarTimer(){if(carAutoTimer){clearTimeout(carAutoTimer);carAutoTimer=null;}}
function stopCarRecognition(){try{if(carRecognition)carRecognition.abort();}catch(_ ){} carRecognition=null;carCommandMode=false;}
function isCarLessonActive(){return !!(session&&curTask()?.mode==='car_voice'&&!checked&&$('learnScreen')?.classList.contains('active')&&$('lessonCard')?.classList.contains('car-active'));}
function stopCarSession(){stopCarRecognition();clearCarTimer();try{if('speechSynthesis'in window)speechSynthesis.cancel();}catch(_ ){}session=null;checked=false;selectedChoice=null;const card=$('lessonCard');if(card){card.classList.add('hidden');card.classList.remove('car-active');} $('summary')?.classList.add('hidden');$('emptyLesson')?.classList.remove('hidden');show('today');}
async function carAskCurrent(){
  const t=curTask(),w=curWord();if(!t||!w||!isCarLessonActive())return;
  stopCarRecognition();clearCarTimer();carSilenceRetries=0;setCarStatus('Słuchaj pytania');
  await speak('Przetłumacz na angielski: '+sentencePl(w),{lang:'pl-PL',repeat:1,rate:.95,force:true});
  if(!isCarLessonActive())return;setCarStatus('Mów teraz');startCarListening(false);
}
async function handleCarNoSpeech(reason='Nie rozpoznano odpowiedzi.'){
  if(!isCarLessonActive())return;
  carSilenceRetries++;
  if(carSilenceRetries<=2){
    setCarStatus(`Nie usłyszałem. Próba ${carSilenceRetries} z 2.`);
    await speak('Nie usłyszałem odpowiedzi. Spróbuj jeszcze raz.',{lang:'pl-PL',repeat:1,rate:.95,force:true});
    if(isCarLessonActive()){setCarStatus('Mów teraz');startCarListening(false);}
    return;
  }
  const w=curWord();
  mark(false,'Brak odpowiedzi',{score:0,status:'wrong',label:'Źle',issues:[{code:'silence',message:reason}],expected:expected(w,'car_voice')});
}
function startCarListening(commandOnly=false){
  const SR=speechApi(),input=document.querySelector('.answer');
  if(!isCarLessonActive())return;
  if(!SR){setCarStatus('Brak rozpoznawania mowy w tej przeglądarce');return;}
  stopCarRecognition();carCommandMode=commandOnly;lastSpeechText='';let recognitionFailed=false;
  try{
    carRecognition=new SR();carRecognition.lang=commandOnly?'pl-PL':(state.settings.voiceLang||'en-US');carRecognition.interimResults=true;carRecognition.continuous=false;
    carRecognition.onresult=e=>{let txt='';for(let i=e.resultIndex;i<e.results.length;i++)txt+=e.results[i][0].transcript+' ';lastSpeechText=txt.trim();if(input)input.value=lastSpeechText;const box=$('speechTranscript');if(box){box.classList.remove('hidden');box.textContent='Rozpoznano: '+lastSpeechText;}};
    carRecognition.onerror=e=>{if(!isCarLessonActive())return;recognitionFailed=true;const code=e.error||'błąd';if(['no-speech','audio-capture'].includes(code))handleCarNoSpeech('Mikrofon nie zarejestrował odpowiedzi.');else setCarStatus('Mikrofon: '+code+'. Użyj przycisku „Mów teraz” albo „Powtórz”.');};
    carRecognition.onend=()=>{if(!isCarLessonActive()||recognitionFailed)return;const txt=(lastSpeechText||'').trim();if(!txt){handleCarNoSpeech();return;}carSilenceRetries=0;if(handleVoiceCommand(txt))return;const t=curTask(),w=curWord();if(!t||!w||!isCarLessonActive())return;const result=scoreTaskAnswer(txt,w,t.mode);mark(result.status==='correct',txt,result);};
    carRecognition.start();
  }catch(e){setCarStatus('Nie udało się uruchomić mikrofonu: '+e.message);}
}
function handleVoiceCommand(txt){const n=normalize(txt); if(!n)return false; const has=(...xs)=>xs.some(x=>n.includes(x)); if(has('powtorz','powtor','potworz','repeat','again')){handleCarCommand('repeat');return true;} if(has('dalej','dale','daly','next','skip')){handleCarCommand('skip');return true;} if(has('wolniej','slow','slower')){state.settings.voiceRate=clamp((parseFloat(state.settings.voiceRate)||.9)-.1,.5,1.4);syncSettings();save();handleCarCommand('repeat');return true;} if(has('zatrzymaj','stop','pauza','pause')){handleCarCommand('stop');return true;} if(has('pokaz odpowiedz','pokaż odpowiedź','nie wiem','no idea','show answer')){if(session&&!checked)mark(false,'Nie wiem');return true;} return false;}
function handleCarCommand(cmd){
  if(cmd==='listen'){setCarStatus('Mów teraz');startCarListening(false);return;}
  if(cmd==='repeat'){carAskCurrent();return;}
  if(cmd==='slower'){state.settings.voiceRate=clamp((parseFloat(state.settings.voiceRate)||.9)-.1,.5,1.4);syncSettings();save();carAskCurrent();return;}
  if(cmd==='skip'){if(!session)return;if(checked)nextCard();else mark(false,'Pominięto',{score:0,status:'wrong',label:'Źle',issues:[{code:'skip',message:'Zadanie zostało pominięte.'}],expected:expected(curWord(),curTask()?.mode)});return;}
  if(cmd==='stop'){setCarStatus('Zatrzymano');stopCarSession();}
}
async function carAfterMark(ok,w,ans,result=null){
  stopCarRecognition();clearCarTimer();
  result=result||scoreTaskAnswer(ans,w,'car_voice');
  const partial=result.status==='partial';
  setCarStatus(ok?'Dobrze':(partial?'Prawie dobrze':'Do poprawy'));
  const exp=result.expected||expected(w,'car_voice');
  await speak(ok?'Dobrze.':(partial?'Prawie dobrze. Posłuchaj poprawnej odpowiedzi.':'Do poprawy. Posłuchaj poprawnej odpowiedzi.'),{lang:'pl-PL',repeat:1,rate:.95,force:true});
  await speak(exp,{lang:state.settings.voiceLang||'en-US',repeat:1,rate:Math.max(.65,(parseFloat(state.settings.voiceRate)||.9)-.05),force:true});
  if(!session||curTask()?.mode!=='car_voice'||!checked||!$('learnScreen')?.classList.contains('active'))return;
  if(state.settings.carAutoNext!==false){
    const pause=clamp(parseInt(state.settings.carPause)||3,1,8)*1000;
    carAutoTimer=setTimeout(()=>{if(session&&checked&&$('learnScreen')?.classList.contains('active'))nextCard();},pause);
  }
}
async function hardRefresh(){
  await clearAppCaches();
  try{if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration();if(reg)await reg.update();}}catch(_ ){}
  location.replace(location.pathname+'?v='+APP_VERSION+'&reload='+Date.now());
}
function importData(){try{state=migrate(JSON.parse($('dataBox').value));save();syncSettings();renderAll();alert('Import zakończony.')}catch(_ ){alert('Nieprawidłowe dane importu.')}}
function resetProgress(){if(!confirm('Usunąć postępy?'))return;state=defState();save();syncSettings();renderAll();}
function percent(a,b){return b?Math.round(a/b*100)+'%':'0%';}function clamp(v,min,max){return Math.min(max,Math.max(min,v));}function shuffle(a){return [...a].sort(()=>Math.random()-.5);}function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
window.__trainerTests={normalize,todayKey,isCloseEnough,answerScore,bestAnswerScore,migrateProgress,advanceProgress,migrate,isVoiceAllowed,acceptedAnswers,scoreTaskAnswer,wordsOf,dl,WORDS,WORD_ALIASES,practiceQueue,modeLabel,expected,handleVoiceCommand,DIALOGUE_SCENES,hasQualityExample,sentenceEn,uniqueTasks};
document.addEventListener('DOMContentLoaded',()=>{try{boot();}catch(e){console.error(e);err(e.message||e);}});
