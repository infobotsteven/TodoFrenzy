# Funkcje aplikacji

Opis tego, co aplikacja robi i jakie reguły za tym stoją (reguły są ważne przy zmianach). Szczegóły techniczne: [ARCHITEKTURA.md](ARCHITEKTURA.md).
Wersja angielska (kanoniczna): [../FEATURES.md](../FEATURES.md).

## Model użytkowania

- **Logowanie jednym wspólnym kontem** (domyślnie `admin` / `admin`, zmieniane w `.env` — patrz [BEZPIECZENSTWO.md](BEZPIECZENSTWO.md)). Bez logowania widać tylko ekran logowania
  (pod każdym adresem; po zalogowaniu wracasz na ten sam adres). Zalogowany użytkownik widzi i edytuje wszystko jak dotąd; **wielu użytkowników może być zalogowanych naraz**
  (osobne sesje, sesja trwa 7 dni od ostatniej aktywności). Przycisk **Wyloguj** jest w pasku u góry. Po 5 błędnych próbach z jednego adresu logowanie jest blokowane na 15 minut.
  Wygasła sesja w trakcie pracy zwraca na ekran logowania. Nie ma osobnych kont ani autorów zmian.
- Aplikacja działa w sieci lokalnej (komputer + telefony); nie jest PWA (nie instaluje się, nie działa offline).
- Język interfejsu: polski. Daty: format polski (`pl-PL`), tydzień zaczyna się w poniedziałek.

## Strona główna

Od góry: nagłówek „Projekty” z przyciskami **+ Nowy projekt** i **Użytkownicy**, pole wyszukiwania, siatka projektów,
a pod nią sekcja z zakładkami **Kalendarz**, **Zaległe**, **Bez terminu** i **Archiwum**.

### Projekty

- Karta projektu: nazwa, opis (2 linie), pasek postępu i licznik `ukończone / wszystkie` (ze wszystkich list projektu),
  „Zaktualizowano … temu”, kolor projektu jako kropka przed tytułem (tak samo na kartach list) oraz **delikatne tło i obwódka w kolorze projektu** (tak jak od początku miał stały projekt „Inne”);
  projekt bez koloru ma kartę neutralną, a po najechaniu obwódka się wzmacnia.
- Tworzenie, edycja (nazwa, opis, kolor), usuwanie (z listami i zadaniami, po potwierdzeniu), **kopiowanie**
  (kopia ląduje tuż za oryginałem, nazwa dostaje „ (kopia)”, wszystkie zadania wracają jako niewykonane; kopiowane są
  listy, tagi list, terminy i przypisani użytkownicy).
- Zmiana kolejności przeciąganiem (zapisywana w bazie). Podczas wyszukiwania przeciąganie jest wyłączone.
- Wyszukiwanie po nazwie i opisie (stan wyszukiwania w pamięci aplikacji, nie w adresie).

### Archiwum projektów

- W nagłówku strony głównej są dwie zakładki: **Projekty** i **Archiwum** (z liczbą zarchiwizowanych). Archiwum pokazuje karty zarchiwizowanych
  projektów (wspólny „styl archiwum”: ukośne kreskowanie, przerywana obwódka, wyszarzony tytuł i postęp, pusta kropka koloru, ikona pudełka przy „Zarchiwizowano … temu”;
  od ostatnio zarchiwizowanych) z przyciskiem **Przywróć**; wyszukiwarka działa w obu. Ten sam styl mają zadania zarchiwizowanych projektów (kalendarz, zakładka „Archiwum”)
  i chipy „Projekty archiwalne” w filtrach.
- **Archiwizacja:** w oknie *Edytuj projekt* przycisk **Archiwizuj** (po zapisie powrót na stronę główną i komunikat z **Cofnij**). Stały projekt
  „Inne” nie podlega archiwizacji. Archiwizacja niczego nie kopiuje ani nie kasuje — ustawia znacznik `archived_at` projektu.
- **Zadania zarchiwizowanego projektu** (wszystkie, także niewykonane): trafiają do zakładki **Archiwum** zadań (karta: „Projekt zarchiwizowany” + data,
  przycisk **Przywróć projekt**, pole wyboru zablokowane), **znikają** z „Zaległych” i „Bez terminu”, a w kalendarzu są **domyślnie ukryte**.
