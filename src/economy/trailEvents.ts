import { CommodityId, ContinentId, SeasonId } from './economyEngine';
import { LightingMoodId } from '../world3d/terrainAndShaders';
import { PbrWeatherId } from '../world3d/pbrWeather';

export type TrailEventCategory =
  | 'caravan_meeting'
  | 'monster_blockade'
  | 'mysterious_merchant'
  | 'weather_hazard'
  | 'lost_relic';

export interface TrailEventChoice {
  id: string;
  label: string;
  subtitle: string;
  kind: 'interact' | 'tactical' | 'bypass';
  costGold?: number;
  requiredMinStrength?: number;
  rewardHint: string;
}

export interface ActiveTrailEvent {
  id: string;
  templateId: string;
  title: string;
  category: TrailEventCategory;
  categoryLabel: string;
  continentId: ContinentId;
  regionName: string;
  /** World 3D coordinates (x, z) placed right along active trade roads/passes */
  position2D: [number, number];
  /** 2D Atlas percentage [left%, top%] matching cinematic_four_continents_atlas */
  atlasPercent: [number, number];
  preferredTimes: LightingMoodId[];
  preferredWeathers?: PbrWeatherId[];
  spawnedAtTime: LightingMoodId;
  spawnedAtWeather: PbrWeatherId;
  severity: 'opportunity' | 'danger' | 'mystery';
  colorHex: string;
  loreText: string;
  commodityId: CommodityId;
  baseGoldReward: number;
  baseCommodityQty: number;
  basePrestigeReward: number;
  monsterPower: number;
  choices: TrailEventChoice[];
}

export interface TrailEventOutcome {
  eventId: string;
  choiceId: string;
  success: boolean;
  bypassed: boolean;
  headline: string;
  narrative: string;
  goldDelta: number;
  prestigeDelta: number;
  knightHpDelta: number;
  monstersDefeatedDelta: number;
  commodityDelta?: { id: CommodityId; qty: number };
}

interface TrailEventTemplate {
  templateId: string;
  title: string;
  category: TrailEventCategory;
  categoryLabel: string;
  continentId: ContinentId;
  regionName: string;
  position2D: [number, number];
  atlasPercent: [number, number];
  preferredTimes: LightingMoodId[];
  preferredWeathers?: PbrWeatherId[];
  severity: 'opportunity' | 'danger' | 'mystery';
  colorHex: string;
  loreText: string;
  commodityId: CommodityId;
  baseGoldReward: number;
  baseCommodityQty: number;
  basePrestigeReward: number;
  monsterPower: number;
  choices: TrailEventChoice[];
}

