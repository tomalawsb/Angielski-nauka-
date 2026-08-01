'use strict';

/**
 * Angielski Daily Trainer 6.6.0
 * Uruchomienie aplikacji i interfejs testowy.
 * Wydzielone z wersji 5.8.3 bez zmiany zachowania aplikacji.
 */

function boot(){
  const catalogCheck=courseCatalogStatus();if(!catalogCheck.valid)throw new Error('Nieprawidłowy katalog kursu: '+catalogCheck.errors[0]);
  state=loadState();
  const removedOldPractice=discardIncompatiblePracticeSession({persist:false});
  if(removedOldPractice)save({silent:true});
  applyAppearance();
  bind();
  setupKeyboardHandling();
  setupSystemThemeListener();
  setupFilters();
  setupVoices();
  syncSettings();
  renderAll();
  show('today');
  registerServiceWorker().then(()=>configureReminders(false));
  startReminderClock();
  if(!state.settings.onboardingComplete)setTimeout(openOnboarding,200);
}
function shuffle(array){const result=[...array];for(let index=result.length-1;index>0;index--){const swap=Math.floor(Math.random()*(index+1));[result[index],result[swap]]=[result[swap],result[index]];}return result;}

window.__trainerTests={normalize,todayKey,addDays,isCloseEnough,answerScore,bestAnswerScore,migrateProgress,advanceProgress,migrate,validateImportedState,isVoiceAllowed,acceptedAnswers,scoreTaskAnswer,semanticTaskResult,A2_SEMANTIC_VALIDATORS,repeatedSemanticContent,hasSelfName,wordsOf,dl,WORDS,WORD_ALIASES,COURSE_CATALOG,CONTENT_VERSION,CONTENT_QUALITY,CourseCore,CourseUiCore,courseDashboard,courseCatalogStatus,courseLessons,publishedCourseLessons,courseLesson,courseLessonProgress,courseKnownMaterialIds,canStartCourseLesson,buildCourseLessonQueue,courseLessonCarMaterialIds,buildLessonCarQueue,startLessonCarSession,latestCourseLessonForCar,startCourseLesson,recordCourseTaskResult,finalizeCourseAttempt,practiceQueue,modeLabel,expected,handleVoiceCommand,matchesStudyFilters,courseTopicMaterialIds,practiceSessionMatchesFilters,discardIncompatiblePracticeSession,trainingTopicOptions,trainingTopicLabel,trainingTopicHelp,applyTrainingFilters,clearPracticeSessionForFilterChange,exportPayload,backupFileName,applyImportedText,isVocabularyItem,isSentenceItem,practiceBase,due,weak,activeWords,getState:()=>state,applyAppearance,DIALOGUE_SCENES,hasQualityExample,sentenceEn,uniqueTasks,shuffle,diffMarkup,preferNotRecent,orderedReviews,startSession,mark,retryCurrent,getSession:()=>session};
document.addEventListener('DOMContentLoaded',()=>{try{boot();}catch(error){console.error(error);err(error.message||error);}});
