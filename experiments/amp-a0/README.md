# Amp A0: bancada de risco

Ainda não é o pedal do app. Não abre áudio automaticamente e não integra TONE3000.
A aprovação depende de um modelo real e de medição física com a interface do Pedro.
Nada nesta bancada declara automaticamente que a meta de 10–12 ms foi atingida.

## Dependências e escopo

- `nam-rs = 0.4.0`, MIT: https://github.com/OpenSauce/nam-rs
- Código avaliado nesta sessão: `6462dd59a927de0cdc3c48cbf1dece51882d7727`.
- Oráculo de referência: NeuralAmpModelerCore 0.6.0, MIT, commit
  `0b3d3c97b0859a3a8c92a8628c4dd89a25eb5842`:
  https://github.com/sdatkinson/NeuralAmpModelerCore
- A bancada possui workspace isolado para não introduzir o candidato no build
  distribuído antes da paridade. Reutiliza o `audio-engine` do projeto, com cpal/rtrb.
- Arquivos e resultados gerados ficam em `target/amp-a0/`. Não adicionar modelos,
  IRs, capturas, binários ou cópias das dependências ao Git.
- Preparação, parsing, warmup e destruição ficam fora da região de processamento.
  A0 carrega um modelo por execução; troca com crossfade e IR ficam para A1.
- O monitor aceita F32, uma entrada e uma saída na mesma interface externa, mesma
  taxa do modelo e buffer solicitado de 64/128. Sem resampling, gate ou calibração
  de entrada ainda. Usa somente o canal de saída escolhido, com rampa, ganho de
  -24 dB e teto de amostra de -3 dBFS. O teto não é um limitador true-peak.
- O metrônomo/afinador devem estar desligados na bancada. A unificação do stream
  de saída do app acontece em A1; não há um segundo stream de metrônomo na bancada.

## Compilar e conferir sem tocar som

Na raiz do projeto, com acesso ao crates.io:

```sh
cargo build --release --manifest-path experiments/amp-a0/Cargo.toml
cargo test --release --manifest-path experiments/amp-a0/Cargo.toml
python3 experiments/amp-a0/scripts/generate-fixtures.py
```

Os modelos gerados são redes teóricas, sem captura de amplificador e sem áudio
de terceiros. Os três modelos mínimos têm referência matemática independente,
calculada em Python. Há também LSTM H32 e WaveNet C16 sintéticas para estressar
o processamento. Isso não comprova paridade com C++ nem custo de um amp real.

O binário fica em `experiments/amp-a0/target/release/pratica-amp-a0`:

```sh
experiments/amp-a0/target/release/pratica-amp-a0 compare \
  --model target/amp-a0/synthetic/lstm.nam \
  --input target/amp-a0/synthetic/input.json \
  --expected target/amp-a0/synthetic/expected-lstm.json \
  --reference-kind analytic-synthetic

experiments/amp-a0/target/release/pratica-amp-a0 bench \
  --model /caminho/do/seu/modelo.nam --frames 64 --seconds 10
```

Repetir com 128 frames. O benchmark é offline, processa N segundos de sinal o mais
rápido possível: `cpu_seconds` e `realtime_factor` não são a CPU de um monitor ao
vivo. O relatório inclui p50/p95/p99/máximo, prazo por bloco e contagem de
alocações/liberações dentro do processamento. `thread_cpu_processing` mede o
tempo de CPU da thread, incluindo o custo das leituras do relógio, para investigar
diferenças em relação ao tempo de parede. `deadline_misses` conta blocos que
atingiram ou ultrapassaram o prazo. Isso não altera a prioridade do processo nem
simula as callbacks do CoreAudio. A biblioteca não faz resampling.

### Ambiente desta sessão

O crates.io estava sem DNS. Para compilar a bancada, foi usada uma cópia MIT dos
arquivos de código e licenças, obtida pelo conector GitHub no commit fixado, em
`target/amp-a0/nam-rs-6462dd5/`. Nenhum modelo/áudio de terceiros foi baixado.
O override é só da linha de comando, não muda o app nem o manifesto publicado:

```sh
cargo build --release --offline --manifest-path experiments/amp-a0/Cargo.toml \
  --config 'patch.crates-io.nam-rs.path="target/amp-a0/nam-rs-6462dd5"'
```