export const TRAIL_EVENT_TEMPLATES: TrailEventTemplate[] = [
  {
    templateId:'evt_latarniczka',title:'Zgaszona lampa Dobrochny',category:'mysterious_merchant',
    categoryLabel:'Latarniczka',continentId:'nowa_nadzieja',regionName:'Kanał Wron',
    position2D:[530,133],atlasPercent:[35.5,71.5],preferredTimes:['night','golden_hour'],
    severity:'mystery',colorHex:'#e5ba7a',loreText:'Dobrochna osłania knot od bryzgu. Przez mgłę słychać wiosła barki. Przytrzymasz lampę czy popłyniesz po nową linę?',
    commodityId:'drewno_elfickie',baseGoldReward:80,baseCommodityQty:2,basePrestigeReward:12,monsterPower:0,
    choices:[{id:'light_the_lamp',kind:'tactical',label:'Przytrzymaj lampę',subtitle:'Barka trafi do przystani.',rewardHint:'80 zł od sternika'},
      {id:'bring_line',kind:'interact',costGold:30,label:'Opłać łódź po linę',subtitle:'Cieśla odda dwie deski.',rewardHint:'2 szt. drewna'},
      {id:'bypass',kind:'bypass',label:'Idź dalej',subtitle:'Dobrochna zaczeka na inną łódź.',rewardHint:'Wolne przejście'}],
  },
  {
    templateId:'evt_liczman',title:'Rachmistrz zgubił liczman',category:'caravan_meeting',
    categoryLabel:'Rachmistrz',continentId:'nowa_nadzieja',regionName:'Trakt Solny',
    position2D:[766,66],atlasPercent:[73.55,60.65],preferredTimes:['midday','golden_hour'],
    severity:'opportunity',colorHex:'#a0ccb9',loreText:'Iwo wysypuje na blat zawartość sakwy. Brakuje ostatniego liczmana i nie może zamknąć rachunku za przewóz soli.',
    commodityId:'runiczny_pergamin',baseGoldReward:75,baseCommodityQty:1,basePrestigeReward:15,monsterPower:0,
    choices:[{id:'check_tally',kind:'tactical',label:'Porównaj kwity przewoźników',subtitle:'Iwo zapłaci za odtworzenie rachunku.',rewardHint:'75 zł'},
      {id:'copy_tally',kind:'interact',costGold:20,label:'Zamów odpis rejestru',subtitle:'Pisarz odstąpi ci arkusz.',rewardHint:'1 pergamin'},
      {id:'bypass',kind:'bypass',label:'Odejdź od stołu',subtitle:'Droga jest wolna.',rewardHint:'Wolne przejście'}],
  },
  {
    templateId: 'evt_karawana_przystan',
    title: 'Spotkanie z Królewską Karawaną Kupiecką',
    category: 'caravan_meeting',
    categoryLabel: 'Spotkanie z Karawaną',
    continentId: 'stary_kontynent',
    regionName: 'Trakt Królewska Przystań — Srebrny Gaj',
    position2D: [-30, 12],
    atlasPercent: [39.0, 56.5],
    preferredTimes: ['golden_hour', 'midday'],
    severity: 'opportunity',
    colorHex: '#F59E0B',
    loreText:
      'Na trakcie między Królewską Przystanią a Srebrnym Gajem spotykasz uginającą się od towarów karawanę Hanzy. Mistrz wozu oferuje hurtową sprzedaż po obniżonej cenie przed zmrokiem.',
    commodityId: 'drewno_elfickie',
    baseGoldReward: 680,
    baseCommodityQty: 8,
    basePrestigeReward: 35,
    monsterPower: 0,
    choices: [
      {
        id: 'trade_caravan',
        label: 'Kup okazyjny ładunek od Karawany (450 zł)',
        subtitle: 'Zyskaj +8x Drewno Elfickie oraz +35 Prestiżu kupieckiego',
        kind: 'interact',
        costGold: 450,
        rewardHint: '+8x Drewno Elfickie · +35 Prestiżu',
      },
      {
        id: 'escort_share',
        label: 'Wymień informacje o cenach i dołącz do konwoju',
        subtitle: 'Darmowa premia informacyjna i prowizja od mistrzów szlaku',
        kind: 'tactical',
        rewardHint: '+680 zł · +20 Prestiżu',
      },
      {
        id: 'bypass',
        label: 'Omiń karawanę i jedź dalej własnym szlakiem',
        subtitle: 'Brak kosztów — bezpieczne ominięcie spotkania',
        kind: 'bypass',
        rewardHint: 'Bezpieczne ominięcie (0 zł)',
      },
    ],
  },
  {
    templateId: 'evt_blokada_most_potwory',
    title: 'Blokada Traktu przez Potwory i Orki',
    category: 'monster_blockade',
    categoryLabel: 'Blokada Potworów',
    continentId: 'stary_kontynent',
    regionName: 'Przełęcz ku Żelaznej Kuźni',
    position2D: [0, -28],
    atlasPercent: [47.5, 45.0],
    preferredTimes: ['dusk', 'night', 'golden_hour'],
    severity: 'danger',
    colorHex: '#EF4444',
    loreText:
      'Uzbrojona banda górskich trolli i zdziczałych orków zatarasowała kamienny trakt prowadzący do Żelaznej Kuźni. Karawany stoją w miejscu, a z mroku słychać ryk bestii!',
    commodityId: 'mithril',
    baseGoldReward: 1350,
    baseCommodityQty: 3,
    basePrestigeReward: 75,
    monsterPower: 26,
    choices: [
      {
        id: 'fight_blockade',
        label: 'Rozbij blokadę szarżą Rycerza',
        subtitle: 'Walka z bestiami o łup z wozów (zalecana Siła Rycerza ≥ 18)',
        kind: 'interact',
        requiredMinStrength: 18,
        rewardHint: '+1350 zł · +3x Mithril · +75 Prestiżu',
      },
      {
        id: 'pay_mercenaries',
        label: 'Wynajmij strażników z pobliskiej warowni (550 zł)',
        subtitle: 'Oczyść trakt bez ryzyka ran dla Rycerza i przejmij część łupu',
        kind: 'tactical',
        costGold: 550,
        rewardHint: '+2x Mithril · +45 Prestiżu (0 obr.)',
      },
      {
        id: 'bypass',
        label: 'Omiń blokadę wąskim górskim objazdem (180 zł)',
        subtitle: 'Dłuższa droga okrężna bez walki — opłata za przewodnika',
        kind: 'bypass',
        costGold: 180,
        rewardHint: 'Bezpieczne ominięcie (-180 zł)',
      },
    ],
  },
  {
    templateId: 'evt_nocna_wataha',
    title: 'Nocna Zasadzka Watahy Cieni',
    category: 'monster_blockade',
    categoryLabel: 'Nocna Blokada',
    continentId: 'stary_kontynent',
    regionName: 'Wschodni Trakt do Krwawego Szczytu',
    position2D: [36, -6],
    atlasPercent: [55.0, 56.0],
    preferredTimes: ['night', 'dusk'],
    preferredWeathers: ['fog', 'storm', 'rain'],
    severity: 'danger',
    colorHex: '#DC2626',
    loreText:
      'Po zapadnięciu zmroku na wulkanicznym trakcie pojawiła się wataha ognistych wilków i maruderów cienia. Oczy bestii płoną w ciemności, blokując przejazd ku Krwawemu Szczytowi.',
    commodityId: 'smocza_luska',
    baseGoldReward: 1550,
    baseCommodityQty: 2,
    basePrestigeReward: 90,
    monsterPower: 30,
    choices: [
      {
        id: 'fight_blockade',
        label: 'Staw czoła Watasze Cieni z Rycerzem',
        subtitle: 'Zdobądź rzadkie Smocze Łuski i chwałę pogromcy mroku',
        kind: 'interact',
        requiredMinStrength: 20,
        rewardHint: '+1550 zł · +2x Smocza Łuska · +90 Prestiżu',
      },
      {
        id: 'torch_formation',
        label: 'Rozpal runiczne pochodnie i odstrasz bestie (400 zł)',
        subtitle: 'Bezpieczne przejście przez nocną zasadzkę i zebranie porzuconych kryształów',
        kind: 'tactical',
        costGold: 400,
        rewardHint: '+1x Smocza Łuska · +40 Prestiżu',
      },
      {
        id: 'bypass',
        label: 'Omiń zasadzkę i przeczekaj w bezpiecznej stanicy (150 zł)',
        subtitle: 'Ominięcie nocnego zagrożenia kosztem postoju',
        kind: 'bypass',
        costGold: 150,
        rewardHint: 'Bezpieczne ominięcie (-150 zł)',
      },
    ],
  },
  {
    templateId: 'evt_solaria_karawana_przypraw',
    title: 'Karawana Przypraw Sułtanatu Solarii',
    category: 'caravan_meeting',
    categoryLabel: 'Karawana Solarii',
    continentId: 'solaria_poludnie',
    regionName: 'Złote Wydmy przed Oazą Al-Kharim',
    position2D: [-38, 102],
    atlasPercent: [31.5, 76.0],
    preferredTimes: ['golden_hour', 'midday'],
    preferredWeathers: ['clear', 'sandstorm'],
    severity: 'opportunity',
    colorHex: '#F59E0B',
    loreText:
      'Długi sznur wielbłądów obładowanych szafranem i mirrą zatrzymuje się przy studni na przedpolu Oazy Al-Kharim. Przewodnik szuka partnera do szybkiej wymiany handlowej.',
    commodityId: 'przyprawy',
    baseGoldReward: 920,
    baseCommodityQty: 10,
    basePrestigeReward: 50,
    monsterPower: 0,
    choices: [
      {
        id: 'trade_caravan',
        label: 'Wykup skrzynie rzadkich przypraw (600 zł)',
        subtitle: 'Pustynna okazja handlowa o wysokiej marży na Starym Kontynencie',
        kind: 'interact',
        costGold: 600,
        rewardHint: '+10x Przyprawy · +50 Prestiżu',
      },
      {
        id: 'share_water',
        label: 'Podziel się mapą bezpiecznych studni',
        subtitle: 'Karawana odwdzięcza się złotem i rekomendacją u Sułtana',
        kind: 'tactical',
        rewardHint: '+920 zł · +30 Prestiżu',
      },
      {
        id: 'bypass',
        label: 'Omiń postój i ruszaj prosto do portu',
        subtitle: 'Zostaw karawanę na wydmach bez zwłoki',
        kind: 'bypass',
        rewardHint: 'Bezpieczne ominięcie (0 zł)',
      },
    ],
  },
  {
    templateId: 'evt_solaria_skorpiony',
    title: 'Blokada Kanionu przez Piaskowe Skorpiony',
    category: 'monster_blockade',
    categoryLabel: 'Blokada Pustynna',
    continentId: 'solaria_poludnie',
    regionName: 'Czerwony Kanion pod Piramidami Słońca',
    position2D: [-96, 128],
    atlasPercent: [18.0, 82.0],
    preferredTimes: ['dusk', 'night', 'golden_hour'],
    preferredWeathers: ['sandstorm', 'clear'],
    severity: 'danger',
    colorHex: '#EA580C',
    loreText:
      'Olbrzymie pancerne skorpiony wynurzyły się z gorących piasków kanionu, odcinając szlak karawanowy między Oazą Al-Kharim a Piramidami Słońca!',
    commodityId: 'przyprawy',
    baseGoldReward: 1400,
    baseCommodityQty: 8,
    basePrestigeReward: 70,
    monsterPower: 24,
    choices: [
      {
        id: 'fight_blockade',
        label: 'Oczyść kanion ostrzem Rycerza',
        subtitle: 'Rozbij gniazdo potworów i przejmij porzucony ładunek przypraw',
        kind: 'interact',
        requiredMinStrength: 18,
        rewardHint: '+1400 zł · +8x Przyprawy · +70 Prestiżu',
      },
      {
        id: 'hire_nomads',
        label: 'Opłać pustynnych tropicieli (500 zł)',
        subtitle: 'Nomadzi odciągną bestie i wydobędą skrzynie bez strat',
        kind: 'tactical',
        costGold: 500,
        rewardHint: '+5x Przyprawy · +45 Prestiżu',
      },
      {
        id: 'bypass',
        label: 'Omiń kanion górnym grzbietem wydm (200 zł)',
        subtitle: 'Bezpieczne ominięcie gniazda potworów',
        kind: 'bypass',
        costGold: 200,
        rewardHint: 'Bezpieczne ominięcie (-200 zł)',
      },
    ],
  },
  {
    templateId: 'evt_frostheim_golem',
    title: 'Lodowy Strażnik Blokuje Fiord Frostgardu',
    category: 'monster_blockade',
    categoryLabel: 'Blokada Lodowa',
    continentId: 'frostheim_polnoc',
    regionName: 'Lodowa Przełęcz Frostheimu',
    position2D: [-144, -132],
    atlasPercent: [18.5, 29.0],
    preferredTimes: ['night', 'dusk', 'midday'],
    preferredWeathers: ['blizzard', 'fog', 'storm'],
    severity: 'danger',
    colorHex: '#38BDF8',
    loreText:
      'Pradawny Lodowy Golem zstąpił z lodowca podczas śnieżycy i zamroził główny szlak sań kupieckich wiodący do Frostgardu.',
    commodityId: 'krysztaly_many',
    baseGoldReward: 1680,
    baseCommodityQty: 6,
    basePrestigeReward: 85,
    monsterPower: 32,
    choices: [
      {
        id: 'fight_blockade',
        label: 'Skrucz Lodowego Golema w starciu Rycerza',
        subtitle: 'Zdobądź czyste Kryształy Many z rdzenia potwora',
        kind: 'interact',
        requiredMinStrength: 22,
        rewardHint: '+1680 zł · +6x Kryształy Many · +85 Prestiżu',
      },
      {
        id: 'melt_passage',
        label: 'Użyj alchemicznych ogni do roztopienia lodu (650 zł)',
        subtitle: 'Otwórz fiord bez walki i zbierz odłamki kryształów',
        kind: 'tactical',
        costGold: 650,
        rewardHint: '+4x Kryształy Many · +50 Prestiżu',
      },
      {
        id: 'bypass',
        label: 'Omiń przełęcz szlakiem przybrzeżnym (220 zł)',
        subtitle: 'Ostrożne ominięcie golema z pomocą pilotów lodołamacza',
        kind: 'bypass',
        costGold: 220,
        rewardHint: 'Bezpieczne ominięcie (-220 zł)',
      },
    ],
  },
  {
    templateId: 'evt_aetheris_korsarze',
    title: 'Blokada Szmaragdowej Cieśniny przez Korsarzy',
    category: 'monster_blockade',
    categoryLabel: 'Blokada Korsarzy',
    continentId: 'aetheris_wschod',
    regionName: 'Wodny Trakt przed Jadeitową Przystanią',
    position2D: [148, 42],
    atlasPercent: [82.0, 62.0],
    preferredTimes: ['dusk', 'night', 'golden_hour'],
    preferredWeathers: ['fog', 'storm', 'clear'],
    severity: 'danger',
    colorHex: '#EC4899',
    loreText:
      'Dwie szybkie dżonki korsarzy z Czarnej Zatoki rozciągnęły łańcuch portowy w mglistej cieśninie, żądając haraczu od statków płynących z Jadeitowej Przystani.',
    commodityId: 'runiczny_pergamin',
    baseGoldReward: 1520,
    baseCommodityQty: 5,
    basePrestigeReward: 80,
    monsterPower: 28,
    choices: [
      {
        id: 'fight_blockade',
        label: 'Dokonaj abordażu z Rycerzem i Gwardią',
        subtitle: 'Przejmij zrabowane zwoje runiczne i skrzynię korsarzy',
        kind: 'interact',
        requiredMinStrength: 20,
        rewardHint: '+1520 zł · +5x Runiczny Pergamin · +80 Prestiżu',
      },
      {
        id: 'bribe_corsairs',
        label: 'Wykup bezpieczny glejt i zwoje z kontrabandy (580 zł)',
        subtitle: 'Uniknij bitwy morskiej i zdobądź rzadkie pergaminy',
        kind: 'tactical',
        costGold: 580,
        rewardHint: '+4x Runiczny Pergamin · +35 Prestiżu',
      },
      {
        id: 'bypass',
        label: 'Omiń blokadę kursem przez zewnętrzną rafę (210 zł)',
        subtitle: 'Bezpieczne ominięcie łańcucha korsarzy',
        kind: 'bypass',
        costGold: 210,
        rewardHint: 'Bezpieczne ominięcie (-210 zł)',
      },
    ],
  },
  {
    templateId: 'evt_widmowy_kupiec',
    title: 'Widmowy Kupiec Nocnego Targu',
    category: 'mysterious_merchant',
    categoryLabel: 'Nocny Kupiec',
    continentId: 'stary_kontynent',
    regionName: 'Rozdroża przy Kręgu Runicznym',
    position2D: [24, -36],
    atlasPercent: [53.0, 46.5],
    preferredTimes: ['night', 'dusk'],
    severity: 'mystery',
    colorHex: '#A855F7',
    loreText:
      'Pod rozgwieżdżonym niebem pojawia się wóz oświetlony błękitnymi latarniami. Zakapturzony kupiec oferuje zaklęte kryształy i pergaminy, których nie ma na żadnej dziennej giełdzie.',
    commodityId: 'krysztaly_many',
    baseGoldReward: 1100,
    baseCommodityQty: 6,
    basePrestigeReward: 65,
    monsterPower: 0,
    choices: [
      {
        id: 'trade_caravan',
        label: 'Zawrzyj tajemny kontrakt nocny (700 zł)',
        subtitle: 'Otrzymaj rzadkie Kryształy Many znacznie poniżej kursu giełdowego',
        kind: 'interact',
        costGold: 700,
        rewardHint: '+6x Kryształy Many · +65 Prestiżu',
      },
      {
        id: 'decipher_rune',
        label: 'Odczytaj pieczęć z ksiąg gildii',
        subtitle: 'Kupiec nagradza Twoją wiedzę złotem i szacunkiem',
        kind: 'tactical',
        rewardHint: '+1100 zł · +45 Prestiżu',
      },
      {
        id: 'bypass',
        label: 'Omiń tajemniczy wóz i nie ryzykuj klątwy',
        subtitle: 'Bezpieczne ominięcie spotkania nocnego',
        kind: 'bypass',
        rewardHint: 'Bezpieczne ominięcie (0 zł)',
      },
    ],
  },
  {
    templateId: 'evt_osuwisko_deszcz',
    title: 'Zalany Trakt i Osuwisko Po Ulewie',
    category: 'weather_hazard',
    categoryLabel: 'Zjawisko Pogodowe',
    continentId: 'stary_kontynent',
    regionName: 'Dolina Rzeki pod Srebrnym Gajem',
    position2D: [-34, 10],
    atlasPercent: [35.5, 58.0],
    preferredTimes: ['midday', 'golden_hour', 'dusk'],
    preferredWeathers: ['rain', 'storm', 'fog'],
    severity: 'mystery',
    colorHex: '#0EA5E9',
    loreText:
      'Ulewny deszcz rozmył brzeg rzeki i odsłonił zatopioną skrzynię kupiecką pod powalonym dębem, lecz rwący nurt zagraża wozom!',
    commodityId: 'zelazo',
    baseGoldReward: 960,
    baseCommodityQty: 14,
    basePrestigeReward: 45,
    monsterPower: 0,
    choices: [
      {
        id: 'salvage_cargo',
        label: 'Wyślij ludzi po zatopiony ładunek i udrożnij trakt (260 zł)',
        subtitle: 'Odzyskaj sztaby żelaza i zdobądź wdzięczność okolicznych kupców',
        kind: 'interact',
        costGold: 260,
        rewardHint: '+14x Ruda Żelaza · +45 Prestiżu',
      },
      {
        id: 'build_plank_bridge',
        label: 'Pobierz opłatę za prowizoryczny mostek z bali',
        subtitle: 'Szybki zysk z przeprawy uwięzionych wozów',
        kind: 'tactical',
        rewardHint: '+960 zł · +25 Prestiżu',
      },
      {
        id: 'bypass',
        label: 'Omiń rozlewisko wyższą drogą leśną',
        subtitle: 'Bezpieczny objazd bez moknięcia',
        kind: 'bypass',
        rewardHint: 'Bezpieczne ominięcie (0 zł)',
      },
    ],
  },
  {
    templateId: 'evt_aetheris_barka',
    title: 'Cesarska Barka Handlowa z Aetheris',
    category: 'caravan_meeting',
    categoryLabel: 'Spotkanie z Konwojem',
    continentId: 'aetheris_wschod',
    regionName: 'Szlak do Świątyni Tysiąca Smoków',
    position2D: [168, -10],
    atlasPercent: [84.0, 44.0],
    preferredTimes: ['golden_hour', 'midday'],
    severity: 'opportunity',
    colorHex: '#10B981',
    loreText:
      'Na tle szmaragdowych iglic Aetheris napotykasz cesarski konwój wiozący pergaminy i złoto do stolicy. Mandaryn zaprasza Cię do wymiany darów.',
    commodityId: 'runiczny_pergamin',
    baseGoldReward: 1050,
    baseCommodityQty: 5,
    basePrestigeReward: 60,
    monsterPower: 0,
    choices: [
      {
        id: 'trade_caravan',
        label: 'Wykup cesarskie zwoje runiczne (520 zł)',
        subtitle: 'Zapas cennych pergaminów do Wieży Magów lub na giełdę',
        kind: 'interact',
        costGold: 520,
        rewardHint: '+5x Runiczny Pergamin · +60 Prestiżu',
      },
      {
        id: 'diplomatic_gift',
        label: 'Podpisz list polecający Hanzy',
        subtitle: 'Mandaryn wypłaca premię za otwarcie szlaku morskiego',
        kind: 'tactical',
        rewardHint: '+1050 zł · +40 Prestiżu',
      },
      {
        id: 'bypass',
        label: 'Omiń konwój z należytym ukłonem',
        subtitle: 'Bezpieczne ominięcie spotkania',
        kind: 'bypass',
        rewardHint: 'Bezpieczne ominięcie (0 zł)',
      },
    ],
  },
];