- **Przywrócenie zadania przywraca cały projekt:** „Przywróć projekt” na karcie zadania w archiwum (albo „Przywróć” na karcie projektu / w jego oknie edycji /
  w banerze na stronie projektu) cofa archiwizację — projekt wraca na listę, a jego zadania do kalendarza, „Zaległych” i „Bez terminu”. Zadania, które były
  wykonane, zostają w archiwum jako zwykłe wykonane zadania.
- **Przycisk powrotu** na stronie zarchiwizowanego projektu to „← Archiwum” i wraca do zakładki „Archiwum” (zakładka strony głównej jest w adresie: `/?widok=archiwum`,
  więc działa też „Wstecz” przeglądarki); na stronie zwykłego projektu to „← Projekty”.
- Strona zarchiwizowanego projektu działa (można ją otworzyć i edytować), ale ma baner „Ten projekt jest zarchiwizowany” z przyciskiem **Przywróć projekt**.
  Okno „Nowe zadanie” w kalendarzu nie oferuje zarchiwizowanych projektów. Kopia zarchiwizowanego projektu jest zwykłym, aktywnym projektem.

### Stały projekt „Inne”

- Dokładnie jeden, tworzony automatycznie przy starcie serwera, jeśli go brak. Zawsze **pierwszy** na liście, poza
  przeciąganiem. Ma zarezerwowany **brązowy** kolor (`brown`, którego nie ma w palecie wyboru), więc nikt inny go nie dostanie.
- **Nie da się go usunąć**, zmienić mu nazwy ani koloru (edytować można opis), ani przesunąć. Ma **jedną listę „Zadania”**,
  której nie da się usunąć ani skopiować, i nie da się dodać kolejnych list. Reguły pilnuje serwer (HTTP 403/400).
- Kopia projektu „Inne” jest zwykłym projektem „Inne (kopia)” bez brązowego koloru.
- Zadania z „Inne” w kalendarzu i zaległych mają ten sam brązowy styl co karta projektu.
- Służy m.in. jako domyślny cel dodawania zadań z kalendarza.

## Widok projektu (`/project/:id`)

- Nagłówek (nazwa, opis, postęp, **Edytuj projekt**), przycisk „Projekty” nad tytułem.
- Pasek akcji nad listami: przełącznik **Siatka / Slider** (tylko szerokie ekrany), **Tagi**, **+ Nowa lista**.
- **Filtry zadań:** priorytet (jeden), „Ukryj wykonane”, tag (pokazuje tylko listy z tym tagiem), użytkownicy
  (wielokrotny wybór + „Bez przypisania”). Filtry tylko ukrywają — nic nie zmieniają w danych.

### Listy

- Nazwa, opis, kolor, **tagi** (tagi należą do list, nie do zadań), kolejność (drag & drop), kopiowanie (z zadaniami),
  usuwanie. Lista **nie ma dat** (usunięte na życzenie — daty są przy zadaniach).
- **Dwa układy od 640 px szerokości** (zapamiętywane w przeglądarce, klucz `listView`):
  - *Siatka* — kolumny typu masonry: listy układają się jedna pod drugą bez luk; liczba kolumn wynika z szerokości,
    lista nr N trafia do kolumny N mod liczba kolumn. Kolumny rozciągają się, żeby wypełnić rząd od krawędzi do krawędzi
    (odstęp poziomy = pionowy), do 1,5 × minimalnej szerokości listy.
  - *Slider* — jeden rząd przewijany poziomo; listy mają stałą szerokość (taką jak minimalna w siatce).
  - Na telefonie listy są jedna pod drugą.
- Długie teksty łamią się (`overflow-wrap: anywhere`), karty nie mają wewnętrznego przewijania.

### Zadania

- Pola: nazwa, opis, **priorytet** (brak / niski / średni / wysoki), **jeden termin** (data bez godziny),
  **przypisani użytkownicy**, stan wykonania.
- **Szybkie dodawanie:** pole pod listą; Enter dodaje i zostawia fokus. **Wklejenie tekstu z wieloma liniami** jest
  rozpoznawane jako lista zadań (co najmniej dwie niepuste linie, maksymalnie 200) — każda linia staje się zadaniem;
  punktory i numeracja (`-`, `*`, `•`, `1.`, `2)`) oraz pola `[ ]` / `[x]` są czyszczone, a `[x]` oznacza zadanie wykonane.
  Pojedyncza linia wkleja się jak zwykły tekst.