Se o Cargo resolver o caminho relativamente ao manifesto em sua versão, use o
caminho absoluto da pasta acima. O lock da bancada é transitório e ignorado no
Git; não há lock de produção aprovado para esse candidato nesta entrega.

## Oráculo C++

Requer rede, Git, CMake e compilador C++. O script só baixa código/dependências em
`target/amp-a0/`, verifica o commit do Core e não modifica o Git principal:

```sh
sh experiments/amp-a0/scripts/build-oracle.sh

target/amp-a0/oracle-build/pratica-nam-oracle \
  /caminho/modelo.nam target/amp-a0/synthetic/input.json target/amp-a0/core-output.json

experiments/amp-a0/target/release/pratica-amp-a0 compare \
  --model /caminho/modelo.nam \
  --input target/amp-a0/synthetic/input.json \
  --expected target/amp-a0/core-output.json --reference-kind NAMCore-0.6.0
```

O oráculo executa o caminho genérico, sem A2-fast e sem prewarm no reset.
A comparação descarta o receptive field inicial do WaveNet, informa erro máximo
absoluto/RMS e falha se exceder `1e-5`. Usar modelos mono que o Rust também aceita.
O Core foi compilado no Mac ARM64 em 22/11/2026. As 14 comparações de sete modelos
sintéticos em 64/128 frames passaram, com erro máximo de 1,49e-8. Além dos modelos
mínimos e das redes maiores, os casos A2 exercitam gating GATED/BLENDED, FiLM,
grupos, bottleneck e head de dois taps. Isso cobre esses casos concretos, sem
declarar compatibilidade com todos os arquivos NAM. Falta o modelo local real.

Como a rede do Terminal estava bloqueada, as fontes foram obtidas pelo conector
GitHub em `target/amp-a0/core-source-0b3d3c9/`, com hashes de blobs conferidos.
Eigen ficou no commit `bc3b39870ecb690a623a3f49149a358b95c5781d` e AudioDSPTools
em `0827c6c2fc0deced568536142ea86f189e0b98a1`, os submódulos fixados pelo Core.
Core/AudioDSPTools/nlohmann usam MIT; Eigen inclui MPL-2.0 e avisos BSD em seus
componentes. As licenças permanecem junto das fontes ignoradas em `target/`.
Essa referência não é distribuída no `.app`. O caminho padrão do script usa Git,
verifica os commits e recusa modificações nos arquivos versionados da referência.

## Repetir a validação offline

Depois dos builds, execute na raiz, sem outros testes/builds concorrentes:

```sh
python3 experiments/amp-a0/scripts/validate-offline.py \
  --oracle target/amp-a0/oracle-build/pratica-nam-oracle
```

O roteiro gera os fixtures, compara ambos os motores em 64/128 frames e roda três
benchmarks seriados por modelo/buffer, cada um com dez segundos de sinal. Salva
hashes dos binários, modelos e entrada em `target/amp-a0/offline-report.json`.
Para o modelo local, acrescente `--model /caminho/modelo.nam`; `--input` aceita um
sinal JSON mais longo para modelos com receptive field maior. Este sinal é usado
na comparação; o benchmark continua gerando seu próprio sinal de teste.

Códigos de saída: 0 para verificações offline sem estouro de prazo, 1 para erro de
execução/paridade/DSP, 2 para estouro de prazo. `execution_checks_passed` separado
dos campos de prazo impede tratar uma comparação correta como aprovação de
desempenho. `candidate_approved` e `rtl_measured` continuam falsos em todos eles.

Na execução desta sessão, as 42 rodadas tiveram zero alocações/liberações no DSP,
mas nove blocos ultrapassaram o prazo de parede, com picos de 10,18 ms na LSTM H32
e 20,02 ms na WaveNet C16 em buffer 128. Nenhum bloco ultrapassou o prazo de CPU
da thread. A diferença é compatível com preempção/escalonamento; não comprova que
as callbacks ao vivo ficarão estáveis. A validação terminou com código 2.

## Monitor ao vivo

Liste e escolha o ID exato da interface, sem fallback para o alto-falante:

```sh
experiments/amp-a0/target/release/pratica-amp-a0 list
experiments/amp-a0/target/release/pratica-amp-a0 monitor \
  --device 'ID_DA_INTERFACE' --model /caminho/modelo.nam \
  --input-channel 1 --output-channel 1 --frames 64 --seconds 60
```

