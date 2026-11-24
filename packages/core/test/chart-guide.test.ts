import {describe,it,expect} from 'vitest';
import {chartCues,chartGuidePlan,chartGuideAt,parseChordPro,transposeDoc,MAX_CHART_CUES} from '../src';
describe('guia de cifra com tempos explícitos',()=>{
 it('preserva cada ocorrência, linhas e segmentos sem confundir repetições',()=>{
  const doc=parseChordPro('{comment: Estudo}\n[C]Texto neutro [Am]outro\n\n[C][F]\nSem acorde\n');
  expect(chartCues(doc).map((c)=>[c.id,c.chord])).toEqual([['1:0','C'],['1:1','Am'],['3:0','C'],['3:1','F']]);
  expect(chartCues(transposeDoc(doc,2)).map((c)=>c.chord)).toEqual(['D','Bm','D','G']);
 });
 it('não inventa tempos e recusa planos vazios, incompletos ou grandes',()=>{
  const cues=chartCues(parseChordPro('[C][Am]'));
  for(const beats of [[],[4],[4,0],[4,NaN],[1.5,4],[33,4]])expect(chartGuidePlan(cues,beats)).toBeNull();
  expect(chartGuidePlan([],[])).toBeNull();
  expect(chartGuidePlan(Array.from({length:MAX_CHART_CUES+1},(_,i)=>({...cues[0]!,id:String(i)})),Array(MAX_CHART_CUES+1).fill(4))).toBeNull();
 });
 it('troca exatamente nas fronteiras e termina após o último tempo',()=>{
  const plan=chartGuidePlan(chartCues(parseChordPro('[C][Am][C]')),[2,1,4])!;
  expect(Array.from({length:8},(_,i)=>chartGuideAt(plan,i,false)?.index??null)).toEqual([0,0,1,2,2,2,2,null]);
  expect(chartGuideAt(plan,2,false)?.beatsLeft).toBe(1);
  expect(chartGuideAt(plan,3,false)?.beatsLeft).toBe(4);
  expect(chartGuideAt(plan,7,true)).toEqual({index:0,beatsLeft:2,lap:1});
  expect(chartGuideAt(plan,1000,true)).toEqual({index:2,beatsLeft:1,lap:142});
  expect(chartGuideAt(plan,-1,true)).toBeNull();expect(chartGuideAt(plan,NaN,true)).toBeNull();
 });
 it('não muda a origem, não depende de BPM e inclui acorde sem forma',()=>{
  const cues=chartCues(parseChordPro('[Cxyz][C]')),beats=[1,2];const snapshot=structuredClone(cues);
  const plan=chartGuidePlan(cues,beats)!;beats[0]=8;cues[0]!.chord='D';
  expect(plan.cues).toEqual(snapshot);expect(plan.ends).toEqual([1,3]);
 });
});
