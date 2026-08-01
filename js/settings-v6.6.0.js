'use strict';

/**
 * Angielski Daily Trainer 6.6.0
 * Ustawienia nauki, tematyki treningu, głosu oraz wyglądu.
 */

function levels(){return [...new Set(WORDS.map(word=>word.level).filter(Boolean))].sort((a,b)=>['A1','A2','B1','B2','C1','C2'].indexOf(a)-['A1','A2','B1','B2','C1','C2'].indexOf(b));}
function tracks(){return [...new Set(WORDS.map(word=>word.track).filter(Boolean))].sort();}
function trainingTopicOptions(){
  const available=new Set(tracks());
  const preferred=[
    ['Ogólny','Ogólny i codzienny'],
    ['Praktyczne','Praktyczne sytuacje'],
    ['Dialogi','Dialogi dodatkowe'],
    ['Praca','Praca i obsługa klienta'],
    ['Techniczne','Techniczne']
  ];
  const options=[[TRAINING_TOPIC_COURSE,'Materiał bieżącego kursu A1/A2 (zalecane)']];
  for(const [value,label] of preferred)if(available.has(value)){options.push([value,label]);available.delete(value);}
  for(const value of [...available].filter(value=>!/^Kurs\s+A[12]$/i.test(value)).sort())options.push([value,value]);
  options.push(['all','Wszystkie materiały dodatkowe, także techniczne']);
  return options;
}
function trainingTopicLabel(value=state?.settings?.defaultTrack){const shortLabels=new Map([[TRAINING_TOPIC_COURSE,'Kurs A1/A2'],['all','Wszystkie']]);return shortLabels.get(value)||String(value||'Kurs A1/A2');}
function trainingTopicHelp(value=state?.settings?.defaultTrack){
  if(value===TRAINING_TOPIC_COURSE)return 'Trening korzysta tylko z materiałów odblokowanych lub poznanych w bieżącym kursie A1/A2. Nie dodaje techniki, chyba że występuje w konkretnej lekcji kursu.';
  if(value==='Techniczne')return 'Wybrano wyłącznie słownictwo techniczne.';
  if(value==='Praca')return 'Wybrano słownictwo zawodowe i obsługę klienta.';
  if(value==='all')return 'Wybrano całą dodatkową bazę. Ten wariant zawiera również materiały zawodowe i techniczne.';
  return `Trening korzysta wyłącznie z tematyki „${trainingTopicLabel(value)}”.`;
}
function fillSelect(id,options){const element=$(id);if(element)element.innerHTML=options.map(option=>`<option value="${esc(option[0])}">${esc(option[1])}</option>`).join('');}
function setupSystemThemeListener(){
  if(typeof matchMedia!=='function')return;
  const media=matchMedia('(prefers-color-scheme: dark)');
  const refresh=()=>{if(state?.settings?.themeMode==='system')applyAppearance();};
  if(typeof media.addEventListener==='function')media.addEventListener('change',refresh);else if(typeof media.addListener==='function')media.addListener(refresh);
}
function setupFilters(){
  const levelOptions=[['all','Wszystkie poziomy'],...levels().map(value=>[value,value])];
  const materialTrackOptions=[['all','Wszystkie tematyki'],...tracks().map(value=>[value,value])];
  const topicOptions=trainingTopicOptions();
  fillSelect('levelFilter',levelOptions);fillSelect('trackFilter',materialTrackOptions);
  fillSelect('defaultLevel',levelOptions);fillSelect('trainingLevel',levelOptions);
  fillSelect('defaultTrack',topicOptions);fillSelect('trainingTopic',topicOptions);
  fillSelect('onboardingLevel',levels().map(value=>[value,value]));fillSelect('onboardingTrack',topicOptions);
  fillSelect('voiceLang',[['en-US','Angielski USA'],['en-GB','Angielski UK'],['en-AU','Angielski Australia'],['en-CA','Angielski Kanada']]);
}
function setupVoices(){const select=$('voiceName');if(!select)return;const voices=('speechSynthesis'in window)?speechSynthesis.getVoices().filter(voice=>/^en/i.test(voice.lang)):[];const current=state?.settings?.voiceName||'';select.innerHTML='<option value="">Domyślny głos</option>'+voices.map(voice=>`<option value="${esc(voice.name)}">${esc(voice.name)} — ${esc(voice.lang)}</option>`).join('');select.value=[...select.options].some(option=>option.value===current)?current:'';}
function setValue(id,value){const element=$(id);if(element)element.value=value;}
function setChecked(id,value){const element=$(id);if(element)element.checked=!!value;}
function syncTrainingTopicUi(){
  setValue('trainingLevel',state.settings.defaultLevel||'all');setValue('trainingTopic',state.settings.defaultTrack||TRAINING_TOPIC_COURSE);
  if($('trainingTopicBadge'))$('trainingTopicBadge').textContent=trainingTopicLabel();
  if($('trainingTopicHelp'))$('trainingTopicHelp').textContent=trainingTopicHelp();
}
function syncSettings(){
  setValue('dailyGoal',state.settings.dailyGoal);setValue('dailyNew',state.settings.dailyNew);setValue('dailyReview',state.settings.dailyReview);setValue('defaultLevel',state.settings.defaultLevel||'all');setValue('defaultTrack',state.settings.defaultTrack||TRAINING_TOPIC_COURSE);syncTrainingTopicUi();setValue('themeMode',state.settings.themeMode||'system');setValue('fontSize',state.settings.fontSize||'normal');setChecked('animationsEnabled',state.settings.animationsEnabled!==false);setChecked('voiceEnabled',state.settings.voiceEnabled);setValue('voiceLang',state.settings.voiceLang||'en-US');setValue('voiceName',state.settings.voiceName||'');setValue('voiceRate',state.settings.voiceRate??.9);setValue('voiceRepeat',state.settings.voiceRepeat||1);setChecked('autoSpeak',state.settings.autoSpeak);setChecked('preferExample',state.settings.preferExample!==false);setValue('carTaskCount',state.settings.carTaskCount||12);setValue('carPause',state.settings.carPause||3);setChecked('carAutoNext',state.settings.carAutoNext!==false);setChecked('reminderEnabled',state.settings.reminderEnabled);setValue('reminderTime',state.settings.reminderTime||'19:00');setChecked('notificationSound',state.settings.notificationSound!==false);applyAppearance();
}
function normalizeTrainingTopic(value){const allowed=new Set([TRAINING_TOPIC_COURSE,'all',...tracks()]);return allowed.has(value)?value:TRAINING_TOPIC_COURSE;}
function clearPracticeSessionForFilterChange(){
  let cleared=false;
  if(state.activeSession&&state.activeSession.source!=='course'){state.activeSession=null;cleared=true;}
  if(session&&session.source!=='course'){session=null;checked=false;selectedChoice=null;retrySnapshot=null;cleared=true;}
  return cleared;
}
function applyTrainingFilters(level,topic,{clearQueue=true}={}){
  const allowedLevels=new Set(['all',...levels()]);
  const nextLevel=allowedLevels.has(level)?level:'all',nextTopic=normalizeTrainingTopic(topic);
  const changed=state.settings.defaultLevel!==nextLevel||state.settings.defaultTrack!==nextTopic;
  state.settings.defaultLevel=nextLevel;state.settings.defaultTrack=nextTopic;state.settings.trainingTopicVersion=TRAINING_TOPIC_VERSION;
  const cleared=changed&&clearQueue?clearPracticeSessionForFilterChange():false;
  if(changed&&Array.isArray(state.recentWordIds)&&typeof matchesStudyFilters==='function')state.recentWordIds=state.recentWordIds.filter(id=>matchesStudyFilters(WORDS.find(word=>word.id===id))).slice(-120);
  return {changed,cleared,level:nextLevel,topic:nextTopic};
}
function saveTrainingFilters(){
  const previousState=deepClone(state),previousSession=session?deepClone(session):null;
  const result=applyTrainingFilters($('trainingLevel')?.value||'all',$('trainingTopic')?.value||TRAINING_TOPIC_COURSE);
  if(!save()){state=previousState;session=previousSession;syncSettings();return false;}
  syncSettings();renderAll();
  notify(result.cleared?'Tematyka zmieniona. Stara kolejka została usunięta i program utworzy nową.':'Tematyka treningu została zmieniona.','success');
  return true;
}
function saveSettings(){
  const previousState=deepClone(state),previousSession=session?deepClone(session):null;
  const filterResult=applyTrainingFilters($('defaultLevel')?.value||'all',$('defaultTrack')?.value||TRAINING_TOPIC_COURSE);
  state.settings.dailyGoal=clamp(parseInt($('dailyGoal')?.value)||20,5,100);state.settings.dailyNew=clamp(parseInt($('dailyNew')?.value)||7,1,50);state.settings.dailyReview=clamp(parseInt($('dailyReview')?.value)||18,1,100);state.settings.themeMode=$('themeMode')?.value||'system';state.settings.fontSize=$('fontSize')?.value||'normal';state.settings.animationsEnabled=$('animationsEnabled')?.checked!==false;state.settings.voiceEnabled=!!$('voiceEnabled')?.checked;state.settings.voiceLang=$('voiceLang')?.value||'en-US';state.settings.voiceName=$('voiceName')?.value||'';state.settings.voiceRate=clamp(parseFloat($('voiceRate')?.value)||.9,.5,1.4);state.settings.voiceRepeat=clamp(parseInt($('voiceRepeat')?.value)||1,1,4);state.settings.autoSpeak=!!$('autoSpeak')?.checked;state.settings.preferExample=$('preferExample')?.checked!==false;state.settings.carTaskCount=clamp(parseInt($('carTaskCount')?.value)||12,5,30);state.settings.carPause=clamp(parseInt($('carPause')?.value)||3,1,8);state.settings.carAutoNext=$('carAutoNext')?.checked!==false;state.settings.reminderEnabled=!!$('reminderEnabled')?.checked;state.settings.reminderTime=$('reminderTime')?.value||'19:00';state.settings.notificationSound=$('notificationSound')?.checked!==false;applyAppearance();
  if(!save()){state=previousState;session=previousSession;syncSettings();applyAppearance();return false;}
  syncSettings();notify(filterResult.cleared?'Ustawienia zapisane. Stara kolejka treningu została usunięta.':'Ustawienia zapisane.','success');renderAll();return true;
}
function applyAppearance(){const root=$('appRoot');if(root){root.dataset.theme=state?.settings?.themeMode||'system';root.dataset.fontSize=state?.settings?.fontSize||'normal';root.dataset.animations=state?.settings?.animationsEnabled===false?'off':'on';}const meta=$('themeColorMeta');if(meta){let dark=state?.settings?.themeMode==='dark';if(state?.settings?.themeMode==='system'&&typeof matchMedia==='function')dark=matchMedia('(prefers-color-scheme: dark)').matches;meta.content=dark?'#0f172a':'#2563eb';}}
