import { describe,it,expect } from 'vitest';
import { circleKey,FIFTHS_POSITIONS,noteIndex,chordTones } from '../src';
describe('círculo de quintas',()=>{
  it('percorre doze quintas e oferece todas as quinze armaduras',()=>{
    expect(FIFTHS_POSITIONS.flat().slice().sort((a,b)=>a-b)).toEqual(Array.from({length:15},(_,i)=>i-7));
    const roots=FIFTHS_POSITIONS.map((p)=>noteIndex(circleKey(p[0]!).tonic)!);
    for(let i=0;i<12;i++)expect((roots[(i+1)%12]!-roots[i]!+12)%12).toBe(7);
  });
  it('C e Am compartilham armadura, preservando o menor natural',()=>{
    expect(circleKey(0).notes).toEqual(['C','D','E','F','G','A','B']);
    expect(circleKey(0,'minor').notes).toEqual(['A','B','C','D','E','F','G']);
    expect(circleKey(0,'minor').triads.map((t)=>t.chord)).toEqual(['Am','Bdim','C','Dm','Em','F','G']);
  });
  it('grafias enarmônicas mantêm suas armaduras e notas teóricas',()=>{
    expect(circleKey(6).notes).toEqual(['F#','G#','A#','B','C#','D#','E#']);
    expect(circleKey(-6).notes).toEqual(['Gb','Ab','Bb','Cb','Db','Eb','F']);
    expect(circleKey(7).signature).toEqual(['F#','C#','G#','D#','A#','E#','B#']);
    expect(circleKey(-7).signature).toEqual(['Bb','Eb','Ab','Db','Gb','Cb','Fb']);
    expect(circleKey(6).notes.map(noteIndex)).toEqual(circleKey(-6).notes.map(noteIndex));
  });
  it.each(Array.from({length:15},(_,i)=>i-7))('confere intervalos, relativas e tríades na armadura %s',(fifths)=>{
    for(const mode of ['major','minor'] as const){
      const key=circleKey(fifths,mode),pcs=key.notes.map((n)=>noteIndex(n)!);
      const intervals=pcs.map((n)=>(n-pcs[0]!+12)%12);
      expect(intervals).toEqual(mode==='major'?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10]);
      expect(new Set(key.notes.map((n)=>n[0])).size).toBe(7);
      for(const triad of key.triads){
        const parsed=chordTones(triad.chord)!;
        expect(parsed).not.toBeNull();
        expect(triad.notes.map((n)=>(noteIndex(n)!-parsed.root+12)%12).sort((a,b)=>a-b)).toEqual(parsed.intervals.slice().sort((a,b)=>a-b));
      }
    }
  });
  it('recusa armaduras inválidas',()=>{for(const f of [-8,8,NaN,1.5])expect(()=>circleKey(f)).toThrow();});
});
