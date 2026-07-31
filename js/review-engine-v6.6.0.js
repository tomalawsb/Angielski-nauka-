'use strict';

/**
 * Angielski Daily Trainer 6.6.0
 * Dobór materiału, kolejki nauki i powtórek.
 * Rozszerzone o rozdzielenie kursu, powtórek, treningu i trybu samochodowego.
 */

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
function practiceBase(predicate,target,options={}){const selected=[],ids=new Set(),allowFresh=options.allowFresh!==false;const add=(word,kind)=>{if(!word||ids.has(word.id)||!predicate(word))return;if(!allowFresh&&prog(word.id).seen===0)return;selected.push(task(word,kind));ids.add(word.id);};due().filter(predicate).slice(0,state.settings.dailyReview).forEach(word=>add(word,'review'));weak().filter(predicate).slice(0,5).forEach(word=>add(word,'weak'));if(allowFresh)fresh().filter(predicate).slice(0,state.settings.dailyNew).forEach(word=>add(word,'new'));for(const word of preferNotRecent(activeWords())){if(selected.length>=target)break;add(word,prog(word.id).seen?'review':'new');}return selected.slice(0,target);}
function hasQualityExample(word){const en=String(word.examples?.[0]?.en||'').trim(),pl=String(word.examples?.[0]?.pl||'').trim();if(!en||!pl||en.split(/\s+/).length<4)return false;if(/^this word is useful\b/i.test(en))return false;if(normalize(en)===normalize(word.english))return false;return true;}
function sentenceEn(word){return hasQualityExample(word)?word.examples[0].en:word.english;}
function sentencePl(word){return hasQualityExample(word)?word.examples[0].pl:word.polish;}
function practiceQueue(kind){
  const target=Math.max(6,state.settings.dailyGoal||20);
  let base=shuffle(queue(false));if(!base.length)base=preferNotRecent(activeWords()).slice(0,target).map(word=>task(word,'new'));
  if(kind==='vocab')return practiceBase(isVocabularyItem,target).map(item=>({...item,mode:item.kind==='new'?'word_choice':'word_write'}));
  if(kind==='sentences')return practiceBase(isSentenceItem,target,{allowFresh:false}).map(item=>({...item,mode:'sentence_translate'}));
  if(kind==='writing')return practiceBase(isVocabularyItem,target,{allowFresh:false}).map(item=>({...item,mode:'word_write'}));
  if(kind==='listening')return practiceBase(isSentenceItem,target,{allowFresh:false}).map(item=>({...item,mode:'listening_write'}));
  if(kind==='lector')return practiceBase(isSentenceItem,target,{allowFresh:false}).map(item=>({...item,mode:'speaker_repeat'}));
  if(kind==='speaking')return practiceBase(isSentenceItem,target,{allowFresh:false}).map(item=>({...item,mode:'speaking'}));
  if(kind==='car'){
    const carTarget=clamp(parseInt(state.settings.carTaskCount)||12,5,30),seenKeys=new Set(),known=activeWords().filter(word=>prog(word.id).seen>0&&word.carModeEligible!==false&&sentenceEn(word).includes(' '));
    const knownIds=new Set(known.map(word=>word.id)),recentLesson=courseLesson(latestCourseLessonForCar()),lessonPriority=recentLesson?courseLessonCarMaterialIds(recentLesson.id).map(id=>WORDS.find(word=>word.id===id)).filter(word=>word&&knownIds.has(word.id)):[];
    const priority=[...lessonPriority,...orderedReviews(due().filter(word=>knownIds.has(word.id))),...weak().filter(word=>knownIds.has(word.id)),...preferNotRecent(known)];
    const selected=priority.filter(word=>{const key=normalize(sentencePl(word)+'|'+sentenceEn(word));if(seenKeys.has(key))return false;seenKeys.add(key);return true;});
    return selected.slice(0,carTarget).map(word=>task(word,prog(word.id).status==='weak'?'weak':'review','car_voice'));
  }
  if(kind==='dialogues'){
    const conversationOrder=new Map();let nextConversation=0;for(const scene of Object.values(DIALOGUE_SCENES))if(!conversationOrder.has(scene.conversation))conversationOrder.set(scene.conversation,nextConversation++);
    const scenes=WORDS.filter(word=>DIALOGUE_SCENES[word.id]&&matchesStudyFilters(word)&&prog(word.id).seen>0).sort((a,b)=>{const first=DIALOGUE_SCENES[a.id],second=DIALOGUE_SCENES[b.id];return (conversationOrder.get(first.conversation)??999)-(conversationOrder.get(second.conversation)??999)||(first.turn||1)-(second.turn||1)||a.id.localeCompare(b.id);});
    const groups=[];for(let index=0;index<scenes.length;){const conversation=DIALOGUE_SCENES[scenes[index].id].conversation,group=[];while(index<scenes.length&&DIALOGUE_SCENES[scenes[index].id].conversation===conversation)group.push(scenes[index++]);groups.push(group);}const selected=[];for(const group of shuffle(groups)){if(selected.length>=target)break;selected.push(...group);}return selected.map(word=>task(word,prog(word.id).seen?'review':'new','dialogue'));
  }
  if(kind==='test')return shuffle(base).slice(0,target).map((item,index)=>({...item,mode:item.kind==='new'?'word_choice':['word_write','sentence_translate','listening_write','speaking','en_pl'][index%5]}));
  return base.slice(0,target);
}
