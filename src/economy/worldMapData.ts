import {worksites, crafts} from './newHope';
import sanJuanElevation from '../assets/terrain/san-juan.json';
import { CITIES, CommodityId, ContinentId } from './economyEngine';

export type WorldRegionType = 'capital' | 'fear_place' | 'port' | 'sanctuary' | 'workshop';

export interface ContinentSpec {
  id: ContinentId;
  name: string;
  shortName: string;
  subtitle: string;
  climate: string;
  colorHex: string;
  description: string;
  cameraOverviewPos: [number, number, number];
  cameraOverviewLook: [number, number, number];
  capitalRegionId: string;
}

export const WORLD_CONTINENTS: ContinentSpec[] = [
  {
    id: 'stary_kontynent',
    name: 'Stary Kontynent — Królestwo Środka',
    shortName: 'Stary Kontynent',
    subtitle: 'Umiarkowane Niziny, Alpejskie Szczyty i Kaldera Wulkanu',
    climate: 'Umiarkowany · 4 Pory Roku',
    colorHex: '#D4AF37',
    description:
      'Serce Kupieckiego Świata z Królewską Przystanią, leśnymi dolinami Elfów, krasnoludzkimi kopalniami Mithrilu i dymiącym kraterem Smoka Ignisa.',
    cameraOverviewPos: [14, 68, 92],
    cameraOverviewLook: [4, 5, -10],
    capitalRegionId: 'krolewska_przystan',
  },
  {
    id: 'solaria_poludnie',
    name: 'Sułtanat Solarii i Złoty Archipelag',
    shortName: 'Solaria (Południe)',
    subtitle: 'Złote Wydmy, Czerwone Kaniony, Oazy i Koralowe Laguny',
    climate: 'Pustynny & Tropikalny',
    colorHex: '#FB923C',
    description:
      'Rozpalony słońcem południowy kontynent przypraw, jedwabiu, starożytnych piramid oraz turkusowego archipelagu Złotej Zatoki.',
    cameraOverviewPos: [-48, 62, 198],
    cameraOverviewLook: [-44, 4, 108],
    capitalRegionId: 'oaza_alkharim',
  },
  {
    id: 'frostheim_polnoc',
    name: 'Frostheim — Północny Kontynent Lodowy',
    shortName: 'Frostheim (Północ)',
    subtitle: 'Głębokie Fiordy, Lodowce, Góry Lodowe i Zorza Polarna',
    climate: 'Subarktyczny & Lodowcowy',
    colorHex: '#60A5FA',
    description:
      'Surowa, skuta lodem kraina północnych klanów, strzegąca najbogatszych żył czystego żelaza oraz zapomnianej Cytadeli Wiecznego Lodu.',
    cameraOverviewPos: [-110, 62, -38],
    cameraOverviewLook: [-136, 8, -124],
    capitalRegionId: 'frostgard',
  },
  {
    id: 'aetheris_wschod',
    name: 'Cesarstwo Szmaragdowe — Aetheris',
    shortName: 'Aetheris (Wschód)',
    subtitle: 'Mglisite Szczyty Karstowe, Cesarskie Pagody i Zatoka Korsarzy',
    climate: 'Monsunowy & Wyżynny',
    colorHex: '#2DD4BF',
    description:
      'Tajemniczy wschodni kontynent za Cieśniną Szmaragdową, pełen strzelistych wapiennych iglic, starożytnych pagód oraz szlaków runicznych pergaminów.',
    cameraOverviewPos: [164, 64, 106],
    cameraOverviewLook: [162, 7, 12],
    capitalRegionId: 'jadeitowa_przystan',
  },
  {
    id: 'valoria_zachod',
    name: 'Valoria — Zielone Wyżyny i Smocze Knieje',
    shortName: 'Valoria (Zachód)',
    subtitle: 'Szmaragdowe Wodospady, Knieje Druidów i Sanktuaria Smoków',
    climate: 'Wyżynny & Wilgotny',
    colorHex: '#22C55E',
    description:
      'Daleki zachodni kontynent spowity wodospadami i prastarą puszczą, gdzie Zakon Smoczych Hodowców wychowuje młode smoki, a rzemieślnicy pozyskują najcenniejsze drewno.',
    cameraOverviewPos: [-176, 66, 102],
    cameraOverviewLook: [-178, 7, 20],
    capitalRegionId: 'valgard',
  },
  {
    id: 'obsydian_wulkan',
    name: 'Archipelag Obsydianowy — Kuźnie Magmy',
    shortName: 'Obsydian (Płd-Wsch)',
    subtitle: 'Wulkaniczne Kaldery, Rzeki Lawy i Czarne Cytadele Bazaltu',
    climate: 'Wulkaniczny & Geotermalny',
    colorHex: '#F97316',
    description:
      'Południowo-wschodni archipelag czynnych wulkanów i czarnego obsydianu. W jego głębiach powstają najczystsze sztaby Mithrilu, lecz erupcje zagrażają szlakom morskim.',
    cameraOverviewPos: [152, 68, 242],
    cameraOverviewLook: [154, 7, 156],
    capitalRegionId: 'obsydianowa_cytadela',
  },
  {id:'nowa_nadzieja',name:'Nowa Nadzieja',shortName:'Nowa Nadzieja',subtitle:'Warsztaty za wschodnią cieśniną',
    climate:'Morski',colorHex:'#ade1d2',description:'Kupcy zakładają warsztaty pomiędzy wydmami, solankami i szkutniczymi przystaniami.',
    cameraOverviewPos:[620,235,291],cameraOverviewLook:[620,3,0],capitalRegionId:'mierzeja'},
];

