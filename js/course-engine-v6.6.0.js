'use strict';

/**
 * Angielski Daily Trainer 6.6.0
 * Integracja modelu kursu z bieżącym stanem, kolejkami i zaliczaniem lekcji.
 */

function courseLessons(options={}){return CourseCore.flattenLessons(COURSE_CATALOG,options);}
function publishedCourseLessons(){return CourseCore.publishedLessons(COURSE_CATALOG);}
function courseLesson(id){return CourseCore.lessonById(COURSE_CATALOG,id);}
function courseModule(id){return CourseCore.moduleById(COURSE_CATALOG,id);}
function courseLessonProgress(id){return state.course?.lessons?.[id]||CourseCore.defaultLessonProgress('locked');}
function courseLessonCarMaterialIds(id){return CourseCore.lessonCarMaterialIds(courseLesson(id));}
function courseKnownMaterialIds(){
  const known=new Set(state.course?.introducedMaterialIds||[]);
  for(const word of WORDS)if(prog(word.id).seen>0)known.add(word.id);
  return [...known];
}
function canStartCourseLesson(id){return CourseCore.canStartLesson(state.course,COURSE_CATALOG,id);}
function courseCatalogStatus(){return CourseCore.validateCatalog(COURSE_CATALOG,WORDS.map(word=>word.id));}
function buildCourseLessonQueue(id){
  const lesson=courseLesson(id);if(!lesson)return [];
  const map=new Map(WORDS.map(word=>[word.id,word]));
  return CourseCore.buildCourseTasks(lesson,{
    introducedMaterialIds:courseKnownMaterialIds(),
    dueMaterialIds:due().map(word=>word.id),wordMap:map,isVocabularyItem,isSentenceItem
  });
}
function setCourseLessonInProgress(id){
  const progress=state.course?.lessons?.[id];if(!progress)return;
  progress.status='in_progress';progress.lastStartedAt=new Date().toISOString();state.course.currentLessonId=id;state.course.lastLessonId=id;
}
function startCourseLesson(id){
  const lesson=courseLesson(id);
  if(!lesson){notify('Nie znaleziono tej lekcji.','error');return false;}
  if(lesson.status!=='published'){notify('Ta lekcja jest jeszcze przygotowywana.','error');return false;}
  if(!canStartCourseLesson(id)){notify('Ta lekcja jest jeszcze zablokowana.','error');return false;}
  const tasks=buildCourseLessonQueue(id);if(!tasks.length){notify('Lekcja nie ma jeszcze przypisanego materiału.','error');return false;}
  const previous=deepClone(state);setCourseLessonInProgress(id);
  startSession(tasks,'course',{source:'course',lessonId:id,moduleId:lesson.moduleId,lessonTitle:lesson.title,lessonGoal:lesson.goal,taskResults:[],stageProgress:{},finalTaskCompleted:false});
  if(!session||session.lessonId!==id){state=previous;return false;}
  return true;
}
function markCourseMaterialIntroduced(id){
  if(!id||!state.course)return;
  const list=new Set(state.course.introducedMaterialIds||[]);list.add(id);state.course.introducedMaterialIds=[...list];
}
function recordCourseTaskResult(task,result){
  if(!session||session.source!=='course'||!task)return;
  session.taskResults=Array.isArray(session.taskResults)?session.taskResults:[];
  const entry={taskId:task.taskId||`${task.stage||'task'}:${task.wordId||session.taskResults.length}`,wordId:task.wordId||null,materialIds:Array.isArray(task.materialIds)?[...task.materialIds]:undefined,stage:task.stage||null,mode:task.mode,status:result?.status||'completed',score:Number(result?.score)||0,counted:task.counted!==false,required:task.required!==false,completed:true,answeredAt:new Date().toISOString()};
  const existing=session.taskResults.findIndex(item=>item.taskId===entry.taskId);if(existing>=0)session.taskResults[existing]=entry;else session.taskResults.push(entry);
  session.stageProgress=session.stageProgress||{};if(entry.stage)session.stageProgress[entry.stage]=(session.stageProgress[entry.stage]||0)+1;
  if(entry.stage==='introduction'&&entry.wordId)markCourseMaterialIntroduced(entry.wordId);
  if(entry.stage==='finalTask'&&['correct','partial'].includes(entry.status)){session.finalTaskCompleted=true;}
}
function completeCourseInfoTask(){
  const current=curTask();if(!current||!['course_intro','course_intro_group','course_grammar'].includes(current.mode)||!session||session.source!=='course')return false;
  recordCourseTaskResult(current,{status:'completed',score:1});
  for(const id of [current.wordId,...(current.materialIds||[])].filter(Boolean))markCourseMaterialIntroduced(id);
  return true;
}
function buildLessonCarQueue(lessonId){
  const lesson=courseLesson(lessonId);if(!lesson)return [];
  const known=new Set(courseKnownMaterialIds()),limit=clamp(parseInt(state.settings.carTaskCount)||12,5,30),seen=new Set();
  return courseLessonCarMaterialIds(lessonId).map(id=>WORDS.find(word=>word.id===id)).filter(word=>word&&known.has(word.id)&&word.carModeEligible!==false&&sentenceEn(word).includes(' ')).filter(word=>{const key=normalize(sentencePl(word)+'|'+sentenceEn(word));if(seen.has(key))return false;seen.add(key);return true;}).slice(0,limit).map(word=>task(word,prog(word.id).status==='weak'?'weak':'review','car_voice'));
}
async function startLessonCarSession(lessonId){
  const progress=courseLessonProgress(lessonId);
  if(!['completed','review_required','mastered'].includes(progress.status)){notify('Sesja samochodowa jest dostępna po zaliczeniu lekcji.','error');return false;}
  if(!state.settings.carWarningDismissed){const allowed=await showCarWarning();if(!allowed)return false;}
  const tasks=buildLessonCarQueue(lessonId);if(!tasks.length){notify('Ta lekcja nie ma jeszcze poznanego materiału do sesji samochodowej.','error');return false;}
  startSession(tasks,'car',{source:'car',originLessonId:lessonId});return true;
}
function latestCourseLessonForCar(){
  const fromHistory=(state.sessions||[]).find(entry=>entry?.source==='course'&&entry.lessonId&&['completed','review_required','mastered'].includes(entry.courseResult));
  if(fromHistory?.lessonId)return fromHistory.lessonId;
  const lastId=state.course?.lastLessonId,progress=lastId?courseLessonProgress(lastId):null;
  return lastId&&['completed','review_required','mastered'].includes(progress?.status)?lastId:null;
}