- **Wykonanie:** zaznaczenie nie przenosi zadania — zostaje na miejscu, jest wyszarzone i przekreślone. Działa optymistycznie.
- **Usuwanie jednym kliknięciem** (ikona przy zadaniu) z komunikatem **Cofnij** — zadanie wraca na to samo miejsce,
  ze stanem wykonania i resztą pól. Przycisk usuwania znika po przeciągnięciu (nie „zalega” w stanie hover).
- Zmiana kolejności przeciąganiem w obrębie listy (uchwyt ⋮⋮). Przeciąganie ma nakładkę „w ręku”, bez przeskoków.
- Termin: znaczek z datą; po terminie i niewykonane = czerwony „po terminie”.

## Użytkownicy

- Nick (unikalny bez względu na wielkość liter) + **awatar w kółku: pikselowy zwierzak** (12 do wyboru: kot, pies, lis,
  niedźwiedź, królik, panda, żaba, świnka, sowa, pingwin, lew, koala). Rysunki 16×16 są w kodzie (`client/src/components/avatars.ts`).
- Zarządzanie z przycisku **Użytkownicy** na stronie głównej (dodaj / edytuj nick i awatar / usuń). Nowego użytkownika
  można też dodać w oknie zadania — od razu trafia do zadania.
- Przypisywani do zadań jak tagi (wielu na zadanie), widoczni przy zadaniach na listach, w kalendarzu i w zaległych,
  filtrowani w projekcie, kalendarzu i zaległych (w tym „Bez przypisania”).
- Usunięcie użytkownika zdejmuje go z zadań, ale nie usuwa zadań. Zmiana nicka/awatara odświeża się u wszystkich na żywo.

## Tagi

Globalna pula nazw (unikalnych bez względu na wielkość liter), przypisywana do **list**. Okno **Tagi** w widoku projektu:
zmiana nazwy i usuwanie. Wpisanie nazwy istniejącego tagu w formularzu listy dodaje go zamiast tworzyć duplikat.

## Kalendarz (strona główna → zakładka „Kalendarz”)

- Tydzień (pon–niedz): 7 kolumn od 1600 px szerokości ekranu, poniżej kolumny zawijają się (min. ok. 12 rem), na telefonie dni
  są jeden pod drugim. Dzisiejszy dzień jest wyróżniony („dziś”), przeszłe przygaszone.
- Nawigacja: poprzedni/następny tydzień, **Dziś**, **wybór tygodnia z kalendarza miesięcznego** (okno z siatką dni).
  Sąsiednie tygodnie są pobierane z wyprzedzeniem.
- Zadanie w kalendarzu: pole wyboru (wykonane), nazwa, **projekt › lista** (z kolorowymi kropkami; projekt jest linkiem),
  priorytet, użytkownicy. Zaległe niewykonane są podświetlone na czerwono.
- **Zmiana terminu:** przeciągnięcie na inny dzień (uchwyt ⋮⋮) albo klik w nazwę → okno z polem daty i szybkimi
  **Dziś / Jutro / Za tydzień**; „Usuń termin” zdejmuje zadanie z kalendarza (zostaje w liście).
- **Dodawanie zadań:** przycisk **+** w nagłówku każdego dnia i **+ Zadanie** w nagłówku sekcji. Okno: tytuł, opis,
  projekt, lista, data (domyślnie klikniętego dnia), priorytet, osoby. **Bez wyboru projektu zadanie trafia do „Inne” → „Zadania”.**
  Projekt bez list pokazuje „Brak list” i błąd przy zapisie.
- **Ukryj ukończone:** pole wyboru pod nagłówkiem kalendarza (nad filtrami) zdejmuje z dni wykonane zadania; wybór jest **zapamiętany w przeglądarce** (`calendarHideCompleted`) i niezależny od filtrów
  („Wyczyść filtry” go nie wyłącza). Liczba zadań w dniu pokazuje tylko widoczne, a podsumowanie tygodnia („X do zrobienia z Y zadań”) nadal liczy wszystkie zadania po filtrach; gdy wszystkie są ukryte,
  jest komunikat. Wykonanie zadania przy włączonej opcji ukrywa je od razu. Opcja dotyczy tylko kalendarza (zakładki Zaległe/Bez terminu/Archiwum nie zmieniają się).
- **Filtry** (osobny stan od zaległych): projekty (po wyborze projektu pojawiają się jego listy), **projekty archiwalne**, priorytet (wielokrotny),
  użytkownicy (+ „Bez przypisania”).
