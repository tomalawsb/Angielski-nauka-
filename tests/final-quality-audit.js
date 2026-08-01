'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const context={console};context.window=context;context.globalThis=context;vm.createContext(context);
const dataFiles=[
  'data/materials-v6.6.0.js','data/dialogues-v6.6.0.js','data/course-a1-module1-v6.6.0.js',
  'data/course-a1-full-expansion-v6.6.0.js','data/course-a2-full-v6.6.0.js',
  'data/content-quality-v6.6.0.js','data/course-catalog-v6.6.0.js'
];
for(const file of dataFiles)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const words=context.TRAINER_WORDS||[];
const catalog=context.TRAINER_COURSE_CATALOG||{};
const scenes=context.DIALOGUE_SCENES||{};
const lessons=(catalog.levels||[]).flatMap(level=>(level.modules||[]).flatMap(module=>module.lessons||[]));
const modules=(catalog.levels||[]).flatMap(level=>level.modules||[]);
const normalize=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const failures=[];
const check=(condition,message)=>{if(condition)console.log('PASS '+message);else{console.log('FAIL '+message);failures.push(message);}};
check(words.length===1713,'baza zawiera dokładnie 1713 materiałów');
check(new Set(words.map(word=>word.id)).size===words.length,'identyfikatory materiałów są unikalne');
check(words.every(word=>word.examples?.some(example=>example.en?.trim()&&example.pl?.trim())),'każdy materiał ma dwujęzyczny przykład');
const examples=words.flatMap(word=>(word.examples||[]).map(example=>normalize(example.en+'|'+example.pl)));
check(new Set(examples).size===examples.length,'przykłady są unikalne');
check(modules.filter(module=>module.status==='published').length===24,'opublikowano 24 moduły A1-A2');
check(lessons.filter(lesson=>lesson.status==='published').length===115,'opublikowano 115 lekcji A1-A2');
check(lessons.filter(lesson=>lesson.level==='A1').length===55&&lessons.filter(lesson=>lesson.level==='A2').length===60,'liczba lekcji A1 i A2 jest prawidłowa');
check(Object.keys(scenes).length===145,'baza zawiera 145 scen dialogowych');
check(catalog.schemaVersion===3&&catalog.catalogVersion==='2026.07-a1-a2-stable-p8','katalog ma stabilny schemat Pakietu 8');
check(catalog.contentVersion==='a1-a2-2026.07-r1','katalog ma jawną wersję treści');
check(words.every(word=>word.contentVersion===catalog.contentVersion),'każdy materiał ma bieżącą wersję treści');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const refs=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match=>match[1]).filter(ref=>!ref.startsWith('data:')&&!/^https?:/.test(ref));
const missingRefs=refs.filter(ref=>!fs.existsSync(path.join(root,ref.split('?')[0])));
check(missingRefs.length===0,'wszystkie lokalne odwołania HTML istnieją');
const sw=fs.readFileSync(path.join(root,'service-worker-v6.6.0.js'),'utf8');
const shellMatch=sw.match(/const APP_SHELL=\[([\s\S]*?)\];/);
const shellRefs=shellMatch?[...shellMatch[1].matchAll(/APP_ENTRY|'([^']+)'/g)].map(match=>match[0]==='APP_ENTRY'?'./index.html':match[1]):[];
const missingShell=shellRefs.filter(ref=>!fs.existsSync(path.join(root,ref.replace(/^\.\//,'').split('?')[0])));
check(shellRefs.length===30&&missingShell.length===0,'Service Worker buforuje 30 istniejących zasobów');
check(sw.includes("VERSION='6.6.0-p8-topic-fix1'")&&sw.includes('await caches.delete(CACHE_NAME);throw error'),'instalacja PWA nie zachowuje niepełnego cache');
const swAlias=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
check(swAlias===sw,'alias Service Workera jest identyczny z plikiem wersjonowanym');
check(html.includes('id="trainingTopic"')&&html.includes('Tematyka treningu dodatkowego'),'interfejs ma bezpośredni wybór tematyki treningu');
check(html.includes('Polityka prywatności')&&html.includes('Mikrofon i rozpoznawanie mowy'),'interfejs zawiera informacje o prywatności i mikrofonie');
check(html.includes('href="#mainContent"')&&html.includes('aria-live="polite"'),'interfejs ma podstawowe mechanizmy dostępności');
console.log(JSON.stringify({materials:words.length,modules:modules.filter(m=>m.status==='published').length,lessons:lessons.filter(l=>l.status==='published').length,dialogues:Object.keys(scenes).length,examples:examples.length,serviceWorkerAssets:shellRefs.length,failures:failures.length},null,2));
process.exit(failures.length?1:0);
