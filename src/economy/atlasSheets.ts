/** Geographic extents [west, north, east, south] in the same units as the 3D scene. */
export const atlasSheets = {
  swiat:[-2790,-3410,2170,1550], stary_lad:[-282,-230,261,226],
  nowa_nadzieja:[310,-310,930,310], kresy_nadziei:[930,-310,2170,310],
  morze_wylin:[-310,-930,2170,-310], poludniowe_trakty:[-310,310,2170,1550],
  zachodnie_rozlewiska:[-2790,-930,-310,1550], wzgorza_jarmarczne:[-2790,-3410,2170,-930],
} as const;
export type AtlasSheet = keyof typeof atlasSheets;
export function sheetFor(continent:string):AtlasSheet {
  return Object.hasOwn(atlasSheets,continent) ? continent as AtlasSheet : 'stary_lad';
}
export function projectAtlas(sheet:AtlasSheet, [x,z]:readonly number[]):[number,number] {
  const [west,north,east,south]=atlasSheets[sheet];
  return [(x-west)*100/(east-west),(z-north)*100/(south-north)];
}