export interface WorldRegionNode {
  id: string;
  name: string;
  subtitle: string;
  continentId: ContinentId;
  type: WorldRegionType;
  typeLabel: string;
  biome:
    | 'Nadmorska Nizina'
    | 'Zaczarowana Puszcza'
    | 'Alpejskie Szczyty'
    | 'Archipelag Złotej Zatoki'
    | 'Wulkaniczna Kaldera'
    | 'Pustynna Oaza Solarii'
    | 'Czerwone Kaniony Solarii'
    | 'Lodowe Fiordy Frostheimu'
    | 'Szmaragdowe Szczyty Aetheris'
    | 'Szmaragdowe Wyżyny Valorii'
    | 'Obsydianowy Archipelag Magmy';
  position2D: [number, number]; // [x, z] in 620x620 3D world space (-260..260)
  atlasPercent: [number, number]; // [left%, top%] mapped precisely onto the 6-Continent Satellite Atlas
  altitudeMeters: number;
  dangerLabel: string;
  loreDescription: string;
  colorHex: string;
  linkedCityId?: string;
  linkedQuestId?: string;
  featuredCommodity?: CommodityId;
}

export const WORLD_REGIONS: WorldRegionNode[] = [
  // ================= CONTINENT 1: STARY KONTYNENT (9 Regions) =================
  {
    id: 'krolewska_przystan',
    name: 'Królewska Przystań',
    subtitle: 'Stolica Księstwa · Warowny Port & Mennica',
    continentId: 'stary_kontynent',
    type: 'capital',
    typeLabel: 'Stolica Kontynentu',
    biome: 'Nadmorska Nizina',
    position2D: [4, 2],
    atlasPercent: [55.0, 49.0],
    altitudeMeters: 25,
    dangerLabel: 'Niskie (Patrole Gwardii)',
    loreDescription:
      'Potężna kamienna cytadela strzegąca wejścia do Centralnej Zatoki. Tu bije serce Giełdy Towarowej, Królewskiej Mennicy oraz spichlerzy zbożowych Księstwa.',
    colorHex: '#D4AF37',
    linkedCityId: 'krolewska_przystan',
    featuredCommodity: 'zboze',
  },
  {
    id: 'srebrny_gaj',
    name: 'Srebrny Gaj',
    subtitle: 'Dolina Elfów · Tartaki i Skryptoria Run',
    continentId: 'stary_kontynent',
    type: 'capital',
    typeLabel: 'Stolica Frakcji',
    biome: 'Zaczarowana Puszcza',
    position2D: [-56, -4],
    atlasPercent: [44.0, 41.0],
    altitudeMeters: 180,
    dangerLabel: 'Umiarkowane',
    loreDescription:
      'Malownicza dolina nad krętą zachodnią rzeką, otoczona pradawnymi lasami dębów i sosen. Elficcy mistrzowie wyrabiają tu najczystsze drewno i runiczne zwoje.',
    colorHex: '#10B981',
    linkedCityId: 'srebrny_gaj',
    featuredCommodity: 'drewno_elfickie',
  },
  {
    id: 'zelazna_kuznia',
    name: 'Żelazna Kuźnia',
    subtitle: 'Twierdza Krasnoludów · Kopalnie Mithrilu',
    continentId: 'stary_kontynent',
    type: 'capital',
    typeLabel: 'Stolica Frakcji',
    biome: 'Alpejskie Szczyty',
    position2D: [-6, -56],
    atlasPercent: [56.0, 22.0],
    altitudeMeters: 1150,
    dangerLabel: 'Wysokie (Zimowe Zamiecie)',
    loreDescription:
      'Wykuta w północnych ośnieżonych pasmach górskich krasnoludzka forteca, z której kominów unosi się blask wielkich pieców wytapiających żelazo i Mithril.',
    colorHex: '#F59E0B',
    linkedCityId: 'zelazna_kuznia',
    featuredCommodity: 'mithril',
  },
  {
    id: 'krwawy_szczyt',
    name: 'Krwawy Szczyt',
    subtitle: 'Warownia Orków · Pogranicze Wulkanu',
    continentId: 'stary_kontynent',
    type: 'capital',
    typeLabel: 'Stolica Frakcji',
    biome: 'Wulkaniczna Kaldera',
    position2D: [64, -8],
    atlasPercent: [62.5, 45.0],
    altitudeMeters: 1420,
    dangerLabel: 'Ekstremalne',
    loreDescription:
      'Czarna bazaltowa twierdza na wschodnich zboczach wulkanu, gdzie zahartowani pogromcy polują na smoki i handlują bezcennymi Smoczymi Łuskami.',
    colorHex: '#F43F5E',
    linkedCityId: 'krwawy_szczyt',
    featuredCommodity: 'smocza_luska',
  },
  {
    id: 'twierdza_rebeliantow',
    name: 'Czarny Most (Obóz Rebeliantów)',
    subtitle: 'Wyprawa Turowa · Kryjówka Krwawego Korda',
    continentId: 'stary_kontynent',
    type: 'fear_place',
    typeLabel: 'Obóz Rebeliantów',
    biome: 'Nadmorska Nizina',
    position2D: [-28, 6],
    atlasPercent: [47.5, 57.0],
    altitudeMeters: 65,
    dangerLabel: 'Zagrożenie: Poz. 1',
    loreDescription:
      'Ufortyfikowana drewniana palisada blokująca most na trakcie zbożowym. Herszt Krwawy Kord łupi tu nieeskortowane wozy kupieckie.',
    colorHex: '#EF4444',
    linkedQuestId: 'quest_rebelianci_szlak',
    featuredCommodity: 'zboze',
  },
  {
    id: 'puszcza_arachny',
    name: 'Mroczna Puszcza Arachny',
    subtitle: 'Wyprawa Turowa · Gniazdo Cienistych Pająków',
    continentId: 'stary_kontynent',
    type: 'fear_place',
    typeLabel: 'Miejsce Strachu',
    biome: 'Zaczarowana Puszcza',
    position2D: [-74, 10],
    atlasPercent: [46.0, 29.5],
    altitudeMeters: 210,
    dangerLabel: 'Zagrożenie: Poz. 2',
    loreDescription:
      'Gęste, spowite mgłą zachodnie bory, w których gigantyczne pająki przejęły stare leśne skryptoria pełne runicznych zwojów.',
    colorHex: '#A855F7',
    linkedQuestId: 'quest_pajaki_gaj',
    featuredCommodity: 'runiczny_pergamin',
  },
  {
    id: 'sztolnia_mithrilu',
    name: 'Przeklęta Sztolnia Mithrilu',
    subtitle: 'Wyprawa Turowa · Bastion Runicznego Golema',
    continentId: 'stary_kontynent',
    type: 'fear_place',
    typeLabel: 'Miejsce Strachu',
    biome: 'Alpejskie Szczyty',
    position2D: [-32, -62],
    atlasPercent: [51.0, 17.5],
    altitudeMeters: 1580,
    dangerLabel: 'Zagrożenie: Poz. 3',
    loreDescription:
      'Opuszczony szyb pod lodowcem w północnych szczytach. Strzeże go Pradawny Bazaltowy Golem napędzany surową energią many.',
    colorHex: '#F97316',
    linkedQuestId: 'quest_golem_kuznia',
    featuredCommodity: 'mithril',
  },
  {
    id: 'iglica_ignisa',
    name: 'Krater Pradawnego Smoka Ignisa',
    subtitle: 'Legendarne Miejsce Strachu · Wulkaniczna Iglica',
    continentId: 'stary_kontynent',
    type: 'fear_place',
    typeLabel: 'Smocze Legowisko',
    biome: 'Wulkaniczna Kaldera',
    position2D: [82, -20],
    atlasPercent: [64.5, 36.0],
    altitudeMeters: 2450,
    dangerLabel: 'Legendarny Boss: Poz. 5',
    loreDescription:
      'Dymiąca kaldera aktywnego wulkanu na wschodnim krańcu Starego Kontynentu. Nad płynną magmą krąży Pradawny Smok Ignis.',
    colorHex: '#DC2626',
    linkedQuestId: 'quest_smok_szczyt',
    featuredCommodity: 'smocza_luska',
  },
  {
    id: 'krag_arcymaga',
    name: 'Starożytny Krąg Runiczny Arcymaga',
    subtitle: 'Sanktuarium Kolegium Magii · Źródło Many',
    continentId: 'stary_kontynent',
    type: 'sanctuary',
    typeLabel: 'Sanktuarium Magii',
    biome: 'Alpejskie Szczyty',
    position2D: [28, -36],
    atlasPercent: [62.0, 28.0],
    altitudeMeters: 740,
    dangerLabel: 'Strefa Magiczna',
    loreDescription:
      'Wzniesiony na wysokogórskim płaskowyżu kamienny krąg monolitów, z którego Twój Arcymag czerpie energię do zaklęć Złotego Żniwa i Pioruna.',
    colorHex: '#818CF8',
    featuredCommodity: 'krysztaly_many',
  },

  // ================= CONTINENT 2: SUŁTANAT SOLARII I ARCHIPELAG (5 Regions) =================
  {
    id: 'zlota_zatoka',
    name: 'Złota Zatoka',
    subtitle: 'Brama Południa · Archipelag Kupiecki & Many',
    continentId: 'solaria_poludnie',
    type: 'capital',
    typeLabel: 'Stolica Archipelagu',
    biome: 'Archipelag Złotej Zatoki',
    position2D: [14, 76],
    atlasPercent: [37.5, 71.0],
    altitudeMeters: 10,
    dangerLabel: 'Umiarkowane (Sztormy)',
    loreDescription:
      'Słoneczny archipelag koralowy łączący Stary Kontynent z pustynnym Sułtanatem Solarii. Codziennie zawijają tu galeony z przyprawami i kryształami many.',
    colorHex: '#38BDF8',
    linkedCityId: 'zlota_zatoka',
    featuredCommodity: 'krysztaly_many',
  },
  {
    id: 'oaza_alkharim',
    name: 'Oaza Al-Kharim',
    subtitle: 'Stolica Sułtanatu Solarii · Wielki Bazar Przypraw',
    continentId: 'solaria_poludnie',
    type: 'capital',
    typeLabel: 'Stolica Kontynentu',
    biome: 'Pustynna Oaza Solarii',
    position2D: [-64, 118],
    atlasPercent: [30.5, 79.0],
    altitudeMeters: 45,
    dangerLabel: 'Umiarkowane (Burze Piaskowe)',
    loreDescription:
      'Złota pustynna metropolia z kopułami z piaskowca i palmową oazą pośrodku Kontynentu Południowego. Największe centrum handlu przyprawami na świecie.',
    colorHex: '#FB923C',
    linkedCityId: 'oaza_alkharim',
    featuredCommodity: 'przyprawy',
  },
  {
    id: 'piramidy_slonca',
    name: 'Piramidy Słońca Solarii',
    subtitle: 'Starożytne Grobowce · Zaginione Skarby Pustyni',
    continentId: 'solaria_poludnie',
    type: 'fear_place',
    typeLabel: 'Miejsce Strachu',
    biome: 'Czerwone Kaniony Solarii',
    position2D: [-114, 128],
    atlasPercent: [21.5, 86.0],
    altitudeMeters: 340,
    dangerLabel: 'Zagrożenie: Poz. 4',
    loreDescription:
      'Monumentalne schodkowe piramidy wzniesione na krawędzi czerwonych kanionów Solarii. Strzegą ich piaskowe golemy i dawni strażnicy skarbca.',
    colorHex: '#F59E0B',
    linkedQuestId: 'quest_sfinks_solaria',
    featuredCommodity: 'przyprawy',
  },
  {
    id: 'krolewska_stocznia',
    name: 'Wielka Stocznia i Latarnia Morska',
    subtitle: 'Strażnica Cieśniny Południowej · Baza Floty',
    continentId: 'solaria_poludnie',
    type: 'port',
    typeLabel: 'Port Strategiczny',
    biome: 'Archipelag Złotej Zatoki',
    position2D: [48, 54],
    atlasPercent: [56.5, 62.5],
    altitudeMeters: 12,
    dangerLabel: 'Bezpieczny Port',
    loreDescription:
      'Potężna kamienna latarnia prowadząca międzykontynentalne galeony przez cieśninę między Starym Kontynentem, Solarią a Archipelagiem Obsydianowym.',
    colorHex: '#3B82F6',
    featuredCommodity: 'przyprawy',
  },
  {
    id: 'wrak_valthora',
    name: 'Rafa Widmowego Galeonu',
    subtitle: 'Cieśnina Zachodnia · Zjawy Kapitana Valthora',
    continentId: 'solaria_poludnie',
    type: 'fear_place',
    typeLabel: 'Miejsce Strachu',
    biome: 'Archipelag Złotej Zatoki',
    position2D: [-24, 64],
    atlasPercent: [42.5, 83.0],
    altitudeMeters: 0,
    dangerLabel: 'Zagrożenie: Poz. 4',
    loreDescription:
      'Zdradliwa turkusowa cieśnina między Starym Kontynentem a wybrzeżem Solarii, na której spoczywa widmowy galeon wyładowany skrzyniami skarbów.',
    colorHex: '#06B6D4',
    linkedQuestId: 'quest_upior_zatoka',
    featuredCommodity: 'przyprawy',
  },

  // ================= CONTINENT 3: FROSTHEIM — PÓŁNOCNY KONTYNENT LODOWY (3 Regions) =================
  {
    id: 'frostgard',
    name: 'Frostgard',
    subtitle: 'Stolica Frostheimu · Warowny Port Fiordu',
    continentId: 'frostheim_polnoc',
    type: 'capital',
    typeLabel: 'Stolica Kontynentu',
    biome: 'Lodowe Fiordy Frostheimu',
    position2D: [-128, -118],
    atlasPercent: [27.5, 27.5],
    altitudeMeters: 320,
    dangerLabel: 'Wysokie (Arktyczny Mróz)',
    loreDescription:
      'Nordycka twierdza wykuta nad głębokim lodowym fiordem Północnego Kontynentu. Statki lodołamacze wywożą stąd najlepsze żelazo i futra w zamian za południowe przyprawy.',
    colorHex: '#60A5FA',
    linkedCityId: 'frostgard',
    featuredCommodity: 'zelazo',
  },
  {
    id: 'cytadela_lodu',
    name: 'Cytadela Wiecznego Lodu',
    subtitle: 'Serce Lodowca · Sanktuarium Mroźnego Tytana',
    continentId: 'frostheim_polnoc',
    type: 'fear_place',
    typeLabel: 'Miejsce Strachu',
    biome: 'Lodowe Fiordy Frostheimu',
    position2D: [-162, -148],
    atlasPercent: [19.5, 14.5],
    altitudeMeters: 1890,
    dangerLabel: 'Legendarny Boss: Poz. 5',
    loreDescription:
      'Kryształowa forteca na szczycie błękitnego lodowca Frostheimu, nad którą nocą tańczy zorza polarna. Wyprawa tutaj wymaga zaprawionego Rycerza.',
    colorHex: '#38BDF8',
    linkedQuestId: 'quest_tytan_frostheim',
    featuredCommodity: 'mithril',
  },
  {
    id: 'ciesnina_lodowa',
    name: 'Cieśnina Gór Lodowych',
    subtitle: 'Północny Szlak Morski · Przystań Wielorybników',
    continentId: 'frostheim_polnoc',
    type: 'port',
    typeLabel: 'Port Arktyczny',
    biome: 'Lodowe Fiordy Frostheimu',
    position2D: [-88, -94],
    atlasPercent: [33.5, 34.0],
    altitudeMeters: 18,
    dangerLabel: 'Umiarkowane (Góry Lodowe)',
    loreDescription:
      'Zimna cieśnina usiana dryfującymi błękitnymi górami lodowymi, stanowiąca jedyną żeglowną bramę między Frostheimem a Starym Kontynentem.',
    colorHex: '#93C5FD',
    featuredCommodity: 'zelazo',
  },

  // ================= CONTINENT 4: CESARSTWO AETHERIS — WSCHODNI KONTYNENT (3 Regions) =================
  {
    id: 'jadeitowa_przystan',
    name: 'Jadeitowa Przystań',
    subtitle: 'Stolica Cesarstwa Aetheris · Metropolia Pagód',
    continentId: 'aetheris_wschod',
    type: 'capital',
    typeLabel: 'Stolica Kontynentu',
    biome: 'Szmaragdowe Szczyty Aetheris',
    position2D: [158, 18],
    atlasPercent: [85.0, 31.0],
    altitudeMeters: 65,
    dangerLabel: 'Niskie (Cesarska Flota)',
    loreDescription:
      'Olśniewający zamorski port ze strzelistymi cesarskimi pagodami u podnóża mglisitych szczytów karstowych. Centrum handlu Runicznymi Pergaminami i Kryształami Many.',
    colorHex: '#2DD4BF',
    linkedCityId: 'jadeitowa_przystan',
    featuredCommodity: 'runiczny_pergamin',
  },
  {
    id: 'swiatynia_smokow',
    name: 'Świątynia Tysiąca Smoków',
    subtitle: 'Górskie Sanktuarium Pagód · Źródło Run',
    continentId: 'aetheris_wschod',
    type: 'sanctuary',
    typeLabel: 'Sanktuarium Wschodu',
    biome: 'Szmaragdowe Szczyty Aetheris',
    position2D: [180, -34],
    atlasPercent: [91.5, 16.0],
    altitudeMeters: 1320,
    dangerLabel: 'Strefa Magiczna',
    loreDescription:
      'Klasztor zawieszony między spowitymi chmurami wapiennymi iglicami północnego Aetheris. Mistrzowie Wschodu spisują tu pradawne zwoje zaklęć.',
    colorHex: '#34D399',
    featuredCommodity: 'runiczny_pergamin',
  },
  {
    id: 'czarna_zatoka',
    name: 'Czarna Zatoka Korsarzy',
    subtitle: 'Południowy Przylądek Aetheris · Skarbiec Piratów',
    continentId: 'aetheris_wschod',
    type: 'fear_place',
    typeLabel: 'Twierdza Korsarzy',
    biome: 'Szmaragdowe Szczyty Aetheris',
    position2D: [150, 74],
    atlasPercent: [88.5, 48.0],
    altitudeMeters: 30,
    dangerLabel: 'Zagrożenie: Poz. 4',
    loreDescription:
      'Ukryta wśród stromych szmaragdowych klifów zatoka, z której korsarze atakują bogate galeony wracające ze Wschodu.',
    colorHex: '#EC4899',
    linkedQuestId: 'quest_korsarz_aetheris',
    featuredCommodity: 'smocza_luska',
  },

  // ================= CONTINENT 5: VALORIA — ZIELONE WYŻYNY ZACHODU (3 Regions) =================
  {
    id: 'valgard',
    name: 'Valgard (Wyżyny)',
    subtitle: 'Stolica Valorii · Twierdza Nad Wodospadami',
    continentId: 'valoria_zachod',
    type: 'capital',
    typeLabel: 'Stolica Kontynentu',
    biome: 'Szmaragdowe Wyżyny Valorii',
    position2D: [-168, 8],
    atlasPercent: [13.5, 46.5],
    altitudeMeters: 420,
    dangerLabel: 'Umiarkowane',
    loreDescription:
      'Wzniesiona na szmaragdowych tarasach ponad kaskadami wodospadów twierdza Valorii. Eksportuje najtrwalsze drewno i świeże plony do pozostałych kontynentów.',
    colorHex: '#22C55E',
    linkedCityId: 'valgard',
    featuredCommodity: 'drewno_elfickie',
  },
  {
    id: 'smocza_przystan',
    name: 'Smocza Przystań',
    subtitle: 'Sanktuarium Hodowców Smoków · Port Klifowy',
    continentId: 'valoria_zachod',
    type: 'capital',
    typeLabel: 'Stolica Hodowli Smoków',
    biome: 'Szmaragdowe Wyżyny Valorii',
    position2D: [-192, 46],
    atlasPercent: [11.0, 57.5],
    altitudeMeters: 165,
    dangerLabel: 'Umiarkowane (Dzikie Wywerny)',
    loreDescription:
      'Główny ośrodek Zakonu Smoczych Hodowców, gdzie inkubuje się jaja czterech żywiołów i handluje bezcennymi Smoczymi Łuskami.',
    colorHex: '#4ADE80',
    linkedCityId: 'smocza_przystan',
    featuredCommodity: 'smocza_luska',
  },
  {
    id: 'gniazdo_wywern',
    name: 'Gniazdo Pradawnych Wywern',
    subtitle: 'Północny Klif Valorii · Legowisko Bestii',
    continentId: 'valoria_zachod',
    type: 'fear_place',
    typeLabel: 'Smocze Legowisko',
    biome: 'Szmaragdowe Wyżyny Valorii',
    position2D: [-202, -18],
    atlasPercent: [13.5, 36.5],
    altitudeMeters: 1120,
    dangerLabel: 'Zagrożenie: Poz. 4',
    loreDescription:
      'Górska grań ponad wodospadami Valorii, gdzie gniazdują dzikie wywerny. Pokonanie ich Królowej zapewnia bogate łupy łusek i drewna.',
    colorHex: '#16A34A',
    linkedQuestId: 'quest_wywerny_valoria',
    featuredCommodity: 'smocza_luska',
  },

  // ================= CONTINENT 6: ARCHIPELAG OBSYDIANOWY (3 Regions) =================
  {
    id: 'obsydianowa_cytadela',
    name: 'Obsydianowa Cytadela',
    subtitle: 'Stolica Archipelagu · Kuźnie Płynnej Magmy',
    continentId: 'obsydian_wulkan',
    type: 'capital',
    typeLabel: 'Stolica Kontynentu',
    biome: 'Obsydianowy Archipelag Magmy',
    position2D: [156, 148],
    atlasPercent: [74.5, 76.5],
    altitudeMeters: 980,
    dangerLabel: 'Wysokie (Aktywne Wulkany)',
    loreDescription:
      'Monumentalna cytadela z czarnego bazaltu, w której kowale wykorzystują żar magmowych rzek do wytopu najczystszego Mithrilu w całym Kupieckim Świecie.',
    colorHex: '#F97316',
    linkedCityId: 'obsydianowa_cytadela',
    featuredCommodity: 'mithril',
  },
  {
    id: 'port_popiolow',
    name: 'Port Popiołów',
    subtitle: 'Południowa Przystań Magmowa · Szlak Kryształów',
    continentId: 'obsydian_wulkan',
    type: 'capital',
    typeLabel: 'Stolica Handlowa',
    biome: 'Obsydianowy Archipelag Magmy',
    position2D: [124, 174],
    atlasPercent: [66.5, 86.0],
    altitudeMeters: 40,
    dangerLabel: 'Wysokie (Popiół Wulkaniczny)',
    loreDescription:
      'Brama morska Archipelagu Obsydianowego, skąd szybkie galeony przewożą Kryształy Many oraz sztaby metalu na północne giełdy.',
    colorHex: '#EA580C',
    linkedCityId: 'port_popiolow',
    featuredCommodity: 'krysztaly_many',
  },
  {
    id: 'otchlan_magmy',
    name: 'Otchłań Tytana Magmy',
    subtitle: 'Wielka Kaldera Południa · Boss Wulkaniczny',
    continentId: 'obsydian_wulkan',
    type: 'fear_place',
    typeLabel: 'Legendarne Miejsce Strachu',
    biome: 'Obsydianowy Archipelag Magmy',
    position2D: [188, 168],
    atlasPercent: [80.0, 68.0],
    altitudeMeters: 2150,
    dangerLabel: 'Legendarny Boss: Poz. 5',
    loreDescription:
      'Najpotężniejszy czynny wulkan Archipelagu Obsydianowego. W jego kraterze spoczywa Kolos Magmowy strzegący legendarnej żyły Mithrilu.',
    colorHex: '#DC2626',
    linkedQuestId: 'quest_tytan_obsydian',
    featuredCommodity: 'mithril',
  },
  ...worksites.map((site):WorldRegionNode=>({
    id:site.id,name:site.name,subtitle:crafts[site.craft].name,continentId:'nowa_nadzieja',type:'workshop',
    typeLabel:'Warsztat kupiecki',biome:'Nadmorska Nizina',position2D:[site.x,site.z],
    atlasPercent:[(site.x-310)/6.2,(site.z+310)/6.2],altitudeMeters:Math.round(newHopeHeight(site.x,site.z)),
    dangerLabel:'Osada rzemieślnicza',loreDescription:site.description,colorHex:crafts[site.craft].color,
  })),
];

