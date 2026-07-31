'use strict';
(function(global){
  const COMPLETED_STATUSES=new Set(['completed','review_required','mastered']);
  const ACTIVE_STATUSES=new Set(['available','in_progress','review_required']);
  const unique=list=>[...new Set((Array.isArray(list)?list:[]).filter(Boolean).map(String))];
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));

  function lessonUiStatus(lesson,courseState){
    if(!lesson)return 'planned';
    if(lesson.status!=='published')return lesson.status||'draft';
    return courseState?.lessons?.[lesson.id]?.status||'locked';
  }
  function buildSnapshot(catalog,courseState,words=[],items={},sessions=[],levelId='A1'){
    const levels=Array.isArray(catalog?.levels)?catalog.levels:[];
    const level=levels.find(entry=>entry.id===levelId)||levels[0]||{id:levelId,title:levelId,modules:[]};
    const modules=(level.modules||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
    const lessons=CourseCore.flattenLessons(catalog).filter(lesson=>lesson.level===level.id);
    const published=lessons.filter(lesson=>lesson.status==='published');
    const progressFor=lesson=>courseState?.lessons?.[lesson.id]||{};
    const completedLessons=published.filter(lesson=>COMPLETED_STATUSES.has(progressFor(lesson).status));
    const publishedModules=modules.filter(module=>(module.lessons||[]).some(lesson=>lesson.status==='published'));
    const completedModuleIds=new Set(courseState?.completedModuleIds||[]);
    const completedModules=publishedModules.filter(module=>completedModuleIds.has(module.id));
    const currentById=published.find(lesson=>lesson.id===courseState?.currentLessonId);
    const current=currentById&&(!COMPLETED_STATUSES.has(progressFor(currentById).status)||published.every(lesson=>COMPLETED_STATUSES.has(progressFor(lesson).status)))
      ?currentById
      :published.find(lesson=>progressFor(lesson).status==='in_progress')
        ||published.find(lesson=>progressFor(lesson).status==='available')
        ||published.find(lesson=>ACTIVE_STATUSES.has(progressFor(lesson).status))
        ||published.find(lesson=>!COMPLETED_STATUSES.has(progressFor(lesson).status))
        ||published.at(-1)
        ||lessons[0]
        ||null;
    const progressPercent=published.length?Math.round(completedLessons.length/published.length*100):0;
    const wordById=new Map((words||[]).map(word=>[word.id,word]));
    const courseMaterialIds=new Set(unique(published.flatMap(lesson=>CourseCore.lessonMaterialIds(lesson))));
    const introducedIds=unique(courseState?.introducedMaterialIds||[]).filter(id=>courseMaterialIds.has(id));
    const masteredIds=introducedIds.filter(id=>items?.[id]?.status==='mastered');
    const grammarLearningIds=introducedIds.filter(id=>{
      const word=wordById.get(id),grammar=word?.grammar||{};
      const hasGrammar=!!(grammar.partOfSpeech||grammar.structure||grammar.past||grammar.pastParticiple||grammar.typicalPrepositions||word?.partOfSpeech);
      return hasGrammar&&items?.[id]?.status!=='mastered';
    });
    const reviewMaterialIds=introducedIds.filter(id=>items?.[id]?.status==='weak');
    const reviewLessonIds=published.filter(lesson=>['review_required'].includes(progressFor(lesson).status)||progressFor(lesson).lastResult==='retry').map(lesson=>lesson.id);
    const carSessions=(sessions||[]).filter(entry=>entry?.source==='car'||entry?.practice==='car');
    const carCorrect=carSessions.reduce((sum,entry)=>sum+(Number(entry.correct)||0),0);
    const carWrong=carSessions.reduce((sum,entry)=>sum+(Number(entry.wrong)||0),0);
    const moduleEntries=modules.map(module=>{
      const moduleLessons=lessons.filter(lesson=>lesson.moduleId===module.id);
      const modulePublished=moduleLessons.filter(lesson=>lesson.status==='published');
      const moduleCompleted=modulePublished.filter(lesson=>COMPLETED_STATUSES.has(progressFor(lesson).status));
      return {...module,lessons:moduleLessons,publishedCount:modulePublished.length,completedCount:moduleCompleted.length,progressPercent:modulePublished.length?Math.round(moduleCompleted.length/modulePublished.length*100):0,isCompleted:completedModuleIds.has(module.id)};
    });
    const canDo=lessons.map(lesson=>({id:lesson.id,title:lesson.title,goal:lesson.goal,status:lessonUiStatus(lesson,courseState),order:lesson.order,moduleId:lesson.moduleId}));
    return {
      levelId:level.id,levelTitle:level.title||level.id,levelStatus:level.status||'planned',modules:moduleEntries,lessons,publishedLessons:published,
      plannedLessonCount:lessons.length,publishedLessonCount:published.length,completedLessonCount:completedLessons.length,
      publishedModuleCount:publishedModules.length,completedModuleCount:completedModules.length,progressPercent,currentLesson:current,
      knownMaterialCount:introducedIds.length,masteredMaterialCount:masteredIds.length,grammarLearningCount:grammarLearningIds.length,
      reviewAreaCount:new Set([...reviewMaterialIds,...reviewLessonIds]).size,canDo,carSessionCount:carSessions.length,
      carAccuracy:(carCorrect+carWrong)?Math.round(carCorrect/(carCorrect+carWrong)*100):0
    };
  }
  global.CourseUiCore={COMPLETED_STATUSES,lessonUiStatus,buildSnapshot};
})(window);