function scheduleCourseRemediation(result){
  const tomorrow=addDays(1);
  for(const id of result.weakMaterialIds||[]){
    const word=WORDS.find(item=>item.id===id);if(!word)continue;
    const progress=prog(id);progress.status='weak';progress.nextReview=tomorrow;progress.mastery=Math.max(0,(progress.mastery||0)-8);
  }
}
function finalizeCourseAttempt(completedSession){
  if(completedSession?.source!=='course'||!completedSession.lessonId)return null;
  const lesson=courseLesson(completedSession.lessonId);if(!lesson)return null;
  const result=CourseCore.evaluateLessonAttempt(completedSession,lesson);scheduleCourseRemediation(result);
  state.course=CourseCore.applyLessonResult(state.course,COURSE_CATALOG,lesson.id,result,new Date().toISOString());
  completedSession.courseResult=result.outcome;completedSession.courseAccuracy=result.accuracy;completedSession.finalTaskCompleted=result.finalTaskCompleted;
  return result;
}
function currentCourseSummary(result){
  if(!result)return null;
  if(result.outcome==='mastered')return 'Lekcja opanowana bardzo dobrze.';
  if(result.outcome==='completed')return 'Lekcja zaliczona.';
  if(result.outcome==='review_required')return 'Lekcja zaliczona, ale materiał wróci do dodatkowych powtórek.';
  return 'Lekcja wymaga ponownej próby. Wynik i błędy zostały zapisane.';
}