Canais começam em 1. Use a interface e fones com fio; desative o monitoramento
direto da interface para ouvir apenas o caminho processado. O monitor começa
baixo, para sozinho ao fim e faz fade-out normal. Desconexão/erro gera silêncio e
encerra a execução. Não testar trocas de modelo encerrando o processo à força.

Para a referência sem modelo:

```sh
experiments/amp-a0/target/release/pratica-amp-a0 bypass \
  --device 'ID_DA_INTERFACE' --sample-rate 48000 \
  --input-channel 1 --output-channel 1 --frames 64 --seconds 60
```

O buffer real pode diferir do solicitado; ambos são informados. O relatório
mostra CPU do processo em % de um núcleo, p99/pico da callback, carga do prazo,
underflow/overflow, reequilíbrio da fila, clipping, NaN/Inf e alocações/liberações.
O relatório conta frames efetivamente processados e retorna erro se nenhum foi
processado, houver alocações, falhas de stream/fila ou callback acima do prazo.
Esse resultado não aprova o candidato nem confirma RTL. A fila é limitada; reequilíbrio é contado e não pode ser tratado como teste sem
falhas. Zero alocações aqui cobre a região marcada do código do host/modelo, não
os drivers do macOS. Tempos de callback medem parede e incluem preempção do SO.
O monitor não declara RTL a partir de timestamps ou da soma de buffers.

## Medir entrada→saída de verdade

Uma montagem de referência simultânea com uma interface de duas entradas/saídas:

1. Na DAW, mande o sinal de teste de banda larga em nível baixo pela saída 2 e
   conecte essa saída de linha à entrada 1. A DAW grava a entrada 1 como referência.
2. O monitor Prática lê entrada 1 e processa para saída 1. Conecte saída 1 de linha
   à entrada 2. A DAW grava a entrada 2 como retorno.
3. Grave as entradas 1 e 2 simultaneamente em um WAV estéreo: referência à esquerda,
   retorno à direita. Desligue monitoração da DAW, compensação automática/manual de
   atraso e plugins da gravação; não desloque os canais nem normalize separadamente.
   Use o mesmo relógio, com ganho/entradas equivalentes. Não conecte saída de potência.
4. Repita com `bypass` e com `monitor`, 64 e 128 frames. Para modelos não lineares,
   confirme que o sinal continua correlacionável; resultado inconclusivo não é passe.

O gerador fornece um sinal determinístico em `input.json` e `probe-source.wav`
(mono float32, pico -20 dBFS). Para reprodução na DAW, use esse WAV ou um probe
próprio de banda larga. Evite tom
senoidal puro: picos periódicos podem dar um atraso falso. O arquivo
`synthetic-delay-321.wav` é apenas teste do analisador, não gravação de interface.

```sh
experiments/amp-a0/target/release/pratica-amp-a0 analyze-rtl \
  --capture /caminho/referencia-e-retorno.wav
```

O analisador aceita WAV PCM 16/24/32 ou float32, rejeita baixa confiança/picos
ambíguos e informa atraso em amostras/ms. Ele não verifica fisicamente os cabos,
a configuração da DAW ou o clock: `capture_topology_verified` permanece falso.
Um cabo simples saída→entrada mede I/O; não substituir essa medição pela prova
completa do caminho entrada→NAM→saída descrita acima.

## Critério para seguir para A1

- Paridade C++ abaixo de `1e-5` no conjunto de modelos aceitos.
- Nenhuma alocação/liberação na região do DSP/callback marcada.
- RTL físico até 12 ms, buffer real conferido em 64/128, por repetições.
- Dez minutos sem falha de stream, underflow, overflow ou reequilíbrio; margem
  no prazo da callback, inclusive enquanto a interface gráfica está em uso.
- Conferência tocando com a guitarra e modelo reais.

Se falhar, registrar os números e parar. Não usar o benchmark sintético como
justificativa para avançar ao pedal, à versão web ou ao TONE3000.

## Roteiro do teste físico com a Scarlett (para o Pedro)

Antes de tudo: o resultado deste teste é o que decide a A0. Nada aqui aprova sozinho.

### Modelo

- Um `.nam` local, de licença CC BY, CC0 ou GPL (TONE3000 ou `pelennor2170/NAM_models`).
  Anote nome, autor, licença, link e arquitetura (A1/A2, WaveNet/LSTM, taxa).
