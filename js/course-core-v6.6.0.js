'use strict';
(function(global){
  const ALLOWED_LEVELS=['A1','A2','B1','B2','C1','C2'];
  const ALLOWED_STAGES=['review','introduction','recognition','writing','listening','speaking','dialogue','finalTask'];
  const LESSON_STATUSES=['locked','available','in_progress','completed','review_required','mastered'];
  const CATALOG_LESSON_STATUSES=['draft','published','archived'];
  const TASK_MODES=['course_intro','course_intro_group','course_grammar','word_choice','word_write','sentence_translate','listening_write','speaker_repeat','speaking','dialogue','course_final'];

  const clone=value=>JSON.parse(JSON.stringify(value));
  const unique=list=>[...new Set((Array.isArray(list)?list:[]).filter(Boolean).map(String))];
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
  const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);

  function flattenModules(catalog){
    const result=[];
    for(const level of catalog?.levels||[])for(const module of level.modules||[])result.push({...module,level:module.level||level.id});
    return result.sort((a,b)=>(ALLOWED_LEVELS.indexOf(a.level)-ALLOWED_LEVELS.indexOf(b.level))||((a.order||0)-(b.order||0))||String(a.id).localeCompare(String(b.id)));
  }
  function flattenLessons(catalog,options={}){
    const includeDraft=options.includeDraft!==false;
    const result=[];
    for(const level of catalog?.levels||[]){
      for(const module of level.modules||[]){
        for(const lesson of module.lessons||[]){
          const normalized={...lesson,level:lesson.level||level.id,moduleId:lesson.moduleId||module.id,moduleTitle:module.title||'',levelTitle:level.title||level.id};
          if(includeDraft||normalized.status==='published')result.push(normalized);
        }
      }
    }
    return result.sort((a,b)=>(ALLOWED_LEVELS.indexOf(a.level)-ALLOWED_LEVELS.indexOf(b.level))||String(a.moduleId).localeCompare(String(b.moduleId))||((a.order||0)-(b.order||0))||String(a.id).localeCompare(String(b.id)));
  }
  function lessonById(catalog,id){return flattenLessons(catalog).find(lesson=>lesson.id===id)||null;}
  function moduleById(catalog,id){return flattenModules(catalog).find(module=>module.id===id)||null;}
  function publishedLessons(catalog){return flattenLessons(catalog,{includeDraft:false}).filter(lesson=>lesson.status==='published');}
  function nextPublishedLessonId(catalog,lessonId){const list=publishedLessons(catalog),index=list.findIndex(lesson=>lesson.id===lessonId);return index>=0&&index+1<list.length?list[index+1].id:null;}
  function firstPublishedLessonId(catalog,level=null){return (publishedLessons(catalog).find(lesson=>!level||lesson.level===level)||{}).id||null;}
  function stageMaterialIds(lesson,stage){return unique(lesson?.stageMaterialIds?.[stage]||[]);}
  function lessonMaterialIds(lesson){return unique([
    ...(lesson?.materialIds||[]),...(lesson?.vocabularyIds||[]),...(lesson?.phraseIds||[]),
    ...(lesson?.grammarIds||[]),...(lesson?.dialogueIds||[]),...(lesson?.carMaterialIds||[]),
    ...Object.values(lesson?.stageMaterialIds||{}).flatMap(value=>Array.isArray(value)?value:[])
  ]);}
  function lessonCarMaterialIds(lesson){return unique(lesson?.carMaterialIds||[]);}
  function allCatalogMaterialIds(catalog){return unique(flattenLessons(catalog).flatMap(lesson=>[...lessonMaterialIds(lesson),...(lesson.reviewMaterialIds||[])]));}

  function validateCatalog(catalog,validMaterialIds=[]){
    const errors=[],warnings=[],validIds=new Set(validMaterialIds||[]),levelIds=new Set(),moduleIds=new Set(),lessonIds=new Set();
    if(!isObject(catalog))return {valid:false,errors:['Katalog kursu musi być obiektem.'],warnings};
    if(!Number.isInteger(catalog.schemaVersion)||catalog.schemaVersion<1)errors.push('Brak poprawnej wersji schematu katalogu.');
    if(!Array.isArray(catalog.levels))errors.push('Pole levels musi być tablicą.');
    for(const level of catalog.levels||[]){
      if(!isObject(level)){errors.push('Nieprawidłowy wpis poziomu.');continue;}
      if(!ALLOWED_LEVELS.includes(level.id))errors.push(`Nieznany poziom kursu: ${level.id}.`);
      if(levelIds.has(level.id))errors.push(`Powtórzony poziom: ${level.id}.`);levelIds.add(level.id);
      if(!Array.isArray(level.modules))errors.push(`Poziom ${level.id} nie ma tablicy modules.`);
      for(const module of level.modules||[]){
        if(!isObject(module)){errors.push(`Nieprawidłowy moduł w ${level.id}.`);continue;}
        if(!module.id||moduleIds.has(module.id))errors.push(!module.id?`Moduł w ${level.id} nie ma id.`:`Powtórzony moduł: ${module.id}.`);moduleIds.add(module.id);
        if(!Array.isArray(module.lessons))errors.push(`Moduł ${module.id} nie ma tablicy lessons.`);
        const orders=new Set();
        for(const lesson of module.lessons||[]){
          if(!isObject(lesson)){errors.push(`Nieprawidłowa lekcja w ${module.id}.`);continue;}
          if(!lesson.id||lessonIds.has(lesson.id))errors.push(!lesson.id?`Lekcja w ${module.id} nie ma id.`:`Powtórzona lekcja: ${lesson.id}.`);lessonIds.add(lesson.id);
          if(lesson.moduleId&&lesson.moduleId!==module.id)errors.push(`Lekcja ${lesson.id} wskazuje inny moduł.`);
          if(lesson.level&&lesson.level!==level.id)errors.push(`Lekcja ${lesson.id} wskazuje inny poziom.`);
          if(!CATALOG_LESSON_STATUSES.includes(lesson.status||'draft'))errors.push(`Lekcja ${lesson.id} ma nieznany status katalogowy.`);
          if(!Number.isInteger(lesson.order)||lesson.order<1)errors.push(`Lekcja ${lesson.id} ma nieprawidłową kolejność.`);
          if(orders.has(lesson.order))errors.push(`Powtórzona kolejność lekcji ${lesson.order} w module ${module.id}.`);orders.add(lesson.order);
          if(typeof lesson.title!=='string'||!lesson.title.trim())errors.push(`Lekcja ${lesson.id} nie ma tytułu.`);
          if(typeof lesson.goal!=='string'||!lesson.goal.trim())errors.push(`Lekcja ${lesson.id} nie ma celu „Potrafię…”.`);
          if(!Array.isArray(lesson.stages)||!lesson.stages.length)errors.push(`Lekcja ${lesson.id} nie ma etapów.`);
          else for(const stage of lesson.stages)if(!ALLOWED_STAGES.includes(stage))errors.push(`Lekcja ${lesson.id} ma nieznany etap: ${stage}.`);
          if(new Set(lesson.stages||[]).size!==(lesson.stages||[]).length)errors.push(`Lekcja ${lesson.id} ma powtórzone etapy.`);
          const rules=lesson.completionRules||{};
          if(!Number.isFinite(Number(rules.minimumAccuracy))||Number(rules.minimumAccuracy)<1||Number(rules.minimumAccuracy)>100)errors.push(`Lekcja ${lesson.id} ma nieprawidłowy próg zaliczenia.`);
          if(rules.minimumMaterialAccuracy!==undefined&&(!Number.isFinite(Number(rules.minimumMaterialAccuracy))||Number(rules.minimumMaterialAccuracy)<1||Number(rules.minimumMaterialAccuracy)>100))errors.push(`Lekcja ${lesson.id} ma nieprawidłowy próg kluczowych materiałów.`);
          const materialIds=lessonMaterialIds(lesson),reviewIds=unique(lesson.reviewMaterialIds||[]),requiredMaterialIds=unique(rules.requiredMaterialIds||[]);
          if(lesson.stageMaterialIds!==undefined&&!isObject(lesson.stageMaterialIds))errors.push(`Lekcja ${lesson.id} ma nieprawidłową mapę etapów.`);
          for(const [stage,ids] of Object.entries(lesson.stageMaterialIds||{})){
            if(!ALLOWED_STAGES.includes(stage))errors.push(`Lekcja ${lesson.id} ma materiały dla nieznanego etapu: ${stage}.`);
            if(!Array.isArray(ids))errors.push(`Lekcja ${lesson.id} ma nieprawidłową listę materiałów etapu ${stage}.`);
            else for(const id of unique(ids))if(!materialIds.includes(id))errors.push(`Lekcja ${lesson.id} ma materiał etapu ${stage} spoza lekcji: ${id}.`);
          }
          if(lesson.carMaterialIds!==undefined&&!Array.isArray(lesson.carMaterialIds))errors.push(`Lekcja ${lesson.id} ma nieprawidłową listę materiałów samochodowych.`);
          for(const id of lessonCarMaterialIds(lesson))if(!materialIds.includes(id))errors.push(`Lekcja ${lesson.id} ma materiał samochodowy spoza lekcji: ${id}.`);
          if(lesson.grammarNote!==undefined){
            if(!isObject(lesson.grammarNote)||typeof lesson.grammarNote.title!=='string'||typeof lesson.grammarNote.explanation!=='string')errors.push(`Lekcja ${lesson.id} ma nieprawidłowe wyjaśnienie gramatyczne.`);
            if(lesson.grammarNote?.examples!==undefined&&!Array.isArray(lesson.grammarNote.examples))errors.push(`Lekcja ${lesson.id} ma nieprawidłowe przykłady gramatyczne.`);
          }
          if(rules.requiredMaterialIds!==undefined&&!Array.isArray(rules.requiredMaterialIds))errors.push(`Lekcja ${lesson.id} ma nieprawidłową listę kluczowych materiałów.`);
          for(const id of requiredMaterialIds)if(!materialIds.includes(id)&&!reviewIds.includes(id))errors.push(`Lekcja ${lesson.id} wskazuje kluczowy materiał spoza lekcji: ${id}.`);
          if((lesson.status||'draft')==='published'&&!materialIds.length)errors.push(`Opublikowana lekcja ${lesson.id} nie ma materiału.`);
          for(const id of [...materialIds,...reviewIds])if(validIds.size&&!validIds.has(id))errors.push(`Lekcja ${lesson.id} wskazuje nieznany materiał: ${id}.`);
          if(materialIds.some(id=>reviewIds.includes(id)))warnings.push(`Lekcja ${lesson.id} ma ten sam materiał jako nowy i powtórkowy.`);
          if((lesson.stages||[]).includes('finalTask')&&!lesson.finalTask)errors.push(`Lekcja ${lesson.id} ma etap finalTask bez definicji zadania końcowego.`);
          if(lesson.finalTask){
            if(typeof lesson.finalTask.instruction!=='string'||!lesson.finalTask.instruction.trim())errors.push(`Zadanie końcowe ${lesson.id} nie ma polecenia.`);
            if(!['writing','speaking','dialogue'].includes(lesson.finalTask.mode||'writing'))errors.push(`Zadanie końcowe ${lesson.id} ma nieznany tryb.`);
            const accepted=unique(lesson.finalTask.acceptedAnswers||[]),keywordGroups=Array.isArray(lesson.finalTask.requiredKeywords)?lesson.finalTask.requiredKeywords:[];
            if(lesson.finalTask.acceptedAnswers!==undefined&&!Array.isArray(lesson.finalTask.acceptedAnswers))errors.push(`Zadanie końcowe ${lesson.id} ma nieprawidłowe warianty odpowiedzi.`);
            if(lesson.finalTask.requiredKeywords!==undefined&&(!Array.isArray(lesson.finalTask.requiredKeywords)||keywordGroups.some(group=>!(typeof group==='string'||Array.isArray(group)))))errors.push(`Zadanie końcowe ${lesson.id} ma nieprawidłowe kryteria słów kluczowych.`);
            const normalizedGroups=keywordGroups.map(group=>unique(Array.isArray(group)?group:[group])).filter(group=>group.length);
            if(lesson.finalTask.minimumKeywordGroups!==undefined&&(!Number.isInteger(Number(lesson.finalTask.minimumKeywordGroups))||Number(lesson.finalTask.minimumKeywordGroups)<1||Number(lesson.finalTask.minimumKeywordGroups)>normalizedGroups.length))errors.push(`Zadanie końcowe ${lesson.id} ma nieprawidłową liczbę wymaganych kryteriów.`);
            for(const field of ['minimumSentences','minimumKeywordSentences','minimumPeople','minimumActions'])if(lesson.finalTask[field]!==undefined&&(!Number.isInteger(Number(lesson.finalTask[field]))||Number(lesson.finalTask[field])<1||Number(lesson.finalTask[field])>20))errors.push(`Zadanie końcowe ${lesson.id} ma nieprawidłowe pole ${field}.`);
            if(lesson.finalTask.actionGroups!==undefined&&(!Array.isArray(lesson.finalTask.actionGroups)||lesson.finalTask.actionGroups.some(group=>!Array.isArray(group)||!group.length||group.some(value=>typeof value!=='string'||!value.trim()))))errors.push(`Zadanie końcowe ${lesson.id} ma nieprawidłowe grupy czynności.`);
            if(lesson.finalTask.minimumActions!==undefined&&Number(lesson.finalTask.minimumActions)>(lesson.finalTask.actionGroups||[]).length)errors.push(`Zadanie końcowe ${lesson.id} wymaga większej liczby czynności niż zdefiniowano grup.`);
            if((lesson.status||'draft')==='published'&&!accepted.length&&!normalizedGroups.length)errors.push(`Opublikowane zadanie końcowe ${lesson.id} nie ma obiektywnych kryteriów oceny.`);
          }
        }
      }
    }
    return {valid:errors.length===0,errors,warnings};
  }

  function defaultLessonProgress(status='locked'){
    return {status:LESSON_STATUSES.includes(status)?status:'locked',attempts:0,bestAccuracy:0,lastAccuracy:0,lastResult:null,lastStartedAt:null,completedAt:null,stagesCompleted:[],finalTaskCompleted:false};
  }
  function defaultCourseState(catalog){
    const activeLevelIds=(catalog?.levels||[]).filter(level=>level.status==='active').map(level=>level.id);
    const firstIds=unique(activeLevelIds.map(level=>firstPublishedLessonId(catalog,level)).filter(Boolean));
    if(!firstIds.length){const fallback=firstPublishedLessonId(catalog);if(fallback)firstIds.push(fallback);}
    const first=firstIds[0]||null,firstModuleIds=unique(firstIds.map(id=>lessonById(catalog,id)?.moduleId).filter(Boolean));
    const lessons={};
    for(const lesson of flattenLessons(catalog))lessons[lesson.id]=defaultLessonProgress(firstIds.includes(lesson.id)?'available':'locked');
    return {schemaVersion:2,selectedLevel:'A1',currentLessonId:first,lastLessonId:null,unlockedLessonIds:firstIds,unlockedModuleIds:firstModuleIds,completedModuleIds:[],introducedMaterialIds:[],lessons};
  }
  function migrateCourseState(source,catalog,validMaterialIds=[]){
    const fresh=defaultCourseState(catalog),input=isObject(source)?source:{},validLessons=new Set(flattenLessons(catalog).map(lesson=>lesson.id)),published=new Set(publishedLessons(catalog).map(lesson=>lesson.id)),validModules=new Set(flattenModules(catalog).map(module=>module.id)),validMaterials=new Set(validMaterialIds||[]);
    const lessons={};
    for(const lesson of flattenLessons(catalog)){
      const raw=isObject(input.lessons?.[lesson.id])?input.lessons[lesson.id]:{},base=fresh.lessons[lesson.id]||defaultLessonProgress();
      const status=LESSON_STATUSES.includes(raw.status)?raw.status:base.status;
      lessons[lesson.id]={
        ...base,...raw,status,
        attempts:clamp(Math.floor(raw.attempts||0),0,100000),bestAccuracy:clamp(raw.bestAccuracy||0,0,100),lastAccuracy:clamp(raw.lastAccuracy||0,0,100),
        stagesCompleted:unique(raw.stagesCompleted||[]).filter(stage=>ALLOWED_STAGES.includes(stage)),finalTaskCompleted:!!raw.finalTaskCompleted,
        lastStartedAt:typeof raw.lastStartedAt==='string'?raw.lastStartedAt:null,completedAt:typeof raw.completedAt==='string'?raw.completedAt:null,
        lastResult:['retry','review_required','completed','mastered',null].includes(raw.lastResult)?raw.lastResult:null
      };
    }
    let unlocked=unique(input.unlockedLessonIds||[]).filter(id=>published.has(id));
    const firstIds=unique((catalog?.levels||[]).filter(level=>level.status==='active').map(level=>firstPublishedLessonId(catalog,level)).filter(Boolean));
    const first=firstIds[0]||firstPublishedLessonId(catalog);
    for(const firstId of firstIds)if(!unlocked.includes(firstId))unlocked.push(firstId);
    for(const [id,progress] of Object.entries(lessons))if(['completed','review_required','mastered','available','in_progress'].includes(progress.status)&&published.has(id)&&!unlocked.includes(id))unlocked.push(id);
    for(const [id,progress] of Object.entries(lessons)){if(['completed','review_required','mastered'].includes(progress.status)){const nextId=nextPublishedLessonId(catalog,id);if(nextId&&published.has(nextId)&&!unlocked.includes(nextId))unlocked.push(nextId);}}
    for(const id of unlocked)if(lessons[id]?.status==='locked')lessons[id].status='available';
    const selectedLevel=ALLOWED_LEVELS.includes(input.selectedLevel)?input.selectedLevel:(fresh.selectedLevel||'A1');
    const currentLessonId=validLessons.has(input.currentLessonId)&&published.has(input.currentLessonId)?input.currentLessonId:(unlocked.find(id=>lessons[id]&&!['completed','mastered'].includes(lessons[id].status))||first||null);
    const completedModuleIds=unique(input.completedModuleIds||[]).filter(id=>validModules.has(id));
    const unlockedModuleIds=unique(input.unlockedModuleIds||[]).filter(id=>validModules.has(id));
    for(const lessonId of unlocked){const moduleId=lessonById(catalog,lessonId)?.moduleId;if(moduleId&&!unlockedModuleIds.includes(moduleId))unlockedModuleIds.push(moduleId);}
    for(const moduleId of completedModuleIds)if(!unlockedModuleIds.includes(moduleId))unlockedModuleIds.push(moduleId);
    return {
      schemaVersion:2,selectedLevel,currentLessonId,lastLessonId:validLessons.has(input.lastLessonId)?input.lastLessonId:null,
      unlockedLessonIds:unlocked,unlockedModuleIds,completedModuleIds,
      introducedMaterialIds:unique(input.introducedMaterialIds||[]).filter(id=>!validMaterials.size||validMaterials.has(id)),lessons
    };
  }
  function canStartLesson(courseState,catalog,lessonId){
    const lesson=lessonById(catalog,lessonId);if(!lesson||lesson.status!=='published')return false;
    return !!courseState?.unlockedLessonIds?.includes(lessonId)&&courseState?.lessons?.[lessonId]?.status!=='locked';
  }

  function buildCourseTasks(lesson,options={}){
    if(!lesson||lesson.status!=='published')return [];
    const known=new Set(unique(options.introducedMaterialIds||[])),dueIds=unique(options.dueMaterialIds||[]),wordMap=options.wordMap instanceof Map?options.wordMap:new Map(),isVocabulary=options.isVocabularyItem||(()=>false),isSentence=options.isSentenceItem||(()=>true),tasks=[],seenKeys=new Set();
    const push=task=>{const key=task.taskId||`${task.stage}|${task.mode}|${task.wordId||''}|${(task.materialIds||[]).join(',')}`;if(seenKeys.has(key))return;seenKeys.add(key);tasks.push(task);};
    const lessonScope=new Set([...lessonMaterialIds(lesson),...unique(lesson.reviewMaterialIds||[])]);
    const reviewCandidates=unique([...(lesson.reviewMaterialIds||[]),...dueIds.filter(id=>lessonScope.has(id))]).filter(id=>known.has(id)&&wordMap.has(id));
    if((lesson.stages||[]).includes('review'))for(const id of reviewCandidates.slice(0,Math.max(0,Number(lesson.reviewLimit)||5)))push({taskId:`${lesson.id}:review:${id}`,wordId:id,kind:'review',mode:isSentence(wordMap.get(id))?'sentence_translate':'en_pl',stage:'review',required:false,counted:true});
    const materials=lessonMaterialIds(lesson).filter(id=>wordMap.has(id));
    const idsFor=stage=>{const configured=stageMaterialIds(lesson,stage);return (configured.length?configured:materials).filter(id=>wordMap.has(id));};
    if((lesson.stages||[]).includes('introduction')){
      const newIds=idsFor('introduction').filter(id=>!known.has(id));
      const groupSize=Math.min(8,Math.max(1,Number(lesson.introductionGroupSize)||5));
      for(let index=0;index<newIds.length;index+=groupSize){const group=newIds.slice(index,index+groupSize);push({taskId:`${lesson.id}:intro-group:${index/groupSize+1}`,materialIds:group,kind:'new',mode:'course_intro_group',stage:'introduction',required:true,counted:false});}
      if(lesson.grammarNote)push({taskId:`${lesson.id}:grammar`,kind:'new',mode:'course_grammar',stage:'introduction',required:true,counted:false,grammarNote:clone(lesson.grammarNote)});
    }
    const addStage=(stage,modeFor)=>{
      if(!(lesson.stages||[]).includes(stage))return;
      for(const id of idsFor(stage)){
        const word=wordMap.get(id),wasKnown=known.has(id),mode=typeof modeFor==='function'?modeFor(word):modeFor;
        push({taskId:`${lesson.id}:${stage}:${id}`,wordId:id,kind:wasKnown?'review':'new',mode,stage,required:true,counted:true});
      }
    };
    if((lesson.stages||[]).includes('recognition')){const recognitionIds=idsFor('recognition');for(const id of recognitionIds){const word=wordMap.get(id),wasKnown=known.has(id);push({taskId:`${lesson.id}:recognition:${id}`,wordId:id,kind:wasKnown?'review':'new',mode:'word_choice',stage:'recognition',required:true,counted:true,choicePoolIds:recognitionIds});}}
    addStage('writing',word=>word?.courseType==='term'?'word_write':(isSentence(word)?'sentence_translate':'word_write'));
    addStage('listening','listening_write');
    addStage('speaking','speaking');
    addStage('dialogue','dialogue');
    if((lesson.stages||[]).includes('finalTask')&&lesson.finalTask){
      const accepted=unique(lesson.finalTask.acceptedAnswers||[]),requiredKeywords=(Array.isArray(lesson.finalTask.requiredKeywords)?lesson.finalTask.requiredKeywords:[]).map(group=>unique(Array.isArray(group)?group:[group])).filter(group=>group.length),minimumKeywordGroups=Math.min(requiredKeywords.length,Math.max(0,Number(lesson.finalTask.minimumKeywordGroups)||requiredKeywords.length)),requiredChecks=unique(lesson.finalTask.requiredChecks||[]),minimumSentences=Math.max(0,Number(lesson.finalTask.minimumSentences)||0),automaticKeywordSentences=lesson.level==='A2'&&minimumSentences>1?Math.min(2,minimumSentences,minimumKeywordGroups):0,minimumKeywordSentences=Math.max(0,Number(lesson.finalTask.minimumKeywordSentences)||automaticKeywordSentences);
      push({taskId:`${lesson.id}:final`,kind:'new',mode:'course_final',stage:'finalTask',required:true,counted:true,prompt:lesson.finalTask.instruction||'',hint:lesson.finalTask.hint||'',answerMode:lesson.finalTask.mode||'writing',acceptedAnswers:accepted,expectedAnswer:accepted[0]||'',exampleAnswer:lesson.finalTask.exampleAnswer||accepted[0]||'',minimumWords:Math.max(0,Number(lesson.finalTask.minimumWords)||0),requiredKeywords,minimumKeywordGroups,requiredChecks,minimumSentences,minimumKeywordSentences,minimumPeople:Math.max(0,Number(lesson.finalTask.minimumPeople)||0),actionGroups:(lesson.finalTask.actionGroups||[]).map(group=>unique(group)),minimumActions:Math.max(0,Number(lesson.finalTask.minimumActions)||0)});
    }
    return tasks;
  }

  function evaluateLessonAttempt(session,lesson){
    const results=Array.isArray(session?.taskResults)?session.taskResults:[],counted=results.filter(result=>result.counted!==false&&result.stage!=='introduction'),correct=counted.filter(result=>result.status==='correct').length,partial=counted.filter(result=>result.status==='partial').length,total=counted.length;
    const accuracy=total?Math.round((correct+partial*.5)/total*100):0,completedStages=unique(results.filter(result=>result.completed!==false).map(result=>result.stage)).filter(Boolean),requiredStages=unique((lesson?.stages||[]).filter(stage=>stage!=='review'));
    const missingStages=requiredStages.filter(stage=>!completedStages.includes(stage));
    const finalTaskRequired=lesson?.completionRules?.requiredFinalTask!==false&&(lesson?.stages||[]).includes('finalTask'),finalTaskCompleted=!finalTaskRequired||results.some(result=>result.stage==='finalTask'&&result.status==='correct');
    const requiredMaterialIds=unique(lesson?.completionRules?.requiredMaterialIds||[]),minimumMaterialAccuracy=clamp(lesson?.completionRules?.minimumMaterialAccuracy||50,1,100);
    const failedRequiredMaterialIds=requiredMaterialIds.filter(id=>{const materialResults=counted.filter(result=>result.wordId===id);if(!materialResults.length)return true;const materialCorrect=materialResults.filter(result=>result.status==='correct').length,materialPartial=materialResults.filter(result=>result.status==='partial').length;return Math.round((materialCorrect+materialPartial*.5)/materialResults.length*100)<minimumMaterialAccuracy;});
    const requiredMaterialsPassed=failedRequiredMaterialIds.length===0;
    const threshold=clamp(lesson?.completionRules?.minimumAccuracy||70,1,100),softThreshold=Math.max(1,threshold-20);let outcome='retry',unlockNext=false;
    if(finalTaskCompleted&&requiredMaterialsPassed&&!missingStages.length&&accuracy>=90){outcome='mastered';unlockNext=true;}
    else if(finalTaskCompleted&&requiredMaterialsPassed&&!missingStages.length&&accuracy>=threshold){outcome='completed';unlockNext=true;}
    else if(finalTaskCompleted&&requiredMaterialsPassed&&!missingStages.length&&accuracy>=softThreshold){outcome='review_required';unlockNext=true;}
    const weakMaterialIds=unique([...results.filter(result=>result.wordId&&result.status!=='correct').map(result=>result.wordId),...failedRequiredMaterialIds]);
    return {outcome,accuracy,correct,partial,total,finalTaskCompleted,requiredMaterialsPassed,failedRequiredMaterialIds,completedStages,missingStages,unlockNext,weakMaterialIds};
  }

  function applyLessonResult(courseState,catalog,lessonId,result,when=new Date().toISOString()){
    const next=clone(courseState||defaultCourseState(catalog)),lesson=lessonById(catalog,lessonId);if(!lesson||!next.lessons[lessonId])return next;
    next.unlockedModuleIds=unique(next.unlockedModuleIds||[]);if(lesson.moduleId&&!next.unlockedModuleIds.includes(lesson.moduleId))next.unlockedModuleIds.push(lesson.moduleId);
    const progress=next.lessons[lessonId];progress.attempts=(progress.attempts||0)+1;progress.lastAccuracy=result.accuracy||0;progress.bestAccuracy=Math.max(progress.bestAccuracy||0,result.accuracy||0);progress.lastResult=result.outcome;progress.stagesCompleted=unique(result.completedStages||[]);progress.finalTaskCompleted=!!result.finalTaskCompleted;progress.lastStartedAt=progress.lastStartedAt||when;
    progress.status=result.outcome==='retry'?'in_progress':result.outcome; if(result.outcome!=='retry')progress.completedAt=when;
    next.lastLessonId=lessonId;next.currentLessonId=lessonId;
    if(result.unlockNext){
      const nextId=nextPublishedLessonId(catalog,lessonId);if(nextId){if(!next.unlockedLessonIds.includes(nextId))next.unlockedLessonIds.push(nextId);if(next.lessons[nextId]?.status==='locked')next.lessons[nextId].status='available';const nextModuleId=lessonById(catalog,nextId)?.moduleId;if(nextModuleId&&!next.unlockedModuleIds.includes(nextModuleId))next.unlockedModuleIds.push(nextModuleId);next.currentLessonId=nextId;}
    }
    const module=moduleById(catalog,lesson.moduleId),moduleLessons=(module?.lessons||[]).filter(item=>item.status==='published');if(moduleLessons.length&&moduleLessons.every(item=>['completed','review_required','mastered'].includes(next.lessons[item.id]?.status))&&!next.completedModuleIds.includes(module.id))next.completedModuleIds.push(module.id);
    return next;
  }

  global.CourseCore={ALLOWED_LEVELS,ALLOWED_STAGES,LESSON_STATUSES,TASK_MODES,flattenModules,flattenLessons,publishedLessons,lessonById,moduleById,nextPublishedLessonId,firstPublishedLessonId,lessonMaterialIds,lessonCarMaterialIds,stageMaterialIds,allCatalogMaterialIds,validateCatalog,defaultLessonProgress,defaultCourseState,migrateCourseState,canStartLesson,buildCourseTasks,evaluateLessonAttempt,applyLessonResult};
})(window);
