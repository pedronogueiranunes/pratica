import { useEffect, useMemo, useRef, useState } from 'react';
import { alternativeChordShapes, chordAtCapo, chartCues, chartGuideAt, chartGuidePlan, MAX_CHART_CUES, type ChordProDoc, type ChartGuidePlan } from '@gx/core';
import { useMetronome } from '../lib/metronome';
import { useApp } from '../lib/app-state';
import { onEngine } from '../lib/engine';
import { ChordChart } from './ChordChart';
import { FretboardExplorer } from './FretboardExplorer';
import { IconPlay, IconStop } from '../icons';

export function ChartPractice({doc,label,capo,onChord,selectedChord,onBegin}:{doc:ChordProDoc;label:string;capo:number;onChord:(name:string,target:HTMLButtonElement)=>void;selectedChord:string|null;onBegin:()=>void}) {
  const m=useMetronome(), {settings}=useApp();
  const cues=useMemo(()=>chartCues(doc),[doc]);
  const cueShape=useMemo(()=>cues.map((c)=>c.id).join(','),[cues]);
  const [beats,setBeats]=useState<number[]>(()=>cues.map(()=>0));
  const [uniform,setUniform]=useState(4),[loop,setLoop]=useState(false),[scroll,setScroll]=useState(false),[board,setBoard]=useState(false);
  const [running,setRunning]=useState(false),[cursor,setCursor]=useState<{index:number;beatsLeft:number;lap:number}|null>(null),[message,setMessage]=useState('');
  const active=useRef<{plan:ChartGuidePlan;loop:boolean;last:number}|null>(null), root=useRef<HTMLDivElement>(null);
  const plan=useMemo(()=>chartGuidePlan(cues,beats),[cues,beats]);
  const current=cursor?cues[cursor.index]:null;
  const diagram=useMemo(()=>{const shape=current?alternativeChordShapes(current.chord)[0]:null;return shape?chordAtCapo(shape,capo):null;},[current,capo]);
  const halt=(reason='Guia parado.')=>{if(active.current){active.current=null;m.stop();}setRunning(false);setCursor(null);setMessage(reason);};
  useEffect(()=>m.onTick((tick)=>{
    const a=active.current;if(!a||tick.sub!==0)return;
    if(a.last<0&&tick.index!==0)return;
    const beat=tick.bar*settings.metronome.beatsPerBar+tick.beat;
    if(beat===a.last)return;
    if(beat<a.last){halt('O metrônomo reiniciou. Comece o guia novamente.');return;}
    a.last=beat;
    const next=chartGuideAt(a.plan,beat,a.loop);
    if(!next){halt('Estudo concluído.');return;}
    setCursor(next);
  }),[m.onTick,settings.metronome.beatsPerBar]);
  useEffect(()=>{if(!m.running&&active.current&&active.current.last>=0)halt('Metrônomo parado.');},[m.running]);
  // Transpor mantém as ocorrências; trocar revisão ou editar a cifra muda a estrutura e zera os tempos.
  const lastShape=useRef(cueShape);
  useEffect(()=>{if(lastShape.current===cueShape)return;lastShape.current=cueShape;if(active.current)halt('A cifra mudou. Defina os tempos de novo.');setBeats(cues.map(()=>0));},[cueShape]);
  useEffect(()=>{if(active.current)halt('Configuração de áudio ou compasso mudou. Comece novamente.');},[settings.metronome.beatsPerBar,settings.metronome.subdivision,settings.metronome.outputDeviceId]);
  useEffect(()=>{
    const hide=()=>{if(document.hidden)halt('Guia interrompido ao ocultar a página.');};
    const off=onEngine((e)=>{if(e.type==='error'&&e.direction!=='input'&&active.current)halt(`Não deu para continuar. Confira a saída em Ajustes. ${e.message}`);});
    document.addEventListener('visibilitychange',hide);
    return()=>{if(active.current){active.current=null;m.stop();}off();document.removeEventListener('visibilitychange',hide);};
  },[m.stop]);
  useEffect(()=>{
    if(!scroll||!current)return;
    root.current?.querySelector<HTMLElement>(`[data-chart-cue="${current.id}"]`)?.scrollIntoView({block:'nearest',inline:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  },[current,scroll]);
  const start=async()=>{
    if(!plan||m.running)return;
    onBegin();setMessage('');setCursor(null);const run={plan,loop,last:-1};active.current=run;setRunning(true);
    const started=await m.start();if(!started&&active.current===run)halt('Não deu para iniciar. Confira a saída em Ajustes e tente novamente.');
  };
  return <div className="chart-practice" ref={root}>
    {cues.length>0 && <section className="chart-guide" aria-label="Guia pelo metrônomo">
      <h3>Guia pelo metrônomo</h3>
      <p className="small muted">Defina os tempos de cada ocorrência para este estudo. Eles não indicam o ritmo original e ficam só nesta abertura.</p>
      {cues.length>MAX_CHART_CUES?<p role="status">Esta cifra tem mais de {MAX_CHART_CUES} ocorrências. Use um trecho menor para o guia.</p>:<>
        <div className="chart-guide-controls">
          <label>Tempos por acorde<input type="number" min="1" max="32" value={uniform} disabled={running} aria-label="Tempos para aplicar a todos" onChange={(e)=>setUniform(Number(e.target.value))}/></label>
          <button className="btn" disabled={running||!Number.isInteger(uniform)||uniform<1||uniform>32} onClick={()=>setBeats(cues.map(()=>uniform))}>Usar em todos</button>
          <label>BPM do estudo<input type="number" min="20" max="400" value={m.bpm} aria-label="BPM do guia" onChange={(e)=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=20&&n<=400)m.setBpm(n);}}/></label>
          <label className="inline-check"><input type="checkbox" checked={loop} disabled={running} onChange={(e)=>setLoop(e.target.checked)}/>Repetir estudo</label>
        </div>
        <details className="chart-guide-editor"><summary>Tempos por ocorrência ({cues.length})</summary><ol>{cues.map((cue,i)=><li key={cue.id}><label><span>{i+1}. <strong>{cue.chord}</strong></span><input type="number" min="1" max="32" disabled={running} aria-label={`Tempos da ocorrência ${i+1}, ${cue.chord}`} value={beats[i]||''} placeholder="Definir" onChange={(e)=>setBeats((all)=>all.map((v,j)=>j===i?Number(e.target.value):v))}/></label></li>)}</ol></details>
        <div className="chart-guide-controls">
          <button className="btn primary" disabled={!plan||(!running&&m.running)} onClick={()=>running?halt():start()}>{running?<IconStop/>:<IconPlay/>}{running?'Parar guia':'Iniciar guia'}</button>
          <label className="inline-check"><input type="checkbox" checked={scroll} onChange={(e)=>setScroll(e.target.checked)}/>Rolar até o acorde</label>
          <label className="inline-check"><input type="checkbox" checked={board} onChange={(e)=>setBoard(e.target.checked)}/>Mostrar braço do guia</label>
        </div>
        {!plan&&<p className="small muted">Preencha os tempos ou use Usar em todos para começar.</p>}
        {!running&&m.running&&<p className="small muted">Pare o metrônomo atual para iniciar este guia do começo.</p>}
        <p className="chart-guide-state" role="status">{running?(current?`${current.chord} · ocorrência ${cursor!.index+1}/${cues.length} · ${cursor!.beatsLeft} ${cursor!.beatsLeft===1?'tempo restante':'tempos restantes'}${loop?` · volta ${cursor!.lap+1}`:''}`:'Aguardando o primeiro tempo…'):message||'Guia desligado.'}</p>
        <p className="small muted">Usa o clique, compasso e saída de Ajustes. Parar o guia também para o metrônomo. Nenhum acorde é tocado automaticamente.</p>
      </>}
    </section>}
    <ChordChart doc={doc} label={label} onChord={onChord} selectedChord={selectedChord} activeCueId={running?current?.id:null}/>
    {board&&<section className="chart-guide-board" aria-label="Braço do acorde do guia"><h3>Braço do guia{current?`: ${current.chord}`:''}</h3><p className="small muted">Forma de referência no tempo do roteiro, não detecção do que você tocou.{capo?` Casas reais com capo ${capo}.`:''}</p>{diagram?<FretboardExplorer diagram={diagram} embedded/>:<p className="small muted">{current?'Sem forma disponível para este acorde. O guia continua.':'Inicie o guia para acompanhar o acorde no braço.'}</p>}</section>}
  </div>;
}
