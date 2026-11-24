import type { ChordProDoc } from './chordpro';
export const MAX_CHART_CUES = 512;
export interface ChartCue { id: string; chord: string; line: number; segment: number }
/** Ocorrências, não acordes únicos: duas aparições de C são dois passos. */
export function chartCues(doc: ChordProDoc): ChartCue[] {
  return doc.lines.flatMap((line,i)=>line.type==='lyrics'?line.segments.flatMap((seg,j)=>seg.chord?.trim()?[{id:`${i}:${j}`,chord:seg.chord,line:i,segment:j}]:[]):[]);
}
export interface ChartGuidePlan { cues: ChartCue[]; ends: number[]; total: number }
/** Só aceita tempos explicitamente preenchidos, sem deduzir duração da letra. */
export function chartGuidePlan(cues: readonly ChartCue[], beats: readonly number[]): ChartGuidePlan | null {
  if (!cues.length || cues.length>MAX_CHART_CUES || cues.length!==beats.length || new Set(cues.map((c)=>c.id)).size!==cues.length || beats.some((b)=>!Number.isInteger(b)||b<1||b>32)) return null;
  let total=0;
  return {cues:cues.map((c)=>({...c})),ends:beats.map((b)=>total+=b),total};
}
export function chartGuideAt(plan: ChartGuidePlan, beat: number, loop: boolean): {index:number;beatsLeft:number;lap:number}|null {
  if (!Number.isSafeInteger(beat)||beat<0||(!loop&&beat>=plan.total)) return null;
  const local=beat%plan.total,index=plan.ends.findIndex((end)=>local<end);
  return index<0?null:{index,beatsLeft:plan.ends[index]!-local,lap:Math.floor(beat/plan.total)};
}
