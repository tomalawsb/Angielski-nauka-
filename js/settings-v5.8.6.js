'use strict';

/**
 * Angielski Daily Trainer 5.8.6
 * Ustawienia nauki, głosu oraz wyglądu.
 * Wydzielone z wersji 5.8.3 bez zmiany zachowania aplikacji.
 */

function levels(){return [...new Set(WORDS.map(word=>word.level).filter(Boolean))].sort((a,b)=>['A1','A2','B1','B2','C1','C2'].indexOf(a)-['A1','A2','B1','B2','C1','C2'].indexOf(b));}
function tracks(){return [...new Set(WORDS.map(word=>word.track).filter(Boolean))].sort();}
function fillSelect(id,options){const element=$(id);if(element)element.innerHTML=options.map(option=>`<option value="${esc(option[0])}">${esc(option[1])}</option>`).join('');}
function setupSystemThemeListener(){
  if(typeof matchMedia!=='function')return;
  const media=matchMedia('(prefers-color-scheme: dark)');
  const refresh=()=>{if(state?.settings?.themeMode==='system')applyAppearance();};
  if(typeof media.addEventListener==='function')media.addEventListener('change',refresh);else if(typeof media.addListener==='function')media.addListener(refresh);
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
