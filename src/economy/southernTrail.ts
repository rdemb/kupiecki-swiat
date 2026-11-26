import type { Worksite } from './newHope';
import type { NestSpecies } from './northPassage';

export const southBounds = { west: -310, east: 2170, near: 310, far: 1550 } as const;
export const southernInns: Worksite[] = [
  {id:'dom_matryc', name:'Dom Matryc', craft:'bursztynnik', x:300,z:720,description:'Przy karczmie pachnie olejem lnianym. Na dębowej prasie rytownicy odbijają smocze łuski na czerpanym papierze.'},
  {id:'prom_lnu',name:'Prom pod Lnianym Żaglem',craft:'szkutnik',x:65,z:1070,description:'Dom przewoźnika stoi na brzegu delty. Przed każdym rejsem karczmarka owija księgi w olejowane płótno.'},
  {id:'zajazd_perlowy',name:'Zajazd Poławiaczek Pereł',craft:'bursztynnik',x:445,z:1105,description:'Pod powałą wiszą muszle. Poławiaczki rozpoznają dno zatoki po drobinach osadu na zawiasie skorupy.'},
  {id:'biala_cysterna',name:'Biała Cysterna',craft:'warzelnik',x:835,z:570,description:'Bielone schody prowadzą z chłodnej karczmy do solnych tarasów. Między stopniami wysychają różowe sadzawki.'},
  {id:'siodlo_garncarzy',name:'Siodło Garncarzy',craft:'warzelnik',x:1020,z:825,description:'Dym z pieców wisi nad przełęczą. Gospodyni suszy tu gliniane formy na delikatne odciski.'},
  {id:'grota_ochry',name:'Grota Ochry',craft:'bursztynnik',x:1350,z:1150,description:'W ścianie gospody widać rude warstwy skał. Malarze rozcierają miejscowy pigment do podpisywania rycin.'},
  {id:'wrota_plaskowyzu',name:'Wrota Płaskowyżu',craft:'szkutnik',x:1700,z:695,description:'Woźnice zostawiają wozy pod kamiennym okapem. Wieczorem złote skrzydła rzucają cienie na ściany wąwozu.'},
  {id:'studnia_luster',name:'Studnia Luster',craft:'warzelnik',x:1910,z:1110,description:'Na dnie bezwietrznej doliny woda odbija niebo. Przed gospodą stoją kamienne niecki pełne kryształów.'},
  {id:'przystan_papiernikow',name:'Przystań Papierników',craft:'szkutnik',x:815,z:1300,description:'Na ramach pod okapem schnie papier z trzciny. Przyjezdni przywożą tu najstarsze odbitki, by je podkleić.'},
];
export const firstInn = southernInns[0].id;
export const engravers = [
  {name:'Ada Papierniczka',prompt:'Brzeg świeżej kartki jeszcze błyszczy. Co zrobisz przed włożeniem jej do teki?',choices:['Wysuszę na ramie','Zwinę w ciasny rulon'],answer:0},
  {name:'Remek od Pieczęci',prompt:'Na miedzi trzeba wyryć nazwę wsi. Jak ułożysz litery, żeby odbitka dała się czytać?',choices:['Jak na odbitce','W lustrzanym odbiciu'],answer:1},
  {name:'Telimena z Promu',prompt:'Przez pokład przelewa się woda. W co zapakujesz ryciny?',choices:['W ażurową sieć','W olejowane płótno'],answer:1},
  {name:'Iwo Ochrowy',prompt:'Dwie barwy łuski wyglądają podobnie przy ogniu. Gdzie porównasz próbki?',choices:['W świetle dziennym','W cieniu pod stołem'],answer:0},
  {name:'Bronka Muszlarka',prompt:'Dwa okazy różnią się wielkością. Co umieścisz obok ich odcisków?',choices:['Datę targu','Tę samą podziałkę'],answer:1},
  {name:'Teo Introligator',prompt:'Luźne ryciny mieszają się w podróży. Jak zachowasz ich kolejność?',choices:['Ponumeruję arkusze','Odetnę rogi wszystkich'],answer:0},
  {name:'Ofka z Tarasów',prompt:'Na skrzyni został solny nalot. Gdzie położysz suchy papier?',choices:['Na oczyszczonej desce','Bezpośrednio na soli'],answer:0},
  {name:'Radost Prasownik',prompt:'Pierwsza odbitka urywa się z lewej. Co sprawdzisz przed następną?',choices:['Nazwę portu','Równy docisk płyty'],answer:1},
] as const;
export interface CabinetStop {site:string; engraved:boolean; opens:number; guide:number; ballotEnds:number|null; votes:Record<string,number>; myVote:string|null}
export interface Exhibit {id:number;guild:string;species:NestSpecies;edition:number;done:boolean;route:CabinetStop[]}
export interface CabinetBook {
  shows:Exhibit[]; loans:{edition:number;species:NestSpecies}[]; guild:string|null;
  sheets:number; stamps:string[]; sampler:{guide:number;stamped:boolean}|null;
}
