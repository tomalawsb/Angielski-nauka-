
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),context={console};context.window=context;context.globalThis=context;vm.createContext(context);
for(const file of ['js/course-core-v6.6.0.js','data/materials-v6.6.0.js','data/dialogues-v6.6.0.js','data/course-a1-module1-v6.6.0.js','data/course-a1-full-expansion-v6.6.0.js','data/course-a2-full-v6.6.0.js','data/course-catalog-v6.6.0.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const words=context.TRAINER_WORDS,catalog=context.TRAINER_COURSE_CATALOG,level=catalog.levels.find(x=>x.id==='A2');
const lessons=context.CourseCore.flattenLessons(catalog,{includeDraft:false}).filter(x=>x.level==='A2');
const byId=new Map(words.map(w=>[w.id,w]));const used=new Set(lessons.flatMap(l=>context.CourseCore.lessonMaterialIds(l)));
const wrong=[...used].filter(id=>byId.get(id)?.level!=='A2');
const car=lessons.flatMap(l=>(l.carMaterialIds||[]).map(id=>({lesson:l.id,w:byId.get(id)}))).filter(x=>!x.w||x.w.carModeEligible===false||String(x.w.english).trim().split(/\s+/).length<2);
const ids=words.length-new Set(words.map(w=>w.id)).size;const pairs=words.length-new Set(words.map(w=>String(w.english).toLowerCase().trim()+'|'+String(w.polish).toLowerCase().trim())).size;
const own=words.filter(w=>w.level==='A2'&&String(w.id).startsWith('course_a2_')).length;
const ownItems=words.filter(w=>w.level==='A2'&&String(w.id).startsWith('course_a2_'));const missingExamples=ownItems.filter(w=>!Array.isArray(w.examples)||!w.examples.length);const a2Scenes=Object.keys(context.DIALOGUE_SCENES||{}).filter(id=>id.startsWith('course_a2_'));const summary={materials:words.length,a2Materials:own,modules:level?.modules.length||0,lessons:lessons.length,used:used.size,wrongLevel:wrong.length,invalidCar:car.length,duplicateIds:ids,duplicatePairs:pairs,missingExamples:missingExamples.length,a2Scenes:a2Scenes.length};console.log(JSON.stringify(summary,null,2));
const fail=[];if(own<600)fail.push('za mało materiałów A2');if(summary.modules!==12)fail.push('moduły');if(summary.lessons!==60)fail.push('lekcje');if(wrong.length)fail.push('poziom');if(car.length)fail.push('samochód');if(ids)fail.push('ID');if(pairs)fail.push('duplikaty par');if(missingExamples.length)fail.push('przykłady');if(a2Scenes.length!==55)fail.push('dialogi');if(fail.length){console.error('FAIL '+fail.join(', '));process.exit(1)}console.log('PASS pełny audyt A2');
