'use strict';
window.DIALOGUE_SCENES={
  "scene_b1_001": {
    "conversation": "Ustalenia z klientem",
    "turn": 1,
    "total": 5,
    "role": "Termin",
    "context": "Klientowi nie pasuje czwartkowy termin. Zaproponuj piątek.",
    "prompt": "Client: Thursday does not work for me. Can we choose another day?",
    "promptPl": "Zaproponuj przeniesienie terminu na piątek.",
    "accepted": [
      "Can we move the appointment to Friday?",
      "Could we move the appointment to Friday?",
      "Can we reschedule the appointment for Friday?"
    ]
  },
  "scene_b1_005": {
    "conversation": "Ustalenia z klientem",
    "turn": 2,
    "total": 5,
    "role": "Prowadzenie przewodu",
    "context": "Klient pyta o sposób poprowadzenia kabla.",
    "prompt": "Client: What options do I have for the cable?",
    "promptPl": "Zapytaj, czy kabel ma być ukryty, czy widoczny.",
    "accepted": [
      "Do you want the cable hidden or visible?",
      "Would you like the cable hidden or visible?",
      "Should the cable be hidden or visible?"
    ]
  },
  "scene_b1_009": {
    "conversation": "Ustalenia z klientem",
    "turn": 3,
    "total": 5,
    "role": "Instruktaż",
    "context": "Klient nie wie, jak obsługiwać urządzenie.",
    "prompt": "Client: I do not know how this works.",
    "promptPl": "Powiedz, że pokażesz klientowi, jak tego używać.",
    "accepted": [
      "I will show you how to use it.",
      "I'll show you how to use it.",
      "Let me show you how to use it."
    ]
  },
  "scene_b1_013": {
    "conversation": "Ustalenia z klientem",
    "turn": 4,
    "total": 5,
    "role": "Wybór rozwiązania",
    "context": "Klient pyta, które rozwiązanie będzie trwalsze.",
    "prompt": "Client: Which option should work better in the long term?",
    "promptPl": "Powiedz, że to rozwiązanie będzie bardziej niezawodne.",
    "accepted": [
      "This solution will be more reliable.",
      "This option will be more reliable."
    ]
  },
  "scene_b1_017": {
    "conversation": "Ustalenia z klientem",
    "turn": 5,
    "total": 5,
    "role": "Zapis konfiguracji",
    "context": "Kończysz konfigurację urządzenia.",
    "prompt": "Client: Will these settings remain after a restart?",
    "promptPl": "Powiedz, że zapiszesz ustawienia.",
    "accepted": [
      "I will save the settings.",
      "I'll save the settings."
    ]
  },
  "scene_b2_002": {
    "conversation": "Rozmowa serwisowa",
    "turn": 1,
    "total": 5,
    "role": "Telefon",
    "context": "Rozpoczynasz rozmowę dotyczącą montażu kamery.",
    "prompt": "Client: Hello, how can I help you?",
    "promptPl": "Powiedz, że dzwonisz w sprawie montażu kamery.",
    "accepted": [
      "I am calling about the camera installation.",
      "I'm calling about the camera installation.",
      "I am calling regarding the camera installation."
    ]
  },
  "scene_b2_006": {
    "conversation": "Rozmowa serwisowa",
    "turn": 2,
    "total": 5,
    "role": "Czas pracy",
    "context": "Klient pyta, ile czasu jeszcze potrzebujesz.",
    "prompt": "Client: How much longer will it take?",
    "promptPl": "Odpowiedz, że potrzebujesz około trzydziestu minut.",
    "accepted": [
      "I need about thirty minutes to finish.",
      "I need around thirty minutes to finish.",
      "It will take me about thirty minutes to finish."
    ]
  },
  "scene_b2_010": {
    "conversation": "Rozmowa serwisowa",
    "turn": 3,
    "total": 5,
    "role": "Nagrywanie",
    "context": "Klient pyta, kiedy kamera rozpoczyna nagrywanie.",
    "prompt": "Client: Does the camera record all the time?",
    "promptPl": "Wyjaśnij, że kamera nagrywa po wykryciu ruchu.",
    "accepted": [
      "The camera records when it detects movement.",
      "The camera starts recording when it detects movement.",
      "It records when it detects motion."
    ]
  },
  "scene_b2_014": {
    "conversation": "Rozmowa serwisowa",
    "turn": 4,
    "total": 5,
    "role": "Zalecenie",
    "context": "Stary przewód ma uszkodzoną izolację.",
    "prompt": "Client: Can we continue using the old cable?",
    "promptPl": "Powiedz, że stary przewód powinien zostać wymieniony.",
    "accepted": [
      "The old cable should be replaced.",
      "We should replace the old cable."
    ]
  },
  "scene_b2_018": {
    "conversation": "Rozmowa serwisowa",
    "turn": 5,
    "total": 5,
    "role": "Dostęp",
    "context": "Logowanie nie działa z podanym hasłem.",
    "prompt": "Client: Why can I not sign in?",
    "promptPl": "Wyjaśnij, że hasło jest nieprawidłowe.",
    "accepted": [
      "The password is incorrect.",
      "The password is not correct."
    ]
  },
  "scene_a1_003": {
    "conversation": "Podstawowa diagnoza internetu",
    "turn": 1,
    "total": 5,
    "role": "Działanie internetu",
    "context": "Klient pyta, czy internet w ogóle działa.",
    "prompt": "Client: Is the internet completely down?",
    "promptPl": "Wyjaśnij, że działa, ale jest wolny.",
    "accepted": [
      "The internet works, but the speed is low.",
      "The internet is working, but the speed is low.",
      "The internet works, but it is slow."
    ]
  },
  "scene_a1_007": {
    "conversation": "Podstawowa diagnoza internetu",
    "turn": 2,
    "total": 5,
    "role": "Zasilanie",
    "context": "Klient chce odłączyć zasilacz urządzenia.",
    "prompt": "Client: Can I unplug this device?",
    "promptPl": "Wyjaśnij, że urządzenie musi być podłączone do zasilania.",
    "accepted": [
      "The device must be connected to power.",
      "The device needs to be connected to power.",
      "The device must stay connected to power."
    ]
  },
  "scene_a1_011": {
    "conversation": "Podstawowa diagnoza internetu",
    "turn": 3,
    "total": 5,
    "role": "Sygnał",
    "context": "Klient pyta, gdzie telefon będzie miał lepszy zasięg.",
    "prompt": "Client: Where is the signal better?",
    "promptPl": "Powiedz, że sygnał jest lepszy przy oknie.",
    "accepted": [
      "The signal is better near the window.",
      "The signal is stronger near the window.",
      "You get a better signal near the window."
    ]
  },
  "scene_a1_015": {
    "conversation": "Podstawowa diagnoza internetu",
    "turn": 4,
    "total": 5,
    "role": "Zakończenie",
    "context": "Skończyłeś montaż.",
    "prompt": "Client: Have you finished the installation?",
    "promptPl": "Powiedz, że montaż jest zakończony.",
    "accepted": [
      "The installation is complete.",
      "The installation is finished."
    ]
  },
  "scene_a1_019": {
    "conversation": "Podstawowa diagnoza internetu",
    "turn": 5,
    "total": 5,
    "role": "Położenie routera",
    "context": "Kamera ma słaby sygnał z powodu odległości.",
    "prompt": "Client: Why is the camera signal weak?",
    "promptPl": "Powiedz, że router jest za daleko od kamery.",
    "accepted": [
      "The router is too far from the camera.",
      "The router is too far away from the camera."
    ]
  },
  "scene_a2_004": {
    "conversation": "Montaż kamery u klienta",
    "turn": 1,
    "total": 5,
    "role": "Miejsce montażu",
    "context": "Musisz ustalić miejsce montażu.",
    "prompt": "Client: I have not decided where the camera should go.",
    "promptPl": "Zapytaj, gdzie masz zamontować kamerę.",
    "accepted": [
      "Where should I mount the camera?",
      "Where should I install the camera?",
      "Where do you want me to mount the camera?"
    ]
  },
  "scene_a2_008": {
    "conversation": "Montaż kamery u klienta",
    "turn": 2,
    "total": 5,
    "role": "Aplikacja",
    "context": "Nie widzisz potrzebnej aplikacji na telefonie klienta.",
    "prompt": "Client: I cannot find the application.",
    "promptPl": "Poproś klienta, aby sprawdził, czy aplikacja jest zainstalowana.",
    "accepted": [
      "Please check if the application is installed.",
      "Please check whether the application is installed.",
      "Please check that the application is installed."
    ]
  },
  "scene_a2_012": {
    "conversation": "Montaż kamery u klienta",
    "turn": 3,
    "total": 5,
    "role": "Wycena",
    "context": "Klient prosi o dokument z kosztami.",
    "prompt": "Client: Can you give me the price in writing?",
    "promptPl": "Powiedz, że możesz przygotować pisemną wycenę.",
    "accepted": [
      "I can prepare a written quote.",
      "I can provide a written quote.",
      "I can make a written quote for you."
    ]
  },
  "scene_a2_016": {
    "conversation": "Montaż kamery u klienta",
    "turn": 4,
    "total": 5,
    "role": "Test",
    "context": "Aplikacja została skonfigurowana.",
    "prompt": "Client: What should I do now?",
    "promptPl": "Poproś klienta o przetestowanie aplikacji.",
    "accepted": [
      "Please test the application now.",
      "Please try the application now."
    ]
  },
  "scene_a2_020": {
    "conversation": "Montaż kamery u klienta",
    "turn": 5,
    "total": 5,
    "role": "Zasięg",
    "context": "Obraz z kamery zatrzymuje się przez słaby sygnał.",
    "prompt": "Client: The picture sometimes freezes. What do you recommend?",
    "promptPl": "Poleć mocniejszy punkt dostępowy.",
    "accepted": [
      "I recommend a stronger access point.",
      "I would recommend a stronger access point."
    ]
  },
  "scene_quote_001": {
    "conversation": "Wycena i zakres prac",
    "turn": 1,
    "total": 4,
    "role": "Oględziny",
    "context": "Klient chce poznać ostateczną cenę przed oględzinami.",
    "prompt": "Client: Can you tell me exactly how much it will cost?",
    "promptPl": "Wyjaśnij, że najpierw musisz obejrzeć miejsce.",
    "accepted": [
      "I need to inspect the site before I can give you a final price.",
      "I have to inspect the site before I can give you a final price.",
      "I need to see the site before I can give you the final price."
    ]
  },
  "scene_quote_002": {
    "conversation": "Wycena i zakres prac",
    "turn": 2,
    "total": 4,
    "role": "Zakres podstawowy",
    "context": "Klient pyta, co obejmuje podstawowa oferta.",
    "prompt": "Client: What is included in the basic option?",
    "promptPl": "Wymień montaż, konfigurację i krótkie szkolenie.",
    "accepted": [
      "The basic option includes installation, configuration, and a short user guide.",
      "The basic option covers installation, configuration, and a short user guide.",
      "Installation, configuration, and a short user guide are included in the basic option."
    ]
  },
  "scene_quote_003": {
    "conversation": "Wycena i zakres prac",
    "turn": 3,
    "total": 4,
    "role": "Koszt dodatkowy",
    "context": "Klient pyta o koszt dodatkowej kamery.",
    "prompt": "Client: How much more would one additional camera cost?",
    "promptPl": "Powiedz, że dodatkowa kamera podniosłaby cenę o około 200 zł.",
    "accepted": [
      "The additional camera would increase the price by about two hundred zlotys.",
      "An additional camera would cost about two hundred zlotys more.",
      "The additional camera would add about PLN 200 to the price."
    ]
  },
  "scene_quote_004": {
    "conversation": "Wycena i zakres prac",
    "turn": 4,
    "total": 4,
    "role": "Termin wyceny",
    "context": "Klient chce wiedzieć, kiedy otrzyma pisemną ofertę.",
    "prompt": "Client: That sounds reasonable. When will I receive the quote?",
    "promptPl": "Powiedz, że wyślesz wycenę dziś po południu i będzie ważna 14 dni.",
    "accepted": [
      "I will send the written quote this afternoon, and it will remain valid for fourteen days.",
      "I’ll send the written quote this afternoon, and it will be valid for fourteen days.",
      "You will receive the written quote this afternoon, and it will be valid for fourteen days."
    ]
  },
  "scene_delay_001": {
    "conversation": "Telefon i opóźnienie",
    "turn": 1,
    "total": 4,
    "role": "Informacja o opóźnieniu",
    "context": "Dzwonisz do klienta, ponieważ nie dotrzesz punktualnie.",
    "prompt": "Client: Hello, are you still coming today?",
    "promptPl": "Poinformuj, że możesz spóźnić się około 20 minut.",
    "accepted": [
      "I am calling because I may be about twenty minutes late.",
      "I’m calling because I may be around twenty minutes late.",
      "I may be about twenty minutes late, so I wanted to let you know."
    ]
  },
  "scene_delay_002": {
    "conversation": "Telefon i opóźnienie",
    "turn": 2,
    "total": 4,
    "role": "Przyczyna opóźnienia",
    "context": "Klient pyta, dlaczego się spóźnisz.",
    "prompt": "Client: What caused the delay?",
    "promptPl": "Wyjaśnij, że poprzednie zlecenie trwało dłużej, niż oczekiwałeś.",
    "accepted": [
      "The previous job took longer than expected.",
      "My previous job took longer than expected.",
      "The previous service visit took longer than I expected."
    ]
  },
  "scene_delay_003": {
    "conversation": "Telefon i opóźnienie",
    "turn": 3,
    "total": 4,
    "role": "Nowa godzina",
    "context": "Klient chce znać przewidywaną godzinę przyjazdu.",
    "prompt": "Client: What time do you expect to arrive?",
    "promptPl": "Powiedz, że powinieneś dotrzeć około 15:30.",
    "accepted": [
      "I should arrive at about half past three.",
      "I should arrive at around half past three.",
      "I expect to arrive at about three thirty."
    ]
  },
  "scene_delay_004": {
    "conversation": "Telefon i opóźnienie",
    "turn": 4,
    "total": 4,
    "role": "Zakończenie rozmowy",
    "context": "Klient akceptuje późniejszą godzinę.",
    "prompt": "Client: No problem. I will be here.",
    "promptPl": "Podziękuj i obiecaj ponowny telefon, jeżeli coś się zmieni.",
    "accepted": [
      "Thank you for understanding. I will call again if anything changes.",
      "Thank you for understanding. I’ll call you if anything changes.",
      "Thanks for understanding. I will let you know if anything changes."
    ]
  },
  "scene_instruction_001": {
    "conversation": "Instrukcja obsługi",
    "turn": 1,
    "total": 4,
    "role": "Pierwszy krok",
    "context": "Klient chce zobaczyć obraz z kamery na telefonie.",
    "prompt": "Client: How do I view the camera on my phone?",
    "promptPl": "Poleć otwarcie aplikacji i wybranie kamery z listy urządzeń.",
    "accepted": [
      "Open the application and select the camera from the device list.",
      "Open the app and select the camera from the device list.",
      "First, open the application and choose the camera from the device list."
    ]
  },
  "scene_instruction_002": {
    "conversation": "Instrukcja obsługi",
    "turn": 2,
    "total": 4,
    "role": "Podgląd na żywo",
    "context": "Klient widzi nazwę kamery, ale nie wie, co nacisnąć.",
    "prompt": "Client: I can see the camera name. What should I press now?",
    "promptPl": "Wyjaśnij, że należy nacisnąć przycisk podglądu na żywo.",
    "accepted": [
      "Tap the live view button to display the current picture.",
      "Tap the live view button to see the current picture.",
      "Press the live view button to open the current camera image."
    ]
  },
  "scene_instruction_003": {
    "conversation": "Instrukcja obsługi",
    "turn": 3,
    "total": 4,
    "role": "Odtwarzanie nagrań",
    "context": "Klient chce znaleźć nagranie z poprzedniego dnia.",
    "prompt": "Client: How can I find a recording from yesterday?",
    "promptPl": "Wyjaśnij, że trzeba wybrać datę i przesunąć oś czasu.",
    "accepted": [
      "If you want to review an event, choose the date and move the timeline.",
      "To review an event, select the date and move the timeline.",
      "Choose the date and move the timeline to find the recording."
    ]
  },
  "scene_instruction_004": {
    "conversation": "Instrukcja obsługi",
    "turn": 4,
    "total": 4,
    "role": "Dalsza pomoc",
    "context": "Klient obawia się, że zapomni kolejne kroki.",
    "prompt": "Client: I understand now, but I may forget the steps.",
    "promptPl": "Zaproponuj drukowaną instrukcję i możliwość późniejszego telefonu.",
    "accepted": [
      "I will leave a printed guide, and you can call me if you need further help.",
      "I’ll leave a printed guide, and you can call me if you need more help.",
      "I will leave you a printed guide, and you can contact me if you need help."
    ]
  },
  "scene_complaint_001": {
    "conversation": "Reklamacja i rozwiązanie",
    "turn": 1,
    "total": 4,
    "role": "Przyjęcie reklamacji",
    "context": "Klient jest zdenerwowany trzecią awarią połączenia.",
    "prompt": "Client: The connection has failed again, and this is the third time.",
    "promptPl": "Okaż zrozumienie dla frustracji klienta.",
    "accepted": [
      "I understand why the repeated disconnections are frustrating.",
      "I understand that the repeated disconnections are frustrating.",
      "I can understand why these repeated connection failures are frustrating."
    ]
  },
  "scene_complaint_002": {
    "conversation": "Reklamacja i rozwiązanie",
    "turn": 2,
    "total": 4,
    "role": "Weryfikacja historii",
    "context": "Klient domaga się natychmiastowej wymiany urządzenia.",
    "prompt": "Client: You should replace the device immediately.",
    "promptPl": "Powiedz, że najpierw chcesz przejrzeć poprzedni raport serwisowy.",
    "accepted": [
      "I would like to review the previous service report before I propose another repair.",
      "I’d like to review the previous service report before proposing another repair.",
      "Before I propose another repair, I would like to review the previous service report."
    ]
  },
  "scene_complaint_003": {
    "conversation": "Reklamacja i rozwiązanie",
    "turn": 3,
    "total": 4,
    "role": "Warunki gwarancji",
    "context": "Klient pyta, czy zapłaci za ponowną awarię tego samego elementu.",
    "prompt": "Client: Will I have to pay if the same part has failed?",
    "promptPl": "Wyjaśnij, że ponowna awaria tego samego elementu będzie objęta gwarancją.",
    "accepted": [
      "If the same component has failed again, the replacement will be covered by the warranty.",
      "If the same part has failed again, its replacement will be covered by the warranty.",
      "The replacement will be covered by the warranty if the same component has failed again."
    ]
  },
  "scene_complaint_004": {
    "conversation": "Reklamacja i rozwiązanie",
    "turn": 4,
    "total": 4,
    "role": "Plan dalszych działań",
    "context": "Klient chce otrzymać jasny plan rozwiązania problemu.",
    "prompt": "Client: I need to know exactly what you are going to do next.",
    "promptPl": "Obiecaj pisemne podsumowanie diagnozy i proponowanego rozwiązania do jutra.",
    "accepted": [
      "I will send you a written summary of the diagnosis and the proposed solution by tomorrow.",
      "I’ll send you a written summary of the diagnosis and proposed solution by tomorrow.",
      "By tomorrow, I will send you a written summary of the diagnosis and the proposed solution."
    ]
  },
  "scene_scope_001": {
    "conversation": "Uzgodnienie zakresu",
    "turn": 1,
    "total": 4,
    "role": "Ograniczenie budżetu",
    "context": "Klient chce dodać modernizację sieci bez zwiększenia ceny.",
    "prompt": "Client: Can you include the network upgrade without changing the price?",
    "promptPl": "Wyjaśnij, że budżet obejmuje prace niezbędne, ale nie opcjonalną modernizację.",
    "accepted": [
      "The current budget covers the essential work, but not the optional network upgrade.",
      "The current budget includes the essential work, but it does not cover the optional network upgrade.",
      "The essential work is covered by the current budget, but the optional network upgrade is not."
    ]
  },
  "scene_scope_002": {
    "conversation": "Uzgodnienie zakresu",
    "turn": 2,
    "total": 4,
    "role": "Wariant etapowy",
    "context": "Klient szuka sposobu na obniżenie obecnego kosztu bez zamykania drogi do rozbudowy.",
    "prompt": "Client: Is there a way to keep the cost down without starting again next year?",
    "promptPl": "Zaproponuj przełożenie modernizacji i przygotowanie instalacji do późniejszej rozbudowy.",
    "accepted": [
      "We could postpone the upgrade and prepare the installation so that it can be added later.",
      "We could delay the upgrade and prepare the installation for a later expansion.",
      "We can postpone the upgrade while preparing the installation so it can be added later."
    ]
  },
  "scene_scope_003": {
    "conversation": "Uzgodnienie zakresu",
    "turn": 3,
    "total": 4,
    "role": "Korzyść rozwiązania",
    "context": "Klient pyta o zaletę wykonania prac etapami.",
    "prompt": "Client: What would be the advantage of doing it that way?",
    "promptPl": "Wyjaśnij, że wariant obniży bieżący koszt i zachowa możliwość rozbudowy.",
    "accepted": [
      "That option would reduce the immediate cost while preserving the possibility of expansion.",
      "That option would lower the immediate cost while keeping the possibility of expansion.",
      "It would reduce the current cost without removing the option to expand later."
    ]
  },
  "scene_scope_004": {
    "conversation": "Uzgodnienie zakresu",
    "turn": 4,
    "total": 4,
    "role": "Aktualizacja wyceny",
    "context": "Klient prosi o osobne pokazanie prac podstawowych i opcjonalnych.",
    "prompt": "Client: Please show both options separately in the quote.",
    "promptPl": "Powiedz, że zaktualizujesz wycenę i rozdzielisz oba zakresy.",
    "accepted": [
      "I will revise the quote to distinguish the essential work from the optional upgrade.",
      "I’ll revise the quote to separate the essential work from the optional upgrade.",
      "I will update the quote so that the essential work and the optional upgrade are shown separately."
    ]
  }
};