// --- DETERMINISTIC MULTI-OCTAVE FBM + RIDGE 4-CONTINENT HEIGHTMAP ---
// Shared pure math so 3D terrain, cities, palms, pines, icebergs, pagodas, roads & ships sit 100% flush!

function hash2D(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2D(x: number, z: number, octaves = 5): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise2D(x * freq, z * freq);
    maxAmp += amp;
    freq *= 2.04;
    amp *= 0.48;
  }
  return value / maxAmp;
}

function ridgeNoise2D(x: number, z: number, octaves = 4): number {
  let value = 0;
  let amp = 0.55;
  let freq = 1;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    const n = valueNoise2D(x * freq, z * freq) * 2 - 1;
    const ridge = 1 - Math.abs(n);
    value += amp * ridge * ridge;
    maxAmp += amp;
    freq *= 2.08;
    amp *= 0.46;
  }
  return value / maxAmp;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function gaussian(dx: number, dz: number, radius: number): number {
  const d2 = dx * dx + dz * dz;
  return Math.exp(-d2 / (2 * radius * radius));
}

// Two-by-two averages of decoded USGS elevations, ordered north to south.
// The survey supplies the local ridges. The coastline and city terraces belong to the game.
const reliefSize = 128;
const reliefSamples = Uint8Array.from(atob(sanJuanElevation), c => c.charCodeAt(0));
function mountainRelief(x: number, z: number): number {
  const u = Math.min(1, Math.max(0, (x + 85) / 176)) * (reliefSize - 1);
  const v = Math.min(1, Math.max(0, (-z + 3) / 102)) * (reliefSize - 1);
  const ix = Math.min(reliefSize - 2, Math.floor(u));
  const iz = Math.min(reliefSize - 2, Math.floor(v));
  const i = iz * reliefSize + ix;
  const tx = u - ix, tz = v - iz;
  const top = reliefSamples[i] + tx * (reliefSamples[i + 1] - reliefSamples[i]);
  const bottom = reliefSamples[i + reliefSize] + tx * (reliefSamples[i + reliefSize + 1] - reliefSamples[i + reliefSize]);
  return (top + tz * (bottom - top)) / 255;
}

