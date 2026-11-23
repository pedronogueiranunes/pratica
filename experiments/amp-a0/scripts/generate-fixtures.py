#!/usr/bin/env python3
"""Gera modelos/sinais sintéticos originais. Nenhum áudio ou captura de terceiros."""
import json, math, pathlib, struct
root = pathlib.Path(__file__).resolve().parents[3]
out = root / 'target' / 'amp-a0' / 'synthetic'
out.mkdir(parents=True, exist_ok=True)
def save(name, value):
    (out / name).write_text(json.dumps(value), encoding='utf-8')
def lstm(head):
    return {'version':'0.5.4','architecture':'LSTM','sample_rate':48000,'config':{'input_size':1,'hidden_size':1,'num_layers':1},'weights':[0,0,0,0,.5,0,0,0,0,0,0,0,0,0,head,0], 'metadata':{'name':'Pratica synthetic LSTM, not an amp capture'}}
model = lstm(.8)
save('lstm.nam', model)
save('a2.nam', {'version':'0.5.4','architecture':'SlimmableContainer','sample_rate':48000,'config':{'submodels':[{'max_value':.5,'model':lstm(.8)},{'max_value':1.,'model':lstm(.6)}]},'weights':[]})
# Uma camada teórica, sem captura de equipamento. Layout conferido com o formato NAM.
save('wavenet.nam', {'version':'0.5.4','architecture':'WaveNet','sample_rate':48000,'config':{'layers':[{'input_size':1,'condition_size':1,'channels':1,'head_size':1,'kernel_size':1,'dilations':[1],'activation':'ReLU','gated':False,'head_bias':False}],'head':None,'head_scale':1.},'weights':[1.,1.,0.,0.,1.,0.,1.,1.]})
seed=71
signal=[]
for _ in range(24000):
    seed ^= (seed << 13) & 0xffffffff; seed ^= seed >> 17; seed ^= (seed << 5) & 0xffffffff
    signal.append(((seed / 0xffffffff)*2-1)*.1)
save('input.json', signal)
save('expected-wavenet.json', [max(0., x) for x in signal])
for name,head in [('expected-lstm.json',.8),('expected-a2.json',.6)]:
    cell=0.; result=[]
    for sample in signal:
        cell=.5*cell+.5*math.tanh(.5*sample)
        result.append(head*.5*math.tanh(cell))
    save(name,result)
# Rede sintética maior: custo da topologia, não timbre/benchmark de amp real.
h=32
weights=[math.sin(i*17.)*.02 for i in range(4*h*(1+h)+4*h+2*h+h+1)]
save('lstm-h32-synthetic.nam', {'version':'0.5.4','architecture':'LSTM','sample_rate':48000,'config':{'input_size':1,'hidden_size':h,'num_layers':1},'weights':weights})
channels=16; dilations=[1,2,4,8,16,32,64,128,256,512]
count=channels+len(dilations)*(channels*channels*3+channels+channels+channels*channels+channels)+channels+1
weights=[math.sin(i*13.)*.01 for i in range(count-1)]+[1.]
save('wavenet-c16-synthetic.nam', {'version':'0.5.4','architecture':'WaveNet','sample_rate':48000,'config':{'layers':[{'input_size':1,'condition_size':1,'channels':channels,'head_size':1,'kernel_size':3,'dilations':dilations,'activation':'Tanh','gated':False,'head_bias':False}],'head':None,'head_scale':1.},'weights':weights})
# Casos originais da família A2: gating, FiLM, bottleneck, grupos e head de 2 taps.
# A contagem segue as dimensões das matrizes, sem copiar uma captura de amp.
for mode in ['gated', 'blended']:
    ch=4; bn=2; mid=2*bn; groups=2; taps=3; layers=2
    per_layer=mid*ch*taps//groups+mid+mid+ch*bn//groups+ch+4*bn
    count=ch+layers*per_layer+bn*2+1+1
    layer={'input_size':1,'condition_size':1,'channels':ch,'bottleneck':bn,
           'kernel_sizes':[taps]*layers,'dilations':[1,4],
           'activation':[{'type':'Tanh'}]*layers,'gating_mode':[mode]*layers,
           'secondary_activation':[{'type':'Sigmoid'}]*layers,
           'groups_input':groups,'groups_input_mixin':1,
           'layer1x1':{'active':True,'groups':groups},'head1x1':{'active':False,'out_channels':bn,'groups':1},
           'activation_post_film':{'active':True,'shift':True,'groups':1},
           'head':{'out_channels':1,'kernel_size':2,'bias':True}}
    save(f'a2-{mode}-film.nam', {'version':'0.6.0','architecture':'WaveNet',
         'sample_rate':48000,'config':{'layers':[layer],'head':None,'head_scale':1.},
         'weights':[math.sin(i*11.)*.15 for i in range(count-1)]+[1.]})
source=b''.join(struct.pack('<f',x) for x in signal)
source_fmt=struct.pack('<HHIIHH',3,1,48000,48000*4,4,32)
source_body=b'WAVEfmt '+struct.pack('<I',len(source_fmt))+source_fmt+b'data'+struct.pack('<I',len(source))+source
(out/'probe-source.wav').write_bytes(b'RIFF'+struct.pack('<I',len(source_body))+source_body)
# WAV estéreo de atraso CONHECIDO, apenas teste do analisador; não é medição física.
lag=321
samples=b''.join(struct.pack('<ff',x,-.3*signal[i-lag] if i>=lag else 0.) for i,x in enumerate(signal))
fmt=struct.pack('<HHIIHH',3,2,48000,48000*8,8,32)
body=b'WAVEfmt '+struct.pack('<I',len(fmt))+fmt+b'data'+struct.pack('<I',len(samples))+samples
(out/'synthetic-delay-321.wav').write_bytes(b'RIFF'+struct.pack('<I',len(body))+body)
print(f'Fixtures sintéticos gerados em {out}. Não representam latência ou custo de um amp real.')
