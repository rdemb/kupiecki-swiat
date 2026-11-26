import type { MillMark } from './mill';
import type { Worksite } from './newHope';

export const westBounds = {west:-2790, east:-310, north:-930, south:1550} as const;
export const riverX = (z:number) => -1550 + 160*Math.sin(z*.004);
export const marshSites: Worksite[] = [
  {id:'gospoda_koperty',name:'Gospoda pod Kopertą',craft:'szkutnik',x:-730,z:125,description:'W szparze między kołkami przystani tkwi torba z listem. Na klapie ciemnieje ślad po wielkiej wodzie.'},
  {id:'mlyn_znakow',name:'Młyn Znaków Wodnych',craft:'szkutnik',x:-1010,z:-430,description:'Arkusze z młyna schną na sznurze. Pod światło widać znak drucianej formy, który przechodzi nawet przez zalany list.'},
  {id:'sklad_beczek',name:'Skład Trzech Bednarzy',craft:'warzelnik',x:-1470,z:-535,description:'Na placu stoją beczki soli z trzema różnymi piętnami. Każda partia trafiła na inny wóz.'},
  {id:'straznica_lanowa',name:'Strażnica Łanowa',craft:'szkutnik',x:-1870,z:-140,description:'Rycerka osłania konwoje na grobli. Po powodzi prowadzi spis kupców, którzy rozbili obóz na suchych wyspach.'},
  {id:'brod_zachodni',name:'Zachodni Brzeg Brodu',craft:'szkutnik',x:-1475,z:325,description:'Za niską łachą piasku wystaje słupek dawnej przeprawy. Tutaj czekają wozy jadące na wschód.'},
  {id:'brod_wschodni',name:'Wschodni Brzeg Brodu',craft:'szkutnik',x:-1300,z:325,description:'Na wierzbie wisi żelazny pierścień do cumowania. Z obu brzegów widać dach faktorii.'},
  {id:'olszyna_lusek',name:'Olszyna Łusek',craft:'bursztynnik',x:-970,z:815,description:'Spomiędzy starych olch wystaje pysk smoka trzcinowego. Jego kryza ginie wśród liści.'},
  {id:'jar_krzemienia',name:'Jar Krzemienia',craft:'bursztynnik',x:-2460,z:300,description:'Na kredowej półce odpoczywa smok o pancerzu z ciemnych tarcz. Na dole zbieracze sortują krzemień.'},
  {id:'faktoria_grobli',name:'Faktoria na Grobli',craft:'warzelnik',x:-2020,z:945,description:'Pod arkadą czekają listy przewozowe. Faktor prowadzi osobną księgę skrzyń oddanych promownikowi.'},
  {id:'sad_mgiel',name:'Sad Siedmiu Mgieł',craft:'bursztynnik',x:-2030,z:-570,description:'Na północnej terasie chłód utrzymuje się do południa. Sadownicy suszą owoce na drogę do brodu.'},
];
export const letterStages = [
  {site:'gospoda_koperty',title:'List na palu',description:'„Jeśli nie zdążę przed wodą, szukajcie mojego wozu za młynem”. Atrament rozszedł się przy podpisie. Włókna arkusza zachowały jasny znak.'},
  {site:'mlyn_znakow',title:'Pod światło',description:'Papierniczka przykłada list do okna. Teraz widać, dla kogo czerpano ten papier.'},
  {site:'sklad_beczek',title:'Ładunek z wozu',description:'W magazynie pozostał wtórnik listu przewozowego. Trzeba porównać go ze znakiem na ładunku.'},
  {site:'straznica_lanowa',title:'Ostatni suchy ślad',description:'Rycerka szykuje wóz do drogi. Świadek widział, gdzie kupiec zjechał z zalanego traktu.'},
  {site:'brod_zachodni',title:'Kupiec na drugim brzegu',description:'Pod przewróconym wozem żarzy się palenisko. Kupiec przeżył wezbranie. Wręcza ci starą księgę przewoźnika i prosi o odprowadzenie do gospody.'},
] as const;
export const witnessesByStage = [
  [
    {name:'Hela Sitniczka',line:'Widzisz prześwit w kształcie kłosa? Takie arkusze zamawiali bednarze dla targu zbożowego.',choices:['Kłos','Koło łopatkowe'],answer:0},
    {name:'Jagna Prasowniczka',line:'Na dole jest podwójny krąg. W naszej formie został po dwóch zszytych drutach.',choices:['Podkowa','Podwójny krąg'],answer:1},
    {name:'Miro od Włókien',line:'Palec czuje trzy cienkie smugi, a pod światło ukazują się trzy ryby na jednej lince.',choices:['Trzy ryby','Jedna kotwica'],answer:0},
  ],[
    {name:'Witosz Obręcznik',line:'Kiedy wóz ruszał ku strażnicy, dzwoniły żelazne obręcze. Ładunek miał smołowane wieka.',choices:['Worki owsa','Smołowane beczki'],answer:1},
    {name:'Sara Powroźniczka',line:'Poznaję swój zielony sznur. Tym razem wiązałam bele płótna na wóz do strażnicy.',choices:['Bele płótna','Skrzynie szkła'],answer:0},
    {name:'Lenart Solnik',line:'W szwie worka osiadł biały nalot. Ostatnią partię soli posłałem do strażnicy.',choices:['Mąka','Sól'],answer:1},
  ],[
    {name:'Ida z Chorągwi',line:'Na grzbiecie grobli wciąż stoi drogowskaz. Koleiny mijają go od suchej strony, prosto ku staremu brodowi.',choices:['Jedź grzbietem grobli','Wjedź w rozlewisko'],answer:0},
    {name:'Olbracht od Dzwonu',line:'Spod mostku nie słychać kół. Za to z suchej wierzbiny pod starym brodem odpowiada mi dzwonek kupca.',choices:['Sprawdź zatopiony mostek','Poprowadź wóz do wierzbiny'],answer:1},
    {name:'Róża Tropicielka',line:'Przy starym brodzie jawnie odciśnięte koło. W trawie na mieliźnie widać tylko wodne ptaki.',choices:['Idź śladem koła','Przeszukaj mieliznę'],answer:0},
  ],
] as const;
export const ticketPrice = 12;
export const ferryGoal = 36;
export const landings = ['brod_zachodni','brod_wschodni'] as const;
export const otherBank = (site:string) => site===landings[0]?landings[1]:landings[0];
export const westName = (site:string) => marshSites.find(s=>s.id===site)?.name??site;
export interface LetterPage {
  ledger:{uid:string;mark:MillMark}|null;
  stage:number; witness:number; found:boolean; fund:number; wallet:number|null;
  parcel:{origin:string;delivered:boolean;arrives:number}|null; canBook:boolean;
}