function selectedCourseLevel(){
  const available=(COURSE_CATALOG.levels||[]).map(level=>level.id);
  const selected=state.course?.selectedLevel||state.settings?.defaultLevel||available[0]||'A1';
  return available.includes(selected)?selected:(available[0]||'A1');
}
function courseDashboard(levelId=selectedCourseLevel()){
  return CourseUiCore.buildSnapshot(COURSE_CATALOG,state.course,WORDS,state.items,state.sessions,levelId);
}
function courseStatusText(status){
  return {draft:'W przygotowaniu',planned:'Planowana',archived:'Archiwalna',locked:'Zablokowana',available:'Dostępna',in_progress:'W trakcie',completed:'Zaliczona',review_required:'Do powtórki',mastered:'Opanowana'}[status]||status;
}
function courseStatusClass(status){
  if(status==='mastered'||status==='completed')return 'green';
  if(status==='review_required')return 'amber';
  if(status==='in_progress'||status==='available')return 'blue';
  return 'neutral';
}
function courseLessonPosition(snapshot,lesson){
  if(!lesson)return '';
  const module=snapshot.modules.find(entry=>entry.id===lesson.moduleId),moduleLessons=module?.lessons||[];
  const index=Math.max(0,moduleLessons.findIndex(entry=>entry.id===lesson.id));
  return `${snapshot.levelId} · Moduł ${module?.order||1} · Lekcja ${index+1} z ${moduleLessons.length||snapshot.plannedLessonCount}`;
}
function renderCourseHome(){
  const snapshot=courseDashboard(),lesson=snapshot.currentLesson,hasCourse=snapshot.publishedLessonCount>0;
  setText('courseHomeEyebrow',hasCourse?courseLessonPosition(snapshot,lesson):`${snapshot.levelId} · Kurs w przygotowaniu`);
  setText('courseHomeTitle',hasCourse?(lesson?.title||`Kurs ${snapshot.levelId}`):(snapshot.modules[0]?.title||`Kurs ${snapshot.levelId}`));
  setText('courseHomeGoal',hasCourse?(lesson?.goal||'Kontynuuj naukę od ostatniego miejsca.'):`Zaplanowano ${snapshot.plannedLessonCount} lekcji. Materiał zostanie udostępniony po przygotowaniu modułu.`);
  setText('courseHomePercent',snapshot.progressPercent+'%');
  setText('courseHomeProgressText',hasCourse?`${snapshot.completedLessonCount} z ${snapshot.publishedLessonCount} lekcji`:`0 z ${snapshot.plannedLessonCount} zaplanowanych lekcji`);
  setProgress($('courseHomeBar'),snapshot.progressPercent);
  const button=$('courseContinueBtn');if(button){button.disabled=!hasCourse||!lesson||lesson.status!=='published'||!canStartCourseLesson(lesson.id);button.querySelector?.('span')&&(button.querySelector('span').textContent=hasCourse?(courseLessonProgress(lesson.id).status==='in_progress'?'Wznów lekcję':'Kontynuuj kurs'):'Kurs w przygotowaniu');}
  setText('homeLevelName',snapshot.levelId);
  setText('homeLevelProgress',snapshot.progressPercent+'%');
  setText('homeLevelDetails',hasCourse?`${snapshot.completedLessonCount}/${snapshot.publishedLessonCount} lekcji · ${snapshot.completedModuleCount}/${snapshot.publishedModuleCount} modułów`:`${snapshot.plannedLessonCount} lekcji w planie`);
  setProgress($('homeLevelBar'),snapshot.progressPercent);
}
function courseLessonRow(snapshot,lesson){
  const status=CourseUiCore.lessonUiStatus(lesson,state.course),progress=courseLessonProgress(lesson.id),canStart=lesson.status==='published'&&canStartCourseLesson(lesson.id);
  const accuracy=progress.bestAccuracy?` · najlepszy wynik ${progress.bestAccuracy}%`:'';const materialCount=CourseCore.lessonMaterialIds(lesson).length;
  return `<button class="course-lesson-row ${canStart?'is-clickable':''}" data-course-lesson="${esc(lesson.id)}" ${canStart?'':'disabled'}><span class="course-lesson-number">${lesson.order}</span><span class="course-lesson-copy"><strong>${esc(lesson.title)}</strong><small>${esc(lesson.goal)}</small><small>${materialCount} materiałów · ok. ${lesson.estimatedMinutes||12} min</small>${accuracy?`<small>${esc(accuracy.slice(3))}</small>`:''}</span><span class="course-status ${courseStatusClass(status)}">${esc(courseStatusText(status))}</span></button>`;
}
function renderCoursePlan(){
  const snapshot=courseDashboard();
  const select=$('courseLevelSelect');
  if(select){const html=(COURSE_CATALOG.levels||[]).map(level=>`<option value="${esc(level.id)}">${esc(level.title||level.id)}</option>`).join('');if(select.innerHTML!==html)select.innerHTML=html;select.value=snapshot.levelId;}
  setText('coursePlanPercent',snapshot.progressPercent+'%');
  setText('coursePlanSummary',snapshot.publishedLessonCount?`${snapshot.completedLessonCount} z ${snapshot.publishedLessonCount} opublikowanych lekcji`:`${snapshot.plannedLessonCount} lekcji zaplanowanych, jeszcze bez publikacji`);
  setProgress($('coursePlanBar'),snapshot.progressPercent);
  const list=$('courseModuleList');if(!list)return;
  if(!snapshot.modules.length){list.innerHTML='<div class="card empty-state"><h2>Ten poziom jest jeszcze planowany</h2><p class="muted">Najpierw powstaje pełna ścieżka A1. Kolejne poziomy zostaną dodane później.</p></div>';return;}
  list.innerHTML=snapshot.modules.map(module=>`<article class="course-module-card"><div class="course-module-head"><div><p class="eyebrow">Moduł ${module.order}</p><h2>${esc(module.title)}</h2></div><span class="badge">${module.publishedCount?`${module.completedCount}/${module.publishedCount}`:'w przygotowaniu'}</span></div><div class="progress"><span class="${widthClass(module.progressPercent)}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${module.progressPercent}" aria-label="Postęp modułu ${esc(module.title)}"></span></div><div class="course-lesson-list">${module.lessons.map(lesson=>courseLessonRow(snapshot,lesson)).join('')}</div></article>`).join('');
}
function renderCourseProgress(){
  const snapshot=courseDashboard();
  setText('courseProgressLevel',snapshot.levelId);
  setText('courseProgressPercent',snapshot.progressPercent+'%');
  setText('courseProgressDescription',snapshot.publishedLessonCount?`${snapshot.completedLessonCount} z ${snapshot.publishedLessonCount} lekcji ukończonych`:`Kurs ma ${snapshot.plannedLessonCount} zaplanowanych lekcji i czeka na publikację materiału.`);
  setProgress($('courseProgressBar'),snapshot.progressPercent);
  setText('courseCompletedLessons',snapshot.completedLessonCount);
  setText('courseCompletedModules',snapshot.completedModuleCount);
  setText('courseKnownMaterials',snapshot.knownMaterialCount);
  setText('courseMasteredMaterials',snapshot.masteredMaterialCount);
  setText('courseGrammarLearning',snapshot.grammarLearningCount);
  setText('courseReviewAreas',snapshot.reviewAreaCount);
  setText('courseCarSessions',snapshot.carSessionCount);
  setText('courseCarAccuracy',snapshot.carAccuracy+'%');
  const list=$('courseCanDoList');if(list){const currentIndex=Math.max(0,snapshot.canDo.findIndex(skill=>skill.id===snapshot.currentLesson?.id)),start=Math.max(0,Math.min(currentIndex-3,Math.max(0,snapshot.canDo.length-12))),visible=snapshot.canDo.slice(start,start+12);list.innerHTML=visible.length?visible.map(skill=>`<div class="can-do-item"><span class="can-do-mark ${courseStatusClass(skill.status)}">${['completed','mastered'].includes(skill.status)?'✓':skill.status==='in_progress'?'…':'•'}</span><div><strong>${esc(skill.goal)}</strong><small>${esc(skill.title)}</small></div><span class="course-status ${courseStatusClass(skill.status)}">${esc(courseStatusText(skill.status))}</span></div>`).join(''):'<p class="muted">Brak zaplanowanych umiejętności dla tego poziomu.</p>';}
}
function renderCourseUi(){renderCourseHome();renderCoursePlan();renderCourseProgress();}
function startCurrentCourseLesson(){
  const snapshot=courseDashboard(),lesson=snapshot.currentLesson;
  if(!snapshot.publishedLessonCount||!lesson||lesson.status!=='published'){show('course');notify('Lekcje kursu są jeszcze przygotowywane.');return false;}
  if(!canStartCourseLesson(lesson.id)){show('course');notify('Ta lekcja jest jeszcze zablokowana.','error');return false;}
  return startCourseLesson(lesson.id);
}
function chooseCourseLevel(levelId){
  if(!(COURSE_CATALOG.levels||[]).some(level=>level.id===levelId))return;
  state.course.selectedLevel=levelId;save({silent:true});renderCourseUi();
}
