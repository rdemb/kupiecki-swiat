# Kupiecki Świat 3D: Odrodzenie

Wielokontynentalna gra ekonomiczno-strategiczna i turowe RPG osadzona w uniwersum **Kupieckiego Świata**. Projekt łączy dynamiczną giełdę towarową (P2P + nadwyżki miejskie), 4 pory roku z katastrofami i hodowlą smoków, interaktywne wnętrza wszystkich 12 stolic, animowaną Arenę Rycerską, turowe wyprawy na Miejsca Strachu oraz interaktywny świat 3D w Three.js z materiałami PBR, shaderami cząsteczkowymi pogody GLSL i post-processingiem.

---

## Pierwszy szlak

[Zagraj w Kupiecki Świat](https://rdemb.github.io/kupiecki-swiat/). Po wybraniu „Wkrocz na targ” otwiera się prolog, a potem Plac Złotej Wagi. Można od razu kupić towar do ładowni lub przejść do Srebrnego Gaju i Żelaznej Kuźni. Zajazd pokazuje okręgi i ogłoszone lokacje z serwera. Wybranie okręgu prowadzi do kancelarii ziemskiej. Pomysł na zajazd pochodzi z [FAQ dawnego Kupieckiego Świata](https://kupiecki-swiat.wikidot.com/faq).

Prolog ma 20 sekund, własną ścieżkę dźwiękową i polskie opisy dźwięków. Cztery kadry źródłowe powstały w ImageGen. Przedstawiają sakwę z monetami, poranny plac handlowy, most z wozem drewna i warsztat kowala. Animowane sceny i montaż można odtworzyć z plików WebP w `public/cinema` poleceniem `python scripts/render-cinematics.py` po zainstalowaniu NumPy, OpenCV i FFmpeg. Ustawienia ograniczonego ruchu lub oszczędzania danych wyłączają automatyczne odtwarzanie na wejściu. Mapa 3D korzysta z [materiałów Poly Haven na licencji CC0](public/materials/SOURCES.txt).

### Komora celna w Królewskiej Przystani

[Wejdź do wagi portowej](https://rdemb.github.io/kupiecki-swiat/?miejsce=waga-portowa). Połóż odważniki na prawej szali, aż zrównoważą próbkę na lewej. Gość może ćwiczyć. Zalogowany kupiec podpisuje manifest raz w czasie półgodzinnej wachty. Trzecia pieczęć otwiera pierwszeństwo przeładunku do końca tej wachty. Nowe dostawy budowlane do okręgu przystani i konwoje handlowe księstwa zaczynające się lub kończące w tym okręgu trwają wtedy 30 zamiast 60 sekund. Już wysłany wóz zachowuje termin. Wpis w kronice pozostaje po odpłynięciu statku.

Waga, odważniki i łańcuchy są geometrią Three.js. Fotograficzne tło komory powstało w ImageGen na podstawie opisu średniowiecznej bałtyckiej przystani widzianej znad pustego dębowego stołu. Komora i reguła trzech pieczęci to rozwinięcie świata na potrzeby tej wersji.

### Warzelnia nad zatoką

[Otwórz warzelnię](https://rdemb.github.io/kupiecki-swiat/?miejsce=warzelnia). W dawnej grze głód zatrzymywał produkcję, a do zakładów nadmorskich należały poławiacz krabów i warzelnia soli. [Zarządzanie miastem](https://kupiecki-swiat.wikidot.com/zarzadzanie-miastem) · [Miasta nadmorskie](https://kupiecki-swiat.wikidot.com/nadmorskie).

W Odrodzeniu kupcy dzielą zapasy Królewskiej Przystani. Połów daje 4 racje po 25 sekundach. Za 2 racje warzelnicy w 35 sekund produkują 2 beczki. Każdy zalogowany kupiec może wydać 4 beczki szyprowi. Fracht opłaca jeden zaprzęg, który skraca o 15 sekund najbliższy nowy konwój budowlany lub handlowy kancelarii zawijający do tego portu. Premia łączy się z odprawą komory celnej. Czasy, przeliczniki i zaprzęgi to reguły Odrodzenia.

Księga korzysta z serwerowego czasu i SQLite. Zmiana kończy się także pod nieobecność gracza. Scenę do `public/cinema/warzelnia.webp` przygotowano w ImageGen. Kadr przedstawia żelazną panew z solanką przy drewnianym nabrzeżu, warzelnika z grabiami i łódź poławiaczy w bocznym świetle późnego popołudnia.

## Najważniejsze Funkcje

### 1. Sześć Kontynentów, 26 Regionów i 12 Stolic Handlowych w Świecie 3D PBR
- **Stary Kontynent**: Królewska Przystań, Srebrny Gaj, Żelazna Kuźnia, Krwawy Szczyt, Złota Zatoka oraz Miejsca Strachu.
- **Solaria (Południowe Piaski)**: Sułtanat Oazy Al-Kharim z kopułami, minaretami i palmami, Schodkowe Piramidy Słońca oraz Wielki Sfinks.
- **Frostheim (Lodowa Północ)**: Nordycka przystań Frostgard, Cytadela Lodowego Tytana, dryfujące góry lodowe i zorza polarna (Aurora Borealis).
- **Aetheris (Szmaragdowy Wschód)**: Cesarska Jadeitowa Przystań z pagodami, wapienne iglice krasowe i Świątynia Tysiąca Smoków.
- **Valoria (Zachodnie Wyżyny)**: Valgard, Smocza Przystań, klify wywern i wodospady.
- **Archipelag Obsydianowy (Wulkaniczny Południowy Wschód)**: Obsydianowa Cytadela, Port Popiołów i geotermalne rzeki magmy.
- **Grafika 3D Three.js + GLSL**:
  - Rzeźbiony teren `520×520` z triplanarnym mapowaniem skał, 6-biomowym splatmappingiem PBR i mapą normalnych Sobela.
  - Ocean z falami Gerstnera, załamaniem Fresnela, SSS i pianą przybrzeżną.
  - **System Pogodowy PBR z dynamicznymi shaderami cząsteczkowymi GLSL**: deszcz, śnieg i wolumetryczna mgła zmieniające parametry terenu, oceanu i fizykę szlaków w czasie rzeczywistym.
  - 4 nastroje oświetlenia (**Złota Godzina / Dzień / Zmierzch / Noc**) oraz system **CameraPresets** z natychmiastowym śledzeniem wybranej karawany 3D w locie.

### 2. Interaktywne Wnętrza Wszystkich 12 Miast i Animowana Arena Rycerska
- **Wejście do każdego z 12 miast**: unikalna oprawa graficzna, animowana atmosfera cząsteczkowa (`motion/react`), 5 interaktywnych dzielnic (**Hala Giełdowa**, **Arena Rycerska**, **Kuźnia & Zbrojownia**, **Karczma Kupiecka** z leczeniem HP i plotkami giełdowymi, **Brama Karawan**) oraz szybki przełącznik między wszystkimi 12 stolicami.
- **Arena Rycerska (Animowane Pojedynki Rycerzy)**: wyzywaj **12 Czempionów Miast** oraz **rycerzy innych graczy** z rankingu na animowane pojedynki turowe z szarżami, blokami tarczą, runicznymi uderzeniami, efektami cięć SVG, wyskakującymi obrażeniami, paskami HP/Furii i rankingiem ELO.

### 3. Matematyczna Gospodarka, 4 Pory Roku, Katastrofy i Analityka Giełdowa
- **Krzywa niedoboru i nadwyżki (Inventory Bonding Curve)**, wpływ wolumenu (**Kyle's Lambda**) i **wskaźnik nastroju rynkowego** zasilany modelem antyinflacyjnym (podatek Tobina `M(t) / M*`, koszt składowania demurrage, obligacje Mennicy).
- **Animowany Terminal Giełdowy (`motion/react`)**: płynne wyróżnianie wzrostów i spadków cen w czasie rzeczywistym, wykresy świecowe, oferty P2P i sezonowe nadwyżki miejskie.
- **Dynamiczne 4 Pory Roku (Wiosna / Lato / Jesień / Zima)** wpływające na ceny, dostępność surowców, wygląd 3D świata i prędkość karawan.
- **Losowe Zdarzenia na Szlaku i Katastrofy Świata**: spotkania karawan, blokady potworów, susze, zamiecie i erupcje wulkaniczne wymagające decyzji gracza.
- **Ranking Skarbców Gildii (D3.js)**: dynamiczny wykres słupkowy D3 reagujący na wpłaty do skarbca gildii.

### 4. RPG: Personalizacja Bohatera, Hodowla Smoków, Księstwo i Kontrakty
- **Personalizacja i 3 Ścieżki Rozwoju Bohatera** (Wódz, Magnat, Arcymag) + zbrojownia z ekwipunkiem do kupienia i znalezienia.
- **Sanktuarium i Hodowla Smoków**: inkubacja jaj, karmienie, ewolucja żywiołowych smoków i wyprawy powietrzne wspierające handel i walkę.
- **Turowe Wyprawy na Miejsca Strachu**, **Kampania Fabularna (5 Aktów)**, **Kontrakty Królewskie**, **Drzewko Technologii**, **Dom Aukcyjny**, **Gildie & Czat** oraz **Konta Graczy** (Express + WebSocket + opcjonalnie Firebase Auth & Firestore).

---

## Architektura i Stack Technologiczny

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Three.js (GLSL PBR + cząsteczki pogodowe + post-processing), `motion/react`, D3.js
- **Backend**: Node.js, Express, WebSocket (`ws`), autoryzacja sesyjna i serwerowa symulacja rynku
- **Chmura (opcjonalnie)**: Firebase Authentication + Cloud Firestore (`firestore.rules`)
- **Testy jednostkowe**: `node:test` + `tsx` (silnik ekonomii, 6 kontynentów, pogoda PBR, zdarzenia na szlaku, rozwój bohatera, pory roku/katastrofy/smoki, rankingi gildii, presety kamer 3D, wnętrza miast i Arena Rycerska)

---

## Uruchomienie Lokalne

### Wymagania
- Node.js 24.22+ (SQLite wbudowane w Node.js)
- npm 10+

### Instalacja i start serwera deweloperskiego
```bash
npm install
npm run dev
```
Aplikacja uruchomi się pod adresem `http://localhost:3000`.

### Testy, lintowanie i budowa produkcyjna
```bash
# Zestaw testów jednostkowych (node:test)
npm test

# Sprawdzenie typów TypeScript
npm run lint

# Budowa produkcyjna (Vite + kopiowanie zasobów)
npm run build

# Start produkcyjny
npm start
```

### Konta w wersji testowej

Kompilacja tworzy katalog `dist` i plik `server.cjs`. Wystarczają do uruchomienia przez Node.js 24 z tego samego katalogu. Interfejs, API i WebSocket korzystają z jednego adresu. `PORT` domyślnie wynosi 3000, a `HOST` ustala interfejs sieciowy. Ustaw `HOST=127.0.0.1` dla prób na własnym komputerze.

Baza profili SQLite powstaje w `.data/game.sqlite`. Na hostingu ustaw `GAME_DATA_DIR` na katalog na trwałym dysku. Starsze profile z `players.json` w tym katalogu są importowane jednorazowo podczas pierwszego startu. Aby wykonać kopię zapasową, zatrzymaj serwer i skopiuj cały katalog danych. Po restarcie zaloguj się ponownie. Jedna instancja prowadzi wspólną giełdę i zapisuje jej stan, aukcje, gildie oraz ostatnie wiadomości czatu w tej samej bazie. Ta wersja jest przeznaczona do testów z zaufanymi graczami.

### Zmienne środowiskowe
Skopiuj `.env.example` do `.env` i opcjonalnie uzupełnij własne klucze, jeśli chcesz uruchomić dodatkową integrację chmurową. Gra działa w pełni również lokalnie bez żadnej konfiguracji zewnętrznych kluczy.

---

## Struktura Projektu

```text
├── server.ts                            # Serwer Express + WebSocket (rynek, P2P, aukcje, czat)
├── src/
│   ├── App.tsx                          # Główny stan gry, HUD, skróty klawiszowe i integracja modułów
│   ├── economy/
│   │   ├── economyEngine.ts             # Model cen, podatku antyinflacyjnego, 4 pór roku i 12 stolic
│   │   ├── worldMapData.ts              # 6 kontynentów, 26 regionów i mapa wysokości
│   │   ├── cityAndArenaEngine.ts        # Wnętrza 12 miast, 12 Czempionów i silnik walk Areny Rycerskiej
│   │   ├── gameData.ts                  # 5 Ras, Rycerz, wyprawy, Księstwo, Magia, Kampania, Technologie
│   │   ├── heroProgression.ts           # Personalizacja bohatera, 3 ścieżki rozwoju i ekwipunek RPG
│   │   ├── dragonBreeding.ts            # Hodowla smoków, inkubacja jaj i wyprawy powietrzne
│   │   ├── worldDisasters.ts            # Katastrofy świata i akcje ratunkowe
│   │   ├── trailEvents.ts               # Losowe zdarzenia na szlaku zależne od pogody i pory dnia
│   │   ├── guildRankings.ts             # Ranking skarbców gildii dla wykresu D3
│   │   └── achievementsAndQuests.ts     # Kontrakty Królewskie, Osiągnięcia i Ranga Szlachecka
│   ├── world3d/
│   │   ├── terrainAndShaders.ts         # Shadery GLSL terenu PBR, oceanu Gerstnera i nieba
│   │   ├── pbrWeather.ts                # System pogodowy PBR i modyfikatory handlu
│   │   ├── weatherParticles.ts          # Dynamiczne shadery cząsteczkowe GLSL (deszcz, śnieg, mgła)
│   │   ├── cameraPresets.ts             # Presety kamer 3D i śledzenie karawan w locie
│   │   └── architectureAndProps.ts      # Architektura 12 miast, monumenty, smoki i galeony
│   └── components/
│       ├── World3DCanvas.tsx            # Scena Three.js, cząsteczki pogodowe, kamera i post-processing
│       ├── CityInteriorModal.tsx        # Interaktywne wnętrza 12 miast + animowana Arena Rycerska
│       ├── WorldMapAtlasPanel.tsx       # Atlas 6 Kontynentów + aktywne szlaki z kamerą 3D na karawanę
│       ├── DayTraderTerminal.tsx        # Animowana giełda (Motion), wskaźnik nastroju i oferty P2P
│       ├── GuildTreasuryRankingChart.tsx# Dynamiczny wykres słupkowy D3 skarbców gildii
│       ├── KnightAndMissionsPanel.tsx   # Rozwój bohatera, zbrojownia, wyprawy i wejście na Arenę
│       ├── DuchyAndStoryCampaignPanel.tsx # Kampania, Księstwo, Magia i Sanktuarium Smoków
│       ├── AuctionTechGuildPanel.tsx    # Szlaki 3D, Dom Aukcyjny, Technologie, Gildie i Czat
│       └── AuthAndProfilePanel.tsx      # Logowanie, rejestracja i profil kupca
├── firestore.rules                      # Reguły bezpieczeństwa Firestore
└── LICENSE                              # Licencja MIT
```

---

## Licencja

Projekt udostępniany na licencji **MIT** — szczegóły w pliku [LICENSE](./LICENSE).

### Dwór Imperatora

Po zalogowaniu zakładka **Konto** pokazuje skarbiec oraz nadany przedrostek. Imperator może tam wybrać istniejącego gracza, przyznać sztabki albo nadać lub cofnąć przedrostek. Uzasadnienie trafia do księgi dekretów. Sztabki są osobnym dobrem od złota handlowego. Pierwsze wydanie obsługuje ich nadawanie i przechowywanie.

Operator VPS przypisuje tron do już zarejestrowanego, potwierdzonego konta. Uruchamia poniższe polecenie z katalogu kodu, podając faktyczną lokalizację bazy, login i odpowiadający mu UID. Polecenie nie zastępuje istniejącego właściciela.

```sh
GAME_DATA_DIR=/ścieżka/do/danych node scripts/seat-emperor.mjs LOGIN UID
```

### Karczma, gildie i przewodnik

W każdym z dwunastu miast karczma prowadzi własną tablicę. Zalogowany kupiec może zamieścić do trzech czynnych ogłoszeń, szukać chętnych do handlu lub wyprawy i zamknąć sprawę. Ogłoszenia wygasają po siedmiu dniach. Przy stole gildii gracze rozmawiają prywatnie, zakładają własny cech, rozpatrują prośby i przekazują proporzec. Serwer zapisuje te decyzje w SQLite. Każdy dodatkowy zrzeszony gracz skraca czas nowo wysyłanych konwojów kancelarii o 5%, maksymalnie o 20%. Liczy się rzeczywiste członkostwo.

Podstawą tej korzyści jest [zarządzanie gildią w oryginale](https://kupiecki-swiat.wikidot.com/zarzadzanie-gildia). Współczynniki przewozu oraz wpływ sezonu, ulewy, mrozu i zarazy zbożowej na zbiory faktorii należą do zasad Odrodzenia. Cztery wskazówki na trakcie, w karczmie, gildii i księstwie można przeczytać lub odtworzyć na żądanie. Nagrania powstały lokalnie przy użyciu [polskiego głosu Piper Darkman](https://huggingface.co/rhasspy/piper-voices/blob/main/pl/pl_PL/darkman/medium/MODEL_CARD). Wnętrze karczmy to wygenerowany kadr.

### Kupieckie kontrakty na zboże

W karczmie wybierz **Kontrakty i młyn** albo wejdź do [młyna Królewskiej Przystani](https://rdemb.github.io/kupiecki-swiat/?miejsce=mlyn). Kupiec określa cenę, liczbę worków i odbiorcę: własny magazyn lub młyn miasta. Serwer od razu pobiera pełną zapłatę do depozytu. Inni kupcy, również z różnych gildii, mogą dostarczać zboże partiami. Każda partia jednocześnie zmniejsza magazyn dostawcy, zwalnia jego zapłatę i zasila wybranego odbiorcę. Niewykorzystana część depozytu wraca po odwołaniu lub upływie 24 godzin.

Cztery worki dostarczone do młyna dają trzy miary mąki. Reszta ziarna przechodzi na kolejną dostawę. Piekarnie zużywają jedną miarę co dziesięć minut. Kupiec może też wydać 32 zł na prowiant kosztujący miasto trzy miary mąki i skracający jego następny przewóz kancelarii o pięć sekund. Podczas ulewy lub mrozu niedobór mąki może skłonić miasto do wystawienia zamówienia na 30 worków po 28 zł. Skarbiec musi mieć na to pokrycie. Wszystkie te zasady stanowią rozszerzenie Odrodzenia.