- **Pasek nad filtrami i przycisk „Wyczyść filtry”:** nad wierszami filtrów jest pasek z opcjami widoku (w kalendarzu „Ukryj ukończone”) i **stałym przyciskiem „Wyczyść filtry”** — widocznym od początku, nieaktywnym,
  gdy nie ma czego czyścić (samo „Ukryj ukończone” go nie aktywuje). Taki sam przycisk (bez opcji obok) jest w zakładkach **Zaległe, Bez terminu i Archiwum**, a każda zakładka ma własny stan filtrów.
- **Projekty archiwalne:** zadania zarchiwizowanych projektów są domyślnie ukryte. Sekcja filtrów „Projekty archiwalne” (przerywane chipy, tylko
  gdy zarchiwizowany projekt ma zadania z terminem) pozwala je **dodatkowo** pokazać — przygaszone, z przerywaną obwódką; podlegają filtrom osób i
  priorytetu. „Wyczyść filtry” znów je ukrywa.

## Zaległe (strona główna → zakładka „Zaległe”)

- **Zaległe = niewykonane zadania z terminem wcześniejszym niż dziś** (dziś liczone po stronie przeglądarki).
  Zadania bez terminu, z terminem dziś lub później oraz wykonane nie są zaległe.
- Na zakładce czerwony **licznik** zaległych (zawsze widoczny, także w zakładce kalendarza).
- **Siatka kart** (nie kalendarz): każda karta ma pole wyboru, nazwę, opis (2 linie), projekt › lista, priorytet, osoby oraz
  stopkę: etykieta „Termin”, **data do kiedy zadanie miało być wykonane** (z dniem tygodnia), „N dni po terminie”
  i przycisk **Zmień termin** (to samo okno co w kalendarzu, ze skrótami Dziś / Jutro / Za tydzień).
- Karty w rzędzie mają jednakową wysokość, stopka jest zawsze na dole.
- **Filtry** jak w kalendarzu (projekty → listy, priorytet, użytkownicy), z własnym stanem (zapamiętywanym przy przełączaniu zakładek).
  Opcje filtrów obejmują tylko projekty/listy, w których coś jest zaległe.
- **Sortowanie:** od najstarszych terminów (domyślnie) / od najnowszych.
- Zmiana terminu na dziś lub później, wykonanie zadania albo zmiana zrobiona przez kogoś innego **zdejmuje kartę z widoku**;
  termin nadal przeszły zmienia kartę w miejscu i przelicza kolejność.

## Bez terminu (strona główna → zakładka „Bez terminu”)

- **Niewykonane zadania, które nie mają daty** (wykonane i z terminem nie są pokazywane). Zakładka jest zbudowana na wzór „Zaległych”
  (wspólny komponent `TaskGridSection`): siatka kart, te same filtry (projekty → listy, priorytet, użytkownicy; osobny stan), licznik
  (szary) na zakładce.
- Karta: pole wyboru, nazwa, opis, projekt › lista, priorytet, osoby oraz stopka: „Termin — **Brak terminu**”, „Dodano {data}” i przycisk
  **Ustaw termin** (okno z polem daty i skrótami Dziś / Jutro / Za tydzień; „Zapisz” jest wyłączone, dopóki nie wybrano daty).
  Zadania z „Inne” mają brązowy styl.
- **Sortowanie:** wg projektów i list (domyślnie, „Inne” pierwsze, potem kolejność jak w projektach), od najnowszych / od najstarszych
  (wg daty dodania zadania; w bazie ma rozdzielczość 1 s).
- Ustawienie terminu albo wykonanie zdejmuje kartę z widoku (zadanie z terminem pojawia się w kalendarzu); usunięcie terminu zadaniu
  (np. w kalendarzu przez „Usuń termin” albo przez kogoś innego) sprawia, że zadanie pojawia się tutaj — także na żywo.

## Archiwum (strona główna → zakładka „Archiwum”)

- **Wykonane zadania** (z terminem i bez) **oraz wszystkie zadania zarchiwizowanych projektów** (patrz „Archiwum projektów”) w tej samej siatce kart co „Zaległe” i „Bez terminu” (wspólny `TaskGridSection`),
  z tymi samymi filtrami (osobny stan) i szarym licznikiem na zakładce. Karta ma zaznaczone pole i **niepoprzekreśloną** nazwę.
