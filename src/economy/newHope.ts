import { southernInns } from './southernTrail';
import {northernSites} from './northPassage';

export const crafts = {
  bursztynnik: {name:'Bursztynnik', product:'paciory bursztynu', color:'#ebb76e', patrons:['Ruta z Mierzei','Tobiasz Sitnik','Hanka z Wydm','Nela Sitarka','Eryk od Inkluzji']},
  warzelnik: {name:'Warzelnik', product:'miary soli', color:'#b5d8d3', patrons:['Salomea Warzelna','Olek Bednarz','Inga z Solanek','Hugo z Progów','Maryna Solna']},
  szkutnik: {name:'Szkutnik', product:'klepki kadłuba', color:'#c0a083', patrons:['Mira Szkutniczka','Boruta Smolarz','Józwa Kil','Celina Smolarka','Wit od Wręg']},
};
export type Craft = keyof typeof crafts;
export interface Worksite { id:string; name:string; craft:Craft; x:number; z:number; description:string }
export const worksites: Worksite[] = [
  {id:'mierzeja',name:'Mierzeja Mew',craft:'bursztynnik',x:444,z:-115,description:'Po sztormie korzenie morszczynu zatrzymują okruchy jantaru. Kupcy czekają tu na pierwsze sito.'},
  {id:'szlifiernia',name:'Dom Szlifierzy',craft:'bursztynnik',x:593,z:-177,description:'Północne światło wpada przez wąskie okno prosto na stół szlifierki. Gotowe paciory wędrują do portu.'},
  {id:'panwie',name:'Słone Panwie',craft:'warzelnik',x:753,z:96,description:'Na białych stopniach laguny słychać skrobanie drewnianych grabi. Każda miara soli trafia do księgi.'},
  {id:'solanki',name:'Źródła pod Trzciną',craft:'warzelnik',x:801,z:-76,description:'Na skraju mokradeł wybija słona woda. Deszcz i dostawa opału zmieniają rytm warzenia.'},
  {id:'pochylnia',name:'Pochylnia Wron',craft:'szkutnik',x:553,z:115,description:'Na drewnianych kozłach dojrzewają wręgi. Puste miejsca na stojaku zdradzają zapotrzebowanie stoczni.'},
  {id:'warsztat_kila',name:'Przystań pod Kilem',craft:'szkutnik',x:658,z:5,description:'Gdy odpływ odsłania pale, szkutnicy schodzą pod kadłub. Stąd wypływa drewno na oba brzegi.'},
  {id:'lawica_krabow',name:'Ławica Krabów',craft:'szkutnik',x:1056,z:75,description:'Poławiacze wyciągają kosze przy odpływie. Cieśla czeka z rozszczelnioną łodzią na następny przypływ.'},
  {id:'brzeg_inkluzji',name:'Brzeg Inkluzji',craft:'bursztynnik',x:1164,z:116,description:'Fala podcina brunatny klif. W korzeniach wystają bryłki jantaru z zatopionymi igłami drzew.'},
  {id:'biale_progi',name:'Białe Progi',craft:'warzelnik',x:1392,z:-123,description:'U stóp białych progów woda paruje w płytkich basenach. Drewniane zastawki oddzielają solankę od potoku.'},
  {id:'cicha_stocznia',name:'Cicha Stocznia',craft:'szkutnik',x:1515,z:-86,description:'Na piaszczystym języku łodzie leżą kilem do góry. Świeża smoła zdradza, które wrócą na wodę.'},
  {id:'wyspa_zrzutek',name:'Wyspa Wyrzutków',craft:'bursztynnik',x:1693,z:132,description:'Za trzcinową mielizną sztorm wyrzuca smocze łuski, gałęzie i bursztyn. Kupcy przebierają wyrzut na sitach.'},
  {id:'pustelnia_solna',name:'Pustelnia Solna',craft:'warzelnik',x:1930,z:-25,description:'Nad źródłem wiszą wędzone ryby. Zapasy soli odmierzane tu o świcie trafiają na najdalszy odcinek wybrzeża.'},
  {id:'przyladek_dwoch_szyj',name:'Przylądek Dwóch Szyj',craft:'szkutnik',x:2040,z:-55,description:'Z pomostu widać mokradła. Piloci omijają trzcinę, gdy nad szuwarami podnoszą się jednocześnie dwie zielone głowy.'},
  ...northernSites,
  ...southernInns,
];
export function craftRank(completed:number) {
  return completed >= 8 ? 'Mistrz' : completed >= 3 ? 'Czeladnik' : 'Uczeń';
}
export interface Assignment { prompt:string; choices:readonly string[]; answer:number; reason:string }
export const assignments:Record<Craft,Assignment[]> = {
  bursztynnik:[
    {prompt:'Sztorm naniósł drewno i jantar. Gdzie zaczniesz przebierać wyrzut?',choices:['W splątanych wodorostach','W skrzyni z żelazem','W wyschniętym palenisku'],answer:0,reason:'Lekki jantar zbiera się razem z wyrzuconą materią organiczną.'},
    {prompt:'Paciorek po szlifie ma matową powierzchnię. Jak go wykończysz?',choices:['Gruboziarnistym żwirem','Miękką tkaniną i drobnym ścierniwem','W palenisku'],answer:1,reason:'Drobne ścierniwo usuwa rysy, a tkanina nadaje połysk.'},
    {prompt:'W bryłce zatopiony jest liść. Jak zaplanujesz szlif?',choices:['Przetnij środek liścia','Skuj ją jak krzemień','Zachowaj otoczkę wokół liścia'],answer:2,reason:'Wartość tego zamówienia zależy od zachowania całej inkluzji.'}],
  warzelnik:[
    {prompt:'Woda wyparowała, na dnie panwi osiadły kryształy. Co pakujesz?',choices:['Mokrą trzcinę','Osuszone kryształy','Popiół spod pieca'],answer:1,reason:'Suchy towar znosi drogę bez rozpuszczenia.'},
    {prompt:'Do płytkiego zbiornika spływa deszczówka. Co ochroni solankę?',choices:['Dodanie wody z rzeki','Wpuszczenie strumienia','Odcięcie dopływu deszczówki'],answer:2,reason:'Oddzielenie słodkiej wody utrzymuje stężenie solanki.'},
    {prompt:'Transport dla rybaków odpływa rano. Gdzie przechowasz odmierzoną sól?',choices:['W suchej beczce pod dachem','Na odkrytej tratwie','W mokrym worku'],answer:0,reason:'Sucha beczka chroni sól przed wilgocią podczas rejsu.'}],
  szkutnik:[
    {prompt:'Klepka musi wejść w łuk burty. Co zrobisz przed jej osadzeniem?',choices:['Wysusz ją przy żarze','Skróć o połowę','Uplastycznij drewno parą'],answer:2,reason:'Wilgoć i ciepło pomagają wygiąć klepkę do kształtu wręgi.'},
    {prompt:'Na styku klepek pojawia się sączenie. Co wybierzesz z magazynu?',choices:['Pakuły i smołę','Garść soli','Wióry z bursztynu'],answer:0,reason:'Pakuły wypełniają szczelinę, a smoła osłania uszczelnienie.'},
    {prompt:'Szukasz drewna na zakrzywiony element wręgi. Który kawałek odłożysz?',choices:['Deskę z poprzecznym pęknięciem','Drewno z włóknem zgodnym z łukiem','Spróchniały pień'],answer:1,reason:'Włókna biegnące wzdłuż łuku wzmacniają wygięty element.'}],
};
export interface CareerJob {id:string;site:string;craft:Craft;patron:string;task:number;finished:number;units:number}
export const outfitting:Record<Craft,number> = {bursztynnik:3,warzelnik:4,szkutnik:6};
export interface CareerBook {sailings:number; stores:Record<Craft,number>; lastShipment:null|{name:string;site:string};jobs:CareerJob[];progress:Partial<Record<Craft,number>>;stocks:Record<string,number>;marks:{craft:Craft;name:string}[]}
