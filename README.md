# Kupiecki Świat 3D: Odrodzenie

Wielokontynentalna gra ekonomiczno-strategiczna i turowe RPG osadzona w uniwersum **Kupieckiego Świata**. Projekt łączy dynamiczną giełdę towarową (P2P + nadwyżki miejskie), 4 pory roku z katastrofami i hodowlą smoków, interaktywne wnętrza wszystkich 12 stolic, animowaną Arenę Rycerską, turowe wyprawy na Miejsca Strachu oraz interaktywny świat 3D w Three.js z materiałami PBR, shaderami cząsteczkowymi pogody GLSL i post-processingiem.

---

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
- Node.js 20+
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