- **Filtry w archiwum:** projekty są w dwóch osobnych sekcjach — „Projekty” (aktywne) i „Projekty archiwalne” (przerywane chipy z pustą kropką), tak jak w kalendarzu. W przeciwieństwie do kalendarza
  nic nie jest tu domyślnie ukryte: bez wyboru widać wszystkie zadania, a wybranie chipów z jednej lub obu sekcji pokazuje tylko zadania wybranych projektów (alternatywa). Po wybraniu projektu aktywnego
  pojawia się wiersz „Listy” (pod „Projektami”), a po wybraniu projektu archiwalnego osobny wiersz **„Listy archiwalne”** (pod „Projektami archiwalnymi”, przerywane chipy) — listy obu rodzajów
  się nie mieszają. Filtry osób i priorytetu działają na całość.
- Stopka karty: etykieta „Wykonano”, **data wykonania** (zielona), pod nią „Termin był: …” albo „Bez terminu”, oraz przycisk **Przywróć**.
  Data wykonania to czas ostatniej zmiany zadania w chwili wykonania (`updated_at`) — późniejsza edycja zadania przesuwa ją.
- **Przywracanie:** przycisk „Przywróć” albo odznaczenie pola oznacza zadanie jako niewykonane i zdejmuje je z archiwum; wraca do swojej
  listy, a zależnie od terminu pojawia się w „Zaległych”, „Bez terminu” albo w kalendarzu.
- **Sortowanie:** ostatnio wykonane (domyślnie) / najdawniej wykonane. Zadania wykonane w innych widokach (lista, kalendarz, zaległe,
  bez terminu) lądują tu od razu, a zmiany innych osób pojawiają się na żywo.
- Archiwum nie jest osobną flagą — to po prostu zadania z `completed = true`; w projektach pozostają na swoich miejscach.

## Statystyki (strona główna → zakładka „Statystyki”)

Trzecia zakładka obok „Projektów” i „Archiwum” (adres `/?widok=statystyki`); po jej wybraniu nie ma wyszukiwarki, projektów ani kalendarza. Wszystkie liczby dotyczą **ukończonych zadań** i liczone są po momencie
wykonania (`completed_at`) w strefie czasowej przeglądarki; odznaczenie zadania zdejmuje je ze statystyk, a zmiany innych osób odświeżają liczby na żywo.

- **Ukończone dzisiaj** — liczba i dzisiejsza data.
- **Ukończone zadania (suma)** — suma z ostatnich dni (dziś włącznie) i średnia dzienna; zakres z listy: 7 (domyślnie) / 14 / 30 / 90 dni.
- **Projekty** — dwa kafle: **Aktywne projekty** (kropka w kolorze marki) i **Zarchiwizowane projekty** (wygląd archiwum: kreskowanie, przerywana obwódka, ikona pudełka). Każdy pokazuje liczbę projektów
  (bez stałego „Inne”, co jest napisane pod kaflami), **pasek postępu zadań** tych projektów oraz podpis „Ukończono X z Y zadań” z procentem (albo „Brak zadań”). Kafle są linkami do zakładek „Projekty” i „Archiwum”;
  archiwizowanie, przywracanie, dodawanie i usuwanie projektów oraz wykonywanie zadań (także przez inne osoby) zmieniają je na żywo.
- **Ukończone w tygodniu** — wykres słupkowy jednego tygodnia (poniedziałek–niedziela, 7 słupków): domyślnie bieżący tydzień, strzałkami **przesuwasz tygodnie** (zakres dat między strzałkami), „Ten tydzień” wraca do
  bieżącego. Słupek dzisiejszy jest wyróżniony, dni po dzisiejszym są puste i przygaszone, nad słupkami są liczby, a każdy słupek ma podpowiedź z datą i liczbą. Wykres rośnie razem z wysokością pudełka.
- **Aktywność w miesiącu** — mapa jak na GitHubie: kolumny to tygodnie, wiersze to dni tygodnia (od poniedziałku), kolor kafelka (5 poziomów, w kolorze marki) zależy od liczby ukończonych względem najlepszego dnia
  miesiąca. Kafelki **wypełniają całą kartę** i pokazują numer dnia, **liczbę ukończonych** oraz nazwy pierwszych zadań (przy 3+ zadaniach jedna nazwa i „+N więcej”; na telefonie bez nazw); podpowiedź listuje
  do 12 zadań punktorami. Domyślnie bieżący miesiąc, strzałkami wybierasz inne, „Ten miesiąc” wraca do bieżącego; dzisiejszy dzień ma obramowanie. Legenda „Mniej … Więcej”.