export interface ContinentBiomeWeights {
  desert: number;   // Solaria dunes & red canyons
  glacier: number;  // Frostheim ice & arctic snow
  jade: number;     // Aetheris emerald karst highlands (also boosts Valoria lush moss)
  oasis: number;    // Lush palm oases inside Solaria desert & Valoria waterfalls
  volcanic: number; // Eastern Ignis volcanic caldera + Obsidian Archipelago
}

/**
 * Pure geographic biome classifier across all 6 Continents in 620x620 world space.
 */
export function getContinentBiomeWeights(x: number, z: number): ContinentBiomeWeights {
  // Solaria Desert Continent (South & Southwest)
  const desertDist = Math.hypot((x + 68) * 0.82, (z - 126) * 0.96);
  const desert = 1 - smoothstep(42, 86, desertDist);

  // Palm Oasis lush green ring right around Oaza Al-Kharim (-64, 118) + Valoria emerald valleys
  const oasisDist = Math.hypot(x + 64, z - 118);
  const valoriaDist = Math.hypot((x + 184) * 0.9, (z - 18) * 0.78);
  const valoriaLush = 1 - smoothstep(32, 68, valoriaDist);
  const oasis = Math.min(1, (1 - smoothstep(10, 24, oasisDist)) * desert + valoriaLush * 0.65);

  // Frostheim Glacial Continent (Far Northwest)
  const glacierDist = Math.hypot((x + 140) * 0.85, (z + 130) * 0.85);
  const glacier = 1 - smoothstep(46, 92, glacierDist);

  // Aetheris Jade Karst Continent (Far East) + Valoria highland greenery
  const jadeDist = Math.hypot((x - 168) * 0.92, (z - 12) * 0.65);
  const jade = Math.min(1, (1 - smoothstep(38, 76, jadeDist)) + valoriaLush * 0.45);

  // Volcanic Caldera on eastern flank of Stary Kontynent + Obsidian Archipelago (Far SE)
  const volcDist = Math.hypot(x - 75, z + 16);
  const obsidianDist = Math.hypot((x - 158) * 0.86, (z - 162) * 0.88);
  const volcanic = Math.max(
    1 - smoothstep(15, 42, volcDist),
    1 - smoothstep(38, 78, obsidianDist),
  );

  return { desert, glacier, jade, oasis, volcanic };
}

