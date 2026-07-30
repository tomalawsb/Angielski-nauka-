'use strict';

/**
 * Angielski Daily Trainer 5.8.6
 * Stan domyślny, migracje, walidacja importu i zapis lokalny.
 * Rozszerzone o migrację danych kursu i bezpieczną walidację zapisu 5.8.6.
 */

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
    items:{},days:{},mistakes:{},modeStats:{},sessions:[],activeSession:null,recentWordIds:[],
    course:CourseCore.defaultCourseState(COURSE_CATALOG)
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
  const course=CourseCore.migrateCourseState(source.course,COURSE_CATALOG,WORDS.map(word=>word.id));
  const introduced=new Set(course.introducedMaterialIds||[]);
  for(const [id,progress] of Object.entries(items))if((progress?.seen||0)>0&&WORDS.some(word=>word.id===id))introduced.add(id);
  course.introducedMaterialIds=[...introduced];
  const migrateSessionEntry=entry=>entry&&typeof entry==='object'?{source:entry.source||((entry.practice==='reviews')?'review':(entry.practice==='car'?'car':'practice')),...entry}:entry;
  return {
    ...freshState,...source,version:APP_VERSION,
    settings:{...freshState.settings,...(source.settings||{})},
    user:{...freshState.user,...(source.user||{})},
    items,days:source.days||source.daily||{},mistakes:source.mistakes||{},modeStats:source.modeStats||{},course,
    sessions:Array.isArray(source.sessions)?source.sessions.slice(0,100).map(migrateSessionEntry):[],
    activeSession:source.activeSession&&typeof source.activeSession==='object'?migrateSessionEntry(source.activeSession):null,
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
  const allowedTop=new Set(['version','createdAt','settings','user','items','wordProgress','days','daily','mistakes','modeStats','sessions','activeSession','recentWordIds','course']);
  assertKnown(parsed,allowedTop,'imporcie');
  if(parsed.version!==undefined){
    if(typeof parsed.version!=='string'||!/^\d+\.\d+\.\d+$/.test(parsed.version))throw new Error('Nieprawidłowy numer wersji danych.');
    const imported=parsed.version.split('.').map(Number),current=APP_VERSION.split('.').map(Number);
    const compare=(left,right)=>left[0]-right[0]||left[1]-right[1]||left[2]-right[2];
    if(imported[0]<4||compare(imported,current)>0)throw new Error('Nieobsługiwana wersja danych: '+parsed.version+'.');
  }
  isoDate(parsed.createdAt,'utworzenia zapisu');
  assertObject(parsed.settings,'settings');assertObject(parsed.user,'user');assertObject(parsed.items??parsed.wordProgress,'items');assertObject(parsed.days??parsed.daily,'days');assertObject(parsed.mistakes,'mistakes');assertObject(parsed.modeStats,'modeStats');assertObject(parsed.course,'course');
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
  if(parsed.course!==undefined){
    const course=parsed.course,knownLessons=new Set(CourseCore.flattenLessons(COURSE_CATALOG).map(lesson=>lesson.id)),knownModules=new Set(CourseCore.flattenModules(COURSE_CATALOG).map(module=>module.id));
    assertKnown(course,new Set(['schemaVersion','selectedLevel','currentLessonId','lastLessonId','unlockedLessonIds','unlockedModuleIds','completedModuleIds','introducedMaterialIds','lessons']),'course');
    number(course.schemaVersion,1,100,'course.schemaVersion');
    if(course.selectedLevel!==undefined&&!CourseCore.ALLOWED_LEVELS.includes(course.selectedLevel))throw new Error('Nieznany poziom w course.selectedLevel.');
    for(const field of ['currentLessonId','lastLessonId'])if(course[field]!==undefined&&course[field]!==null&&(!knownLessons.has(course[field])||typeof course[field]!=='string'))throw new Error('Nieznana lekcja w course.'+field+'.');
    const validateIdList=(value,name,known,max=10000)=>{if(value===undefined)return;if(!Array.isArray(value)||value.length>max||value.some(id=>typeof id!=='string'||!known.has(id)))throw new Error('Nieprawidłowa lista '+name+'.');};
    validateIdList(course.unlockedLessonIds,'course.unlockedLessonIds',knownLessons,1000);validateIdList(course.unlockedModuleIds,'course.unlockedModuleIds',knownModules,1000);validateIdList(course.completedModuleIds,'course.completedModuleIds',knownModules,1000);validateIdList(course.introducedMaterialIds,'course.introducedMaterialIds',validIds,WORDS.length+Object.keys(WORD_ALIASES).length);
    assertObject(course.lessons,'course.lessons');
    for(const [id,progress] of Object.entries(course.lessons||{})){
      if(!knownLessons.has(id))throw new Error('Nieznana lekcja w course.lessons: '+id+'.');assertObject(progress,'course.lessons.'+id);assertKnown(progress,new Set(['status','attempts','bestAccuracy','lastAccuracy','lastResult','lastStartedAt','completedAt','stagesCompleted','finalTaskCompleted']),'course.lessons.'+id);
      if(progress.status!==undefined&&!CourseCore.LESSON_STATUSES.includes(progress.status))throw new Error('Nieprawidłowy status lekcji '+id+'.');number(progress.attempts,0,100000,'course.lessons.'+id+'.attempts');number(progress.bestAccuracy,0,100,'course.lessons.'+id+'.bestAccuracy');number(progress.lastAccuracy,0,100,'course.lessons.'+id+'.lastAccuracy');
      if(progress.lastResult!==undefined&&progress.lastResult!==null&&!['retry','review_required','completed','mastered'].includes(progress.lastResult))throw new Error('Nieprawidłowy wynik lekcji '+id+'.');isoDate(progress.lastStartedAt,'course.lessons.'+id+'.lastStartedAt');isoDate(progress.completedAt,'course.lessons.'+id+'.completedAt');bool(progress.finalTaskCompleted,'course.lessons.'+id+'.finalTaskCompleted');
      if(progress.stagesCompleted!==undefined&&(!Array.isArray(progress.stagesCompleted)||progress.stagesCompleted.some(stage=>!CourseCore.ALLOWED_STAGES.includes(stage))))throw new Error('Nieprawidłowe etapy lekcji '+id+'.');
    }
  }
  if(Object.keys(days).length>2000)throw new Error('Import zawiera zbyt długą historię dni.');
  for(const [date,entry] of Object.entries(days)){if(!isValidDateKey(date))throw new Error('Nieprawidłowa data historii: '+date+'.');assertObject(entry,'historia dnia '+date);assertKnown(entry,new Set(['correct','wrong','xp']),'historii dnia '+date);for(const f of ['correct','wrong','xp'])number(entry[f],0,1000000,`${date}.${f}`);}
  for(const [id,count] of Object.entries(parsed.mistakes||{})){if(!validIds.has(id))throw new Error('Nieznany materiał w mistakes: '+id+'.');number(count,0,1000000,'mistakes.'+id);}
  const validModes=new Set(['course_intro','course_final','course','word_choice','word_write','sentence_translate','listening_write','speaker_repeat','speaking','dialogue','car_voice','en_pl','mixed','test','reviews','vocab','sentences','writing','listening','lector','car','dialogues']);
  for(const [mode,entry] of Object.entries(parsed.modeStats||{})){if(!validModes.has(mode))throw new Error('Nieznany tryb w statystykach: '+mode+'.');assertObject(entry,'modeStats.'+mode);assertKnown(entry,new Set(['correct','wrong','xp']),'modeStats.'+mode);for(const f of ['correct','wrong','xp'])number(entry[f],0,100000000,`modeStats.${mode}.${f}`);}
  const validateTask=(task,name)=>{assertObject(task,name);assertKnown(task,new Set(['taskId','wordId','kind','mode','stage','required','counted','prompt','hint','answerMode','acceptedAnswers','expectedAnswer','minimumWords','requiredKeywords','minimumKeywordGroups']),name);if(task.wordId!==undefined&&task.wordId!==null&&!validIds.has(task.wordId))throw new Error('Nieznany materiał w '+name+'.');if(!task.wordId&&!['course_final'].includes(task.mode))throw new Error('Brak materiału w '+name+'.');if(!['new','review','weak'].includes(task.kind))throw new Error('Nieprawidłowy rodzaj zadania w '+name+'.');if(!validModes.has(task.mode))throw new Error('Nieprawidłowy tryb zadania w '+name+'.');if(task.stage!==undefined&&!CourseCore.ALLOWED_STAGES.includes(task.stage))throw new Error('Nieprawidłowy etap zadania w '+name+'.');bool(task.required,name+'.required');bool(task.counted,name+'.counted');string(task.taskId,name+'.taskId',300);string(task.prompt,name+'.prompt',1000);string(task.hint,name+'.hint',1000);string(task.expectedAnswer,name+'.expectedAnswer',1000);number(task.minimumWords,0,100,name+'.minimumWords');number(task.minimumKeywordGroups,0,100,name+'.minimumKeywordGroups');if(task.acceptedAnswers!==undefined&&(!Array.isArray(task.acceptedAnswers)||task.acceptedAnswers.length>50||task.acceptedAnswers.some(value=>typeof value!=='string'||value.length>1000)))throw new Error('Nieprawidłowe warianty odpowiedzi w '+name+'.');if(task.requiredKeywords!==undefined&&(!Array.isArray(task.requiredKeywords)||task.requiredKeywords.length>50||task.requiredKeywords.some(group=>!Array.isArray(group)||!group.length||group.some(value=>typeof value!=='string'||value.length>200))))throw new Error('Nieprawidłowe kryteria słów kluczowych w '+name+'.');};
  const validSources=new Set(['practice','review','course','car']);
  const resultFields=new Set(['taskId','wordId','stage','mode','status','score','counted','required','completed','answeredAt']);
  const validateTaskResults=(values,name)=>{if(values===undefined)return;if(!Array.isArray(values)||values.length>500)throw new Error('Nieprawidłowe wyniki zadań w '+name+'.');values.forEach((entry,index)=>{assertObject(entry,`${name}[${index}]`);assertKnown(entry,resultFields,`${name}[${index}]`);string(entry.taskId,`${name}[${index}].taskId`,300);if(entry.wordId!==undefined&&entry.wordId!==null&&!validIds.has(entry.wordId))throw new Error('Nieznany materiał w wynikach zadania.');if(entry.stage!==undefined&&!CourseCore.ALLOWED_STAGES.includes(entry.stage))throw new Error('Nieznany etap w wynikach zadania.');if(entry.mode!==undefined&&!validModes.has(entry.mode))throw new Error('Nieznany tryb w wynikach zadania.');if(entry.status!==undefined&&!['correct','partial','wrong','completed'].includes(entry.status))throw new Error('Nieznany status wyniku zadania.');number(entry.score,0,1,`${name}[${index}].score`,false);bool(entry.counted,`${name}[${index}].counted`);bool(entry.required,`${name}[${index}].required`);bool(entry.completed,`${name}[${index}].completed`);isoDate(entry.answeredAt,`${name}[${index}].answeredAt`);});};
  if(parsed.sessions!==undefined){if(!Array.isArray(parsed.sessions)||parsed.sessions.length>500)throw new Error('Nieprawidłowa historia sesji.');parsed.sessions.forEach((entry,index)=>{assertObject(entry,'sessions['+index+']');assertKnown(entry,new Set(['date','practice','source','lessonId','moduleId','lessonTitle','correct','wrong','xp','total','courseResult','courseAccuracy','finalTaskCompleted']),'sessions['+index+']');isoDate(entry.date,`sessions[${index}].date`);if(typeof entry.practice!=='string'||!validModes.has(entry.practice))throw new Error('Nieprawidłowy tryb sesji.');if(entry.source!==undefined&&!validSources.has(entry.source))throw new Error('Nieprawidłowe źródło sesji.');for(const f of ['correct','wrong','xp','total'])number(entry[f],0,1000000,`sessions[${index}].${f}`);number(entry.courseAccuracy,0,100,`sessions[${index}].courseAccuracy`);bool(entry.finalTaskCompleted,`sessions[${index}].finalTaskCompleted`);if(entry.total!==undefined&&entry.correct!==undefined&&entry.wrong!==undefined&&entry.correct+entry.wrong>entry.total)throw new Error('Niespójny wynik sesji.');});}
  if(parsed.activeSession!==undefined&&parsed.activeSession!==null){const a=parsed.activeSession;assertObject(a,'activeSession');assertKnown(a,new Set(['queue','index','correct','wrong','xp','practice','source','startedAt','lessonId','moduleId','lessonTitle','lessonGoal','taskResults','stageProgress','finalTaskCompleted']),'activeSession');if(!Array.isArray(a.queue)||!a.queue.length||a.queue.length>500)throw new Error('Nieprawidłowa kolejka aktywnej sesji.');a.queue.forEach((task,index)=>validateTask(task,`activeSession.queue[${index}]`));number(a.index,0,a.queue.length,'activeSession.index');for(const f of ['correct','wrong','xp'])number(a[f],0,1000000,'activeSession.'+f);if(typeof a.practice!=='string'||!validModes.has(a.practice))throw new Error('Nieprawidłowy tryb aktywnej sesji.');if(a.source!==undefined&&!validSources.has(a.source))throw new Error('Nieprawidłowe źródło aktywnej sesji.');isoDate(a.startedAt,'activeSession.startedAt');validateTaskResults(a.taskResults,'activeSession.taskResults');assertObject(a.stageProgress,'activeSession.stageProgress');bool(a.finalTaskCompleted,'activeSession.finalTaskCompleted');}
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
