'use strict';

const APP_VERSION='6.6.0';
const WORDS=window.TRAINER_WORDS||[];
const DIALOGUE_SCENES=window.DIALOGUE_SCENES||{};
const WORD_ALIASES=window.TRAINER_WORD_ALIASES||{};
const COURSE_CATALOG=window.TRAINER_COURSE_CATALOG||{schemaVersion:1,levels:[]};
const CONTENT_VERSION=window.TRAINER_CONTENT_VERSION||COURSE_CATALOG.contentVersion||'a1-a2-2026.07-r1';
const CONTENT_QUALITY=window.TRAINER_CONTENT_QUALITY||{};
const CourseCore=window.CourseCore;
if(!CourseCore)throw new Error('Brak modułu course-core.js');
const Core=window.LearningCore;
if(!Core)throw new Error('Brak modułu learning-core.js');
const {normalize,wordsOf,dl,answerScore,bestAnswerScore,migrateProgress,advanceProgress}=Core;

const STORAGE_KEY='angielski_daily_trainer_state_v660';
const OLD_KEYS=['angielski_daily_trainer_state_v650','angielski_daily_trainer_state_v600','angielski_daily_trainer_state_v591','angielski_daily_trainer_state_v590','angielski_daily_trainer_state_v585','angielski_daily_trainer_state_v584','angielski_daily_trainer_state_v583','angielski_daily_trainer_state_v582','angielski_daily_trainer_state_v581','angielski_daily_trainer_state_v58','angielski_daily_trainer_state_v53','angielski_daily_trainer_state_v5','englishPwaProgressV4','angielski-pwa-progress-v4','angielskiPwaProgress'];
const MAX_IMPORT_SIZE=1024*1024;
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
let state=null;
let session=null;
let selectedChoice=null;
let checked=false;
let recognition=null;
let carRecognition=null;
let lastSpeechText='';
let carAutoTimer=null;
let carCommandMode=false;
let carSilenceRetries=0;
let toastTimer=null;
let onboardingStep=1;
let retrySnapshot=null;

const $=id=>document.getElementById(id);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const percent=(a,b)=>b?Math.round(a/b*100)+'%':'0%';
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const deepClone=value=>JSON.parse(JSON.stringify(value));
const setText=(id,value)=>{const element=$(id);if(element)element.textContent=String(value??'');return element;};

/** Wspólny stan aplikacji i komunikaty. */

function err(message){const box=$('errorBox');if(box){box.style.display='block';box.textContent=String(message);}}
window.addEventListener('error',event=>err('Błąd JS: '+(event.message||event.error||event)));
window.addEventListener('unhandledrejection',event=>err('Błąd promise: '+(event.reason?.message||event.reason||event)));
function notify(message,type='info'){
  const box=$('toast');
  if(!box)return;
  clearTimeout(toastTimer);
  box.textContent=message;
  box.className='toast show'+(type==='error'?' error':type==='success'?' success':'');
  toastTimer=setTimeout(()=>box.className='toast',3200);
}
