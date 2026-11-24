# Cromagrama experimental (24/11/2026)

Terceiro bloco da 3C. Braço → Seguir entrada do afinador → Analisar →
Acordes (experimental). Ligar entrada usa o mesmo stream, canal, dispositivo e
referência Lá do afinador. O padrão continua sendo Notas (YIN), e o espectro só
é calculado quando há um painel observando explicitamente esse modo.

## Comportamento e limites

- Mostra energia relativa de 12 classes, classes presentes e acordes com o mesmo
  conjunto exato de classes no catálogo. Não é probabilidade/confiança estatística.
- Anéis indicam todas as oitavas/posições da classe, não alturas ou cordas medidas.
  Não determina baixo nem inversão. Preserva ambiguidades (C6 e Am7, por exemplo).
- Nenhuma nota ausente é completada. Pode não haver acorde compatível; não é
  transcrição. Distorção, harmônicos, ruído, mistura com bateria ou outras fontes
  podem criar notas falsas. Preferir entrada limpa e fones; validação física pendente.
- Não modifica a seleção manual, cifra, revisão, sequência ou registros. Nenhum
  PCM ou diagnóstico espectral é persistido ou sincronizado pelo iCloud.
- Desmarcar/navegar encerra o consumidor de espectro, mas mantém a captura
  compartilhada existente. Desligar entrada também encerra o afinador. A prévia
  local fica bloqueada durante Seguir entrada para não analisar a própria prévia.

## Implementação

`packages/core/src/chromagram.ts` contém FFT Hann, normalização, picos com
interpolação log-parabólica, classes pela referência Lá, atenuação heurística de
parciais inteiros (2 a 6) de picos graves fortes e comparação exata com templates
validados por `chordTones`. Limites declarados: 65–1400 Hz, picos até 35 cents da
classe, sinal mínimo 0,004 RMS. O filtro de harmônicos não separa instrumentos.
O indicador chamado de energia na interface deriva da amplitude normalizada
do maior pico por classe, não de uma integração de energia ou probabilidade.

Web: segundo AnalyserNode ligado ao mesmo splitter/canal, sem conectar ao destino.
Janela de 16384 amostras até 50 kHz, 32768 acima, análise em torno de 120 ms pelo
relógio monotônico. Usa FFT do core, fora de callback de áudio. Em 48 kHz, janela
aproximada de 341 ms, somada à captura e atualização, não uma latência medida.
Acima da resolução suportada (mais de 4 Hz por bin), mostra aviso e não classifica.

Mac: `spectrum.rs` calcula a mesma FFT Hann na thread de controle do audio-engine.
Janela potência de dois com resolução alvo de até 3 Hz/bin (teto 65536 amostras),
sem mudança da callback/ring buffer de entrada. YIN continua nos últimos 4096
samples. Evento `spectrum` contém só potências até aproximadamente 1400 Hz,
resolução, RMS e referência, a cada pelo menos 120 ms. A regra de cromagrama e
nomes roda no core. Comando `tuner_set_spectrum` não abre outra captura.

TunerProvider conta consumidores, descarta eventos quando não há observador,
limpa ao parar/reiniciar/mudar referência e expira eventos sem atualização em
1,2 s (verificação a cada 300 ms). Sem nova dependência ou migração de dados.

## Verificações executadas

- 183 testes core, incluindo FFT com seno/bin/energia/DC conhecidos, C/Am/E/G7/Dm
  sintéticos, inversão/oitavas/referências 432/442, harmônicos, ambiguidade,
  silêncio, dados inválidos, ruído e saturação com resultado limitado. Não afirma
  identificar corretamente guitarra distorcida.
- 27 audio-engine + 11 practice-store. Novos testes Rust verificam energia de
  seno, DC, silêncio, resolução das janelas e truncamento em 44,1/48/96/192 kHz.
  Os dois kernels usam o mesmo oráculo analítico; não foi medido áudio nativo real.
- Contrato SQLite 17, typecheck, Clippy com warnings como erro, build:web e
  build:app. Testes web controlados cobrem opt-in, mesma captura, referência,
  silêncio/desligamento e captura/prévia/sequência/SW. Suíte global
  `PRACTICE_TEST_BROWSER=chrome pnpm test` aborta ao iniciar Chrome headless
  (SIGABRT/EPERM). IndexedDB real não repetido; não há mudança de armazenamento.
- Chrome conectado, harness de senos ignorado pelo git: C→Am, silêncio, troca para
  YIN, seleção independente, prévia desabilitada, desligar zera anéis. Corpo390,
  um tab stop no mapa e console sem erros observados. Dez capturas de viewport em
  `target/qa-chroma/`, cobrindo controles/grade/resultado em desktop1440 e móvel390,
  nos dois temas. Não é teste de microfone real, Safari ou WebView Tauri.
- Revisão independente **ship como experimental** após ajustar paleta dos
  controles e recapturar toda a cobertura. Documentação preserva PRODUCT/DESIGN.

## Como testar

1. Abrir `target/release/bundle/macos/Prática.app` ou `pnpm web --host 127.0.0.1`.
2. Em Ferramentas, escolher a entrada/canal no afinador. Usar guitarra limpa,
   saída com fones e manter bateria/música desligadas durante o primeiro teste.
3. No Braço, marcar Seguir entrada, escolher Acordes (experimental) e Ligar entrada.
4. Tocar acordes conhecidos devagar e sustentar. Comparar classes com as notas da
   forma. Inversões podem ter o mesmo nome, pois não há identificação do baixo.
5. Abafar as cordas, desligar e trocar para Notas (YIN). Conferir que não fica
   resultado antigo. Testar também no braço expandido da cifra.
6. Comparar limpo/distorcido e registrar falsos positivos. CPU e atraso reais,
   reconexão/permissão e Safari/iPhone ainda precisam de teste no equipamento.

A 3C ainda aguarda avanço da cifra pelo metrônomo. Não inicia a Fase 4,
companion com faixa real ou importação por URL.