- Układ: na szerokim ekranie po lewej dwie liczby, wykres i pudełko „Projekty”, po prawej wysoka mapa aktywności (nadmiar wysokości przejmuje wykres); na telefonie pudełka jedno pod drugim.
- **Dane historyczne:** zadania wykonane przed dodaniem statystyk (migracja 0010) mają datę wykonania równą ostatniej zmianie zadania, więc ich rozkład w czasie jest przybliżony. Zadania usunięte i zadania
  „przywrócone” z cofnięcia usunięcia liczą się od momentu odtworzenia.

## Paginacja (Zaległe, Bez terminu, Archiwum)

- Każda z trzech zakładek-siatek dzieli karty na **strony**. Pod siatką jest pasek: zakres („Pozycje 25–48 z 95”), przyciski **‹ ›**, numery stron
  (pierwsza, ostatnia i okolice bieżącej, reszta jako „…”) oraz wybór **„Na stronie”: 12 / 24 (domyślnie) / 48 / 96 / Wszystkie**.
- Rozmiar strony jest wspólny dla trzech zakładek i **zapamiętywany w przeglądarce** (`pageSize`); „Wszystkie” wyłącza paginację.
- Pasek nie pojawia się, gdy pozycji jest nie więcej niż 12. Zmiana strony przewija z powrotem do nagłówka sekcji.
- Numer strony **wraca do 1** po zmianie filtrów, sortowania lub rozmiaru strony i przy przełączeniu zakładki. Gdy lista się skraca (np. po wykonaniu zadań
  albo zmianie przez kogoś innego), bieżąca strona jest przycinana do ostatniej istniejącej.
- Paginacja jest **po stronie klienta** (serwer zwraca wszystkie zadania danego widoku; filtry i sortowanie też są po stronie klienta) — przy bardzo dużych
  zbiorach rozważ paginację serwerową (patrz ROADMAP).

### Paginacja projektów (strona główna → „Projekty” i „Archiwum”)

- Te same zasady i ten sam pasek (zakres, ‹ ›, numery stron, „Na stronie”) pod listą projektów — osobno dla zakładki „Projekty” i „Archiwum” (jedna lista stron na zakładkę, numer strony wraca do 1 po zmianie
  zakładki, wyszukiwania albo rozmiaru strony; po skróceniu listy strona jest przycinana).
- **Rozmiar strony projektów jest osobny od zadań** (`projectPageSize`, domyślnie **12**; 12 / 24 / 48 / 96 / Wszystkie), bo karty projektów są większe. Pasek pojawia się dopiero, gdy projektów jest więcej niż 12.
- Stały projekt „Inne” zawsze jest pierwszy, więc leży na stronie 1. **Przeciąganie zmienia kolejność w obrębie bieżącej strony** (serwer przydziela przeciągniętym projektom ich dotychczasowe miejsca, reszta zostaje);
  żeby przenieść projekt na inną stronę, użyj „Wszystkie” albo przeciągaj stopniowo. Przeciąganie jest nadal wyłączone podczas wyszukiwania.

## Wygląd i zachowanie

- **Język interfejsu (PL / EN):** lista wyboru „PL · Polski / EN · English” w pasku u góry, obok przełącznika motywu (także na ekranie logowania). Domyślnie polski; wybór zapisuje się w przeglądarce (`lang`)
  i ustawia `<html lang>`. Tłumaczone są wszystkie teksty aplikacji (przyciski, etykiety, komunikaty, okna potwierdzeń, podpowiedzi i etykiety dostępności), **daty i nazwy dni/miesięcy** (wg języka),
  **liczba mnoga** („1 task / 5 tasks”, „1 zadanie / 3 zadania / 5 zadań”) oraz **komunikaty błędów z serwera** (klient wysyła nagłówek `X-Lang`). Dane użytkownika (nazwy projektów, list, zadań, tagów, nicki)
  zostają bez zmian; stały projekt „Inne” i jego lista „Zadania” pokazują się jako „Other” / „Tasks” w EN (w bazie zostają po polsku). Zmiana języka od razu przebudowuje ekran (otwarte okna się zamykają).