/**
 * Deterministically generates 4 active Trail Events across the 4 Continents
 * weighted dynamically by Time of Day (lightingMood), active PBR Weather, and Season!
 */
export function generateTrailEventsForWorld(params: {
  lightingMood: LightingMoodId;
  pbrWeather: PbrWeatherId;
  season: SeasonId;
  seed?: number;
  count?: number;
}): ActiveTrailEvent[] {
  const { lightingMood, pbrWeather, seed = 1, count = 4 } = params;

  const scored = TRAIL_EVENT_TEMPLATES.map((tpl, idx) => {
    let weight = 10;
    if (tpl.preferredTimes.includes(lightingMood)) {
      weight += 35;
    }
    if (tpl.preferredWeathers && tpl.preferredWeathers.includes(pbrWeather)) {
      weight += 28;
    }
    // Night & Dusk heavily prioritize monster blockades and mysterious merchants
    if ((lightingMood === 'night' || lightingMood === 'dusk') && tpl.category === 'monster_blockade') {
      weight += 20;
    }
    // Day & Golden Hour favor caravans and trade encounters
    if ((lightingMood === 'midday' || lightingMood === 'golden_hour') && tpl.category === 'caravan_meeting') {
      weight += 18;
    }
    // Deterministic tie-breaker varied by seed so refreshing spawns fresh events
    const pseudoRand = Math.abs(Math.sin((seed + 1) * 19.37 + idx * 7.13)) * 22;
    return { tpl, score: weight + pseudoRand };
  });

  scored.sort((a, b) => b.score - a.score);

  // Pick diverse continents first so multiple regions have active events on the map!
  const chosen: TrailEventTemplate[] = [];
  const usedContinents = new Set<ContinentId>();

  for (const item of scored) {
    if (chosen.length >= count) break;
    if (!usedContinents.has(item.tpl.continentId) || chosen.length >= 3) {
      chosen.push(item.tpl);
      usedContinents.add(item.tpl.continentId);
    }
  }
  for (const item of scored) {
    if (chosen.length >= count) break;
    if (!chosen.some((c) => c.templateId === item.tpl.templateId)) {
      chosen.push(item.tpl);
    }
  }

  return chosen.map((tpl, idx) => ({
    ...tpl,
    id: `${tpl.templateId}_${seed}_${idx}`,
    spawnedAtTime: lightingMood,
    spawnedAtWeather: pbrWeather,
  }));
}

