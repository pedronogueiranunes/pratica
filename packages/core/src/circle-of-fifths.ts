/** Teoria tonal, sem metadados de músicas. Armaduras de sete bemóis a sete sustenidos. */
export type KeyMode = 'major' | 'minor';
export const FIFTHS_POSITIONS: readonly (readonly number[])[] = [[0],[1],[2],[3],[4],[5,-7],[6,-6],[-5,7],[-4],[-3],[-2],[-1]];
const LETTERS = ['C','D','E','F','G','A','B'];
const SHARPS = ['F','C','G','D','A','E','B'], FLATS = ['B','E','A','D','G','C','F'];
const MAJOR_QUALITY = ['','m','m','','','m','dim'], MINOR_QUALITY = ['m','dim','','m','m','',''];
const MAJOR_DEGREES = ['I','ii','iii','IV','V','vi','vii°'], MINOR_DEGREES = ['i','ii°','III','iv','v','VI','VII'];
export interface CircleKey {
  fifths: number; mode: KeyMode; tonic: string; relative: string;
  notes: string[]; signature: string[];
  triads: { degree: string; chord: string; notes: string[] }[];
}
export function circleKey(fifths: number, mode: KeyMode = 'major'): CircleKey {
  if (!Number.isInteger(fifths) || fifths < -7 || fifths > 7 || !['major','minor'].includes(mode)) throw new Error('Armadura inválida.');
  const altered = (fifths < 0 ? FLATS : SHARPS).slice(0, Math.abs(fifths));
  const sign = fifths < 0 ? 'b' : '#';
  const first = ((fifths * 4) % 7 + 7) % 7;
  const major = Array.from({length:7},(_,i) => { const letter=LETTERS[(first+i)%7]!; return letter+(altered.includes(letter)?sign:''); });
  const notes = mode === 'major' ? major : [...major.slice(5),...major.slice(0,5)];
  const qualities = mode === 'major' ? MAJOR_QUALITY : MINOR_QUALITY;
  const degrees = mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES;
  return { fifths, mode, tonic: notes[0]!, relative: mode === 'major' ? major[5]!+'m' : major[0]!, notes,
    signature: altered.map((letter)=>letter+sign),
    triads: notes.map((note,i)=>({degree:degrees[i]!,chord:note+qualities[i]!,notes:[note,notes[(i+2)%7]!,notes[(i+4)%7]!]})) };
}