- **Motyw jasny/ciemny:** przełącznik w nagłówku (suwak); wybór zapisuje się w przeglądarce (`theme`), domyślnie motyw systemu;
  skrypt w `index.html` ustawia go przed pierwszym renderem (bez mignięcia).
- **Logo „Odhacz”** (źródła w katalogu `logo/`: `svg/`, `png/`): w pasku u góry **ikona-kafelek** (jasny motyw: ciemnozielony kafelek `odhacz-icon`, ciemny: limonkowy
  `odhacz-icon-inverse`), na ekranie logowania **sam znak** nad tytułem (jasny: tuszowy `mark-ink`, ciemny: papierowy `mark-paper`). Komponent `components/Logo.tsx` renderuje obie wersje,
  a CSS (`.on-light` / `.on-dark` wg `[data-theme]`) ukrywa nieaktywną. Karta przeglądarki: `favicon.svg` + PNG 16/32 i `apple-touch-icon` w `client/public/`; kolor paska przeglądarki
  zależy od motywu systemu (`theme-color`). Nazwa aplikacji w interfejsie i w tytule karty to „TodoFrenzy”; na wąskim telefonie (≤ 480 px) obok logo nazwa jest ukryta.
- **Kolory marki w interfejsie** (z logo): tokeny `--brand`, `--brand-hover`, `--on-brand`, `--brand-text`. Jasny motyw: przyciski główne, „+” w kalendarzu, pola wyboru, znaczek „dziś”, podkreślenie zakładek i zaznaczenia
  w **ciemnym turkusie** (`#0E3B3C`) z limonkowym napisem, tło strony w kolorze „papieru” (`#F3F5EE`). Ciemny motyw: te same elementy w **limonce** (`#D6F25C`) z turkusowym napisem, tła lekko przyciemnione w stronę turkusu.
  Przełącznik motywu: limonkowy tor w jasnym, turkusowy w ciemnym. Kolory projektów i list (paleta) oraz priorytety zostają bez zmian.
- **Kolor projektu jako identyfikacja:** poza kropką, kolor projektu nadaje delikatne **tło i obwódkę** (7% / 35% koloru) blokom projektów na liście oraz **zadaniom** w kalendarzu i w zakładkach Zaległe / Bez terminu /
  Archiwum (zadanie bierze kolor swojego projektu; projekt bez koloru = neutralne). Zadanie po terminie w kalendarzu zachowuje kolor projektu i ma tylko czerwonawą obwódkę (bez koloru projektu nadal czerwonawe tło).
  Zarchiwizowane projekty i ich zadania mają tylko słaby ślad koloru (4% tła, 28% obwódki) przy kreskowaniu i przerywanej obwódce archiwum. Implementacja: `[data-color]` na `.project-card` i `.cal-task`.
- **Kolory** projektów i list: paleta 10 kolorów (czerwony, pomarańczowy, żółty, zielony, morski, niebieski, granatowy,
  fioletowy, różowy, szary) lub brak. Odcienie zależą od motywu.
- **Skala interfejsu:** od 1100 px szerokości ekranu cały interfejs jest o **20% większy** (`html { font-size: 120% }`,
  wszystkie wymiary w `rem`). Na telefonie 100%.
- **Typografia ujednolicona:** nagłówek strony 28 px, tytuł sekcji 22 px, tytuł karty 18 px (przy 100%); jedna skala rozmiarów
  w tokenach CSS (patrz ARCHITEKTURA).
- **Mobile-first:** brak poziomego przewijania, elementy dotykowe ≥ 44 px, okna modalne mieszczą się na ekranie.
- **Komunikaty (toasty)** o błędach zapisu i akcjach (np. „Cofnij”).
- **Potwierdzenia usuwania** (projekt, lista, zadanie z okna edycji, tag, użytkownik) to okna w stylu aplikacji, nie natywne okna
  przeglądarki: tytuł, opis z nazwą usuwanego elementu (i liczbą zadań), przycisk **Anuluj** (ma fokus, Esc też anuluje)
  i czerwony przycisk potwierdzenia. Usunięcie zadania jednym kliknięciem z listy nie pyta — ma „Cofnij”.
- **Realtime:** zmiany innych osób pojawiają się bez odświeżania; baner przy utracie połączenia i automatyczne
  ponawianie. Przy równoczesnej edycji wygrywa ostatni poprawnie zapisany zapis (brak rozwiązywania konfliktów).
