'use strict';
window.DIALOGUE_SCENES = {
  scene_b1_001: {
    conversation: 'Ustalenia z klientem',
    turn: 1,
    total: 3,
    role: 'Klient',
    context: 'Klientowi nie pasuje czwartkowy termin. Zaproponuj piątek.',
    prompt: 'Klient: Thursday does not work for me. Can we choose another day?',
    promptPl: 'Klient: Czwartek mi nie pasuje. Zaproponuj przeniesienie terminu na piątek.',
    accepted: ['Can we move the appointment to Friday?', 'Could we move the appointment to Friday?', 'Can we reschedule the appointment for Friday?']
  },
  scene_b2_002: {
    conversation: 'Rozmowa serwisowa',
    turn: 1,
    total: 3,
    role: 'Telefon do klienta',
    context: 'Rozpoczynasz rozmowę dotyczącą montażu kamery.',
    prompt: 'Klient: Hello, how can I help you?',
    promptPl: 'Klient odbiera telefon. Powiedz, że dzwonisz w sprawie montażu kamery.',
    accepted: ['I am calling about the camera installation.', "I'm calling about the camera installation.", 'I am calling regarding the camera installation.']
  },
  scene_a1_003: {
    conversation: 'Podstawowa diagnoza internetu',
    turn: 1,
    total: 3,
    role: 'Klient',
    context: 'Klient pyta, czy internet w ogóle działa.',
    prompt: 'Klient: Is the internet completely down?',
    promptPl: 'Klient pyta, czy internet całkiem nie działa. Wyjaśnij, że działa, ale jest wolny.',
    accepted: ['The internet works, but the speed is low.', 'The internet is working, but the speed is low.', 'The internet works, but it is slow.']
  },
  scene_a2_004: {
    conversation: 'Montaż kamery u klienta',
    turn: 1,
    total: 3,
    role: 'Montaż kamery',
    context: 'Musisz ustalić miejsce montażu.',
    prompt: 'Klient: I have not decided where the camera should go.',
    promptPl: 'Klient nie wybrał miejsca. Zapytaj, gdzie masz zamontować kamerę.',
    accepted: ['Where should I mount the camera?', 'Where should I install the camera?', 'Where do you want me to mount the camera?']
  },
  scene_b1_005: {
    conversation: 'Ustalenia z klientem',
    turn: 2,
    total: 3,
    role: 'Ustalenie montażu',
    context: 'Możesz poprowadzić kabel na wierzchu albo go ukryć.',
    prompt: 'Klient: What options do I have for the cable?',
    promptPl: 'Zapytaj klienta, czy kabel ma być ukryty, czy widoczny.',
    accepted: ['Do you want the cable hidden or visible?', 'Would you like the cable hidden or visible?', 'Should the cable be hidden or visible?']
  },
  scene_b2_006: {
    conversation: 'Rozmowa serwisowa',
    turn: 2,
    total: 3,
    role: 'Kończenie pracy',
    context: 'Klient pyta, ile czasu jeszcze potrzebujesz.',
    prompt: 'Klient: How much longer will it take?',
    promptPl: 'Odpowiedz, że potrzebujesz około trzydziestu minut, aby skończyć.',
    accepted: ['I need about thirty minutes to finish.', 'I need around thirty minutes to finish.', 'It will take me about thirty minutes to finish.']
  },
  scene_a1_007: {
    conversation: 'Podstawowa diagnoza internetu',
    turn: 3,
    total: 3,
    role: 'Wyjaśnienie techniczne',
    context: 'Klient chce odłączyć zasilacz urządzenia.',
    prompt: 'Klient: Can I unplug this device?',
    promptPl: 'Wyjaśnij, że urządzenie musi być podłączone do zasilania.',
    accepted: ['The device must be connected to power.', 'The device needs to be connected to power.', 'The device must stay connected to power.']
  },
  scene_a2_008: {
    conversation: 'Montaż kamery u klienta',
    turn: 2,
    total: 3,
    role: 'Pomoc z telefonem',
    context: 'Nie widzisz potrzebnej aplikacji na telefonie klienta.',
    prompt: 'Klient: I cannot find the application.',
    promptPl: 'Poproś klienta, aby sprawdził, czy aplikacja jest zainstalowana.',
    accepted: ['Please check if the application is installed.', 'Please check whether the application is installed.', 'Please check that the application is installed.']
  },
  scene_b1_009: {
    conversation: 'Ustalenia z klientem',
    turn: 3,
    total: 3,
    role: 'Instruktaż',
    context: 'Klient nie wie, jak obsługiwać urządzenie.',
    prompt: 'Klient: I do not know how this works.',
    promptPl: 'Powiedz, że pokażesz klientowi, jak tego używać.',
    accepted: ['I will show you how to use it.', "I'll show you how to use it.", 'Let me show you how to use it.']
  },
  scene_b2_010: {
    conversation: 'Rozmowa serwisowa',
    turn: 3,
    total: 3,
    role: 'Wyjaśnienie funkcji',
    context: 'Klient pyta, kiedy kamera rozpoczyna nagrywanie.',
    prompt: 'Klient: Does the camera record all the time?',
    promptPl: 'Wyjaśnij, że kamera nagrywa, gdy wykryje ruch.',
    accepted: ['The camera records when it detects movement.', 'The camera starts recording when it detects movement.', 'It records when it detects motion.']
  },
  scene_a1_011: {
    conversation: 'Podstawowa diagnoza internetu',
    turn: 2,
    total: 3,
    role: 'Diagnoza sygnału',
    context: 'Klient pyta, gdzie telefon będzie miał lepszy zasięg.',
    prompt: 'Klient: Where is the signal better?',
    promptPl: 'Powiedz, że sygnał jest lepszy przy oknie.',
    accepted: ['The signal is better near the window.', 'The signal is stronger near the window.', 'You get a better signal near the window.']
  },
  scene_a2_012: {
    conversation: 'Montaż kamery u klienta',
    turn: 3,
    total: 3,
    role: 'Wycena',
    context: 'Klient prosi o dokument z kosztami.',
    prompt: 'Klient: Can you give me the price in writing?',
    promptPl: 'Powiedz, że możesz przygotować pisemną wycenę.',
    accepted: ['I can prepare a written quote.', 'I can provide a written quote.', 'I can make a written quote for you.']
  }
};
