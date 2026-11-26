import type { Worksite } from './newHope';

export const northernSites:Worksite[] = [
  {id:'sieci_matyldy',name:'Sieci na Północnej Redzie',craft:'szkutnik',x:-102,z:-486,description:'Matylda wytrząsa z wikliny pancerzyki krabów. Pod daszkiem suszy to, co przypływ przyniósł z głębszej wody.'},
  {id:'latarnia_wylin',name:'Latarnia Wylin',craft:'bursztynnik',x:224,z:-685,description:'W izbie pod latarnią Lechosz ogląda smocze łuski pod światło. Na ścianie wisi mapa z otworami po szpilkach.'},
  {id:'fiord_echa',name:'Fiord Echa',craft:'szkutnik',x:524,z:-777,description:'W wąskim fiordzie echo wraca dwukrotnie. Szkutnicy spuszczają łodzie na wodę pomiędzy głazami.'},
  {id:'wydmy_szkla',name:'Wydmy Szkliste',craft:'bursztynnik',x:784,z:-497,description:'Sztorm odsłania pokłady jantaru w wydmach. Na ścieżce skrzypi nawiany piasek.'},
  {id:'kamienne_ogrody',name:'Kamienne Ogrody',craft:'warzelnik',x:1097,z:-695,description:'Sól osiada na skalnych misach wysokimi kołnierzami. Niezwykłe ślady biegną od ciepłych kałuż ku wodzie.'},
  {id:'czarne_kominy',name:'Czarne Kominy',craft:'warzelnik',x:1395,z:-535,description:'Z czarnego bazaltu unosi się para. Warzelnicy obracają przy niej panwie, dopóki wiatr wieje od morza.'},
  {id:'przystan_morzek',name:'Przystań Morzek',craft:'szkutnik',x:1702,z:-770,description:'W przystani o dwóch ujściach łodzie czekają na zmianę prądu. Szypy i wiosła lśnią od mokrego piasku.'},
  {id:'zatoka_woskowa',name:'Zatoka Woskowa',craft:'bursztynnik',x:1958,z:-509,description:'W mlecznych klifach tkwią miodowe żyłki. Na odległej półce widać ślady skrzydeł.'},
];

export const nestingSites=northernSites.slice(2);
export const nestSpecies={
  dwuglowy_brazowy:'Brązowy smok dwugłowy',
  dwuglowy_czerwony:'Czerwony smok dwugłowy',
  dwuglowy:'Dwugłowy zielony smok',
  blekit:'Błękitny smok przypływu',
} as const;
export type NestSpecies=keyof typeof nestSpecies;
export const witnesses=[
  {name:'Berta Sondziarka',clue:'Wczoraj ten głaz wystawał z wody. Ślad powyżej czy poniżej ciemnej linii przetrwał przypływ?',answers:['Powyżej linii','Na dnie rynny'],answer:0},
  {name:'Florian Knot',clue:'W nocy widziałem dwa cienie. Co pozwoli odróżnić dwie głowy jednego smoka od dwóch zwierząt?',answers:['Kolor chmur','Dwie szyje zbiegające się przy jednej parze skrzydeł'],answer:1},
  {name:'Oda od Sit',clue:'Łuska utkwiła w sicie. Z czym ją porównać, zanim wpiszesz gatunek?',answers:['Z oznaczonym okazem w szkatułce','Z kolorem żagla'],answer:0},
  {name:'Sambor Wioślarz',clue:'W zatoce widać dwa kręgi na wodzie. Co wpiszesz do dziennika?',answers:['Na pewno dwa smoki','Dwa kręgi, liczba zwierząt nieustalona'],answer:1},
  {name:'Mila Zielarka',clue:'W błocie są odciski stóp. Jak utrwalisz ich wielkość, zanim pójdzie deszcz?',answers:['Narysuję je obok miarki','Policzę fale przy brzegu'],answer:0},
  {name:'Ostwin Powroźnik',clue:'Świeży ślad przecina wczorajszy odcisk liny. Który powstał później?',answers:['Odcisk liny','Ślad, który przechodzi przez linę'],answer:1},
] as const;
export const scalePrice=14;
export interface NestBook {
  edition:number; storm:boolean; witness:number|null; stage:'none'|'scale'|'identified'|'observed'|'sold'|'sent';
  sighting:{site:string;species:NestSpecies}|null;
  invitation:{site:string;species:NestSpecies;count:number;signed:boolean}|null;
  album:{edition:number;site:string;species:NestSpecies;witness:number}[];
  history:{edition:number;site:string;species:NestSpecies;guildName:string}[];
}
