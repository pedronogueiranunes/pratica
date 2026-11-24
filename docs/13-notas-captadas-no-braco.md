# Notas captadas no braço (24/11/2026)

Segundo bloco da 3C. Em Ferramentas → Braço, ou no braço expandido de um acorde
da cifra, marcar **Seguir notas do afinador** e clicar **Ligar entrada**. A entrada,
canal, buffer e referência Lá vêm do afinador já existente. Não abre outra captura,
não altera DSP, não monitora o microfone nas caixas e não grava áudio.

Na extensão de cromagrama, o controle passou a se chamar **Seguir entrada do
afinador**. Para manter este comportamento monofônico, escolher **Notas (YIN)**
em Analisar. Ver `14-cromagrama-experimental.md` para o novo modo de acordes.

O anel externo usa a cor de afinação do tema. Marca todas as posições entre as
casas 0 e 24 com o mesmo MIDI da nota captada, incluindo a oitava. O áudio não
permite determinar qual corda foi usada. A seleção manual e os filtros de escala/
acorde continuam independentes; a leitura não preenche um acorde ou tablatura.

`detectedFretPositions` no core reaproveita os critérios de `tuningStatus`: sinal
de pelo menos 0,004 RMS e clareza de pelo menos 0,85. Descarta dados inválidos,
silêncio, instabilidade e notas fora do mapa. Não altera a referência escolhida.
Limpeza de leitura sem eventos continua sob o timeout existente do TunerProvider
(1,2 s, verificado a cada 300 ms). Não é uma medição de latência física.

O botão de entrada controla o afinador compartilhado: desligar no braço desliga
o afinador, e navegar mantém a captura existente. Desmarcar Seguir notas só
desliga o destaque. A prévia da seleção é interrompida ao marcar e fica desabilitada
enquanto esse modo está marcado, para não captar a própria prévia. Sons de outras
fontes ainda podem ser captados pelo microfone; usar fones e tocar uma nota por vez.

## Verificações executadas

- 173 testes core passaram, incluindo sete novos casos: senos sintéticos de E2,
  A2, A3, A4 e A5 passando pelo YIN, referência 442 Hz, oitava e todas as posições,
  parada, sinal fraco, baixa clareza e leituras inválidas.
- 25 audio-engine + 11 practice-store, contrato SQLite 17, typecheck,
  testes web controlados (captura, prévia, sequência e SW), build:web e build:app
  passaram. Bundle de 16,14 MiB em `target/release/bundle/macos/Prática.app`.
- `PRACTICE_TEST_BROWSER=chrome pnpm test` executou core/web/SQLite e falhou ao
  iniciar Chrome headless (SIGABRT/EPERM no sandbox). Não declarado como aprovação
  da suíte global. IndexedDB real não repetido; sem mudança de esquema/adaptador.
- Chrome conectado, entrada simulada gerada em harness ignorado pelo git:
  A4 marcou cinco posições, E2 uma, silêncio e desligar zeraram. Permissão negada
  simulada mostrou erro e permitiu nova tentativa. Seleção manual não mudou com
  a captura. Home/End e Enter preservaram o BPM; um tab stop no mapa.
- Desktop 1440×1000 e móvel 390×844, claro e escuro. Corpo móvel com 390 px,
  rolagem horizontal só no braço; console sem erros observados. Evidências em
  `target/qa-yin/final-*.jpg`, produzidas com sinal sintético e cobrindo o main
  por slices. Revisão independente: **ship**, copy e cobertura resolvidas.
  Sem teste com microfone real.

## Como testar

1. Abrir o bundle compilado ou `pnpm web --host 127.0.0.1`.
2. Em Ferramentas, escolher entrada/canal no afinador e ajustar a referência Lá.
3. No Braço, marcar Seguir notas e Ligar entrada. Autorizar o microfone se pedido.
4. Tocar uma corda de cada vez. Mi grave solto deve marcar E2 na corda 6/casa 0;
   Lá da primeira corda/casa 5 marca também as demais posições de A4.
5. Parar de tocar e desligar a entrada: os anéis devem desaparecer. Comparar
   filtros de escala/acorde, mudar referência e conferir teclado.
6. Em Músicas, abrir um acorde e Ver no braço completo. O capo afeta a forma
   exibida; a captura continua mostrando a altura real, sem transposição artificial.

Pendente físico: qualidade com guitarra limpa/distorcida, ruído e harmônicos,
interfaces/canais/buffers/reconexão e Safari/iPhone. O YIN é monofônico; detecção
de acordes por cromagrama experimental e avanço pelo metrônomo são os próximos
blocos da 3C. Fase 4 e integrações de música não iniciadas.
