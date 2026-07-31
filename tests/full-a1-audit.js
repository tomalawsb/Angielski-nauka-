'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { console };
context.window = context;
context.globalThis = context;
vm.createContext(context);

const sources = [
  'js/course-core-v6.6.0.js',
  'data/materials-v6.6.0.js',
  'data/dialogues-v6.6.0.js',
  'data/course-a1-module1-v6.6.0.js',
  'data/course-a1-full-expansion-v6.6.0.js',
  'data/course-a2-full-v6.6.0.js',
  'data/course-catalog-v6.6.0.js'
];

for (const file of sources) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const words = context.TRAINER_WORDS;
const materialById = new Map(words.map((material) => [material.id, material]));
const level = context.TRAINER_COURSE_CATALOG.levels.find((item) => item.id === 'A1');
const lessons = context.CourseCore
  .flattenLessons(context.TRAINER_COURSE_CATALOG, { includeDraft: false })
  .filter((lesson) => lesson.level === 'A1');
const usedIds = new Set(lessons.flatMap((lesson) => context.CourseCore.lessonMaterialIds(lesson)));

const wrongLevel = [...usedIds]
  .map((id) => materialById.get(id))
  .filter((material) => material && material.level !== 'A1');
const invalidCarMaterials = lessons
  .flatMap((lesson) => (lesson.carMaterialIds || []).map((id) => ({ lessonId: lesson.id, material: materialById.get(id) })))
  .filter(({ material }) => !material || material.carModeEligible === false || String(material.english).trim().split(/\s+/).length < 2);
const duplicateIds = words.length - new Set(words.map((material) => material.id)).size;
const duplicatePairs = words.length - new Set(words.map((material) => (
  `${String(material.english).toLowerCase().trim()}|${String(material.polish).toLowerCase().trim()}`
))).size;

const summary = {
  materials: words.length,
  modules: level ? level.modules.length : 0,
  lessons: lessons.length,
  materialsUsedByA1: usedIds.size,
  wrongLevel: wrongLevel.length,
  invalidCarMaterials: invalidCarMaterials.length,
  duplicateIds,
  duplicateEnglishPolishPairs: duplicatePairs
};

const failures = [];
if (summary.materials < 1700) failures.push(`oczekiwano co najmniej 1700 materiałów, otrzymano ${summary.materials}`);
if (summary.materialsUsedByA1 !== 657) failures.push(`oczekiwano 657 materiałów używanych przez A1, otrzymano ${summary.materialsUsedByA1}`);
if (summary.modules !== 12) failures.push(`oczekiwano 12 modułów, otrzymano ${summary.modules}`);
if (summary.lessons !== 55) failures.push(`oczekiwano 55 lekcji, otrzymano ${summary.lessons}`);
if (wrongLevel.length) failures.push(`materiały spoza A1: ${wrongLevel.map((item) => item.id).join(', ')}`);
if (invalidCarMaterials.length) failures.push(`błędne materiały samochodowe: ${invalidCarMaterials.map((item) => `${item.lessonId}:${item.material?.id || 'BRAK'}`).join(', ')}`);
if (duplicateIds) failures.push(`powtórzone identyfikatory: ${duplicateIds}`);
if (duplicatePairs) failures.push(`powtórzone pary EN/PL: ${duplicatePairs}`);

console.log(JSON.stringify(summary, null, 2));
if (failures.length) {
  console.error(`FAIL: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('PASS pełny audyt A1');