- Guarde fora do repositório e fora do iCloud, por exemplo `~/NAM/modelos/`.
  Nunca dentro de `~/Dev/guitar-exercises-app`. Um modelo por execução.
- Compatibilidade conferida na fonte do nam-rs 0.4.0 (`6462dd5`): WaveNet A1 e A2,
  LSTM e SlimmableContainer A2, com FiLM, gating, bottleneck, grupos e
  `condition_dsp`. Recusa ao carregar: entrada multicanal, head final com mais de
  um canal, gating misto numa mesma array e ativações fora do conjunto. Se recusar,
  anote a mensagem e troque de modelo; não edite o arquivo. A bancada ainda não
  foi exercitada com um SlimmableContainer real; preferir um A2 simples ou A1 no
  primeiro teste.
- A taxa do modelo precisa ser a da Scarlett (normalmente 48 kHz). Sem resampling.

### Segurança

1. Fones com fio na Scarlett. Sem Bluetooth, sem AirPods, sem caixas.
2. Botão de volume dos fones e Monitor da Scarlett quase no mínimo antes de rodar.
3. Desligue o monitoramento direto (Direct Monitor/Air) para ouvir só o caminho processado.
4. Feche a DAW e o Prática (metrônomo e afinador desligados).
5. A bancada já começa com saída em -24 dB e teto de amostra em -3 dBFS, com rampa.
   Suba o volume no botão da interface aos poucos, nunca no software.
6. Se houver chiado, realimentação ou estalo forte: Ctrl+C só se a bancada não parar
   sozinha, e tire os fones antes.

### Passos

```sh
cd ~/Dev/guitar-exercises-app
cargo build --release --manifest-path experiments/amp-a0/Cargo.toml
B=experiments/amp-a0/target/release/pratica-amp-a0
M=~/NAM/modelos/SEU_MODELO.nam
$B list                                   # copie o ID exato da Scarlett
$B bench --model "$M" --frames 64 --seconds 10
$B bench --model "$M" --frames 128 --seconds 10
python3 experiments/amp-a0/scripts/validate-offline.py \
  --oracle target/amp-a0/oracle-build/pratica-nam-oracle --model "$M"
$B bypass  --device 'ID' --sample-rate 48000 --input-channel 1 --output-channel 1 --frames 128 --seconds 60
$B monitor --device 'ID' --model "$M" --input-channel 1 --output-channel 1 --frames 128 --seconds 60
$B monitor --device 'ID' --model "$M" --input-channel 1 --output-channel 1 --frames 64  --seconds 60
# só se os de 60 s passarem limpos:
$B monitor --device 'ID' --model "$M" --input-channel 1 --output-channel 1 --frames 64  --seconds 600
```

Comece por 128 frames, depois 64. Durante o de 10 minutos, use o Mac normalmente
(navegador, Finder) para ver se a interface gráfica derruba o áudio.
A latência real (RTL) só vale pela montagem de loopback descrita em
"Medir entrada→saída de verdade"; sem ela, anote como não medida.

### O que registrar (copie e preencha)

```
Data/hora:
Mac / macOS:            Scarlett (modelo/firmware):
Modelo .nam:            licença:        link:
Arquitetura (A1/A2, tipo):              taxa:
Carregou no nam-rs? (sim / erro):
Paridade C++ (erro máx./RMS, 64 e 128):
Bench 64:  p99 ___ ms  máx ___ ms  deadline_misses ___  alocações ___
Bench 128: p99 ___ ms  máx ___ ms  deadline_misses ___  alocações ___
Monitor 128 (60 s): buffer real ___  CPU ___ %  p99/pico callback ___  under/overflow ___  reequilíbrios ___  clipping ___
Monitor 64  (60 s): buffer real ___  CPU ___ %  p99/pico callback ___  under/overflow ___  reequilíbrios ___  clipping ___
Monitor 64 (10 min): falhas ___  under/overflow ___  reequilíbrios ___
RTL (analyze-rtl, bypass/monitor, 64/128): ___ ms  ou "não medido"
Tocabilidade (1 a 5) e notas: atraso percebido, ataque, ruído, estalos, timbre:
```

Cole o bloco preenchido e os JSON gerados em `target/amp-a0/` na conversa.
Os critérios para seguir à A1 continuam os da seção anterior.
