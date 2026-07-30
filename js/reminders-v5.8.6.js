'use strict';

/**
 * Angielski Daily Trainer 5.8.6
 * Przypomnienia o nauce i kontrola orientacyjnej godziny.
 * Wydzielone z wersji 5.8.3 bez zmiany zachowania aplikacji.
 */

async function configureReminders(askPermission=false){
  if(!state.settings.reminderEnabled||!('Notification'in window))return;
  let permission=Notification.permission;
  if(permission==='default'&&askPermission)permission=await Notification.requestPermission();
  if(permission!=='granted'&&askPermission){state.settings.reminderEnabled=false;syncSettings();save();notify('Przeglądarka nie zezwoliła na powiadomienia.','error');}
}
async function showLearningReminder(){
  if(!state.settings.reminderEnabled||!('Notification'in window)||Notification.permission!=='granted')return;
  const options={body:'Masz krótką sesję lub powtórki do zrobienia.',icon:'./icon-192.png',badge:'./icon-192.png',tag:'daily-learning-reminder',silent:!state.settings.notificationSound};
  try{const registration=('serviceWorker'in navigator)?await navigator.serviceWorker.getRegistration():null;if(registration)await registration.showNotification('Czas na angielski',options);else new Notification('Czas na angielski',options);}catch(error){console.warn('Powiadomienie:',error);}
}
function checkReminderTime(){
  if(!state?.settings?.reminderEnabled)return;
  const now=new Date(),day=todayKey(now),time=state.settings.reminderTime||'19:00';
  const current=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  if(current>=time&&state.settings.reminderLastDay!==day){state.settings.reminderLastDay=day;if(save({silent:true}))showLearningReminder();}
}
function startReminderClock(){if(!('Notification'in window))return;checkReminderTime();setInterval(checkReminderTime,60000);}
