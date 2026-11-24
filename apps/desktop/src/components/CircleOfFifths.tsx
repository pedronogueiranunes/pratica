import { useRef, useState, type KeyboardEvent } from 'react';
import { circleKey, FIFTHS_POSITIONS, type KeyMode } from '@gx/core';

/** O círculo seleciona uma armadura; o modo decide maior ou relativo menor natural. */
export function CircleOfFifths() {
  const [fifths,setFifths]=useState(0),[mode,setMode]=useState<KeyMode>('major');
  const buttons=useRef(new Map<number,HTMLButtonElement>());
  const current=circleKey(fifths,mode);
  const position=FIFTHS_POSITIONS.findIndex((p)=>p.includes(fifths));
  const choose=(i:number)=>setFifths(FIFTHS_POSITIONS[i]![0]!);
  const navigate=(e:KeyboardEvent<HTMLButtonElement>,i:number)=>{
    let next=i;
    if(e.key==='ArrowRight'||e.key==='ArrowDown')next=(i+1)%12;
    else if(e.key==='ArrowLeft'||e.key==='ArrowUp')next=(i+11)%12;
    else if(e.key==='Home')next=0;
    else if(e.key==='End')next=11;
    else return;
    e.preventDefault();e.stopPropagation();choose(next);buttons.current.get(next)?.focus();
  };
  const signature = current.signature.length ? `${current.signature.length} ${fifths>0 ? current.signature.length===1?'sustenido':'sustenidos' : current.signature.length===1?'bemol':'bemóis'}` : 'Sem acidentes';
  return <section className="panel fifths-panel" aria-label="Círculo de quintas">
    <h2>Círculo de quintas</h2>
    <p className="small muted">No sentido horário, avance uma quinta. Cada posição reúne um tom maior e seu relativo menor.</p>
    <div className="fifths-layout">
      <div>
        <div className="fifths-wheel" role="group" aria-label="Tonalidades no círculo de quintas">
          <svg viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="160"/><circle cx="200" cy="200" r="105"/></svg>
          {FIFTHS_POSITIONS.map((choices,i)=>{
            const angle=i*Math.PI/6-Math.PI/2;
            const major=choices.map((n)=>circleKey(n).tonic).join('/');
            const minor=choices.map((n)=>circleKey(n,'minor').tonic+'m').join('/');
            return <button key={i} ref={(el)=>{if(el)buttons.current.set(i,el);else buttons.current.delete(i);}} type="button" className="fifths-key" style={{left:`${50+40*Math.cos(angle)}%`,top:`${50+40*Math.sin(angle)}%`}} aria-label={`${major} maior, relativo menor ${minor}`} aria-pressed={position===i} tabIndex={position===i?0:-1} onClick={()=>choose(i)} onKeyDown={(e)=>navigate(e,i)}><strong>{major}</strong><span>{minor}</span></button>;
          })}
          <div className="fifths-center" aria-hidden="true"><strong>{current.tonic}{mode==='minor'?'m':''}</strong><span>{mode==='major'?'maior':'menor natural'}</span></div>
        </div>
        <p className="small muted">Setas percorrem o círculo. Home vai a C/Am; End vai a F/Dm.</p>
      </div>
      <div className="fifths-details">
        <div className="seg" role="group" aria-label="Modo do círculo"><button type="button" aria-pressed={mode==='major'} onClick={()=>setMode('major')}>Maior</button><button type="button" aria-pressed={mode==='minor'} onClick={()=>setMode('minor')}>Menor natural</button></div>
        {FIFTHS_POSITIONS[position]!.length>1 && <label className="fifths-spelling">Grafia enarmônica<select aria-label="Grafia enarmônica do círculo" value={fifths} onChange={(e)=>setFifths(Number(e.target.value))}>{FIFTHS_POSITIONS[position]!.map((f)=><option key={f} value={f}>{circleKey(f,mode).tonic}{mode==='minor'?'m':''}</option>)}</select></label>}
        <div className="fifths-reading" role="status">
          <h3>{current.tonic}{mode==='major'?' maior':' menor natural'}</h3>
          <p>Relativo {mode==='major'?'menor':'maior'}: <strong>{current.relative}</strong></p>
          <p><strong>{signature}</strong>{current.signature.length>0 && <span className="num"> · {current.signature.join(' · ')}</span>}</p>
          <p className="num fifths-scale">{current.notes.join(' · ')}</p>
        </div>
        <h3>Campo harmônico</h3>
        <ol className="fifths-triads" aria-label="Tríades diatônicas">{current.triads.map((triad)=><li key={triad.degree}><span className="small muted">{triad.degree}</span><strong>{triad.chord}</strong><span className="small num">{triad.notes.join(' · ')}</span></li>)}</ol>
        <p className="small muted">{mode==='minor'?'Menor natural: o quinto grau é menor. As formas harmônica e melódica alteram outras notas.':'Tríades formadas só pelas notas da escala maior.'} Grafias como E# e Cb mantêm a função de cada nota no tom.</p>
      </div>
    </div>
  </section>;
}
