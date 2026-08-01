'use strict';

/**
 * Angielski Daily Trainer 6.6.0
 * Nawigacja, obsługa przycisków, okna dialogowe i onboarding.
 * Wydzielone z wersji 5.8.3 bez zmiany zachowania aplikacji.
 */

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
  $('startBtn')?.addEventListener('click',startSmart);$('reviewBtn')?.addEventListener('click',startReviews);$('homeReviewBtn')?.addEventListener('click',startReviews);$('courseContinueBtn')?.addEventListener('click',startCurrentCourseLesson);$('checkBtn')?.addEventListener('click',checkAnswer);$('retryBtn')?.addEventListener('click',retryCurrent);$('micBtn')?.addEventListener('click',startSpeechAnswer);$('nextBtn')?.addEventListener('click',nextCard);$('dontKnowBtn')?.addEventListener('click',()=>mark(false,'Nie wiem'));$('speakBtn')?.addEventListener('click',()=>speak());$('refreshBtn')?.addEventListener('click',hardRefresh);$('endSessionBtn')?.addEventListener('click',endSessionSafely);
  $('summaryCarBtn')?.addEventListener('click',event=>startLessonCarSession(event.currentTarget.dataset.lessonId));$('resumeSessionBtn')?.addEventListener('click',resumeSession);$('discardSessionBtn')?.addEventListener('click',discardSavedSession);
  ['searchInput','levelFilter','trackFilter'].forEach(id=>$(id)?.addEventListener('input',renderBase));['levelFilter','trackFilter'].forEach(id=>$(id)?.addEventListener('change',renderBase));
  ['dailyGoal','dailyNew','dailyReview','defaultLevel','defaultTrack','themeMode','fontSize','animationsEnabled','voiceEnabled','voiceLang','voiceName','voiceRate','voiceRepeat','autoSpeak','preferExample','carTaskCount','carPause','carAutoNext','reminderTime','notificationSound'].forEach(id=>$(id)?.addEventListener('change',saveSettings));
  ['trainingLevel','trainingTopic'].forEach(id=>$(id)?.addEventListener('change',saveTrainingFilters));
  ['themeMode','fontSize'].forEach(id=>$(id)?.addEventListener('input',saveSettings));
  $('reminderEnabled')?.addEventListener('change',async()=>{saveSettings();await configureReminders(true);});
  $('exportBtn')?.addEventListener('click',()=>exportData({download:true}));$('prepareExportBtn')?.addEventListener('click',()=>exportData({download:false}));$('importBtn')?.addEventListener('click',importData);$('chooseImportFileBtn')?.addEventListener('click',()=>$('importFileInput')?.click());$('importFileInput')?.addEventListener('change',async event=>{const file=event.target.files?.[0];await importDataFile(file);event.target.value='';});$('resetBtn')?.addEventListener('click',resetProgress);
  $('onboardingNext')?.addEventListener('click',nextOnboardingStep);$('onboardingBack')?.addEventListener('click',previousOnboardingStep);$('courseLevelSelect')?.addEventListener('change',event=>chooseCourseLevel(event.target.value));
  document.addEventListener('click',event=>{const courseLessonButton=event.target.closest?.('[data-course-lesson]');if(courseLessonButton){if(!courseLessonButton.disabled)startCourseLesson(courseLessonButton.dataset.courseLesson);return;}const speakMaterial=event.target.closest?.('[data-speak-material]');if(speakMaterial){const word=WORDS.find(item=>item.id===speakMaterial.dataset.speakMaterial);if(word)speak(word.english,{lang:state.settings.voiceLang||'en-US',repeat:1,force:true});return;}const command=event.target.closest?.('[data-car]');if(command){handleCarCommand(command.dataset.car);return;}const choice=event.target.closest?.('.choice');if(!choice||checked)return;document.querySelectorAll('.choice').forEach(item=>item.classList.remove('selected'));choice.classList.add('selected');selectedChoice=choice.dataset.choice;});
  document.addEventListener('keydown',event=>{if(!session||event.key!=='Enter'||!$('learnScreen')?.classList.contains('active'))return;const tag=event.target?.tagName?.toLowerCase();if(tag==='textarea')return;event.preventDefault();if(!$('nextBtn')?.classList.contains('hidden'))nextCard();else checkAnswer();});
  if('speechSynthesis'in window)speechSynthesis.onvoiceschanged=setupVoices;
}
function handleAction(action){
  if(action==='smart'){startSmart();return;}
  if(action==='export'){show('settings');setTimeout(()=>{exportData({download:true});$('dataSettings')?.scrollIntoView?.({behavior:'smooth'});},80);return;}
  if(action==='import'){show('settings');setTimeout(()=>{$('dataSettings')?.scrollIntoView?.({behavior:'smooth'});$('dataBox')?.focus?.();},80);}
}
function show(name){
  const mainNames=new Set(['today','study','progress','more']);
  if(name!=='learn'){document.body?.classList.remove('input-active','keyboard-open');stopCarRecognition();clearCarTimer();try{if('speechSynthesis'in window)speechSynthesis.cancel();}catch(_){}}
  document.querySelectorAll('.screen').forEach(screen=>{screen.classList.remove('active');screen.setAttribute?.('aria-hidden','true');});
  const activeMain=mainNames.has(name)?name:(name==='course'?'today':name==='learn'?(session?.source==='course'?'today':'study'):'more');document.querySelectorAll('.nav').forEach(nav=>{const active=nav.dataset.nav===activeMain;nav.classList.toggle('active',active);if(active)nav.setAttribute?.('aria-current','page');else nav.removeAttribute?.('aria-current');});
  const screen=$(name+'Screen');if(screen){screen.classList.add('active');screen.setAttribute?.('aria-hidden','false');}
  renderAll();
  window.scrollTo?.({top:0,behavior:'instant'});
  if(screen&&name!=='learn'){const heading=screen.querySelector('h1,h2');if(heading){heading.setAttribute?.('tabindex','-1');requestAnimationFrame(()=>heading.focus?.({preventScroll:true}));}}
}
function askConfirm(title,message,confirmLabel='Potwierdź'){
  const dialog=$('confirmDialog');if(!dialog||typeof dialog.showModal!=='function')return Promise.resolve(true);
  setText('confirmTitle',title);setText('confirmMessage',message);setText('confirmOk',confirmLabel);
  return new Promise(resolve=>{const close=()=>{dialog.removeEventListener('close',close);resolve(dialog.returnValue==='ok');};dialog.addEventListener('close',close);dialog.showModal();requestAnimationFrame(()=>$('confirmTitle')?.focus?.());});
}
function openOnboarding(){onboardingStep=1;fillOnboardingValues();renderOnboarding();const dialog=$('onboardingDialog');if(dialog&&typeof dialog.showModal==='function'&&!dialog.open){dialog.showModal();requestAnimationFrame(()=>dialog.querySelector('h1')?.focus?.());}}
function fillOnboardingValues(){setValue('onboardingLevel',state.settings.defaultLevel==='all'?(levels()[0]||'A1'):state.settings.defaultLevel);setValue('onboardingTrack',state.settings.defaultTrack||TRAINING_TOPIC_COURSE);setValue('onboardingGoal',state.settings.dailyGoal||20);}
function renderOnboarding(){document.querySelectorAll('.onboarding-step').forEach(section=>section.classList.toggle('hidden',Number(section.dataset.step)!==onboardingStep));setProgress($('onboardingBar'),onboardingStep*20);$('onboardingBack')?.classList.toggle('hidden',onboardingStep===1);if($('onboardingNext'))$('onboardingNext').textContent=onboardingStep===5?'Przejdź do aplikacji':'Dalej';}
function nextOnboardingStep(){if(onboardingStep<5){onboardingStep++;renderOnboarding();return;}const selectedLevel=$('onboardingLevel')?.value||'A1';applyTrainingFilters(selectedLevel,$('onboardingTrack')?.value||TRAINING_TOPIC_COURSE);if(state.course&&(COURSE_CATALOG.levels||[]).some(level=>level.id===selectedLevel))state.course.selectedLevel=selectedLevel;state.settings.dailyGoal=clamp(parseInt($('onboardingGoal')?.value)||20,5,100);state.settings.onboardingComplete=true;if(!save())return;syncSettings();$('onboardingDialog')?.close?.();renderAll();show('today');}
function previousOnboardingStep(){if(onboardingStep>1){onboardingStep--;renderOnboarding();}}
