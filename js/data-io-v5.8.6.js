'use strict';

/**
 * Angielski Daily Trainer 5.8.6
 * Eksport, import i zerowanie danych użytkownika.
 * Wydzielone z wersji 5.8.3 bez zmiany zachowania aplikacji.
 */

function exportData(){const box=$('dataBox');if(!box)return;box.value=JSON.stringify(state,null,2);setText('dataStatus','Kopia jest gotowa. Zapisz zawartość pola w bezpiecznym miejscu.');box.focus();box.select?.();notify('Dane eksportu zostały przygotowane.','success');}
function importData(){const previous=state;try{const imported=validateImportedState($('dataBox')?.value||'');state=imported;if(!save()){state=previous;return;}syncSettings();renderAll();setText('dataStatus','Import zakończony poprawnie.');notify('Import zakończony.','success');}catch(error){console.error('Import:',error);setText('dataStatus',error.message);notify(error.message,'error');}}
async function resetProgress(){const confirmed=await askConfirm('Usunąć cały postęp?','Zostaną usunięte: postęp, statystyki, ustawienia, historia sesji i dane starszych wersji. Operacji nie można cofnąć.','Usuń wszystko');if(!confirmed)return;for(const key of [STORAGE_KEY,...OLD_KEYS])safeRemove(key);try{for(let index=localStorage.length-1;index>=0;index--){const key=localStorage.key(index);if(key&&(/angielski|english.*trainer/i.test(key)))safeRemove(key);}}catch(error){console.warn('Czyszczenie starszych kluczy:',error);}state=defState();session=null;save({silent:true});syncSettings();renderAll();show('today');notify('Cały postęp został usunięty.','success');setTimeout(openOnboarding,250);}
