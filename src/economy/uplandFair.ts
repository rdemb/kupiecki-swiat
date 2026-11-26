import type { Worksite } from './newHope';
import type { MillMark } from './mill';

export const uplandBounds = {west:-2790,east:2170,north:-3410,south:-930};
export const fairSites:Worksite[] = [
  {id:'rozhuk',name:'Rozstaje pod Dzwonem',craft:'szkutnik',x:-285,z:-2080,description:'Dzwon na rozstajach zwołuje woźniców. Na palach zostają karby po każdej wysokiej wodzie.'},
  {id:'plac_owsa',name:'Owsi Brzeg',craft:'warzelnik',x:-2000,z:-2150,description:'Gospodarze dają plac przy wspólnym spichlerzu. Suchy dojazd biegnie ponad pasmem nadrzecznych pól.'},
  {id:'plac_buku',name:'Bukowa Polana',craft:'szkutnik',x:115,z:-1650,description:'Elfie tkaczki rozwieszają płótna między bukami. Pniaki po dawnej grobli wyznaczają dojazd od lasu.'},
  {id:'plac_lupka',name:'Łupkowe Podcienia',craft:'bursztynnik',x:1550,z:-2500,description:'Krasnoludzcy kamieniarze udostępnili plac pod skalnym okapem. Wozy mogą przeczekać ulewę w sztolni.'},
  {id:'mlyn_bielika',name:'Młyn pod Rogiem',craft:'szkutnik',x:-2340,z:-2840,description:'W młynie rogatych smoków mąka czeka w workach po trzy miary. Młynarki znaczą każdy szew ochrą.'},
  {id:'pila_nad_jarem',name:'Piła nad Jarem',craft:'szkutnik',x:-620,z:-1350,description:'Tracze układają lekkie drągi na stoiska w gotowe wiązki. Sucha droga prowadzi skrajem jaru.'},
  {id:'folusz_ciem',name:'Folusz Ciem',craft:'warzelnik',x:530,z:-2900,description:'Woda porusza stępory. Na belach farbowanego płótna przysiadają nocne ćmy.'},
  {id:'rogata_skarpa',name:'Rogata Skarpa',craft:'bursztynnik',x:-1480,z:-1510,description:'W sypkiej ścianie kredy bieleją ślady zakręconych rogów smoka mącznego.'},
  {id:'zmierzchowe_buki',name:'Zmierzchowe Buki',craft:'szkutnik',x:290,z:-2250,description:'Granatowe skrzydła smoka jedwabnika nikną w cieniu. Jego miedziane czułki drżą na widok wozu.'},
  {id:'solne_okno',name:'Solne Okno',craft:'warzelnik',x:1860,z:-1440,description:'Górnicy wybili otwór nad osadnikiem solanki. Na kamieniu zapisują, jak wysoko sięgała rzeka.'},
  {id:'farbiarnia_urzetu',name:'Farbiarnia Urzetu',craft:'warzelnik',x:-770,z:-2930,description:'Na wietrze schną pasy granatowego płótna. Farbiarki przynoszą tu wieści z trzech placów.'},
  {id:'wrota_geod',name:'Wrota Geod',craft:'bursztynnik',x:1130,z:-3100,description:'Z odsłoniętej żyły górnicy wydobywają geody na targ. Droga do podcieni schodzi stopniami.'}
];

export const fairName=(id:string)=>fairSites.find(site=>site.id===id)?.name??id;
export const camps=['plac_owsa','plac_buku','plac_lupka'] as const;
export const wares={
  maka:{name:'Mąka',source:'mlyn_bielika',cost:4},
  drewno:{name:'Drewno',source:'pila_nad_jarem',cost:6},
  plotno:{name:'Płótno',source:'folusz_ciem',cost:5},
} as const;
export type Ware=keyof typeof wares;
export const wareKeys=Object.keys(wares) as Ware[];
export const hosts=[
  [
    {name:'Nastka Młynarka',hint:'Przy młynie woda zdarła korę z dolnych wierzb. Górą pojadą nawet wozy z mąką.',roads:['Górny gościniec','Wierzbowa łacha'],answer:0},
    {name:'Bożydar od Kół',hint:'Na kamiennym nasypie uchował się suchy pył. Z łąki ściągałem wczoraj pusty wóz.',roads:['Łąka','Kamienny nasyp'],answer:1},
    {name:'Lutka Zielarka',hint:'Trzęsawisko zaszło rudą wodą. Sucha szałwia wciąż szeleści na miedzy.',roads:['Miedza szałwii','Trzęsawisko'],answer:0},
    {name:'Janek Owsiarz',hint:'Zasypany bród poznasz po sterczącej osi. Jedź za białym słupkiem na wzniesieniu.',roads:['Dawny bród','Biały słupek'],answer:1},
  ],[
    {name:'Elra od Czółenek',hint:'Po nocnej wodzie most z łoziny zwisa z jednego brzegu. Bukowy dukt już wysechł.',roads:['Most z łoziny','Bukowy dukt'],answer:1},
    {name:'Mirren Barwiarz',hint:'Za koszami leżą kamienne płyty, nie ruszył ich nurt. W starym kole utknęła barka.',roads:['Droga płytowa','Stare zakole'],answer:0},
    {name:'Taja Cieślini',hint:'Do grobli przybiłam świeżą poręcz. Pod kładką jeszcze niesie pnie.',roads:['Kładka','Grobla z poręczą'],answer:1},
    {name:'Oren Sitarz',hint:'Koło na igliwiu zostawia płytki ślad. Pod olchą sucha jest tylko wierzchnia skorupa.',roads:['Ścieżka po igliwiu','Olszyna'],answer:0},
  ],[
    {name:'Runa Cechmistrzyni',hint:'Sztolnią ciągnie chłodne powietrze, spąg jest suchy. W wykopie wciąż pluska woda.',roads:['Sztolnia','Wykop'],answer:0},
    {name:'Brun Dzwonnik',hint:'Na dolną rampę rzuciłem kamyk i usłyszałem plusk. Pod kramem dzwonów jest przejazd.',roads:['Dolna rampa','Kram dzwonów'],answer:1},
    {name:'Gerta Łupiarka',hint:'Po twardych płytach przy cerkli przeprowadziłam dziś dwa muły. Glina klei się po osie.',roads:['Łupkowe płyty','Droga gliniana'],answer:0},
    {name:'Darg Tragarz',hint:'Górne schronisko widziało dziś trzy wozy. Na niskiej drodze stoją jeszcze pale ostrzegawcze.',roads:['Niska droga','Górne schronisko'],answer:1},
  ],
] as const;
export interface FairWin {edition:number;site:string;name:string;good:Ware}
export interface FairCamp {site:string;guide:number;surveyed:boolean;goods:Ware[]}
export interface UplandBook {
  edition:number;storm:boolean;camps:FairCamp[];winner:FairWin|null;history:FairWin[];
  cargo:null|{good:Ware;edition:number;ticket:number};wallet:number|null;claimed:boolean;ledger:{uid:string;mark:MillMark}|null;
}
