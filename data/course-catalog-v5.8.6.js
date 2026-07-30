'use strict';
(function(){
  const standardStages=['review','introduction','recognition','writing','listening','speaking','finalTask'];
  const lesson=(id,order,title,goal,finalInstruction,requiredKeywords,minimumKeywordGroups=requiredKeywords.length)=>({
    id,level:'A1',moduleId:'a1-m01',order,title,goal,estimatedMinutes:12,status:'draft',
    materialIds:[],reviewMaterialIds:[],stages:[...standardStages],
    finalTask:{mode:'speaking',instruction:finalInstruction,acceptedAnswers:[],minimumWords:3,requiredKeywords,minimumKeywordGroups},
    completionRules:{minimumAccuracy:70,requiredFinalTask:true,requiredMaterialIds:[],minimumMaterialAccuracy:50}
  });
  const catalog={
    schemaVersion:1,catalogVersion:'2026.07-p3',
    levels:[
      {id:'A1',title:'A1 – początkujący',order:1,status:'planned',modules:[
        {id:'a1-m01',level:'A1',order:1,title:'Ja i podstawowe informacje',status:'draft',lessons:[
          lesson('a1-m01-l01',1,'Powitania i pożegnania','Potrafię przywitać się i pożegnać.','Przywitaj się i pożegnaj w dwóch krótkich zdaniach.',[['hello','hi','good morning','good afternoon'],['goodbye','bye','see you']]),
          lesson('a1-m01-l02',2,'Jak masz na imię?','Potrafię podać swoje imię i zapytać o imię rozmówcy.','Przedstaw się i zapytaj rozmówcę o imię.',[['my name is','i am','i m'],['what is your name','what s your name']]),
          lesson('a1-m01-l03',3,'Skąd jesteś?','Potrafię powiedzieć, skąd jestem.','Powiedz, skąd jesteś, i zadaj podobne pytanie.',[['i am from','i m from'],['where are you from']]),
          lesson('a1-m01-l04',4,'Gdzie mieszkasz?','Potrafię powiedzieć, gdzie mieszkam.','Powiedz, gdzie mieszkasz.',[['i live in','i live near']],1),
          lesson('a1-m01-l05',5,'Liczby i wiek','Potrafię podać swój wiek i zrozumieć podstawowe liczby.','Powiedz, ile masz lat.',[['i am','i m'],['years old']],2),
          lesson('a1-m01-l06',6,'Rodzina','Potrafię krótko opisać swoją rodzinę.','Powiedz trzy krótkie zdania o rodzinie.',[['mother','mum','mom','father','dad','brother','sister','wife','husband','son','daughter','family']],1),
          lesson('a1-m01-l07',7,'Podstawowe pytania','Potrafię zadawać najprostsze pytania o osobę.','Zadaj trzy podstawowe pytania nowej osobie.',[['what','where','how','who'],['you','your']],2),
          lesson('a1-m01-l08',8,'Poznawanie nowej osoby','Potrafię przeprowadzić krótką rozmowę przy pierwszym spotkaniu.','Przeprowadź krótkie przedstawienie się.',[['hello','hi'],['my name is','i am','i m'],['nice to meet you']],2),
          lesson('a1-m01-l09',9,'Powtórka modułu','Potrafię wykorzystać materiał z całego modułu.','Przedstaw się w czterech zdaniach.',[['my name is','i am','i m'],['i am from','i m from'],['i live in','i live near']],3),
          lesson('a1-m01-l10',10,'Test praktyczny','Potrafię samodzielnie przedstawić się i odpowiedzieć na podstawowe pytania.','Przedstaw się, podaj wiek, kraj i miejsce zamieszkania.',[['my name is','i am','i m'],['years old'],['i am from','i m from'],['i live in','i live near']],4)
        ]}
      ]},
      {id:'A2',title:'A2 – podstawowy',order:2,status:'planned',modules:[]},
      {id:'B1',title:'B1 – średnio zaawansowany',order:3,status:'planned',modules:[]},
      {id:'B2',title:'B2 – wyższy średnio zaawansowany',order:4,status:'planned',modules:[]}
    ]
  };
  window.TRAINER_COURSE_CATALOG=catalog;
})();