/**
 * Computes exact physical terrain elevation Y at world coordinate (x, z)
 * across the entire 620x620 Six-Continent Open World.
 * Ocean surface sits at Y = 0.
 */
export function newHopeHeight(x:number,z:number):number {
  const relief = fbm2D(x*.022,z*.022,3);
  const wx=x+15*Math.sin(z*.041)+8*Math.sin(x*.062+z*.018);
  const wz=z+13*Math.cos(x*.036)+8*Math.cos(z*.043);
  const ridge=(cx:number,cz:number,rx:number,rz:number)=>1-Math.hypot((wx-cx)/rx,(wz-cz)/rz);
  const land=Math.max(ridge(512,-126,167,113),ridge(632,84,180,151),ridge(782,-24,101,197));
  const shelf=smoothstep(-.13,.25,land);
  return -8+16*shelf+shelf*(Math.max(0,land)*relief*43 + 2.6*Math.sin(x*.14)*Math.cos(z*.11));
}
export function getTerrainHeight(x: number, z: number): number {
  if(x>310) return newHopeHeight(x,z);
  // Domain warping for natural fractal coastlines (zero circular islands!)
  const warpX = (fbm2D(x * 0.015 + 3.1, z * 0.015 + 1.7, 3) - 0.5) * 28;
  const warpZ = (fbm2D(x * 0.015 - 4.2, z * 0.015 + 5.3, 3) - 0.5) * 28;
  const wx = x + warpX;
  const wz = z + warpZ;

  // ==================== CONTINENT 1: STARY KONTYNENT (Center) ====================
  const heartlandMask =
    1.0 - smoothstep(54, 102, Math.hypot((wx + 2) * 0.9, (wz + 22) * 1.18));
  const centralBayCarve = gaussian(x - 4, z - 28, 22) * 1.38;

  const riverCenterX = -42 + Math.sin(z * 0.065) * 8 - z * 0.24;
  const distToRiver = Math.abs(x - riverCenterX);
  const riverMask =
    (1 - smoothstep(1.8, 6.8, distToRiver)) *
    smoothstep(-48, -28, z) *
    (1 - smoothstep(26, 42, z));

  // ==================== CONTINENT 2: SUŁTANAT SOLARII & ARCHIPELAG (South / SW) ====================
  const solariaMainMask =
    1.0 - smoothstep(42, 84, Math.hypot((wx + 72) * 0.82, (wz - 128) * 1.02));
  const zlotaMainIsland = gaussian(x - 14, z - 76, 17.0) * 1.24;
  const zlotaIsletEast = gaussian(x - 36, z - 84, 9.5) * 0.88;
  const zlotaIsletWest = gaussian(x + 12, z - 94, 9.0) * 0.84;
  const shipyardCape = gaussian(x - 48, z - 54, 12.5) * 1.02;

  // ==================== CONTINENT 3: FROSTHEIM GLACIAL CONTINENT (Far NW) ====================
  const frostheimMask =
    1.0 - smoothstep(44, 88, Math.hypot((wx + 144) * 0.84, (wz + 132) * 0.88));
  const fjordCarve = gaussian(x + 106, z + 106, 14) * 1.08;
  const iceStraitIsland = gaussian(x + 88, z + 94, 11.0) * 0.95;

  // ==================== CONTINENT 4: CESARSTWO AETHERIS (Far East) ====================
  const aetherisNorthMask =
    1.0 - smoothstep(32, 66, Math.hypot((wx - 174) * 0.95, (wz + 26) * 0.85));
  const aetherisSouthMask =
    1.0 - smoothstep(30, 62, Math.hypot((wx - 160) * 0.92, (wz - 58) * 0.88));
  const jadeBayCarve = gaussian(x - 138, z - 22, 13.5) * 0.92;
  const easternStraitCarve = (1.0 - smoothstep(4, 15, Math.abs(x - 115))) * 0.95;
  const arcticChannelCarve = (1.0 - smoothstep(8, 22, Math.abs(x + z + 152))) * 0.92;

  // ==================== CONTINENT 5: VALORIA EMERALD HIGHLANDS (Far West) ====================
  const valoriaMainMask =
    1.0 - smoothstep(34, 70, Math.hypot((wx + 186) * 0.92, (wz - 18) * 0.82));
  const valoriaWestStraitCarve = (1.0 - smoothstep(6, 18, Math.abs(x + 124))) * 0.92;

  // ==================== CONTINENT 6: OBSYDIAN VOLCANIC ARCHIPELAGO (Far SE) ====================
  const obsidianMainMask =
    1.0 - smoothstep(34, 72, Math.hypot((wx - 162) * 0.88, (wz - 160) * 0.92));
  const obsidianSouthIslet = gaussian(x - 124, z - 174, 18.0) * 1.12;
  const obsidianNorthStraitCarve = (1.0 - smoothstep(6, 18, Math.abs(z - 108))) * 0.95;

  // Combine all 6 continental landmasses (deep sapphire ocean channels between EVERY continent!)
  const landSignal =
    Math.max(
      heartlandMask - centralBayCarve - easternStraitCarve - arcticChannelCarve - valoriaWestStraitCarve,
      solariaMainMask,
      frostheimMask - fjordCarve - arcticChannelCarve,
      Math.max(aetherisNorthMask, aetherisSouthMask) - jadeBayCarve - easternStraitCarve - obsidianNorthStraitCarve,
      valoriaMainMask - valoriaWestStraitCarve,
      obsidianMainMask - obsidianNorthStraitCarve,
    ) +
    zlotaMainIsland +
    zlotaIsletEast +
    zlotaIsletWest +
    shipyardCape +
    iceStraitIsland +
    obsidianSouthIslet;

  // Base terrain elevation (below 0 = ocean seabed, above 0 = beaches & land)
  let h = (landSignal - 0.34) * 11.8;

  // Organic multi-octave rolling terrain hills on land
  const hills = (fbm2D(x * 0.03, z * 0.03, 5) - 0.38) * 9.2;
  if (h > -1.0) {
    const landWeight = smoothstep(-1.0, 2.6, h);
    h += hills * landWeight;
  }

  // --- STARY KONTYNENT SPECIAL RELIEF ---
  const alpineEnvelope =
    gaussian((x + 6) * 0.65, z + 60, 26) +
    gaussian(x - 28, z + 54, 18) * 0.75 +
    gaussian(x + 42, z + 52, 18) * 0.7;
  const relief = mountainRelief(x, z);
  h += alpineEnvelope * (4.8 + relief * 32);


  const distToVolcano = Math.hypot(x - 82, z + 20);
  const volcanoCone = Math.max(0, 1 - distToVolcano / 34);
  const volcanoRidges = ridgeNoise2D(x * 0.055 + 7.1, z * 0.055 + 3.4, 4);
  let volcanoHeight = Math.pow(volcanoCone, 1.45) * (25.0 + volcanoRidges * 10.0);
  if (distToVolcano < 7.5) {
    const craterBowl = 1 - smoothstep(1.8, 7.5, distToVolcano);
    volcanoHeight -= craterBowl * 8.2;
  }
  h += volcanoHeight;

  h += gaussian(x + 84, z + 4, 18) * ridgeNoise2D(x * 0.04, z * 0.04, 3) * 13.0;

  // --- SOLARIA SPECIAL RELIEF ---
  if (solariaMainMask > 0.15) {
    const duneWaves =
      (Math.sin(x * 0.14 + z * 0.09 + fbm2D(x * 0.04, z * 0.04, 2) * 3.0) * 0.5 + 0.5) * 3.4;
    h += duneWaves * smoothstep(0.25, 0.7, solariaMainMask);

    const mesaEnv = gaussian(x + 114, z - 126, 26);
    const rawMesa = fbm2D(x * 0.045 + 11.2, z * 0.045 - 3.3, 4);
    const terracedMesa = Math.floor(rawMesa * 5.0) / 5.0 + (rawMesa * 5.0 - Math.floor(rawMesa * 5.0)) * 0.25;
    h += mesaEnv * (5.0 + terracedMesa * 16.5);
  }

  // --- FROSTHEIM SPECIAL RELIEF ---
  if (frostheimMask > 0.15) {
    const glacialRidges = ridgeNoise2D(x * 0.042 - 5.1, z * 0.042 + 2.8, 4);
    const deepGlacierEnv = gaussian(x + 158, z + 146, 36);
    h += deepGlacierEnv * (7.5 + glacialRidges * 28.0);
  }

  // --- AETHERIS SPECIAL RELIEF ---
  if (aetherisNorthMask > 0.15 || aetherisSouthMask > 0.15) {
    const karstEnv = gaussian(x - 180, z + 30, 32) + gaussian(x - 168, z - 54, 26) * 0.85;
    const karstPillars = Math.pow(ridgeNoise2D(x * 0.062 + 4.4, z * 0.062 - 6.2, 4), 1.65);
    h += karstEnv * (5.5 + karstPillars * 32.0);
  }

  // --- VALORIA SPECIAL RELIEF (Stepped Emerald Cliffs & Wyvern Peaks) ---
  if (valoriaMainMask > 0.15) {
    const valoriaPeakEnv = gaussian(x + 202, z + 18, 28) + gaussian(x + 178, z - 28, 22) * 0.65;
    const valoriaRidges = ridgeNoise2D(x * 0.046 + 8.3, z * 0.046 - 4.1, 4);
    h += valoriaPeakEnv * (6.2 + valoriaRidges * 22.0);
  }

  // --- OBSYDIAN ARCHIPELAGO SPECIAL RELIEF (Twin Magma Calderas) ---
  const distToObsidianCaldera = Math.hypot(x - 188, z - 168);
  const obsCone = Math.max(0, 1 - distToObsidianCaldera / 36);
  let obsHeight = Math.pow(obsCone, 1.4) * (27.0 + ridgeNoise2D(x * 0.052 - 3.2, z * 0.052 + 6.4, 4) * 11.0);
  if (distToObsidianCaldera < 8.5) {
    obsHeight -= (1 - smoothstep(2.0, 8.5, distToObsidianCaldera)) * 9.5;
  }
  h += obsHeight;

  // Carve western river channel smoothly below water level
  h -= riverMask * 3.8;

  // Smooth Architectural City & Landmark Plateaus across ALL 6 Continents
  const plateaus: Array<{ x: number; z: number; targetY: number; innerR: number; outerR: number }> = [
    // Stary Kontynent
    { x: 4, z: 2, targetY: 2.2, innerR: 9.5, outerR: 17.5 },
    { x: -56, z: -4, targetY: 3.6, innerR: 8.5, outerR: 16.5 },
    { x: -6, z: -56, targetY: 11.8, innerR: 9.0, outerR: 18.0 },
    { x: 64, z: -8, targetY: 8.6, innerR: 8.5, outerR: 16.5 },
    { x: -28, z: 6, targetY: 2.8, innerR: 4.5, outerR: 10.0 },
    { x: 28, z: -36, targetY: 7.4, innerR: 5.5, outerR: 12.0 },
    // Solaria & Archipelago
    { x: 14, z: 76, targetY: 2.0, innerR: 9.0, outerR: 16.5 },
    { x: -64, z: 118, targetY: 2.6, innerR: 10.5, outerR: 19.0 },
    { x: -114, z: 128, targetY: 8.2, innerR: 7.0, outerR: 14.5 },
    { x: 48, z: 54, targetY: 2.1, innerR: 5.5, outerR: 11.5 },
    // Frostheim
    { x: -128, z: -118, targetY: 3.0, innerR: 9.5, outerR: 17.5 },
    { x: -162, z: -148, targetY: 14.2, innerR: 7.5, outerR: 15.0 },
    { x: -88, z: -94, targetY: 2.1, innerR: 5.5, outerR: 11.5 },
    // Aetheris
    { x: 158, z: 18, targetY: 2.4, innerR: 9.5, outerR: 17.5 },
    { x: 180, z: -34, targetY: 13.5, innerR: 6.5, outerR: 14.0 },
    { x: 150, z: 74, targetY: 2.8, innerR: 6.5, outerR: 13.0 },
    // Valoria (Continent 5)
    { x: -168, z: 8, targetY: 4.2, innerR: 9.5, outerR: 17.5 },
    { x: -192, z: 46, targetY: 2.5, innerR: 9.5, outerR: 17.5 },
    { x: -202, z: -18, targetY: 12.4, innerR: 6.5, outerR: 14.0 },
    // Obsydian Archipelago (Continent 6)
    { x: 156, z: 148, targetY: 6.4, innerR: 9.5, outerR: 17.5 },
    { x: 124, z: 174, targetY: 2.2, innerR: 9.0, outerR: 16.5 },
    { x: 188, z: 168, targetY: 14.0, innerR: 6.5, outerR: 13.5 },
  ];

  for (const p of plateaus) {
    const dist = Math.hypot(x - p.x, z - p.z);
    if (dist < p.outerR) {
      const blend = 1 - smoothstep(p.innerR, p.outerR, dist);
      h = h * (1 - blend) + p.targetY * blend;
    }
  }

  return Number(h.toFixed(3));
}

export function getCityElevation(cityId: string): number {
  const city = CITIES.find((c) => c.id === cityId);
  if (!city) return 2.0;
  return getTerrainHeight(city.position3D[0], city.position3D[2]);
}

export function isVolcanicZone(x: number, z: number): number {
  const d1 = Math.hypot(x - 74, z + 15);
  const d2 = Math.hypot(x - 178, z - 164);
  return Math.max(1 - smoothstep(14, 42, d1), 1 - smoothstep(18, 48, d2));
}
