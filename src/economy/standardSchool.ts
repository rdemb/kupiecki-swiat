import type { Passage } from './bridge';
import type { FeastTown } from './harvestLoaf';
import type { Ration } from './garrison';
import type { WeatherConditionId } from './economyEngine';
import { journeySeconds } from './waybills';

export const mentorMarks = 3;
export const roadNames: Record<Passage, string> = { bridge: 'Most', detour: 'Górny bród' };
const schoolNamePattern = /^[\p{L}]+(?:[ '\u2019-][\p{L}]+)*$/u;
export function validRecruitName(name: string) {
  return name.length >= 2 && name.length <= 28 && schoolNamePattern.test(name);
}
export interface RoadGuide {
  id: number;
  name: string;
  own: boolean;
  captain: string;
  knighted?: boolean;
  relayDue?: number | null;
  learned: { road: Passage; mentor: string }[];
  trip: { road: Passage; arrival: number; returns: number } | null;
}
export interface RoadRecord {
  id: number;
  name: string;
  mentor: string;
  road: Passage;
  origin: FeastTown;
  arrival: number;
  lesson: boolean;
}
export function schoolLegSeconds(road: Passage, weather: WeatherConditionId, rationDelay: number) {
  return 2 * journeySeconds(1, weather, road) + rationDelay;
}
export interface SchoolBook {
  weather: WeatherConditionId;
  closed: boolean;
  guides: RoadGuide[];
}
export type SchoolCommand =
  | { action: 'enrolSquire'; name: string }
  | { action: 'guideWagon'; guide: number; road: Passage; lesson: boolean; ration: Ration };
