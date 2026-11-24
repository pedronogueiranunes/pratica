import {describe,it,expect} from 'vitest';
import {outputChannelOptions,inputChannelOptions,validOutputChannels,validateSetting,flattenSettings,settingsFromRows} from '../src';
describe('canais de entrada e saída por interface',()=>{
 it('oferece estéreo e canais isolados só quando há mais de um canal',()=>{
  expect(outputChannelOptions(1)).toEqual([]);
  expect(outputChannelOptions(2).map((o)=>[o.value,o.label])).toEqual([[0,'1 e 2 (estéreo)'],[1,'Só 1'],[2,'Só 2']]);
  expect(outputChannelOptions(4)[0]!.label).toBe('Todos');
  expect(inputChannelOptions(2).map((o)=>o.value)).toEqual([0,1]);
  expect(inputChannelOptions(0)).toEqual([]);
 });
 it('valida o mapa e guarda só neste aparelho',()=>{
  expect(validOutputChannels({scarlett:2,mac:0})).toBe(true);
  for(const bad of [[],null,{x:-1},{x:1.5},{x:129},{'':1}])expect(validOutputChannels(bad)).toBe(false);
  const rows=flattenSettings({metronome:{outputChannels:{scarlett:1}}},'mac-a');
  expect(rows[0]!.key).toBe('device:mac-a:metronome.outputChannels');
  rows.forEach((r)=>validateSetting(r));
  expect(settingsFromRows(rows,'mac-a').metronome.outputChannels).toEqual({scarlett:1});
  expect(settingsFromRows(rows,'mac-b').metronome.outputChannels).toBeUndefined();
  expect(()=>validateSetting({key:'metronome.outputChannels',value:{scarlett:1}})).toThrow();
 });
});
