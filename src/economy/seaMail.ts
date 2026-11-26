export const courierFee = 3;
export const courierSeconds = 150;
export const dispatchTopics = { grain: 'Zboże na straganie', salt: 'Zapas soli', timber: 'Drewno na pochylni' };
export interface Envelope { id: number; sender: string; guild: string }
export interface Dispatch extends Envelope {
  written: number; body: string; voyage: number | null; vessel: string | null;
  roadDue: number | null; delivered: number | null;
}
export interface PostBook { sent: Dispatch[]; received: Dispatch[] }
