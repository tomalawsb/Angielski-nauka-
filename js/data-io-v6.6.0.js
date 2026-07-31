'use strict';

/**
 * Angielski Daily Trainer 6.6.0
 * Eksport do pliku, import pliku/tekstu i zerowanie danych użytkownika.
 */

function exportPayload(){
  state.version=APP_VERSION;
  state.contentVersion=CONTENT_VERSION;
  return JSON.stringify(state,null,2);
}
function backupFileName(){return `angielski-daily-trainer-${APP_VERSION}-${todayKey()}.json`;}
function prepareExportText(){
  const box=$('dataBox');if(!box)return '';
  const payload=exportPayload();box.value=payload;
  setText('dataStatus','Kopia jest gotowa w polu tekstowym. Możesz ją skopiować albo pobrać jako plik.');
  box.focus();box.select?.();notify('Dane eksportu zostały przygotowane.','success');return payload;
}
function downloadExportFile(){
  const payload=exportPayload(),blob=new Blob([payload],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=backupFileName();link.rel='noopener';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  const box=$('dataBox');if(box)box.value=payload;
  setText('dataStatus','Pobrano kopię danych. Przechowuj plik poza pamięcią przeglądarki.');notify('Kopia JSON została pobrana.','success');
  return payload;
}
function exportData(options={}){return options.download===false?prepareExportText():downloadExportFile();}
function applyImportedText(rawText,sourceLabel='tekstu'){
  const previous=state;
  try{
    const imported=validateImportedState(rawText||'');state=imported;
    if(!save()){state=previous;return false;}
    syncSettings();renderAll();setText('dataStatus',`Import z ${sourceLabel} zakończony poprawnie. Wersja treści: ${CONTENT_VERSION}.`);notify('Import zakończony.','success');return true;
  }catch(error){console.error('Import:',error);state=previous;setText('dataStatus',error.message);notify(error.message,'error');return false;}
}
function importData(){return applyImportedText($('dataBox')?.value||'','pola tekstowego');}
async function importDataFile(file){
  if(!file)return false;
  if(file.size>MAX_IMPORT_SIZE){const message='Plik importu jest za duży. Maksymalny rozmiar to 1 MB.';setText('dataStatus',message);notify(message,'error');return false;}
  if(!/\.json$/i.test(file.name||'')&&file.type&&file.type!=='application/json'){const message='Wybierz plik JSON utworzony przez aplikację.';setText('dataStatus',message);notify(message,'error');return false;}
  try{const text=await file.text();const box=$('dataBox');if(box)box.value=text;return applyImportedText(text,'pliku '+file.name);}catch(error){const message='Nie udało się odczytać pliku: '+error.message;setText('dataStatus',message);notify(message,'error');return false;}
}
async function resetProgress(){const confirmed=await askConfirm('Usunąć cały postęp?','Zostaną usunięte: postęp, statystyki, ustawienia, historia sesji i dane starszych wersji. Operacji nie można cofnąć.','Usuń wszystko');if(!confirmed)return;for(const key of [STORAGE_KEY,...OLD_KEYS])safeRemove(key);try{for(let index=localStorage.length-1;index>=0;index--){const key=localStorage.key(index);if(key&&(/angielski|english.*trainer/i.test(key)))safeRemove(key);}}catch(error){console.warn('Czyszczenie starszych kluczy:',error);}state=defState();session=null;save({silent:true});syncSettings();renderAll();show('today');notify('Cały postęp został usunięty.','success');setTimeout(openOnboarding,250);}