/**
 * Pure resolution engine for any player choice on a Trail Event (Interact, Tactical, or Bypass).
 */
export function resolveTrailEventChoice(
  event: ActiveTrailEvent,
  choiceId: string,
  ctx: {
    playerGold: number;
    knightStrength: number;
    knightDefense: number;
  },
): TrailEventOutcome {
  const choice = event.choices.find((c) => c.id === choiceId) ?? event.choices[event.choices.length - 1];

  if (choice.kind === 'bypass') {
    const toll = Math.min(ctx.playerGold, choice.costGold ?? 0);
    return {
      eventId: event.id,
      choiceId: choice.id,
      success: true,
      bypassed: true,
      headline: `Ominięto Zdarzenie: ${event.title}`,
      narrative:
        toll > 0
          ? `Twoja drużyna skorzystała z bezpiecznego objazdu w regionie ${event.regionName} (koszt przewodnika: -${toll} zł). Szlak znów jest wolny.`
          : `Ominąłeś spotkanie w regionie ${event.regionName} bez strat i ruszyłeś w dalszą drogę.`,
      goldDelta: -toll,
      prestigeDelta: 5,
      knightHpDelta: 0,
      monstersDefeatedDelta: 0,
    };
  }

  const requiredGold = choice.costGold ?? 0;
  if (requiredGold > 0 && ctx.playerGold < requiredGold) {
    return {
      eventId: event.id,
      choiceId: choice.id,
      success: false,
      bypassed: false,
      headline: 'Zbyt Mało Złota w Sakwie',
      narrative: `Ta akcja wymaga ${requiredGold} zł, a posiadasz jedynie ${Math.round(ctx.playerGold)} zł. Wybierz inną opcję lub omiń zdarzenie.`,
      goldDelta: 0,
      prestigeDelta: 0,
      knightHpDelta: 0,
      monstersDefeatedDelta: 0,
    };
  }

  if (choice.id === 'fight_blockade') {
    const effectivePower = ctx.knightStrength * 1.15 + ctx.knightDefense * 0.45;
    const decisiveWin = effectivePower >= event.monsterPower;
    const hpLoss = decisiveWin ? -12 : -28;
    const goldGain = decisiveWin ? event.baseGoldReward : Math.round(event.baseGoldReward * 0.6);
    const qtyGain = decisiveWin ? event.baseCommodityQty : Math.max(1, Math.floor(event.baseCommodityQty * 0.5));
    const prestigeGain = decisiveWin ? event.basePrestigeReward : Math.round(event.basePrestigeReward * 0.6);

    return {
      eventId: event.id,
      choiceId: choice.id,
      success: true,
      bypassed: false,
      headline: decisiveWin
        ? `Zwycięstwo! Przełamano Blokadę: ${event.title}`
        : `Ciężkie Starcie — Przebito się przez Blokadę`,
      narrative: decisiveWin
        ? `Twój Rycerz rozgromił zagrożenie w regionie ${event.regionName}! Zdobyto +${goldGain} zł, +${qtyGain} szt. cennego surowca oraz +${prestigeGain} Prestiżu.`
        : `Walka była zacięta (Rycerz stracił ${Math.abs(hpLoss)} HP), ale udało się rozproszyć wrogów i zdobyć +${goldGain} zł oraz +${qtyGain} szt. surowca!`,
      goldDelta: goldGain,
      prestigeDelta: prestigeGain,
      knightHpDelta: hpLoss,
      monstersDefeatedDelta: 1,
      commodityDelta: { id: event.commodityId, qty: qtyGain },
    };
  }

  if (choice.kind === 'interact') {
    return {
      eventId: event.id,
      choiceId: choice.id,
      success: true,
      bypassed: false,
      headline: `Zakończono Interakcję: ${event.title}`,
      narrative: `Pomyślnie zawarto umowę w regionie ${event.regionName}. Koszt: ${requiredGold} zł, zdobyto +${event.baseCommodityQty} szt. towaru oraz +${event.basePrestigeReward} Prestiżu!`,
      goldDelta: -requiredGold,
      prestigeDelta: event.basePrestigeReward,
      knightHpDelta: 0,
      monstersDefeatedDelta: 0,
      commodityDelta: { id: event.commodityId, qty: event.baseCommodityQty },
    };
  }

  // Tactical alternative (paid escort / diplomacy / info exchange)
  if (requiredGold > 0) {
    const partialQty = Math.max(1, Math.ceil(event.baseCommodityQty * 0.65));
    const partialPrestige = Math.round(event.basePrestigeReward * 0.65);
    return {
      eventId: event.id,
      choiceId: choice.id,
      success: true,
      bypassed: false,
      headline: `Taktyczne Rozwiązanie: ${event.title}`,
      narrative: `Dzięki sprytnej decyzji (-${requiredGold} zł) zabezpieczono szlak bez obrażeń, przejmując +${partialQty} szt. surowca i +${partialPrestige} Prestiżu.`,
      goldDelta: -requiredGold,
      prestigeDelta: partialPrestige,
      knightHpDelta: 0,
      monstersDefeatedDelta: event.category === 'monster_blockade' ? 1 : 0,
      commodityDelta: { id: event.commodityId, qty: partialQty },
    };
  }

  return {
    eventId: event.id,
    choiceId: choice.id,
    success: true,
    bypassed: false,
    headline: `Zysk Kupiecki na Szlaku: ${event.title}`,
    narrative: `Twoja dyplomacja w regionie ${event.regionName} przyniosła natychmiastowy zysk +${event.baseGoldReward} zł oraz +${Math.round(event.basePrestigeReward * 0.6)} Prestiżu!`,
    goldDelta: event.baseGoldReward,
    prestigeDelta: Math.round(event.basePrestigeReward * 0.6),
    knightHpDelta: 0,
    monstersDefeatedDelta: 0,
  };
}
