'use strict';

/**
 * Angielski Daily Trainer 5.8.6
 * Sesje, renderowanie zadań, ocenianie i ponawianie błędów.
 * Rozszerzone o etapy kursu, zadanie końcowe i zapis wyniku lekcji.
 */

async function startPractice(kind){
  if(kind==='car'&&!state.settings.carWarningDismissed){const allowed=await showCarWarning();if(!allowed)return;}
  const tasks=practiceQueue(kind);
  if(!tasks.length){const learnedOnly=['sentences','writing','listening','lector','speaking','dialogues','car'].includes(kind);const message=learnedOnly?'Najpierw poznaj materiał w głównej nauce. Ten tryb korzysta tylko z wcześniej przedstawionych treści.':kind==='vocab'?'Brak pojedynczych słów dla wybranego poziomu i ścieżki.':'Brak zadań dla wybranego poziomu i ścieżki.';notify(message,'error');return;}
  startSession(tasks,kind,{source:kind==='car'?'car':'practice'});
}
function startSmart(){const today=state.days[todayKey()]||{correct:0,wrong:0};const done=(today.correct||0)+(today.wrong||0);const remaining=Math.max(5,(state.settings.dailyGoal||20)-done);const tasks=practiceQueue('test').slice(0,remaining);if(!tasks.length){notify('Brak zadań. Zmień poziom, ścieżkę albo limity w ustawieniach.','error');return;}startSession(tasks,'test',{source:'practice'});}
function startReviews(){const tasks=queue(true);if(!tasks.length){notify('Nie masz zaległych powtórek.','success');return;}startSession(tasks,'reviews',{source:'review'});}
function startSession(tasks,practice='mixed',meta={}){const previous=deepClone(state),preserveOrder=practice==='dialogues'||meta.source==='course',prepared=preserveOrder?[...tasks]:shuffle(tasks);session={queue:prepared,index:0,correct:0,wrong:0,xp:0,practice,source:meta.source||'practice',startedAt:new Date().toISOString(),...meta};state.recentWordIds=[...new Set([...(state.recentWordIds||[]),...prepared.map(item=>item.wordId).filter(Boolean)])].slice(-120);checked=false;selectedChoice=null;retrySnapshot=null;if(!snapshotSession()){state=previous;session=null;return;}$('emptyLesson')?.classList.add('hidden');$('summary')?.classList.add('hidden');$('lessonCard')?.classList.remove('hidden');show('learn');renderLesson();}
function snapshotSession(saveNow=true){state.activeSession=session?deepClone(session):null;return saveNow?save():true;}
function resumeSession(){const saved=state.activeSession;if(!saved||!Array.isArray(saved.queue)||!saved.queue.length){notify('Nie ma sesji do wznowienia.','error');return;}session=JSON.parse(JSON.stringify(saved));checked=false;selectedChoice=null;retrySnapshot=null;$('emptyLesson')?.classList.add('hidden');$('summary')?.classList.add('hidden');$('lessonCard')?.classList.remove('hidden');show('learn');renderLesson();}
async function discardSavedSession(){if(!await askConfirm('Usunąć niedokończoną lekcję?','Dotychczasowy wynik tej sesji nie zostanie dopisany do historii.','Usuń'))return;const previous=deepClone(state.activeSession);state.activeSession=null;if(!save()){state.activeSession=previous;return;}renderToday();}
async function endSessionSafely(){if(!session)return;const ok=await askConfirm('Przerwać lekcję?','Bieżący stan zostanie zapisany i będzie można wznowić lekcję z ekranu Dzisiaj.','Przerwij');if(!ok)return;pauseSession();}
function pauseSession(){stopCarRecognition();clearCarTimer();if(checked)session.index=Math.min(session.index+1,session.queue.length);retrySnapshot=null;if(!snapshotSession())return;$('lessonCard')?.classList.add('hidden');$('emptyLesson')?.classList.remove('hidden');session=null;checked=false;selectedChoice=null;show('today');notify('Lekcja została zapisana do wznowienia.','success');}
function curTask(){return session?.queue?.[session.index]||null;}
function curWord(){const current=curTask();return current?WORDS.find(word=>word.id===current.wordId):null;}
function modeLabel(value){return {course_intro:'wprowadzenie',course_final:'zadanie końcowe',word_choice:'wybór słówka',word_write:'pisanie',sentence_translate:'zdania',listening_write:'słuchanie',speaker_repeat:'słuchaj i powtarzaj',speaking:'mówienie',dialogue:'dialog',car_voice:'samochód',en_pl:'angielski → polski'}[value]||value;}
function dialogueScene(word){return word?DIALOGUE_SCENES[word.id]||null:null;}
function expected(word,taskMode,current=curTask()){
  if(taskMode==='course_final')return current?.expectedAnswer||current?.acceptedAnswers?.[0]||'';
  if(taskMode==='course_intro')return word?.english||'';
  if(!word)return'';
  if(taskMode==='dialogue'){const scene=dialogueScene(word);if(scene?.accepted?.length)return scene.accepted[0];}
  return (taskMode==='en_pl'||taskMode==='word_choice')?word.polish:(['sentence_translate','listening_write','speaker_repeat','speaking','car_voice'].includes(taskMode)?sentenceEn(word):word.english);
}
function acceptedAnswers(word,taskMode,current=curTask()){
  if(taskMode==='course_final')return [...new Set([current?.expectedAnswer,...(current?.acceptedAnswers||[])].filter(Boolean).map(String))];
  const answers=[expected(word,taskMode,current)],scene=taskMode==='dialogue'?dialogueScene(word):null;if(scene?.accepted)answers.push(...scene.accepted);if(Array.isArray(word?.acceptedAnswers))answers.push(...word.acceptedAnswers);if(word?.acceptedAnswers&&Array.isArray(word.acceptedAnswers[taskMode]))answers.push(...word.acceptedAnswers[taskMode]);return [...new Set(answers.filter(Boolean).map(String))];
}
function scoreTaskAnswer(answer,word,taskMode,current=curTask()){
  if(taskMode==='course_final'){
    const variants=acceptedAnswers(word,taskMode,current);if(variants.length)return bestAnswerScore(answer,variants);
    const count=wordsOf(answer).length,minimum=Math.max(1,Number(current?.minimumWords)||1),groups=(Array.isArray(current?.requiredKeywords)?current.requiredKeywords:[]).map(group=>[...new Set((Array.isArray(group)?group:[group]).filter(Boolean).map(String))]).filter(group=>group.length);
    if(!groups.length)return {score:0,status:'wrong',label:'Brak kryteriów',issues:[{code:'missing_criteria',message:'Zadanie końcowe nie ma jeszcze zdefiniowanych kryteriów automatycznej oceny.'}],expected:'',variants:[]};
    const normalized=' '+normalize(answer)+' ',matched=groups.filter(group=>group.some(value=>{const phrase=normalize(value);return phrase&&normalized.includes(' '+phrase+' ');})).length,minimumGroups=Math.min(groups.length,Math.max(1,Number(current?.minimumKeywordGroups)||groups.length)),lengthOk=count>=minimum,keywordsOk=matched>=minimumGroups,issues=[];
    if(!lengthOk)issues.push({code:'minimum_words',message:`Wypowiedź powinna zawierać co najmniej ${minimum} słowa.`});
    if(!keywordsOk)issues.push({code:'required_keywords',message:`Odpowiedź spełnia ${matched} z ${minimumGroups} wymaganych elementów treści.`});
    const score=Math.min(1,((Math.min(1,count/minimum))+(Math.min(1,matched/minimumGroups)))/2);
    if(lengthOk&&keywordsOk)return {score:1,status:'correct',label:'Dobrze',issues:[],expected:'',variants:[]};
    if(count>0)return {score,status:'partial',label:'Prawie dobrze',issues,expected:'',variants:[]};
    return {score:0,status:'wrong',label:'Źle',issues:[{code:'empty',message:'Brak odpowiedzi.'}],expected:'',variants:[]};
  }
  return bestAnswerScore(answer,acceptedAnswers(word,taskMode,current));
}
function promptFor(word,taskMode,current=curTask()){
  if(taskMode==='course_intro')return {label:'Poznaj nowy materiał',prompt:word?.english||'',hint:[word?.polish,hasQualityExample(word)?`${sentenceEn(word)} — ${sentencePl(word)}`:''].filter(Boolean).join(' • ')};
  if(taskMode==='course_final')return {label:'Zadanie końcowe',prompt:current?.prompt||'Wykonaj zadanie końcowe.',hint:current?.hint||'Odpowiedz samodzielnie. To zadanie jest wymagane do zaliczenia lekcji.'};
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
  const current=curTask(),word=curWord();if(!current||(!word&&current.mode!=='course_final'))return finish();
  checked=false;selectedChoice=null;clearCarTimer();
  const infoTask=current.mode==='course_intro';
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
  if(taskMode==='course_intro')return `<div class="course-intro"><strong>${esc(word?.english||'')}</strong><span>${esc(word?.polish||'')}</span>${hasQualityExample(word)?`<p>${esc(sentenceEn(word))}<br><small>${esc(sentencePl(word))}</small></p>`:''}</div>`;
  if(taskMode==='course_final')return `<textarea class="answer" rows="4" autocomplete="off" placeholder="Wpisz lub podyktuj swoją odpowiedź"></textarea><div id="speechTranscript" class="transcript hidden"></div>`;
  if(taskMode==='car_voice')return `<div class="car-panel"><div id="carStatus" class="car-status">Start trybu samochodowego</div><div class="car-prompt">${esc(sentencePl(word))}</div><input class="answer hidden" autocomplete="off"><div id="speechTranscript" class="transcript hidden"></div><div class="car-command-grid"><button class="car-command primary-car" data-car="listen">Mów teraz</button><button class="car-command" data-car="repeat">Powtórz</button><button class="car-command" data-car="skip">Dalej</button><button class="car-command" data-car="slower">Wolniej</button><button class="car-command stop-car" data-car="stop">Stop</button></div><div class="car-tip">Komendy: next, repeat, slower, stop, show answer. Po dwóch nieudanych próbach aplikacja poda poprawną odpowiedź.</div></div>`;
  if(taskMode==='speaking')return `<div class="micline"><input class="answer" autocomplete="off" placeholder="Tu pojawi się rozpoznana mowa — możesz poprawić tekst ręcznie"></div><div id="speechTranscript" class="transcript hidden"></div>`;
  if(taskMode==='word_choice'){const pool=activeWords().filter(item=>item.id!==word.id&&item.level===word.level&&isVocabularyItem(item));const choices=shuffle([word,...shuffle(pool).slice(0,3)]);return `<div class="choices">${choices.map(choice=>`<button class="choice" data-choice="${esc(choice.polish)}">${esc(choice.polish)}</button>`).join('')}</div>`;}
  return '<input class="answer" autocomplete="off" placeholder="Wpisz odpowiedź">';
}
function checkAnswer(){if(checked)return;const word=curWord(),current=curTask();if(!current||(!word&&current.mode!=='course_final'))return;const answer=current.mode==='word_choice'?(selectedChoice||''):(document.querySelector('.answer')?.value||'');if(!answer.trim()){notify('Najpierw wpisz albo wybierz odpowiedź.','error');return;}const result=scoreTaskAnswer(answer,word,current.mode,current);mark(result.status==='correct',answer,result);}
function mark(ok,answer,result=null){
  if(checked)return;const word=curWord(),current=curTask();if(!current||(!word&&current.mode!=='course_final'))return;
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
  if(current?.mode==='course_intro'&&!checked)completeCourseInfoTask();
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
  state.sessions=state.sessions||[];const history={date:new Date().toISOString(),practice:completed.practice,source:completed.source||'practice',correct:completed.correct,wrong:completed.wrong,xp:completed.xp,total:completed.queue.filter(item=>item.counted!==false).length};if(completed.source==='course'){Object.assign(history,{lessonId:completed.lessonId,moduleId:completed.moduleId,lessonTitle:completed.lessonTitle,courseResult:courseResult?.outcome||'retry',courseAccuracy:courseResult?.accuracy||0,finalTaskCompleted:!!courseResult?.finalTaskCompleted});}state.sessions.unshift(history);state.sessions=state.sessions.slice(0,100);state.activeSession=null;
  if(!save()){state=previousState;session=completed;$('summary')?.classList.add('hidden');$('lessonCard')?.classList.remove('hidden');return;}session=null;renderAll();
}
function formatDate(dateKey){if(dateKey===todayKey())return'dzisiaj';if(dateKey===addDays(1))return'jutro';const [year,month,day]=dateKey.split('-');return `${day}.${month}.${year}`;}
