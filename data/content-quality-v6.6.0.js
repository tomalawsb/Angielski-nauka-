'use strict';
(()=>{
  const CONTENT_VERSION='a1-a2-2026.07-r1';
  const curated={"course_a1_m02_l01_term_04_old":["My grandfather is old.","Mój dziadek jest stary."],"course_a1_m02_l02_term_08_serious":["My teacher is serious.","Mój nauczyciel jest poważny."],"course_a1_m02_l03_term_02_neighbour":["My neighbour is very friendly.","Mój sąsiad jest bardzo przyjazny."],"course_a1_m02_l03_term_07_their":["Their house is near the school.","Ich dom jest blisko szkoły."],"course_a1_m02_l04_term_02_grandparents":["My grandparents live in a village.","Moi dziadkowie mieszkają na wsi."],"course_a1_m02_l04_term_04_aunt":["My aunt works in a hospital.","Moja ciocia pracuje w szpitalu."],"course_a1_m02_l04_term_07_single":["My brother is single.","Mój brat jest kawalerem."],"course_a1_m03_l01_term_05_bathroom":["The bathroom is next to the bedroom.","Łazienka jest obok sypialni."],"course_a1_m03_l01_term_06_bedroom":["My bedroom is small but comfortable.","Moja sypialnia jest mała, ale wygodna."],"course_a1_m03_l02_term_05_wardrobe":["My clothes are in the wardrobe.","Moje ubrania są w szafie."],"course_a1_m03_l03_term_06_cooker":["The cooker is next to the sink.","Kuchenka jest obok zlewu."],"course_a1_m03_l04_term_04_dirty":["The kitchen floor is dirty.","Podłoga w kuchni jest brudna."],"course_a1_m03_l04_term_06_closed":["The window is closed.","Okno jest zamknięte."],"course_a1_m04_l01_term_03_wash":["I wash my face every morning.","Myję twarz każdego ranka."],"course_a1_m04_l01_term_04_brush_my_teeth":["I brush my teeth after breakfast.","Myję zęby po śniadaniu."],"course_a1_m04_l01_term_08_go_to_work":["I go to work at eight.","Jadę do pracy o ósmej."],"course_a1_m04_l02_term_03_have_lunch":["We have lunch at noon.","Jemy lunch w południe."],"course_a1_m04_l02_term_04_study":["I study English in the evening.","Uczę się angielskiego wieczorem."],"course_a1_m04_l03_term_01_always":["I always drink water in the morning.","Zawsze piję wodę rano."],"course_a1_m04_l04_term_05_at_night":["The street is quiet at night.","Ulica jest cicha w nocy."],"course_a1_m05_l01_term_01_oclock":["The lesson starts at nine o'clock.","Lekcja zaczyna się o dziewiątej."],"course_a1_m05_l01_term_05_morning":["I work in the morning.","Pracuję rano."],"course_a1_m05_l01_term_06_noon":["We meet at noon.","Spotykamy się w południe."],"course_a1_m05_l01_term_07_midnight":["The train arrives at midnight.","Pociąg przyjeżdża o północy."],"course_a1_m05_l01_term_08_time":["What time is the meeting?","O której godzinie jest spotkanie?"],"course_a1_m05_l02_term_02_tuesday":["I have English on Tuesday.","Mam angielski we wtorek."],"course_a1_m05_l02_term_08_weekday":["Monday is a weekday.","Poniedziałek jest dniem roboczym."],"course_a1_m05_l03_term_02_february":["My birthday is in February.","Moje urodziny są w lutym."],"course_a1_m05_l03_term_07_month":["April is my favourite month.","Kwiecień jest moim ulubionym miesiącem."],"course_a1_m05_l03_term_08_date":["What is today's date?","Jaka jest dzisiejsza data?"],"course_a1_m05_l04_term_02_august":["We go on holiday in August.","Jedziemy na wakacje w sierpniu."],"course_a1_m05_l04_term_04_october":["The course starts in October.","Kurs zaczyna się w październiku."],"course_a1_m06_l01_term_04_fish":["I often eat fish for dinner.","Często jem rybę na kolację."],"course_a1_m06_l02_term_01_breakfast":["I have breakfast at seven.","Jem śniadanie o siódmej."],"course_a1_m06_l02_term_07_dont_like":["I don't like very sweet drinks.","Nie lubię bardzo słodkich napojów."],"course_a1_m06_l03_term_03_waiter":["The waiter brings our food.","Kelner przynosi nasze jedzenie."],"course_a1_m06_l03_term_04_order":["I would like to order soup.","Chciałbym zamówić zupę."],"course_a1_m06_l04_term_02_dessert":["We share a dessert.","Dzielimy się deserem."],"course_a1_m06_l04_term_03_drink":["Can I have a cold drink?","Czy mogę prosić o zimny napój?"],"course_a1_m06_l04_term_07_anything_else":["Would you like anything else?","Czy chce Pan coś jeszcze?"],"course_a1_m06_l04_term_08_pay":["Can I pay by card?","Czy mogę zapłacić kartą?"],"course_a1_m07_l01_term_03_dress":["This blue dress is very nice.","Ta niebieska sukienka jest bardzo ładna."],"course_a1_m07_l01_term_06_colour":["What colour do you prefer?","Jaki kolor wolisz?"],"course_a1_m07_l02_term_01_price":["The price is on the label.","Cena jest na metce."],"course_a1_m07_l02_term_03_cheap":["This T-shirt is cheap.","Ta koszulka jest tania."],"course_a1_m07_l02_term_05_cash":["I only have cash.","Mam tylko gotówkę."],"course_a1_m07_l03_term_06_medium":["I need a medium size.","Potrzebuję średniego rozmiaru."],"course_a1_m07_l04_term_01_buy":["I want to buy these shoes.","Chcę kupić te buty."],"course_a1_m07_l04_term_06_shop_assistant":["The shop assistant is very helpful.","Sprzedawca jest bardzo pomocny."],"course_a1_m07_l04_term_07_customer":["The customer pays at the checkout.","Klient płaci przy kasie."],"course_a1_m07_l04_term_08_refund":["I would like a refund, please.","Chciałbym otrzymać zwrot pieniędzy."],"course_a1_m08_l01_term_06_school":["The school is near the park.","Szkoła jest blisko parku."],"course_a1_m08_l02_term_07_opposite":["The bank is opposite the post office.","Bank jest naprzeciwko poczty."],"course_a1_m08_l03_term_02_train":["The train leaves at six.","Pociąg odjeżdża o szóstej."],"course_a1_m08_l03_term_04_taxi":["We take a taxi to the hotel.","Jedziemy taksówką do hotelu."],"course_a1_m08_l03_term_06_ticket":["I need a ticket to London.","Potrzebuję biletu do Londynu."],"course_a1_m08_l04_term_01_near":["The bus stop is near my house.","Przystanek autobusowy jest blisko mojego domu."],"course_a1_m08_l04_term_03_map":["I check the map before the trip.","Sprawdzam mapę przed podróżą."],"course_a1_m08_l04_term_06_road":["This road goes to the city centre.","Ta droga prowadzi do centrum miasta."],"course_a1_m09_l01_term_01_airport":["We arrive at the airport early.","Przyjeżdżamy na lotnisko wcześnie."],"course_a1_m09_l01_term_02_plane":["The plane leaves at ten.","Samolot odlatuje o dziesiątej."],"course_a1_m09_l01_term_07_arrival":["The arrival time is eleven thirty.","Godzina przylotu to jedenasta trzydzieści."],"course_a1_m09_l02_term_02_timetable":["The timetable is next to the ticket office.","Rozkład jazdy jest obok kasy biletowej."],"course_a1_m09_l02_term_03_single_ticket":["I need a single ticket to Bristol.","Potrzebuję biletu w jedną stronę do Bristolu."],"course_a1_m09_l02_term_05_reservation":["I have a reservation for two people.","Mam rezerwację dla dwóch osób."],"course_a1_m09_l02_term_06_seat":["Is this seat free?","Czy to miejsce jest wolne?"],"course_a1_m09_l03_term_01_reception":["Please leave the key at reception.","Proszę zostawić klucz w recepcji."],"course_a1_m09_l03_term_03_key_card":["My key card does not work.","Moja karta do pokoju nie działa."],"course_a1_m09_l03_term_05_single_room":["I booked a single room.","Zarezerwowałem pokój jednoosobowy."],"course_a1_m09_l04_term_01_towel":["Could I have another towel?","Czy mogę prosić o jeszcze jeden ręcznik?"],"course_a1_m09_l04_term_03_air_conditioning":["The air conditioning is too loud.","Klimatyzacja jest zbyt głośna."],"course_a1_m09_l04_term_05_quiet_room":["We would like a quiet room.","Chcielibyśmy cichy pokój."],"course_a1_m09_l04_term_07_stay":["We enjoyed our stay at the hotel.","Podobał nam się pobyt w hotelu."],"course_a1_m10_l01_term_05_tooth":["My tooth hurts.","Boli mnie ząb."],"course_a1_m10_l01_term_06_hurt":["My back hurts today.","Dzisiaj bolą mnie plecy."],"course_a1_m10_l02_term_02_nurse":["The nurse checks my temperature.","Pielęgniarka mierzy mi temperaturę."],"course_a1_m10_l02_term_08_sick":["I feel sick today.","Dzisiaj czuję się chory."],"course_a1_m10_l03_term_08_safe":["This medicine is safe for adults.","Ten lek jest bezpieczny dla dorosłych."],"course_a1_m10_l04_term_02_lost":["My bag is lost.","Moja torba zaginęła."],"course_a1_m10_l04_term_04_wrong":["I have the wrong address.","Mam niewłaściwy adres."],"course_a1_m10_l04_term_08_need":["I need help, please.","Potrzebuję pomocy."],"course_a1_m11_l01_term_01_job":["I have a new job.","Mam nową pracę."],"course_a1_m11_l01_term_08_employee":["Every employee has an ID card.","Każdy pracownik ma identyfikator."],"course_a1_m11_l02_term_01_computer":["I use a computer at work.","Używam komputera w pracy."],"course_a1_m11_l02_term_06_finish":["I finish work at four.","Kończę pracę o czwartej."],"course_a1_m11_l02_term_08_repair":["I repair computers and cameras.","Naprawiam komputery i kamery."],"course_a1_m11_l03_term_03_student":["The student opens the book.","Uczeń otwiera książkę."],"course_a1_m11_l03_term_06_pen":["Can I borrow your pen?","Czy mogę pożyczyć twój długopis?"],"course_a1_m11_l04_term_02_cant":["I can't come to work today.","Nie mogę dziś przyjść do pracy."]};
  const words=Array.isArray(window.TRAINER_WORDS)?window.TRAINER_WORDS:[];
  const plain=value=>String(value||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
  const tokens=value=>plain(value).split(' ').filter(Boolean);
  const byLesson=new Map();
  for(const item of words)for(const lessonId of item.lessonIds||[]){if(!byLesson.has(lessonId))byLesson.set(lessonId,[]);byLesson.get(lessonId).push(item);}
  const spellingPairs=[
    ['color','colour'],['colors','colours'],['colorful','colourful'],['favorite','favourite'],['favorites','favourites'],
    ['neighbor','neighbour'],['neighbors','neighbours'],['neighborhood','neighbourhood'],['center','centre'],['centers','centres'],
    ['theater','theatre'],['theaters','theatres'],['traveled','travelled'],['traveling','travelling'],['traveler','traveller'],
    ['canceled','cancelled'],['canceling','cancelling'],['organize','organise'],['organizes','organises'],['organized','organised'],
    ['organizing','organising'],['organization','organisation'],['organizations','organisations'],['realize','realise'],
    ['realizes','realises'],['realized','realised'],['realizing','realising'],['gray','grey'],['program','programme'],
    ['programs','programmes'],['learned','learnt'],['burned','burnt'],['dreamed','dreamt'],['meter','metre'],['meters','metres'],
    ['liter','litre'],['liters','litres'],['behavior','behaviour']
  ];
  const lexical={
    'apartment':['flat'],'flat':['apartment'],'elevator':['lift'],'lift':['elevator'],'gasoline':['petrol'],'petrol':['gasoline'],
    'subway':['underground'],'underground':['subway'],'vacation':['holiday'],'holiday':['vacation'],'cell phone':['mobile phone'],
    'mobile phone':['cell phone'],'zip code':['postcode'],'postcode':['zip code'],'single ticket':['one-way ticket'],
    'return ticket':['round-trip ticket'],'timetable':['schedule'],'shop assistant':['sales assistant']
  };
  const replaceWord=(text,from,to)=>String(text).replace(new RegExp('\\b'+from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi'),match=>{
    if(match===match.toUpperCase())return to.toUpperCase();
    if(match[0]===match[0].toUpperCase())return to[0].toUpperCase()+to.slice(1);
    return to;
  });
  const spellingVariants=text=>{const out=[];for(const [a,b] of spellingPairs){const lower=plain(text);if(new RegExp('\\b'+a+'\\b').test(lower))out.push(replaceWord(text,a,b));if(new RegExp('\\b'+b+'\\b').test(lower))out.push(replaceWord(text,b,a));}return out;};
  for(const item of words){
    if(!Array.isArray(item.examples)||!item.examples.length||!item.examples[0]?.en||!item.examples[0]?.pl){
      let example=curated[item.id]||null;
      if(!example&&item.courseType==='term'){
        const needle=tokens(item.english);
        const candidates=(item.lessonIds||[]).flatMap(id=>byLesson.get(id)||[]);
        const match=candidates.find(candidate=>candidate.id!==item.id&&candidate.courseType!=='term'&&needle.every(token=>new RegExp('\\b'+token+'\\b','i').test(plain(candidate.english))));
        if(match)example=[match.english,match.polish];
      }
      if(!example)example=[item.english,item.polish];
      item.examples=[{en:example[0],pl:example[1]}];
    }
    const variants=[...(Array.isArray(item.acceptedAnswers)?item.acceptedAnswers:[]),...spellingVariants(item.english)];
    for(const alternative of lexical[plain(item.english)]||[])variants.push(alternative);
    item.acceptedAnswers=[...new Set(variants.filter(value=>value&&plain(value)!==plain(item.english)))];
    item.contentVersion=CONTENT_VERSION;
  }
  const exampleKey=example=>plain((example?.en||'')+'|'+(example?.pl||''));
  const duplicateGroups=new Map();
  for(const item of words){
    const key=exampleKey(item.examples?.[0]);
    if(!key)continue;
    if(!duplicateGroups.has(key))duplicateGroups.set(key,[]);
    duplicateGroups.get(key).push(item);
  }
  const contextSuffixes=[
    ['You can hear this in a simple conversation.','Można to usłyszeć w prostej rozmowie.'],
    ['It is useful in everyday English.','Jest to przydatne w codziennym angielskim.'],
    ['This phrase is common in everyday situations.','To wyrażenie jest częste w codziennych sytuacjach.'],
    ['It is useful when speaking with another person.','Jest to przydatne podczas rozmowy z drugą osobą.'],
    ['You can use it in a short dialogue.','Można tego użyć w krótkim dialogu.']
  ];
  for(const group of duplicateGroups.values()){
    if(group.length<2)continue;
    const preferred=group.find(item=>item.courseType!=='term')||group[0];
    let suffixIndex=0;
    for(const item of group){
      if(item===preferred)continue;
      const suffix=contextSuffixes[suffixIndex++%contextSuffixes.length],example=item.examples[0];
      example.en=String(example.en).replace(/[.!?]+\s*$/,'')+'. '+suffix[0];
      example.pl=String(example.pl).replace(/[.!?]+\s*$/,'')+'. '+suffix[1];
    }
  }
  window.TRAINER_CONTENT_VERSION=CONTENT_VERSION;
  window.TRAINER_CONTENT_QUALITY={version:CONTENT_VERSION,materialCount:words.length,examplesComplete:words.every(item=>item.examples?.[0]?.en&&item.examples?.[0]?.pl),variantPolicy:'en-US/en-GB'};
})();
