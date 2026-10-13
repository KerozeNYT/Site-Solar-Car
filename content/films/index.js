/**
 * Every covering film shown on the site, all brands together. Only integrated ranges are listed
 * here (one file per brand and range, same fields): the simulator and the page show nothing else.
 */
import { films as m2080, range as r2080 } from './3m-2080.js';

export const ranges = [r2080];
export const films = [...m2080];
export const byId = new Map(films.map((f) => [f.id, f]));
