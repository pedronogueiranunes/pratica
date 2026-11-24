# Status

## Checkout alinhado e guia da cifra revisado, sem publicar (24/11/2026)

- Git alinhado sem perda: tag `backup/pre-align-20261124-1111` no antigo HEAD `26749d9`, ramo `backup/wt-20261124-1111` e stash com o diretório inteiro, e cópia dos 76 arquivos alterados/novos em `.git/backup-wt-20261124-1111/`. Depois `git fetch` e `git reset --mixed origin/main` (`edefc23`). Sobraram só os 10 arquivos do guia da cifra pelo metrônomo. Sem reset --hard, clean ou push.
- Guia revisado: término (para metrônomo e mostra Estudo concluído), loop, reinício do metrônomo (pede para começar de novo), espera pelo tick zero, subdivisões ignoradas e compasso 3/4 conferidos numa simulação da lógica do componente. Correção: trocar revisão ou editar a cifra agora para o guia e zera os tempos; transpor mantém.
- Executado neste ambiente (VM Linux, sem binários nativos do Mac): 4 casos de `chart-guide.test.ts` com shim mínimo de vitest, simulação do handler de ticks e `tsc --noEmit` do core (limpo) e do desktop (sem erros em `src/`; só `@types/node` ausente no VM). **Não executados:** vitest real, `test/chord-sequence.mjs` (Vite nativo), cargo, build:web, build:app e teste na interface. Rodar no Mac antes de publicar.
- Amp A0: roteiro do teste físico com a Scarlett e ficha de registro em `experiments/amp-a0/README.md`. nam-rs 0.4.0 abre A1 e A2 (WaveNet, LSTM, SlimmableContainer), conferido na fonte. A0 continua não aprovada até o resultado do teste do Pedro.

## Publicação de cromagrama e círculo autorizada (24/11/2026)

- Push solicitado pelo Pedro: cromagrama `7603861fd487c944b7a3a75a047aec9fe7f3ce11`, círculo de quintas `91e1b604efa5ed7c3417a00a33ab6998b9a692d9` e documentação em commit separado, sobre a main `8159bf9`, sem force. Apenas 24 arquivos novos/diferentes contra o remoto.
- Próximo bloco autorizado: avanço da cifra pelo metrônomo, com tempos definidos pelo usuário e sem estimar ritmo ou BPM. Acompanhar Pages após atualizar a main.

## Círculo de quintas adicionado em Ferramentas (24/11/2026)

- Extensão solicitada pelo Pedro: painel Círculo de quintas antes do Braço. Doze posições com maior/relativo menor, modo Maior ou Menor natural, armadura ordenada, sete notas e campo harmônico com graus/tríades/notas. B/Cb, F#/Gb e Db/C# oferecem Grafia enarmônica. Não toca som nem altera o tom de uma música ou sequência; escolha local ao painel.
- `circle-of-fifths.ts` no core gera as 15 armaduras (-7 a +7) por letras e acidentes; mantém E#, B#, Cb e Fb onde a teoria exige. Menor natural não recebe sensível ou dominante maior artificial. 19 novos casos conferem percurso das quintas, escalas/relativas/enarmonias e todas as tríades contra `chordTones`. Nenhuma dependência, alteração de DSP ou migração.
- Verificado: **202 core**, **27 audio-engine + 11 practice-store**, **17 contrato SQLite**, captura/espectro/prévia/sequência/SW controlados, typecheck, build:web e build:app. Suíte global `PRACTICE_TEST_BROWSER=chrome pnpm test` aborta no Chrome headless SIGABRT/EPERM depois de core/web/SQLite, portanto não aprovada integralmente. IndexedDB real não repetido, sem mudança de armazenamento. Diff check passou.
- Chrome conectado: C→G por seta, End→F, troca F#/Gb→Gb→Eb menor natural, seis bemóis e tríades; um botão pressionado/um tab stop no círculo. Setas consumidas sem alterar BPM. Desktop1440/móvel390, claro/escuro, alvos mínimos medidos em 56,5 px, corpo390 sem overflow externo, console sem erros observados. Seis capturas em `target/qa-fifths/`, wheel/details no móvel. Sem teste em Safari/iPhone físico. Revisão independente **ship**, sem bloqueios teóricos ou funcionais; documentação conferida. Sistema visual existente preservado, controle segmentado reutilizado; launcher/detector recusados por permissão, conferência manual.
- Bundle recompilado de **16,16 MiB** em `target/release/bundle/macos/Prática.app`. Esta extensão e o cromagrama permanecem locais; site/main continuam em `8159bf9`. Não substituído o app de Aplicativos, não publicado. HEAD local `26749d9`/índice bloqueado: comparar com remoto no próximo push para preservar entregas anteriores e backups.
- Como testar: abrir o bundle compilado → Ferramentas → Círculo de quintas. Selecionar tom, Maior/Menor natural, comparar notas e campo harmônico. Em F#/Gb, alternar grafia. Tab/setas/Home/End/Espaço operam o círculo. Detalhes em `docs/15-circulo-de-quintas.md`.
- Extensão de teoria não conclui a 3C: ainda falta avanço da cifra pelo metrônomo. Permanecem os testes físicos pendentes de áudio iPhone, afinador/interface/buffer/reconexão, cromagrama limpo/distorcido/CPU/atraso, medição de atraso/tema Mac, Safari, iCloud entre dois Macs, Laboratório YouTube153 e Spotify com Client ID próprio/redirect `http://127.0.0.1/callback`. A0 aguarda modelo/interface/loopback. Fase 4 não iniciada.

## 3C, terceiro bloco: cromagrama experimental local (24/11/2026)

- Publicação solicitada no início da rodada concluída: main em **8159bf9cb912fbbe5d1027b5077e85e87c359766**, implementação YIN `4f28c78` e documentação `8159bf9`. Pages **45368467450** passou build e deploy. App recompilado; em seguida implementado este novo bloco, ainda sem publicação.
- Braço em Ferramentas e na cifra ganhou Analisar → Acordes (experimental), com 12 indicadores relativos, classes detectadas e correspondências exatas no catálogo. Anéis em todas as oitavas possíveis; não infere baixo, inversão ou corda e não modifica seleção manual/cifra. Padrão continua Notas (YIN). Controle passou a se chamar Seguir entrada do afinador. A interface avisa sobre harmônicos/distorção e recomenda som limpo/fones.
- `chromagram.ts` no core concentra FFT Hann, picos, classes pela referência Lá, atenuação heurística de harmônicos e templates via `chordTones`. Rust `spectrum.rs` calcula o espectro na thread de controle; web usa o mesmo splitter/canal e FFT do core fora da callback. Espectro só com observador explícito, aproximadamente a cada 120 ms, sem outro stream de entrada. Nada de PCM/espectro persistido, dependências ou migrações novas. Não há monitoramento do microfone nas caixas.
- Verificações reais: **183 core**, **27 audio-engine + 11 practice-store**, **17 contrato SQLite**, captura/espectro/prévia/sequência/SW controlados, typecheck, Clippy `-D warnings`, builds web/app e diff check passaram. Testes sintéticos cobrem C/Am/E/G7/Dm, referências, oitavas/inversões sem baixo inferido, harmônicos, ambiguidade, silêncio/ruído/saturação e kernels FFT com oráculo analítico. Suíte global `PRACTICE_TEST_BROWSER=chrome pnpm test` ainda aborta no Chrome headless SIGABRT/EPERM, depois das etapas anteriores. IndexedDB real não repetido; armazenamento não mudou.
- Chrome conectado com harness sintético ignorado: C→Am, silêncio, troca YIN, seleção independente, prévia bloqueada, parada zero anéis, 390 px sem overflow externo/um tab stop e console sem erros observados. Dez capturas finais de viewport em `target/qa-chroma/`, desktop1440/móvel390 claro/escuro, controles/grade/resultado em slices. Revisão independente **ship como experimental**, após corrigir cores nativas de checkbox/meters e enquadramento. Documentação conferida, PRODUCT/DESIGN/tokens preservados. Launcher/detector recusados por permissão; conferência manual. Não é teste com áudio físico nem execução Tauri real.
- App final recompilado de **16,16 MiB** em `target/release/bundle/macos/Prática.app`. O cromagrama permanece local e não substituiu `/Applications/Prática.app`; site/main continuam `8159bf9`, apenas com bloco YIN publicado. Checkout HEAD `26749d9` e índice bloqueado: comparar arquivos com remoto antes de publicar, sem reenviar as entregas anteriores. Backups preservados.
- Como testar: abrir o bundle compilado → Ferramentas → escolher entrada/canal no afinador → Braço → Seguir entrada → Analisar/Acordes (experimental) → Ligar entrada. Usar fones e som limpo; tocar acordes sustentados, abafar e desligar. No modo de notas, continua YIN. Detalhes, janelas/limiares e limites em `docs/14-cromagrama-experimental.md`.
- A 3C permanece parcial: falta avanço da cifra pelo metrônomo. Pendentes físicos: guitarra limpa/distorcida, qualidade/ruído/harmônicos, CPU/atraso e reconexão/interface/canal/buffer; confirmar som no iPhone após correção publicada, Safari/iPhone, medição de atraso/tema nativo, iCloud em dois Macs e Laboratório YouTube153/Spotify (Client ID próprio, redirect `http://127.0.0.1/callback`). A0 depende de modelo/interface/loopback. Fase 4, companion com faixa real e importação por URL não iniciados.

## Publicação das notas no braço autorizada (24/11/2026)

- Push solicitado pelo Pedro. Implementação em `4f28c783e1d6002f386a7233d7ca9bd8f20f50eb`, documentação em commit separado, sobre a main `95b9053`, sem force. Sete arquivos novos/diferentes conferidos contra o remoto. Recompilação do app solicitada e iniciada; acompanhar Pages após atualizar a main.
- Próxima entrega autorizada: cromagrama experimental da 3C, ainda em desenvolvimento. Não confundir com a detecção monofônica já entregue; sem iniciar Fase 4.

## 3C, segundo bloco: notas captadas no braço (24/11/2026)

- Implementado Seguir notas do afinador em Ferramentas → Braço e no braço expandido da cifra. Opt-in de destaque e botão de entrada compartilhada; mesmos dispositivo/canal/buffer/referência Lá do afinador, sem outro stream, retorno do microfone ou gravação. Desmarcar ou navegar mantém a entrada existente ligada, conforme texto visível; Desligar entrada encerra o afinador compartilhado.
- `detectedFretPositions` no core valida a leitura e marca todas as posições com o mesmo MIDI/oitava nas casas 0–24. Não infere corda nem altera seleção, acorde, cifra ou sequência. Silêncio, sinal fraco/instável, parada e dados inválidos não acendem o braço. Prévia é interrompida/desabilitada durante Seguir notas. Anel externo usa a cor de afinação do tema.
- Verificado: **173 testes core**, **25 audio-engine + 11 practice-store**, **17 contrato SQLite**, captura/prévia/sequência/SW controlados, typecheck e builds web/app passaram. `PRACTICE_TEST_BROWSER=chrome pnpm test` falhou ao iniciar Chrome headless (SIGABRT/EPERM), depois de core/web/SQLite; não aprovado como suíte completa. IndexedDB real não repetido, sem mudança de armazenamento. `git diff --check` passou.
- Chrome conectado com harness sintético ignorado pelo git: A4 cinco posições, E2 uma, silêncio/parada zero, permissão negada e recuperação, seleção independente, Home/End/Enter sem mudar BPM. Desktop1440 e móvel390, claro/escuro, sem overflow externo ou erros no console observados. Capturas finais `target/qa-yin/final-*.jpg`, cobrindo controles/grade/resultado em slices devido ao main com rolagem interna. Revisão independente **ship**, com copy e cobertura corrigidas; documentação conferiu sistema existente sem mudar PRODUCT/DESIGN/tokens. Launcher e detector recusados por permissão, conferência manual. Não é teste de microfone físico ou WebView nativo.
- Bundle compilado de 16,14 MiB: `target/release/bundle/macos/Prática.app`. Esta nova versão não substituiu a de Aplicativos e não foi publicada. Site/main continuam em `95b9053`; checkout HEAD `26749d9`/índice bloqueado, comparar com remoto antes do próximo push para preservar publicações anteriores. Nenhum backup alterado.
- Como testar: abrir o bundle acima → Ferramentas → selecionar entrada/canal no Afinador → Braço → Seguir notas do afinador → Ligar entrada. Tocar uma nota por vez com fones, comparar oitavas/posição e desligar. Também disponível ao expandir Ver no braço completo num acorde da música. Instruções/limites em `docs/13-notas-captadas-no-braco.md`.
- A 3C permanece parcial: próximos blocos são cromagrama experimental e avanço pelo metrônomo. Pendentes físicos: confirmar som no iPhone após correção publicada, qualidade YIN com guitarra/interface/ruído, permissões/canais/buffers/reconexão, atraso real/tema nativo, Safari/iPhone, iCloud entre dois Macs e Laboratório YouTube153/Spotify (Client ID próprio, redirect `http://127.0.0.1/callback`). Amp A0 depende de modelo/interface/loopback. Fase 4 não iniciada.

## Publicação de acordes na cifra e braço autorizada (23/11/2026)

- Resultado confirmado: main em `95b9053106d903eb1bf04e890431c69ebee9de32`, com implementação `71562b5` e documentação `95b9053`. Pages **45275065727** concluiu testes do core, build:web e deploy com sucesso. Conferidos 62 arquivos locais contra os blobs publicados, sem divergências antes deste comprovante. Registro pós-deploy acrescentado somente ao STATUS local para evitar outro deploy apenas pelo recibo.
- Pedro autorizou o push. Comparação com a main `bbfd182` identificou 17 arquivos diferentes, preservando os arquivos já publicados e os backups. Implementação em `71562b53a137d4bfad2148d7b3d540d741ba1e9f` (acordes na cifra, capo, partitura e braço interativo); documentação em commit separado. Main será atualizada com conferência do SHA-base e sem force.
- Verificações executadas nesta entrega estão detalhadas abaixo: 166 testes core, 36 Rust, contrato SQLite 17, testes web controlados, typecheck e builds web/app passaram; a suíte global aborta no Chrome headless do sandbox. O app com esta versão já está instalado em `/Applications/Prática.app`. Nenhum novo build ou teste físico foi alegado nesta publicação.
- Após o push, conferir build e deploy do Pages. A 3C continua parcial: YIN no braço, cromagrama e avanço pelo metrônomo ainda pendentes. Confirmar áudio no iPhone após a correção já publicada.

## 3C, primeiro bloco: braço interativo instalado no Mac (23/11/2026)

- Concluída a substituição pendente do app com acordes na cifra e, ao fim desta rodada, instalada a nova versão com braço em `/Applications/Prática.app`. Bundle de 16,14 MiB, três arquivos conferidos por SHA-256 sem divergências. Backups preservados em `target/app-backups/Pratica-antes-acordes-na-cifra-20261123-162819.app` e `Pratica-antes-braco-20261123-185052.app`. Bancos e logs não foram alterados pela cópia.
- Ferramentas ganhou Braço: seis cordas em afinação padrão, casas 0–24 (150 posições SVG), todas as notas, destaque de acorde ou cinco escalas (maior, menor natural, pentatônicas menor/maior e dórica), opção de bemóis. Fundamental com contorno, seleção preenchida. Uma nota por corda: nova casa substitui, repetir desmarca. Ouvir seleção usa a prévia existente, referência A4 e saída escolhidas, ganho inicial 40%, sem autoplay. Não é gerador de digitações confortáveis.
- `fretboard-explorer.ts` no core concentra mapa, grafia/oitavas, intervalos, seleção, frequências e identificação exata por 18 sufixos. Mostra inversões pelo baixo MIDI real e nomes alternativos (C6/Am7/C), sem completar notas ausentes. Resultados limitados ao catálogo declarado, sem análise de microfone nesta entrega. Nenhuma dependência, tabela, evento ou arquivo de áudio novo.
- No acorde explorado em Músicas, Ver no braço completo abre as casas reais, já convertidas pelo capo; Repor forma da cifra restaura a seleção. C com capo 2 foi conferido como D; trocar para C/E atualizou para D/F#. Seleção manual não modifica cifra, revisão ou sequência e não cria tablatura. Ao fechar/ocultar/navegar, a prévia do painel é interrompida.
- Teclado: um tab stop na grade, setas por corda/casa, Home/End nas casas 0/24, Enter/Espaço seleciona. Eventos não acionam atalhos do BPM. No celular, a rolagem horizontal fica no canvas e mantém as células em 52×48 px. O mapa não é comprimido em 390 px.
- Verificações finais: **166 core**, **25 audio-engine + 11 practice-store**, **17 contrato SQLite**, typecheck, build:web e build:app passaram. Suíte controlada web de captura/prévia/sequência/SW passou. `PRACTICE_TEST_BROWSER=chrome pnpm test` abortou Chrome headless com SIGABRT/EPERM após essas etapas; não aprovado como comando global. Contrato IndexedDB real não repetido, pois adaptadores/esquemas não mudaram.
- Chrome conectado: C/C-E por seleção, escala pentatônica, seleção/desmarcar/repor, rolagem e foco nas casas 0/24, teclado sem mudar BPM, integração de capo na cifra. Corpo móvel390 sem overflow; oito capturas em `target/qa-fretboard/`, desktop1440/móvel390 claro/escuro. Console sem erros no fluxo observado. Revisão independente **ship**, sem achados materiais; documentador conferiu sistema existente, preservando PRODUCT/DESIGN/tokens. Launcher/detector bloqueados por permissão, revisão manual. Não alegada escuta física nem teste Safari.
- Como testar: abrir Prática em Aplicativos → Ferramentas → Braço. Escolher Acorde/C, Usar uma forma e Ouvir seleção; clicar em outras casas, testar escalas e teclado. Em Músicas, clicar num acorde de cifra salva e expandir Ver no braço completo. Detalhes em `docs/12-braco-interativo.md`.
- **A 3C ainda não terminou:** próximos blocos são seguir notas do YIN no braço, cromagrama experimental e avanço da cifra pelo metrônomo. Não implementados nem simulados aqui. Fase 4, tabs por URL, companion e avanço do Amp continuam fora desta entrega. Sem push/publicação nova; site/remoto permanece `bbfd182`. HEAD local `26749d9` e índice bloqueado, comparar com o remoto antes de publicar.
- Pendentes físicos: confirmar áudio no iPhone após correção já publicada; ouvir prévias/bateria/seleção no Mac/Safari/celular, testar afinador/interface/canal/buffer/reconexão, atraso real/tema nativo, iCloud entre dois Macs e Laboratório YouTube153/Spotify (Client ID próprio, redirect `http://127.0.0.1/callback`). A0 ainda depende de modelo/interface/loopback.

## Acordes interativos dentro da cifra implementados localmente (23/11/2026)

- Em Músicas, clicar no acorde inline ou no diagrama abre som de referência, pauta, baixo/inversão e até seis formas validadas. Tocar manual, Som ao selecionar, volume e estado sem forma disponível. Abrir por teclado leva foco ao título; Fechar devolve ao acorde inline. Comparação de conflito e prévia do importador continuam como documentos sem botões de áudio.
- Adicionar à sequência copia a forma exata para o rascunho compartilhado, sem substituir os blocos existentes; Abrir sequência navega ao editor, onde o usuário salva por eventos. Teto de 16 blocos preservado. Não grava prática nem altera cifra/revisões pela exploração. Navegar/ocultar/transpor/trocar revisão ou capo encerra a prévia; remontagem sem autoplay.
- `chordAtCapo` no core valida e converte casas, pestana e nome reais. Diagrama relativo ao capo, som/pauta em altura real; sequência recebe casas absolutas. Exemplo: C com capo 2 vira D no sequenciador. Grafia usa a regra existente de tom com bemóis/sustenidos, preservando nome sem capo. Capo explícito da música vence a diretiva da cifra; editor distingue Da cifra, Sem capo (zero explícito) e casas 1–12. Nenhum esquema/evento novo.
- Verificações finais: **152 testes core**, **25 audio-engine + 11 practice-store**, **17 contrato SQLite**, captura/prévia/sequência/SW em APIs controladas, typecheck/build:web, build:app e `git diff --check` passaram. Teste de capo cobre o catálogo, inversões, pestana, imutabilidade e equivalência das frequências com a sequência. `PRACTICE_TEST_BROWSER=chrome pnpm test` passou pelas etapas anteriores e abortou Chrome headless com SIGABRT/EPERM; não aprovado como comando global. IndexedDB em Chrome real não foi repetido nesta etapa, que não mudou adaptadores/esquemas; salvar música com capo zero foi exercitado pela UI local.
- Chrome conectado: cifra sintética com texto neutro; C/capo2 em D, C/E em D/F# com forma alternativa adicionada à sequência, transposição Db/capo2 em Eb, C/G/capo3 em Eb/Bb, origem do capo/zero explícito, acorde sem forma, som automático desligado/Tocar com Espaço, retorno de foco e navegação. Oito capturas em `target/qa-songchords/`, desktop1440/móvel390 claro/escuro; sem overflow horizontal fora da faixa de diagramas, que rola de propósito. Revisão independente **ship**, sem correções materiais. Sistema visual preservado; documentador conferiu a extensão sem mudar DESIGN/PRODUCT. Launcher/detector bloqueados por permissão, conferência manual. Console sem erros no fluxo observado.
- Bundle local: `target/release/bundle/macos/Prática.app`, **16,14 MiB**. Sem commit/push/publicação desta nova extensão e sem substituição de Aplicativos. Remoto continua `bbfd182`, com bateria e correção iPhone publicadas; HEAD local permanece `26749d9`, índice bloqueado. Comparar com o remoto antes de publicar para não reenviar alterações antigas como novidade.
- Como testar: abrir o bundle local ou rodar `pnpm web --host 127.0.0.1`. Músicas → música com cifra → clicar acorde → alternar baixo/forma → Tocar acorde → Adicionar à sequência → Abrir sequência. Salvar a sequência para manter. Experimentar capo explícito e da cifra, transpor, fechar e usar teclado. Detalhes em `docs/11-acordes-na-cifra.md`.
- Pendente: confirmação do Pedro de que o áudio voltou no iPhone após o deploy anterior; escuta física desta extensão, timbre/estalos, Safari/celular e iCloud em dois Macs. Permanecem afinador/interface, medição de atraso/tema nativo e Laboratório YouTube153/Spotify (Client ID próprio, redirect `http://127.0.0.1/callback`). Próximo bloco de produto: planejar e implementar braço completo 3C; Amp A0 ainda aguarda modelo/interface/loopback. Fase 4, tabs por URL e companion não iniciados.

## Publicação de bateria, sequências e correção iPhone autorizada (23/11/2026)

- Resultado confirmado: main em `bbfd182016bc4dba07d61bfd6a7e569cb25b6b6c`, com `ef3d1ce` (bateria/persistência), `eefee07` (iPhone) e `bbfd182` (documentação). Pages **45242995483** concluiu build e deploy com sucesso, incluindo 149 testes core. Conferidos 52 arquivos locais contra os blobs publicados, sem divergências antes deste registro pós-deploy. Este resultado foi acrescentado somente ao STATUS local para não disparar outro deploy só pelo comprovante. Captura em `target/qa-publish/pages-success.png`.
- Pedro autorizou enviar as três entregas à main. Arquivos comparados com o remoto `05f2bbb`; só diferenças novas entram na publicação, preservando backups e histórico. Commits de implementação: bateria/persistência `ef3d1ce`, correção de sessão iPhone em commit separado e documentação por último. Atualização da main com SHA-base conferido e sem force. Deploy Pages será acompanhado após a atualização.
- Ao receber o deploy: abrir `https://pedronogueira.dev/pratica/` no iPhone, aceitar a atualização do app se aparecer e tocar Começar no metrônomo. Testar também acordes, sequência e bateria, com Silencioso ligado/desligado. Não limpar os dados do site. O teste físico continua pendente até confirmação do Pedro.
- A publicação não substitui o app em Aplicativos. Bundle local da bateria continua em `target/release/bundle/macos/Prática.app`. HEAD/índice locais continuam nas condições registradas abaixo; preservar os arquivos ao sincronizar este checkout.

## Correção local para áudio silencioso no iPhone (23/11/2026)

- Pedro relatou silêncio no site pelo iPhone, incluindo metrônomo e demais sons. Causa física ainda não confirmada. O motor não declarava categoria de sessão; no iOS, Web Audio ambiente pode obedecer ao Silencioso mesmo com o relógio rodando. Referência WebKit: https://bugs.webkit.org/show_bug.cgi?id=251532 e https://bugs.webkit.org/show_bug.cgi?id=252746.
- `web-engine.ts` agora declara `navigator.audioSession.type = playback` quando disponível, antes de criar/retomar o contexto. Afinador usa `play-and-record`, voltando a playback ao encerrar. API ausente ou setter não suportado não bloqueiam o áudio. A categoria musical pode interromper áudio de outro app conforme a política do iOS; não é garantia de mistura com música externa.
- `resume()` começa antes do await de `setSinkId`, preservando o gesto do usuário; cada novo início repete a retomada, inclusive após interrupções. Não há autoplay ou captura nova. Não afirma resolver todos os bugs de retorno do segundo plano do Safari.
- Testes controlados de captura/prévia/sequência passaram, incluindo categoria antes de resume, resume antes de selecionar saída, cancelamento durante seleção, fallback sem Audio Session e retorno da categoria após captura. Build:web/typecheck e `git diff --check` passaram. Não testado em iPhone físico. Sem mudança Rust, banco ou UI; não repetidos testes Rust nesta correção.
- A correção ainda está local, junto da bateria não publicada. Para validar imediatamente no site atual: tirar o iPhone do Silencioso, aumentar o volume de mídia, conferir destino Bluetooth/AirPlay e abrir novamente o site. Depois da publicação autorizada: recarregar/aceitar atualização, testar metrônomo e acorde com Silencioso ligado/desligado, sair e voltar ao Safari e tocar novamente. Não apagar dados do site, pois isso remove registros locais.

## Bateria e sequências salvas implementadas localmente (23/11/2026)

- Oito padrões originais em 4/4: Rock, Reggae, Indie rock, Metal, Ska, Afrobeat, bumbo simples e bumbo/chimbal. Cinco sons sintetizados, sem samples de terceiros. Bateria sozinha ou com acordes; volumes de acordes, clique e bateria ajustáveis ao vivo, mute independente, ritmo trocado no próximo compasso. Grade da bateria não reinicia a cada volta dos acordes. BPM compartilhado, uma saída/AudioContext. Em outro compasso, exige escolha explícita de 4/4.
- Painel Acompanhamento em Ferramentas e no exercício; usa bateria/clique sem tocar os acordes do rascunho. Sair/ocultar interrompe. Em Acordes → Sequência: salvar por nome, carregar, novo rascunho e remover das salvas por tombstone. Guarda formas exatas, tempos, BPM e mixer. Recupera a salva mais recente ao abrir sem autoplay; mudanças não salvas continuam só na sessão.
- `sequence.saved` no PracticeStore, LWW por data/ID, tabela `sequences`: SQLite user_version **3**, IndexedDB `pratica.v1` versão **4**. Migrações aditivas, validação estrutural nativa e validação musical no core/repositório, exportação/importação JSON e fila de eventos desconhecidos preservada. Testada a reprojeção de sequência adiada nos dois bancos. Atualizar os dois Macs antes de sincronizar: o app antigo não abre SQLite já migrado. Banco/PCM não vão ao iCloud.
- Verificações finais: **149 testes core**, **25 audio-engine + 11 practice-store**, **17 contrato SQLite**, **18 IndexedDB no Chrome real**, typecheck, Clippy `-D warnings`, build:web e build:app passaram. Teste de processamento Rust contou zero alocações/liberações em reprodução/troca/mute. Suíte web controlada passou captura/prévia/sequência/bateria/SW. `PRACTICE_TEST_BROWSER=chrome pnpm test` abortou ao iniciar Chrome headless (SIGABRT/EPERM); não foi aprovado como comando global, embora o contrato tenha passado separadamente no Chrome conectado. `git diff --check` passou.
- UI executada: salvar/carregar/reabrir sem autoplay, bateria sem acordes, mixer por teclado, troca de ritmo, proteção 4/4, parada ao navegar e uso durante exercício. Desktop1440 e móvel390, claro/escuro, sem overflow horizontal. Oito capturas em `target/qa-drums/`. Revisão independente pediu campo de nome temático e copy contextual; ambas corrigidas e pontuadas **resolved**, disposition **ship**, sem regressões observadas. Documentação conferiu a extensão do sistema existente, sem mudar tokens/DESIGN/PRODUCT. Launcher/detector bloqueados por permissão; conferência manual.
- `.app` final: `target/release/bundle/macos/Prática.app`, **16,14 MiB**. Esta entrega permanece local; a cópia em Aplicativos e o site continuam na entrega anterior. Nenhum push/merge/publicação desta rodada. HEAD local continua `26749d9`, índice bloqueado; remoto da entrega anterior `05f2bbb`. Há arquivos já publicados misturados no diff local, preservar ao sincronizar e não reenviar tudo como novidade.
- Como testar: abrir o bundle acima; Acordes → Sequência → Ativar bateria → escolher ritmo → Ouvir em loop. Comparar volumes e clique, trocar ritmo e BPM. Adicionar acordes da Biblioteca, salvar com nome, fechar/reabrir e conferir forma/mixer sem som automático. Experimentar também Ferramentas e o painel no exercício. Web: `pnpm web --host 127.0.0.1`. Detalhes em `docs/10-bateria-e-sequencias-salvas.md`.
- Pendente: escuta física dos oito ritmos, equilíbrio/timbre/estalos, carga/latência real e teste longo de sincronismo, Safari/iPhone real, movimento reduzido e iCloud entre dois Macs. Permanecem afinador/interface/permissão/canal/buffer/reconexão, medição de atraso/tema nativo, YouTube153 e Spotify no Laboratório (Client ID próprio e redirect `http://127.0.0.1/callback`). Amp A0 precisa de interface/modelo/loopback. Fase 4, importação de tabs por URL e companion não iniciados.

## Sequenciador entregue e app substituído em Aplicativos (23/11/2026)

- Terceira aba **Sequência** em Acordes: adicionar a forma exata da Biblioteca, até 16 blocos, 1/2/4/8 tempos, repetir, subir/descer, remover e ouvir em loop. Acordes com volume próprio e clique opcional, ajustados antes de tocar. BPM global editável durante reprodução. Parar encerra também o metrônomo; sair da sequência ou ocultar a página interrompe. Nenhum autoplay.
- `chord-sequence.ts` no core valida/compila formas e durações. No Mac, `sequence.rs` usa plano fixo e tempos do metrônomo; ataques no frame correto do bloco, uma única saída, callback sem alocação/lock/I/O e descarte do controle fora dela. No web, buffers preparados e lookahead no relógio do AudioContext; parada cancela sons agendados, troca limita caudas e pausa longa encerra em vez de tocar atrasados em rajada. `runId` separa execuções nos eventos e na UI.
- Rascunho em memória durante a sessão, preservado entre abas e telas. **Fechar/recarregar perde os blocos**; aviso na tela. Salvar por eventos e recuperar sem autoplay é o bloco de persistência previsto depois da bateria. Não foi introduzido armazenamento paralelo nem registro automático de prática.
- Checks finais: **139 testes core**, **22 audio-engine + 10 practice-store**, teste controlado do sequenciador web, typecheck, Clippy com `-D warnings`, build:web e build:app passaram. `PRACTICE_TEST_BROWSER=chrome pnpm test` passou por core, captura/prévia/seq web, SW controlado e SQLite15; Chrome headless abortou no sandbox (SIGABRT/EPERM), portanto suíte completa/IndexedDB em browser real continuam sem aprovação desta rodada. `git diff --check` passou.
- UI executada no Chrome conectado: vazio, adicionar inversão, repetir/reordenar/remover, durações, BPM por teclado, play/stop, clique mudo e parada ao sair; rascunho mantido após navegação. Claro/escuro em 1440 e 390 px, sem overflow horizontal. Revisão independente **ship**, sem correções materiais, com seis capturas válidas em `target/qa-sequence/`. Documentação conferida pelo agente principal após falha do documentador delegado; preservados DESIGN/tokens existentes. Launcher/detector indisponíveis por permissão, revisão manual.
- `pnpm build:app` final gerou bundle de **16,10 MiB**. Substituição de `/Applications/Prática.app` autorizada pelo Pedro e executada pelo Finder; três arquivos do bundle conferidos por SHA-256, sem divergência do build. Cópia anterior: `target/app-backups/Pratica-antes-sequenciador-20261123-091710.app`. Não foi apagado backup do Pedro nem alterado banco/log.
- Para testar: abrir **Prática em Aplicativos**, ir a Acordes, escolher uma forma/baixo e clicar Adicionar à sequência. Repetir com outro acorde, abrir Sequência, escolher tempos e Ouvir em loop. Testar BPM, clique desligado e Parar loop. Web local: `pnpm web --host 127.0.0.1`; para testar o publicado, aguardar a execução do Pages referente ao push desta entrega.
- Push desta entrega autorizado explicitamente ao concluir. Commits preparados: `ec56f1d` (regras e motores) e `ba7e061` (interface e testes), seguidos pelo registro desta documentação; atualização da `main` por fast-forward com conferência do SHA-base `0ba3a83`. Conferir o resultado do Pages no commit remoto final. Índice Git local continua bloqueado; HEAD local ainda `26749d9`, com arquivos de publicações anteriores já no diretório. Não reenviar tudo como novidade; preservar arquivos ao sincronizar este checkout.
- Próximo bloco: **bateria de acompanhamento**, depois persistência e integração. Fase 4, importação de tabs por URL, companion e próximos blocos do Amp não iniciados. Áudio físico, Safari/iPhone real e testes anteriores continuam pendentes: afinador/interface/permissão/canal/reconexão, medição de atraso/tema nativo, iCloud entre dois Macs, YouTube153 e Spotify no Laboratório (Client ID próprio, redirect `http://127.0.0.1/callback`).

## Inversões e formas alternativas entregues localmente (23/11/2026)

- Publicação autorizada pelo Pedro: `4ef6f24` (som/partitura) e `0ba3a83` (documentação e plano), em fast-forward na `main`, sem PR ou merge necessário. GitHub Pages concluiu com sucesso: execução `45163157994`. A gravação do índice Git local está bloqueada pelo sandbox; os commits foram publicados pelo conector. **O HEAD local permanece em `26749d9`**, embora os arquivos publicados estejam no diretório. Não reenviar o diff inteiro como se fosse inédito; sincronizar o checkout com cuidado antes de commitar fora deste ambiente, preservando os novos arquivos locais desta etapa.
- Próxima etapa executada: `packages/core/src/chord-options.ts` oferece variações harmônicas, baixos/inversões pela grafia dos graus e até seis formas únicas, combinando tabela e geração. `chordNoteName` compartilha a grafia da partitura. Cada forma passa por `chordVoicing`, incluindo baixo MIDI real; formas inconsistentes não são oferecidas.
- Acordes ganhou seletores Variação, Baixo / inversão e Posição no braço. Trocar variação retorna ao baixo fundamental e à primeira forma; trocar baixo retorna à primeira forma. Diagrama, som, pauta e Treinar troca usam o acorde selecionado. Repetir o cartão aberto conserva a seleção atual. Escolhas são da sessão, não criam eventos de prática.
- Limites: geração existente até a casa 13, quatro dedos e janela de quatro casas; não garante todas as posições/inversões possíveis. Nomes de inversão com acidentes duplos não são oferecidos pelo parser atual. Baixo explícito informado pelo usuário é preservado mesmo fora dos graus do acorde. Sem forma válida, a interface avisa e não toca. Conforto de digitação e áudio físico precisam de conferência do Pedro.
- Validação desta etapa: **136 testes do core**, typecheck e build:web passaram. Testes Rust separados: **20 audio-engine + 10 practice-store** passaram. `PRACTICE_TEST_BROWSER=chrome pnpm test` passou pelo core, captura/prévia web, SW controlado e SQLite15; Chrome headless abortou no sandbox (SIGABRT/EPERM), portanto a suíte completa não foi aprovada. Não houve mudança Rust depois da rodada separada. `pnpm build:app` passou; `.app` em `target/release/bundle/macos/Prática.app` (16,07 MiB). `git diff --check` passou.
- UI no Chrome conectado: C/E em duas posições; troca para Cm/Eb e Tocar com Espaço; seletores nos temas claro/escuro em desktop1440 e móvel390; nenhum overflow horizontal no móvel. Revisão visual independente: **ship**, sem correções materiais. Seis capturas válidas em `target/qa-inversions/`. Launcher/detector visual bloqueados por permissão, conferência manual; não foi alegado teste de áudio físico ou Safari real.
- Como testar: abrir o `.app` recém-compilado; em Acordes, escolher C, alternar Variação, Baixo / inversão e Posição no braço, e conferir o som e as notas da pauta. Experimentar C/E, C/G, Cm/Eb e C7/Bb. Web local: `pnpm web --host 127.0.0.1`, sem depender do deploy da etapa anterior. **As inversões ainda não foram publicadas.**
- Próxima entrega: transporte e sequência de acordes em loop, depois padrões de bateria e persistência. Não iniciados nesta etapa. Continuam pendentes os testes físicos anteriores: afinador/interface, atraso e tema nativo, celular real, iCloud em dois Macs, YouTube153 e Spotify no Laboratório (Client ID próprio; redirect `http://127.0.0.1/callback`). Amp A0 ainda precisa de modelo real/interface/loopback. Fase 4 não iniciada.

## Planejado: inversões, sequenciador e bateria (23/11/2026)

- Registrados os novos pedidos do Pedro em `docs/08-acordes-sequenciador-e-bateria.md` e nos requisitos: inversões, formas alternativas e variações harmônicas; sequência editável de acordes em loop; bateria com liga/desliga, estilos rock, reggae, indie rock, metal, ska, afrobeat e loops simples.
- Proposta de três volumes independentes (acordes, bateria e metrônomo), um relógio/BPM e saída compartilhados no Mac/web, padrões e síntese originais locais, uso de bateria sem sequência e persistência por eventos. O documento separa regras, motores, integração e testes em quatro entregas.
- Esta rodada alterou somente documentação; os novos controles e sons ainda não existem. Preservada a implementação local anterior de som/partitura e a interface que o Pedro está ajustando. Sem commit ou push. A0, importação por URL e Fase 4 não avançaram.
- Verificação: `git diff --check`. Não foram repetidos testes ou builds por não haver mudança executável nesta rodada; os resultados abaixo pertencem à entrega anterior. Para testar as novas funções, aguardar a implementação de cada entrega.

## Acordes: prévia sonora e partitura implementadas (23/11/2026)

Entrega autorizada pelo Pedro enquanto prepara a interface de áudio para a A0. Implementada localmente sobre `26749d9`; sem commit/push desta rodada. A0/A1/TONE3000 e Fase 4 não foram iniciadas ou aprovadas por esta extensão.

### O que mudou

- Biblioteca Acordes: clicar ou usar Enter/Espaço no cartão seleciona e toca uma prévia; repetir o cartão mantém o detalhe aberto e repete a forma atual. Botão Tocar, seletor de formas, opção Som ao selecionar e volume. Fechar/navegar/ocultar aba interrompe. O volume começa em 50% de um ganho de síntese já limitado; preferências são da sessão da biblioteca e voltam ao padrão ao remontar a tela.
- Diagrama, som e partitura partem da mesma forma validada. `fretMidi` e `chord-voicing.ts` no core calculam as alturas reais, grafia por grau, frequências segundo o A4 do afinador e posição escrita da guitarra uma oitava acima. Respeita baixo/inversão, cordas abafadas/soltas e oitavas; rejeita formas inconsistentes. Uníssonos iguais escritos uma vez, cordas mantidas na síntese.
- Som de referência original: senoidais com parciais limitadas à taxa de amostragem, envelope/decaimento, até seis vozes e duração de 1,4 s. Sem samples ou dependências novas. Nova prévia substitui a anterior com transição curta; não registra prática ou eventos.
- Mac: `preview.rs` e comandos Tauri `chord_preview`/`chord_preview_stop`. A saída do metrônomo é compartilhada com a prévia, inclusive ao iniciar/parar o metrônomo. Estado e descarte do stream ficam no controle, com tempo para encerrar a cauda. Callback com scratch fixa em blocos, teto de soma e banco de clique pendente quando a fila de descarte enche, evitando liberar o banco nela. Seleção explícita de saída perdida retorna erro; não faz fallback silencioso. Medir atraso pede parar também a prévia e aguardar seu encerramento.
- Web: um AudioContext compartilhado; gesto do usuário inicia/resume, geração cancela pedidos antigos ainda aguardando resume, no máximo prévia atual e cauda, desconexão ao terminar e limitador da soma na saída. Não solicita microfone. Prévia preserva a saída do metrônomo em execução.
- Partitura SVG local: clave de sol da guitarra com oitava indicada, acidentes simples/duplos, linhas suplementares, espaçamento de notas vizinhas e colunas de acidentes. Notas que soam também em texto e descrição acessível. Sem inferir ritmo, compasso ou BPM. Símbolo musical da clave usa fallback nativo; nenhuma fonte ou biblioteca adicionada.
- Mantidos tokens e componentes existentes. Diagrama/pauta lado a lado no desktop, empilhados em 390 px; diagramas da grade limitados ao cartão no celular. Botão novo com contraste ajustado localmente, sem mudar os botões de outras telas.

### Verificado nesta sessão

| Verificação | Resultado |
|---|---|
| `pnpm --filter @gx/core test` | **119 testes passaram** (16 novos) |
| `cargo test -p audio-engine -p practice-store` | **20 + 10 passaram** |
| Clippy audio-engine, incluindo testes | Passou com `-D warnings` |
| Teste da prévia web (`test/chord-preview.mjs`) | Passou: cancelamento antes de resume, repetição rápida, vozes limitadas, desconexão, teto de saída, um contexto com o metrônomo e nenhum pedido de microfone |
| `pnpm typecheck` | Passou |
| `PRACTICE_TEST_BROWSER=chrome pnpm test` | Core119, captura web, prévia web, SW controlado e contrato SQLite15 passaram; abertura de outro Chrome foi bloqueada no sandbox (SIGABRT/EPERM), portanto suíte completa não aprovada |
| `pnpm --filter desktop build:web` | Passou |
| `pnpm build:app` | Passou; `.app` em `target/release/bundle/macos/Prática.app` |
| Chrome real via navegador conectado | Desktop1440/390 px, claro/escuro, teclado com Espaço no cartão sem fechar detalhe, troca de formas de Db7M alterando notas da pauta, prévia automática desligada com Tocar manual, forma indisponível com Tocar desabilitado, sem alerta de áudio nos fluxos testados e sem overflow horizontal |
| Revisão visual externa | **ship**, sem correções materiais no acréscimo; seis capturas válidas em `target/qa-chords/`, com topo e continuação da pauta no celular |
| `git diff --check` | Passou |

A interação foi executada no Chrome conectado porque o processo headless foi bloqueado. Não foi afirmada escuta física do sinal: faltam conferir volume percebido, qualidade/estalos em saída real, mistura no CoreAudio e uso no Safari/iPhone real. Não foi feito teste completo com leitor de tela nem teste novo de offline em navegador real. As capturas são do app local via Vite; builds finais feitos depois, sem alterações visuais posteriores. Os ajustes finais de controle/encerramento no adaptador nativo não alteram o render revisado.

### Como testar

- **Web local:** `pnpm web --host 127.0.0.1` na raiz; abrir o endereço informado. A aba de revisão desta sessão usa `http://127.0.0.1:4178/`. Em Acordes, clicar E ou C, repetir, experimentar Db7M e trocar Forma1/2/3. Conferir som e pauta; desmarcar Som ao selecionar e testar Tocar. Abrir sem rede só depois de validar o build:web preparado com service worker.
- **Mac:** abrir o `.app` recém-compilado em `target/release/bundle/macos/Prática.app` ou substituir manualmente a cópia antiga. Conferir a saída em Ajustes, usar Acordes e começar/parar o metrônomo alternando com prévias. Não há painel Amp nesta entrega.
- Detalhes de decisões e limites em `docs/07-acordes-som-e-partitura.md`.

### Próximas pendências

- Pedido futuro de importação de cifra/tab por link registrado nos requisitos e em `docs/06-fase-3-plano.md`. Exige pesquisa de API/licença/formatos por serviço e aprovação antes de integrar; não foi implementada raspagem nem prometida compatibilidade universal.
- Reuso da prévia em cifras/exercícios fica para outra entrega. Braço completo/cromagrama da 3C permanece pendente da validação da 3B e de planejamento do próximo bloco. Músicas não ganhou tabs rítmicas nesta sessão.
- A0 ainda exige `.nam` real, interface e loopback físico. Permanecem pendentes os testes anteriores: afinador real (dispositivo/permissão/canal/buffer/reconexão), medição de atraso e tema nativo, UI em celular real/teclado/movimento reduzido, iCloud entre dois Macs, YouTube153 e Spotify no Laboratório (redirect `http://127.0.0.1/callback`, Client ID próprio).

## Backlog de Acordes: som e partitura (23/11/2026)

- Pedido futuro do Pedro registrado em `docs/07-acordes-som-e-partitura.md`, nos requisitos e no plano da Fase 3: clicar para ouvir o acorde e ver a forma selecionada como partitura. Sem alteração da interface ou implementação nesta sessão.
- Proposta: mesma fonte de alturas para diagrama, áudio e pauta, respeitando cordas/casas, oitavas, baixo/inversão e cordas abafadas. Clicar novamente repete a prévia; fechamento fica separado. Timbre, convenção de notação, renderizador e prioridade ainda serão combinados antes de começar.
- A bancada A0 foi publicada em três commits até `65320e2`; o checkout local já foi sincronizado fora desta sessão e está em `26749d9`, com a alteração posterior de alvos de toque no celular preservada.
- Conferência desta sessão: nenhum `.nam` real encontrado no projeto fora das pastas geradas/dependências e `list` da bancada continua sem dispositivos expostos. A medição física da A0 segue pendente; não foram repetidos benchmarks nem atribuídos resultados de áudio ao vivo.
- Verificação desta rodada: documentação conferida e `git diff --check`. Sem mudanças executáveis, sem nova rodada de testes/builds. Sem commit ou push desta documentação.

## Amp A0: paridade C++ executada, teste físico pendente (22/11/2026)

Continuação da bancada A0. O Core C++ agora foi compilado e executado neste Mac ARM64. **A A0 ainda não está aprovada para avançar ao pedal**: falta o modelo real e o caminho físico de áudio, e o benchmark offline registrou pausas acima do prazo. A interface Amp, a versão web e o TONE3000 continuam fora desta entrega. Os commits locais mais recentes de ícone/instalação do webapp foram preservados. O Pedro autorizou o envio da bancada ao GitHub em 22/11. O índice Git local está bloqueado neste ambiente; a publicação usa o conector do GitHub e o checkout local continua pendente de sincronização.

### O que mudou

- Compilação da referência NeuralAmpModelerCore v0.6.0 (`0b3d3c97b0859a3a8c92a8628c4dd89a25eb5842`). A rede do Terminal continuou bloqueada; as fontes foram obtidas pelo conector GitHub, com **466 blobs conferidos por hash Git**, incluindo as dependências nos commits fixados. Cópia em `target/amp-a0/core-source-0b3d3c9/` e manifesto em `target/amp-a0/source-manifest.json`, ambos ignorados. Não houve alteração no código upstream para compilar.
- Referência genérica, sem A2-fast e sem prewarm no reset, com buffer explícito 64/128. O comparador Rust aceita o mesmo buffer e reporta qual usou. Tolerância permanece 1e-5, descartando o receptive field inicial do WaveNet.
- Dois modelos A2 sintéticos novos, com pesos gerados pelo projeto, exercitam GATED/BLENDED, FiLM, convolução agrupada, bottleneck e head de dois taps. Nenhum `.nam` de terceiros ou arquivo de áudio foi adicionado ao repositório.
- `bench` ganhou tempo de CPU da thread por bloco, separado do tempo de parede, além de contagem de blocos que atingem/ultrapassam o prazo. Leitura do relógio é apenas no benchmark offline, fora da callback; inclui o custo da instrumentação.
- `scripts/validate-offline.py`: gera fixtures, executa paridade em ambos os buffers e três benchmarks seriados de 10 s por configuração. Relatório com hashes dos binários, modelos e entrada; falhas de execução/paridade separadas de estouros de prazo. Saída 0 sem falhas offline, 1 para execução/paridade/DSP, 2 para prazo. Nunca aprova RTL ou o candidato automaticamente.
- O script de build da referência passa a conferir os commits dos submódulos e recusar alterações nos arquivos versionados das fontes locais. A sintaxe foi conferida; o caminho via `git clone` permanece sem execução por bloqueio de rede. A compilação real desta sessão usou a cópia conferida por blobs com CMake.

### Resultados executados

| Verificação | Resultado |
|---|---|
| Referência C++ e bancada Rust release | Compilaram em ARM64 |
| Paridade Core C++ / nam-rs | **14/14 passaram**: sete modelos em 64/128; erro máximo **1,49e-8**, tolerância 1e-5 |
| Abrangência | LSTM mínimo/H32, WaveNet mínimo/C16, container de submodelos e os dois casos A2. Não prova todos os recursos/formas de arquivo NAM |
| Controle negativo de paridade | Referência alterada foi recusada, código 1 |
| Benchmarks offline | **42 rodadas**, todas sem alocações/liberações no DSP; **9 blocos acima do prazo de parede**, nenhum acima do prazo de CPU da thread |
| Testes da bancada | **6 passaram**, incluindo contagem de estouros e relógio de CPU |
| Testes Rust do app | audio-engine **18**, practice-store **10**, todos passaram |
| Clippy da bancada, incluindo testes | Passou com `-D warnings` |
| `PRACTICE_TEST_BROWSER=chrome pnpm test` | Core **103**, SQLite **15**, captura web e SW controlado passaram. Chrome não iniciou no sandbox (SIGABRT/EPERM); suíte completa não aprovada |
| Build web | `pnpm --filter desktop build:web` passou |
| Build app | `pnpm build:app` passou; bundle em `target/release/bundle/macos/Prática.app` |
| Dispositivos físicos / modelo real | Nenhum dispositivo exposto à bancada (`list` vazio); nenhum `.nam` real fornecido. Sem stream, CPU ao vivo ou RTL físico nesta sessão |

Relatório completo: `target/amp-a0/offline-report.json`. O roteiro terminou com **código 2** por prazo. Nas três repetições por configuração, maiores p99/pico de parede:

| Rede | Buffer | Maior p99 | Pico | Blocos acima do prazo |
|---|---|---|---|---|
| LSTM H32 | 64 | 105 µs | 639 µs | 0 |
| LSTM H32 | 128 | 213 µs | 10.179 µs | 4 |
| WaveNet C16 | 64 | 177 µs | 278 µs | 0 |
| WaveNet C16 | 128 | 318 µs | 20.017 µs | 5 |

Prazos a 48 kHz: 1.333/2.667 µs para 64/128. Picos de CPU da thread ficaram abaixo de 800 µs nas redes maiores. A diferença entre CPU e parede é compatível com preempção/escalonamento de um processo offline, mas **não garante estabilidade nas callbacks CoreAudio**. Nenhum valor acima é latência de ida e volta. Os resultados não autorizam avançar com base apenas no benchmark sintético.

### Repetir e fechar a A0

Na raiz do projeto, o executável da referência e o da bancada já estão compilados:

```sh
python3 experiments/amp-a0/scripts/validate-offline.py \
  --oracle target/amp-a0/oracle-build/pratica-nam-oracle
```

Para testar seu modelo, acrescente `--model /caminho/modelo.nam`. `--input` permite um sinal JSON maior quando o receptive field exceder o fixture. Depois, executar `list`, `monitor` e `bypass` no Terminal do Mac, conferir buffer real, CPU da callback e estabilidade por 10 min, e medir o RTL físico com a montagem de referência simultânea do README. Critério mantido: até 12 ms repetidos, sem erros de stream/fila, alocações ou estouro de prazo e conferência tocando a guitarra. Se falhar, registrar os números e parar. Roteiro completo em `experiments/amp-a0/README.md`.

Sem alterações na interface do Amp nesta continuação. Permanecem os testes manuais anteriores: áudio real do afinador, medição de atraso/tema nativo, UI nos dois temas e celular/teclado/movimento reduzido, iCloud entre Macs e provas de YouTube/Spotify no Laboratório.

## Amp A0: bancada implementada, aprovação de risco pendente (22/11/2026)

Esta sessão começou a fase Amp pela prova A0, separada da Fase 4. **Não há pedal na interface nem aprovação do motor ainda.** As alterações anteriores da 3B foram preservadas; 3C não iniciada. Sem commit, push ou publicação.

### Implementado

- `experiments/amp-a0/`: executável CLI isolado com `list`, `bench`, `render`, `compare`, `monitor`, `bypass` e `analyze-rtl`. Candidato `nam-rs = 0.4.0`, MIT, ainda fora das dependências do app distribuído. A bancada aceita um `.nam` local por execução, sem copiar para iCloud.
- `audio-engine/src/amp.rs` e `amp_io.rs`: entrada e saída cpal na mesma interface externa/taxa, canal selecionado, buffer solicitado de 64/128 e fila rtrb limitada. Carregamento/warmup fora das callbacks. Sem I/O, mutex ou alocação intencional no processamento; contador de heap da bancada cobre a região marcada do host/modelo, não o driver.
- Saída inicial -24 dB, rampa de 20 ms, fade-out ao terminar e teto de amostra -3 dBFS (não é limitador true-peak). NaN/Inf na saída leva a silêncio e encerramento. Bluetooth e dispositivo interno são recusados. Não há fallback para outro dispositivo.
- Relatórios JSON: CPU do processo ao vivo em % de um núcleo, tempos p50/p95/p99/pico, carga do prazo da callback, frames reais, underflow/overflow, reequilíbrio, clipping e alocações/liberações. `stream_checks_passed` exige processamento real e ausência de falhas, alocações e estouro do prazo; retorna código de erro se falhar. `candidate_approved` continua falso, pois o relatório não substitui a prova física/paridade.
- Gerador de modelos e sinais originais: LSTM/A2/WaveNet mínimos com equações independentes, LSTM H32 e WaveNet C16 para estresse, probe WAV e captura sintética de atraso conhecido. Tudo gerado em `target/amp-a0/`, ignorado pelo Git. Nenhum modelo, IR ou áudio de terceiros foi incluído.
- Analisador offline de WAV estéreo de referência/retorno simultâneos, correlação com rejeição de silêncio, baixa confiança e picos periódicos ambíguos. Montagem de loopback documentada no README. Não declara topologia verificada nem deduz RTL pela soma de buffers.
- Host de referência C++ e script fixado no NeuralAmpModelerCore v0.6.0 (`0b3d3c97b0859a3a8c92a8628c4dd89a25eb5842`), preparados para comparação, **ainda não compilados/executados**. Sem troca de modelo, IR, gate, calibração ou mistura com o metrônomo nesta A0; ficam para A1 após aprovação da prova.

### Executado nesta sessão

| Verificação | Resultado real |
|---|---|
| Build release ARM64 da bancada | Passou |
| Testes da bancada | 4 passaram, incluindo equação LSTM em blocos diferentes e controle positivo do contador de heap |
| Rust: audio-engine / practice-store | 18 / 10 passaram |
| Clippy com `-D warnings` | Passou no audio-engine e na bancada, incluindo testes |
| Comparações matemáticas sintéticas | LSTM erro máximo 3,73e-9; A2 1,86e-9; WaveNet mínimo 0; tolerância 1e-5. **Não é paridade com C++** |
| Analisador com captura sintética | Recuperou 321 amostras, correlação 1. Não representa latência física |
| `PRACTICE_TEST_BROWSER=chrome pnpm test` | Core 103, contrato SQLite 15, captura web e testes controlados do SW passaram; falhou ao iniciar Chrome no sandbox (SIGABRT/EPERM). Suíte completa não aprovada |
| `pnpm --filter desktop build:web` | Passou |
| `pnpm build:app` | Passou; bundle em `target/release/bundle/macos/Prática.app`. Não adiciona interface Amp |
| Dispositivos expostos à bancada | Lista vazia neste ambiente. Nenhum stream físico executado |

Benchmarks **offline**, 5 s de sinal a 48 kHz, redes sintéticas sem captura de amplificador:

| Rede / bloco | CPU consumida no processo | p99 / pico de parede por bloco | Alocações/liberações no DSP |
|---|---|---|---|
| LSTM H32 / 64 | 0,408 s | 116 / 151 µs | 0 / 0 |
| WaveNet C16 / 64 | 0,675 s | 426 / 3217 µs | 0 / 0 |
| WaveNet C16 / 128, durante testes/build concorrentes | 0,541 s | 1002 / 27425 µs | 0 / 0 |

O prazo de um bloco a 48 kHz é 1333 µs em 64 frames e 2667 µs em 128. Os picos da WaveNet excederam o prazo, portanto **estes resultados não aprovam execução ao vivo**. São tempos de parede de um processo offline, sujeitos à preempção; não permitem concluir CPU ao vivo, tocabilidade ou desempenho de um amp real. Não avançar para A1/web/TONE3000 com base nesses números.

O crates.io estava sem resolução DNS. A compilação usou uma cópia MIT fixada de `nam-rs` (`6462dd59a927de0cdc3c48cbf1dece51882d7727`) em `target/amp-a0/nam-rs-6462dd5/`, obtida pelo conector GitHub, via override local do Cargo. Fonte/licenças permanecem apenas nessa pasta ignorada. O lock da bancada com path local foi ignorado; não houve alteração do lock de produção. Falta compilar o pacote pelo crates.io e fixar o lock definitivo se o candidato for aprovado.

### Como testar e o que falta

Roteiro completo, comandos de compilação, comparação e montagem de loopback: `experiments/amp-a0/README.md`. O executável compilado é `experiments/amp-a0/target/release/pratica-amp-a0`.

```sh
# Na raiz do projeto, fora do ambiente restrito:
experiments/amp-a0/target/release/pratica-amp-a0 list
experiments/amp-a0/target/release/pratica-amp-a0 bench \
  --model /caminho/do/modelo.nam --frames 64 --seconds 10
experiments/amp-a0/target/release/pratica-amp-a0 monitor \
  --device 'ID_DA_INTERFACE' --model /caminho/do/modelo.nam \
  --input-channel 1 --output-channel 1 --frames 64 --seconds 60
```

Repetir em 128 frames; desativar monitoramento direto, metrônomo/afinador do app e monitoração da DAW. Usar interface externa e fones com fio. Não foi encontrado `.nam` real no projeto. Para fechar A0 faltam: paridade contra C++ em WaveNet/LSTM/A2 e no modelo local, monitor com guitarra, CPU ao vivo, estabilidade de 10 min e RTL físico repetido até 12 ms, com o buffer real conferido. A montagem documentada usa duas entradas/saídas, referência e retorno gravados no mesmo relógio; uma captura sintética não atende ao critério. Se falhar, registrar os números e parar.

TONE3000 permanece sem integração e depende de aprovação dos termos. Presets, migração, interface Amp, WASM/AudioWorklet e unificação do stream do metrônomo não foram implementados nesta prova. Permanecem as pendências anteriores de áudio real, atraso em Ajustes/tema nativo, UI nos dois temas e celular/teclado/movimento reduzido, sync entre Macs e provas YouTube/Spotify no Laboratório.

## Verificação da 3B no Mac e publicação (22/11/2026)
- Rodado no Mac do Pedro antes do push: `PRACTICE_TEST_BROWSER=chrome pnpm test` (core **103**, SQLite **15**, IndexedDB **16** com Chrome instalado), `pnpm typecheck`, `pnpm --filter desktop build:web` e `cargo test --workspace` passaram.
- Continuam **não executados**: `pnpm --filter desktop test:qa:3b` (capturas desktop/390 px nos dois temas, conflitos, playlists, offline, atualização), teste real do service worker no navegador, áudio real, medição CoreAudio, iCloud entre dois Macs e Laboratório (YouTube/153, Spotify). A 3B só deve ser tida como validada depois do `test:qa:3b`.
- A bancada Amp A0 (`experiments/amp-a0`, módulos `amp` no motor de áudio) estava no mesmo diretório de trabalho e **não foi publicada**: ainda aguarda aprovação do Pedro.

## QA da 3B no Mac: navegação móvel corrigida (22/11/2026)

- Pedro executou `pnpm --filter desktop test:qa:3b` no Terminal do Mac. O build passou, o navegador abriu e gerou as quatro capturas de conflito em `target/qa-3b/` às 15:44:54, em 1440/390 px, claro/escuro.
- A execução chegou à busca do botão Ajustes (linha 75 do roteiro anterior), depois das verificações de importação, três pontas, resolução/reabertura e criação/reordenação/reabertura de playlist. Parou em timeout de 30 s porque continuava em 390 px: Ajustes fica dentro de Mais. Não era falha do build nem confirmação de aprovação do QA completo.
- O roteiro agora navega pelas telas pelo menu Telas, abrindo Mais quando necessário; imprime cada etapa e limita a espera de ativação do service worker. Não houve alteração da interface do app.
- As quatro capturas foram abertas nesta sessão. Mostram o cabeçalho e parte da comparação; `fullPage` não percorre o scroll interno de `.main`. O roteiro passou a gerar também capturas de continuação para documentar as versões abaixo da dobra, sem alterar o layout.
- Sintaxe do roteiro e `git diff --check` conferidos. Falta executar novamente para confirmar preparo offline em Ajustes, atualização com duas abas, reload sem rede e as capturas de continuação. A 3B permanece em validação; 3C não iniciada. Sem commit/push.

Repetir no Terminal:

```sh
cd ~/Dev/guitar-exercises-app
nvm use 24
pnpm --filter desktop test:qa:3b
```

## Fase 3B: implementação local, validação no navegador pendente (22/11/2026)

A 3B foi implementada sobre `d62e1f9`. **A 3C não começou**: a conferência renderizada e o offline em navegador real ainda são pendências da 3B. Não houve push, publicação ou alteração dos backups.

### Entregas e decisões
- **3B.1, eventos futuros:** separação entre envelope armazenável e evento projetável no core. Tipos desconhecidos com envelope v1 válido são preservados; tipos conhecidos continuam com validação completa. IndexedDB `pratica.v1` passa de v2 para **v3**, só adicionando `deferred_events`, e reprojeta tipos que já conhece ao abrir. SQLite permanece em `user_version=2`. Evento, projeção e fila continuam transacionais. Abertura bloqueada pede fechar outras abas e não deixa uma conexão rejeitada aberta depois.
- **3B.2, playlists:** alternância Músicas/Playlists, criação, renomeação, exclusão com confirmação, adicionar/tirar músicas e reordenar por botões Subir/Descer. Salvar confirma o rascunho; Cancelar descarta. Rascunho, erro, estado de salvamento e trava ficam no provider, preservados ao navegar. Música apagada aparece como indisponível durante edição e pode ser retirada.
- **3B.3, transferência:** botão Exportar ChordPro na música exporta a revisão atual original, sem a transposição de exibição. A importação de ChordPro/.txt da 3A foi reaproveitada. Área Levar repertório para outro aparelho oferece JSON com prévia/confirmar. Formato `pratica.repertoire`, versão 1: envelopes originais de `song.*`, `playlist.*` e `chart.*`, incluindo tombstones e todo o histórico de revisões. Sem ajustes, registros de prática ou arquivos físicos de áudio. Limites: 25 MB e 20.000 eventos. IDs repetidos no pacote, versão incompatível e dados conhecidos inválidos são rejeitados; conflito imutável aborta todo o lote. Reimportar o mesmo pacote é idempotente. Tipos futuros do namespace de repertório são guardados sem projeção.
- **Relay para iCloud:** importar JSON no Mac marca `musicRelay:<eventId>` em `local_meta`, na mesma transação dos eventos. O JSONL publicado por este Mac inclui esses envelopes originais além dos próprios; nunca escreve no arquivo de outro dispositivo. Assim um pacote do navegador chega a outro Mac pelo iCloud, sem reatribuir autoria ou fabricar timestamps novos. Cópias repetidas fundem por ID. Não precisa de migração ou tipo novo de evento. Marcadores de transporte ficam locais.
- **3B.4, offline:** plugin local do Vite emite `sw.js` só no build:web, com precache do HTML/assets/fontes e versão derivada do conteúdo compilado. Escopo estrito `/pratica/`; nada de cachear serviços externos ou dados pessoais. Shell é servido da mesma versão do cache, dados continuam no IndexedDB. Atualização aguarda ativação normal ou clique explícito em Atualizar e recarregar, em Ajustes; com duas abas já abertas, pede fechar as outras. Não recarrega automaticamente durante edição. Limpa apenas caches `pratica-shell-*` antigos na ativação. A checagem de abas não é uma trava atômica contra abrir outra aba exatamente durante a ativação.
- **Persistência:** Ajustes mostra preparo offline e resultado de `navigator.storage.persisted()`/`persist()`. Pedido é explícito, com resultado concedido/não concedido/sem suporte. Aviso sobre Safari, instalação e exportação como cópia, sem prometer que persistência evita limpeza manual. Web em dev sem build não registra service worker; app Tauri não registra.
- **3B.5, conflitos:** comparação agora mostra todas as pontas, em vez de mostrar duas e encerrar outras invisíveis. Resolução preserva `sourceUrl`. Rascunho de cifra guarda `chartId` e `parentRevision` ao abrir; salvar não adota uma ponta importada/sincronizada no meio da edição, evitando absorver conflito silenciosamente.

### Verificações executadas

| Verificação | Resultado nesta rodada |
|---|---|
| Core | **103 testes passaram** |
| `practice-store` | **10 testes passaram**, incluindo pacote web→Mac A→Mac B, reabertura, autoria e idempotência em pasta temporária |
| `audio-engine` | **16 testes passaram**; sem teste de hardware |
| Contrato SQLite | **15 verificações passaram**, incluindo eventos futuros e pacote idempotente/atômico |
| Ciclo de captura web | Passou com APIs controladas |
| Service worker | Passou com APIs controladas em Node: shell sem rede, escopo, cache de versões e bloqueio com duas abas. **Não é execução em navegador** |
| TypeScript | Passou |
| `pnpm build:app` | Passou; compilou o Tauri atual, incluindo a permissão de tema e a operação de medição anteriores. Não executou essas operações |
| `pnpm --filter desktop build:web` | Passou, com `sw.js` e lista de precache emitidos |
| `pnpm test` com `PRACTICE_TEST_BROWSER=chrome` | Core, captura, SW controlado e SQLite passaram; parou ao abrir Chrome com `SIGABRT`/`EPERM`. Suíte completa **não aprovada** |
| `test:qa:3b` | Build web passou; execução parou em `listen EPERM 127.0.0.1`, antes de abrir o navegador. **Nenhuma captura produzida** |
| Página manual do contrato | Gerada em `target/contract/practice-store.html`; não executada nesta rodada |
| Revisão independente | Estática: correções de conflito-base, múltiplas pontas e relay conferidas. Sem aprovação visual. PRODUCT/DESIGN preservados; contexto/detector visual tiveram execução bloqueada |

Não foi usado `fake-indexeddb` nesta rodada. A migração IndexedDB v2→v3 e a reprojeção têm cenário na página de contrato, mas precisam rodar no navegador real. A geração da página e o typecheck não comprovam seu resultado.

### Como testar

```sh
cd ~/Dev/guitar-exercises-app
nvm use 24
open "target/release/bundle/macos/Prática.app"
# Recompilar o app sem DMG:
pnpm build:app
# Contratos e suíte completa com o Chrome instalado:
PRACTICE_TEST_BROWSER=chrome pnpm test
# Contrato IndexedDB manual, em banco temporário:
pnpm --filter desktop test:web:manual
open -a "Google Chrome" target/contract/practice-store.html
# QA web isolado, compila e abre perfil de teste descartável:
pnpm --filter desktop test:qa:3b
```

O QA cria somente textos neutros e banco em perfil descartável: importa repertório com três pontas, compara/resolve/reabre, cria e reordena playlist, captura conflito a 1440/390 px em claro/escuro, testa atualização com duas abas e reload offline. Capturas esperadas em `target/qa-3b/`. O roteiro está preparado e a sintaxe conferida, mas não foi executado até o fim neste ambiente.

1. No Mac, Músicas→Playlists: criar, adicionar músicas, mover, renomear, salvar, reabrir, tirar música e apagar playlist. Conferir Cancelar e rascunho após sair/voltar.
2. Exportar ChordPro e JSON; importar no Chrome e depois de volta no Mac. Reimportar sem duplicar. Conferir exclusões e comparação de cifras; durante uma edição, importar revisão concorrente e salvar para confirmar o conflito.
3. Web offline precisa do **build web servido por HTTP local ou HTTPS**, não apenas `pnpm web` nem `file://`. O QA usa servidor HTTP local. No site público, só verificar a nova versão após um push autorizado; nada foi publicado nesta rodada.
4. Após preparar o cache online, desconectar e recarregar. Editar e reabrir músicas/playlists. Em Ajustes, solicitar persistência e conferir o resultado. Testar atualização de duas versões com duas abas, salvando os rascunhos antes de recarregar.
5. Conferir desktop e 390 px, claro/escuro, teclado, foco e movimento reduzido. Atualizar os dois Macs antes do teste real de iCloud.

### Pendências e histórico
- A 3B ainda depende da execução do contrato IndexedDB real, da comparação de conflito renderizada, dos quatro cenários visuais e do offline/atualização reais. Não iniciar a 3C antes desse fechamento.
- Persistem as pendências do Pedro: afinador com microfone/interface (permissão, qualidade, canal, buffer, reconexão); medição de atraso CoreAudio; barra lateral clara com macOS escuro; celular real; sync iCloud entre dois Macs; Laboratório YouTube/erro 153 e Spotify com redirect `http://127.0.0.1/callback` e Client ID próprio.
- O app compilado do projeto foi atualizado; a cópia em Aplicativos não foi substituída.
- `git add` foi tentado e bloqueado ao criar `.git/index.lock` (`Operation not permitted`). Os lotes 3B.1–3B.5 acima **não são commits criados**: alterações permanecem no diretório de trabalho. Nenhum push, PR, reset, limpeza ou modificação dos backups.

## Ajustes pedidos em 22/11 (depois da 3A)

### Feito
- **Atraso dos dispositivos:** Ajustes ganhou "Medir atraso" (só no Mac). O motor abre cada entrada e saída por um instante, a saída em silêncio, e lê o atraso pelos timestamps do stream. Fica guardado neste Mac (`localStorage`, IDs de áudio não valem em outro Mac). Sem medida, aparece "sem medida" em vez de "cerca de 0 ms". O selo de melhor opção só aparece no primeiro da lista quando há medida ou interface de áudio; Bluetooth continua avisado. Recusa medir com metrônomo ou afinador ligados.
- **Barra lateral no tema claro:** a janela nativa passa a seguir o tema do app (`setTheme`, permissão `core:window:allow-set-theme`). Antes, com o macOS escuro e o app claro, o material translúcido ficava escuro com texto escuro.
- **Roadmap:** trilho de fases no topo com um quadradinho por exercício (preenchido quando há prática registrada), que também filtra por fase; linhas em colunas (exercício, tipo, meta, práticas) no lugar dos selos; "tab" virou um ícone; grade, fases e timeline no mesmo estilo.
- **Tap:** anel no acento a cada toque; com movimento reduzido, só um brilho curto.
- **Acordes (nova tela, ⌘4):** biblioteca com 45 formas consagradas, filtro por tipo e busca por qualquer nome (Em7(9), D/F#, Db7M(9)); acorde fora da tabela ganha formas calculadas a partir das notas, marcadas como "forma calculada". Detalhe com as notas e todas as formas.
- **Troca de acordes:** acorde atual grande, próximo pequeno, contagem regressiva em tempos, troca a cada 1, 2, 4 ou 8 tempos no metrônomo do app, pares do roadmap (G e C, Am e E, D e A), contagem de trocas pedidas e registro em "Troca de acordes em 1 minuto" com as trocas limpas informadas por você. Abre também pela tela do exercício e pela cifra.
- **Cifra:** faixa com o diagrama de cada acorde da música, na ordem; clique mostra outra forma.

### Verificações
- Core: **99 testes passaram** (37 novos de notas, formas e troca), `tsc` passou. Toda forma da tabela e as geradas para 12 acordes fora dela conferem com as notas, abertura de até 4 casas e até 4 dedos.
- `audio-engine`: **16 testes passaram**, clippy sem avisos, compilado no Linux (ALSA). A medição em si depende do CoreAudio e **não foi executada**.
- `pnpm typecheck` e `build:web` passaram; Chromium headless: Roadmap claro/escuro/760 px, Acordes, busca, troca rodando 5 s e 11 s, Tap no meio do pulso. Console sem erros; detector da Impeccable sem apontamentos.
- **Não executado:** app do Mac (medição de atraso, barra lateral com o tema, Tauri compilando a nova permissão), uso real da troca com a guitarra.

### Sobre as capturas de 22/11
O Roadmap das capturas ainda dizia "As visões de timeline, fases e grid chegam na Fase 1", então o app aberto era a versão da 1A, provavelmente a cópia em Aplicativos. O aviso "iCloud pendente: o arquivo deste dispositivo está incompleto ou contém eventos incompatíveis" tem a mesma causa provável: o build novo, usando o mesmo banco, gravou no log tipos de evento que a versão antiga não conhece. Substituir a cópia em Aplicativos pelo build atual deve resolver; a partir da 3A, versões antigas guardam tipos novos em vez de travar.

## Fase 3, parte 3A: músicas e cifras implementadas, validação no Mac pendente (22/11/2026)

Plano e decisões em `docs/06-fase-3-plano.md`. 3B (playlists na interface, exportar/importar, web offline) e 3C (braço completo) ainda não começaram. Nada foi enviado ao GitHub: os commits estão só na `main` local.

### Implementado
- **Sync tolerante a versões:** um evento de tipo desconhecido vindo de outro Mac fica guardado em `deferred_events` e é projetado quando o app passar a conhecer o tipo, ao abrir o banco. Antes, ele fazia o arquivo inteiro do outro aparelho ser tratado como incompatível.
- **Core:** acordes em notação brasileira e inglesa; cifra colada (acordes sobre a letra) convertida para ChordPro na coluna original; leitura e escrita de ChordPro; transposição só de exibição, com grafia pelo tom de destino (Em +1 = Fm, Eb, Db7M). Modelo `Song`, `Playlist`, `ChartRevision` com validação, origem explícita de BPM e tom, revisões imutáveis com conflito visível e resolução por `supersedes`.
- **Persistência:** SQLite `user_version=2` e IndexedDB `pratica.v1` versão 2, migrações só aditivas. Eventos `song.saved` e `playlist.saved` (última gravação vence, exclusão por tombstone) e `chart.revised` (só acrescenta). Validação espelhada TS/Rust.
- **Semente:** 12 músicas do repertório (`data/repertoire.seed.json`), só título, artista e fase. IDs fixos: não duplica entre Macs e uma música apagada não volta. As linhas "(uma música da lista)" ficaram de fora.
- **Tela Músicas:** lista com busca sem acento, filtro por fase e "Só com cifra"; detalhe com tom, BPM, compasso, capo, fase e a origem de cada dado; cifra com acorde sobre a sílaba, quebrando só entre palavras; transposição; importação por texto colado ou arquivo (.cho, .chordpro, .pro, .crd, .txt) com prévia e avisos; uso opcional do tom/BPM da própria cifra; link de origem; editor; exclusão com confirmação; comparação e escolha entre versões em conflito. Rascunhos ficam acima das rotas. Janela estreita mostra um painel por vez.
- A letra da cifra de teste fornecida pelo Pedro não está no repositório (público): o fixture tem a mesma estrutura com texto neutro.

### Verificações (22/11/2026)
- Core: **62 testes passaram** (32 anteriores, 17 de cifra/acordes, 13 de músicas) e `tsc` passou. Rodados numa cópia isolada, porque os `node_modules` do projeto são de macOS.
- `practice-store`: **9 testes Rust passaram** (6 anteriores, evento de tipo futuro no sync, migração v1→v2 com reprojeção, músicas/playlists/revisões), clippy sem avisos, exemplo `bridge` compila. Rodado numa cópia do crate na nuvem, Rust 1.97. O `audio-engine` não foi alterado nem testado de novo.
- Contrato compartilhado: **SQLite real, 13 verificações passaram** (ponte Rust). **IndexedDB, 13 verificações passaram em `fake-indexeddb`** no Node, não num navegador real. Migração de um IndexedDB v1 com registro existente para v2 conferida no mesmo ambiente.
- `pnpm typecheck` (core e desktop) e `pnpm --filter desktop build:web` passaram numa cópia do repositório com dependências instaladas no Linux.
- Revisão visual no Chromium headless do webapp compilado: claro e escuro a 1440 px e janela estreita a 760 px; lista, detalhe, importação com a cifra de teste, cifra salva e transposta, editor. Console sem erros. Detector da Impeccable sem apontamentos. A comparação de conflito não foi vista renderizada.
- **Não executado:** compilação do Tauri (`src-tauri/src/storage.rs` ganhou três operações na lista permitida), app do Mac, `pnpm test` no Mac, contrato IndexedDB no Chrome, sync real entre dois Macs.

### Como testar a 3A

```sh
cd ~/Dev/guitar-exercises-app
nvm use 24
pnpm --filter @gx/core test
cargo test -p practice-store
pnpm typecheck
PRACTICE_TEST_BROWSER=chrome pnpm --filter desktop test   # SQLite + IndexedDB no Chrome
pnpm build:app && open "target/release/bundle/macos/Prática.app"
```

1. Abrir Músicas: as 12 músicas do repertório aparecem, sem tom, BPM nem cifra.
2. Escolher uma, Adicionar cifra, colar uma cifra do Cifra Club. Conferir a prévia (acordes na sílaba certa, avisos), salvar, reabrir o app e abrir sem internet.
3. Transpor para cima e para baixo; a cifra salva não muda. Editar cifra, salvar e conferir.
4. Abrir um arquivo ChordPro com `{key:}` e `{tempo:}`: a opção de usar tom e BPM aparece só se a música ainda não tiver esses dados, e a origem mostra o nome do arquivo.
5. Nova música, editar, apagar. Buscar sem acento, filtrar por fase e "Só com cifra". Janela estreita, teclado, claro e escuro.
6. Dois Macs: atualizar os dois antes de usar Músicas. Editar a mesma cifra offline nos dois, sincronizar e resolver o conflito em Comparar.

## Fase 2: afinador e perfis implementados, validação de áudio pendente (21/11/2026)

### Publicação (22/11/2026)
- A 1A/1B já estava na `main` no commit `4226a21` (publicado pelo conector GitHub). Em 22/11 o histórico local foi alinhado com `git fetch` e `git reset --mixed origin/main`, sem tocar nos arquivos de trabalho. O remoto não tinha avançado além de `4226a21`.
- Backups criados antes do reset: branch `backup/pre-alinhamento-fase2-20261122` e tag `backup-head-20261122` (HEAD antigo, com o commit local `8c0efcb`), mais a ref `refs/backup/worktree-tracked-20261122` (snapshot das alterações rastreadas).
- A Fase 2 foi publicada em commits separados na `main`. O workflow do Pages roda a cada push; veja o resultado do deploy no fim desta seção quando confirmado.

### Implementado
- Afinador mantém estado acima das rotas: entrar em Ajustes e voltar não perde a captura nem indica que está desligado enquanto o microfone está aberto.
- Nota/oitava, frequência, cents, sinal e orientação de ajuste; estados desligado, abrindo, ouvindo, sinal fraco e instável. A nota e o estado são anunciados sem anunciar cents continuamente. Agulha limitada à escala, com atualização direta quando movimento reduzido está ativo.
- Entrada e canal reais informados pelo motor. No Mac, seleção explícita ausente ou canal inválido falham com recuperação, sem cair silenciosamente em outra entrada. Mudança do padrão nativo reabre a captura quando Padrão está selecionado. No navegador, isso depende de o navegador expor alias/grupo do padrão; o rótulo Ouvindo sempre identifica a captura efetiva.
- Buffer solicitado por entrada no Mac, com Automático e opções dentro dos limites do dispositivo. Buffer incompatível pede voltar a Automático. A configuração é solicitada ao cpal, não uma garantia do tamanho de cada callback.
- Salvar perfil guarda ID real, canal, buffer solicitado, taxa de amostragem do processamento, última latência informada, origem da medida e data. Salvar também seleciona explicitamente essa entrada, como a UI informa; ao reabrir/trocar para ela, canal e buffer são recuperados. Salvar novamente atualiza o diagnóstico; não grava um evento a cada callback.
- Perfis ficam em `device:<id>:tuner.inputProfiles`, na mesma persistência por eventos da 1A, com validação TS/Rust e sem migração de tabelas. Não ativam IDs de áudio de outro aparelho. O ranking considera o perfil salvo quando não há leitura corrente; Ajustes distingue perfil salvo de leitura no stream.
- A latência do Mac vem dos timestamps de captura; a do navegador vem do track quando disponível. A UI distingue ausência de medida, medida atual e perfil salvo. A janela YIN tem 4.096 amostras e é exibida separadamente. Não há alegação de medição round trip nem calibração por cabo.
- Web: captura cancelada antes/depois da permissão não reativa o afinador; canais reais substituem a suposição de estéreo; desconexão encerra tracks e informa como retomar. O navegador continua escolhendo o buffer.
- Lógica e modelos em `packages/core/src/tuner.ts`; ciclo de captura em Rust/Web Audio; estado em `apps/desktop/src/lib/tuner.tsx`; painel conserva o sistema visual existente. Fase 3 não iniciada.

### Verificações
- Core: **32 testes passaram**, incluindo seis cordas, três desvios conhecidos e duas taxas de amostragem; estados, limites e perfis locais/validados.
- Rust (`cargo test --workspace`, 22/11): **24 testes passaram** (16 do motor de áudio, 2 adicionais e 6 de persistência/sincronização).
- Contrato SQLite real: **11 verificações passaram**, incluindo reabertura do perfil, isolamento por aparelho e rejeição no backend de perfis inválidos/globais.
- `pnpm --filter desktop test:audio`: passou o contrato do ciclo de captura web com APIs de áudio controladas (cancelar antes/depois da permissão, mono, canal indisponível e desconexão). Não é teste de microfone real ou navegador.
- `pnpm test` (22/11, Mac do Pedro): core (32), captura web e SQLite (11) passaram; o passo IndexedDB parou porque o Chromium do Playwright não está instalado. Rodado à parte com `PRACTICE_TEST_BROWSER=chrome pnpm --filter desktop test:web`: **IndexedDB, 11 verificações passaram**. Ou seja, a suíte inteira passou, mas só com o Chrome instalado; `pnpm test` puro ainda exige `pnpm exec playwright install`.
- TypeScript e `git diff --check` passaram. Em 22/11 passaram também `pnpm typecheck`, `pnpm build:app` (gera só o `.app`) e `pnpm --filter desktop build:web`. O DMG (`pnpm build`) não foi tentado de novo; na rodada anterior falhou com `hdiutil: Device not configured`, limite do ambiente.
- Revisão independente estática conferiu as correções de perfil/default, cancelamento, estado acessível e movimento reduzido. Sem aprovação visual: não havia controle de UI disponível, e o detector de design teve execução bloqueada. PRODUCT/DESIGN preservados por ser extensão do painel existente.

### Como testar

```sh
cd ~/Dev/guitar-exercises-app
nvm use 24
open "target/release/bundle/macos/Prática.app"
# Recompilar sem DMG:
pnpm build:app
# Webapp local:
pnpm web
# Testes sem microfone e sem navegador:
pnpm --filter desktop test:audio
pnpm --filter desktop test:native
# Contrato IndexedDB atualizado, para abrir no Chrome:
pnpm --filter desktop test:web:manual
open -a "Google Chrome" target/contract/practice-store.html
```

1. Ferramentas: ligar afinador, permitir microfone e tocar uma corda por vez. Conferir nota/oitava, cents, sinal baixo/silêncio e Lá 430–450 Hz. Alternar Ajustes/Ferramentas sem perder o estado; parar deve liberar a captura.
2. Com interface conectada: escolher entrada e canal da guitarra. Em Perfil da entrada, experimentar Automático e buffer suportado. Se falhar, voltar a Automático e ligar novamente. Conferir nome/canal efetivo e latência atual sem confundi-la com a janela de análise.
3. Salvar perfil, parar/reabrir o app e conferir entrada/canal/buffer. Testar outra entrada e voltar; salvar novamente para atualizar a medida. Desconectar interface, conferir erro e escolher outra entrada. Com Padrão, mudar a entrada padrão do Mac e conferir reabertura e rótulo Ouvindo.
4. Repetir permissão negada, cancelamento e desconexão no webapp. Conferir modo claro/escuro, janela estreita, teclado e preferência de movimento reduzido.

Ainda pendentes: áudio real com microfone/interface (permissão, qualidade, canal, buffer, reconexão), UI nos dois temas e tamanhos e pendências manuais da 1A/1B/iCloud entre dois Macs. A cópia em Aplicativos não foi substituída. Laboratório: YouTube/erro 153 e Spotify com redirect `http://127.0.0.1/callback` e Client ID próprio continuam pendentes.

## Revalidação da 1A (21/11/2026)

A implementação da 1A e da 1B foi preservada. Esta rodada reforçou testes de falha/retomada e tornou os contratos executáveis sem servidor local. A Fase 2 não foi iniciada.

### Alterações desta rodada
- `apps/desktop/test/run-contracts.mjs` agora empacota a suíte com Vite, sem criar servidores HTTP/WebSocket. O contrato SQLite usa o banco Rust real; o web usa IndexedDB real em contexto novo do navegador e origem HTTPS interceptada, sem rede real nem perfil pessoal.
- `pnpm --filter desktop test:native` executa só o contrato SQLite e informa explicitamente seu escopo.
- `pnpm --filter desktop test:web:manual` gera uma página autossuficiente em `target/contract/practice-store.html`. Gerar a página não significa que o contrato foi executado. A página cria um banco temporário com nome próprio, executa a mesma suíte e solicita sua remoção ao terminar.
- O runner automático usa Chromium. Para usar o Chrome instalado em um ambiente que permita iniciá-lo: `PRACTICE_TEST_BROWSER=chrome pnpm --filter desktop test:web`.
- Testes Rust adicionais conferem exportação pendente após fechar/reabrir o banco, ajustes e rotinas entre dois dispositivos simulados com cópia de conflito e retomada depois que uma linha JSONL incompleta chega inteira. Os testes usam arquivos temporários, sem tocar nos dados reais ou no iCloud do Pedro.

### Resultado atual

| Verificação | Resultado nesta rodada |
|---|---|
| Core | 29 testes passaram |
| Motor de áudio | 16 testes Rust passaram |
| Persistência e sincronização | 6 testes Rust passaram |
| Contrato SQLite | 10 verificações passaram, sem abertura de portas |
| Calendário e validação em fusos distintos | Os 5 testes de `store.test.ts` passaram com `TZ=America/Bahia` e `TZ=America/New_York` |
| TypeScript e sintaxe do runner | Passaram |
| `pnpm --filter desktop build:web` | Passou |
| `pnpm build` | Gerou o `.app`; falhou depois no DMG, com `hdiutil: create failed - Device not configured` |
| `pnpm build:app` | Passou; `.app` atualizado em `target/release/bundle/macos/Prática.app` |
| `pnpm test` completo | Core e SQLite passaram; parou ao iniciar Chromium, ausente no ambiente |
| Contrato web com Chrome instalado | A inicialização do processo foi bloqueada pelo ambiente; sem resultado de execução nesta rodada |

As 10 verificações do IndexedDB passaram na sessão anterior, no Chrome, conforme o registro da 1B. Esse resultado anterior não está sendo contado como uma nova execução do runner alterado.

### O que ainda impede declarar a 1A totalmente validada
- Repetir a suíte web neste ambiente com navegador disponível ou abrir a página manual no Chrome e confirmar o resultado `passed`.
- Durante uma prática real, conferir os quatro tipos de registro pela UI, o BPM registrado após acertos/erro/modo manual, o calendário e a persistência após reabrir. A leitura do código e os contratos de armazenamento não substituem essa verificação da interface.
- Conferir claro/escuro e janela estreita. Nesta rodada não havia ferramenta de controle de interface disponível.
- Testar o transporte real do iCloud em dois Macs da mesma conta, incluindo offline/reconexão. Os dois dispositivos dos testes Rust são simulados e não validam o serviço da Apple.
- Pendências anteriores da 1B continuam: salvar/reativar rotina própria pela UI e reabrir para confirmar.

### Como testar sem depender do DMG

```sh
cd ~/Dev/guitar-exercises-app
nvm use 24
pnpm build:app
open "target/release/bundle/macos/Prática.app"
# Webapp local:
pnpm web
# Contrato nativo, sem navegador:
pnpm --filter desktop test:native
# Página de contrato web sem servidor:
pnpm --filter desktop test:web:manual
open -a "Google Chrome" target/contract/practice-store.html
# Suíte completa em um ambiente que permita executar Chromium:
pnpm --filter desktop exec playwright install chromium
pnpm test
```

Use registros reais de prática ao conferir a interface, porque o histórico é imutável. A página de contrato usa apenas seu banco temporário. Não houve novo teste na UI nem substituição da cópia em Aplicativos nesta rodada.

Continuam pendentes no Laboratório: YouTube embutido/erro 153 e Spotify com redirect `http://127.0.0.1/callback` e Client ID próprio. Sem commits, push, PR ou publicação; o histórico local anterior foi preservado.

## Etapa 1B: organização implementada e app compilado (20/11/2026)

### Feito
- Roadmap com Timeline, Fases expansíveis, Lista e Grid. As quatro visões compartilham filtros por fase e tipo, o mesmo catálogo e o contador de registros em cada exercício. A visão escolhida é lembrada localmente.
- Timeline segue a ordem das fases, sem datas de calendário. O resumo mostra exercícios com prática registrada, sem tratar prática como conclusão. A fase continua sendo escolhida manualmente.
- Hoje alterna Sugestão/Minha rotina. A sugestão oferece Leve 20 min, Normal 40 min e Puxado 60 min. Editar rotina copia a sugestão atual ou a rotina própria.
- Editor permite nomear, trocar exercício, ajustar tipo de bloco e minutos, remover, adicionar e reordenar por botões acessíveis. O total é recalculado. Cancelar descarta; salvar persiste e ativa a rotina própria.
- Rascunho, estado de salvamento, erro e trava de gravação ficam acima das rotas: navegar e voltar mantém as alterações, inclusive durante gravação. Rascunhos são da sessão; a rotina salva persiste após reabrir.
- Rotina própria usa o ID estável `personal` e a interface `PracticeStore` existente. A preferência `routineSource` usa ajuste com LWW, espelhado na validação TS/Rust. Nenhuma migração de tabelas foi necessária.
- Ajustes só são refletidos na UI após persistirem, para não indicar fonte/fase ativa quando a gravação falha.
- Lógica de filtros e edição pura fica em `packages/core/src/roadmap.ts` e `routine-editor.ts`, separada da interface.
- Novo comando `pnpm build:app` gera apenas o `.app`, evitando o problema de empacotamento do DMG. O comando `pnpm build` continua gerando os dois formatos.

### Verificação
- **29 testes do core passaram**, incluindo filtros combinados/fase zero, edição sem mutação, reordenação, referências inválidas e durações.
- **20 testes Rust passaram**: 16 do motor de áudio e 4 de persistência/sincronização.
- **SQLite real: 10 verificações do contrato passaram** em `pnpm test`, incluindo a preferência de rotina após reabrir.
- **IndexedDB real: as mesmas 10 verificações passaram no Chrome**, usando bundle da página de contrato aberto por `file://`, com banco temporário criado e removido pelo teste. O comando automático `pnpm test` ainda termina com erro por `listen EPERM` em localhost:1421 neste ambiente; isso não foi apresentado como sucesso do comando completo.
- Passaram `pnpm typecheck` e `pnpm --filter desktop build:web`.
- `pnpm build` compilou em release e gerou o `.app`; a etapa DMG falhou em `hdiutil` com `Device not configured` no ambiente. Em seguida, **`pnpm build:app` terminou com sucesso** e gerou `target/release/bundle/macos/Prática.app` com o frontend final.
- Aplicativo compilado aberto e conferido no Mac em modo escuro: editor, edição do nome, reordenação, preservação do rascunho ao ir para Roadmap e voltar, cancelamento; quatro visões do Roadmap; combinação Fase 1 + Dexteridade exibindo 2 exercícios nas visões Grid, Fases e Timeline. Não foram criados registros de prática nem salva rotina de teste no banco do Pedro.
- Revisão estática independente resolveu perda de rascunho ao navegar, seleção de ajustes após falha e gravação pendente atravessando rotas. O sistema visual existente foi preservado.
- Pendentes de uso real: salvar/reativar rotina própria pela UI, reabrir o app para conferir essa rotina, claro e janela estreita, sincronização iCloud entre dois Macs. A revisão visual realizada não cobre todos os temas e tamanhos.
- A cópia compilada do projeto foi aberta. Não substituí automaticamente o aplicativo em `/Applications`. Sem commits, push, PR ou publicação; `.git` segue sem permissão de escrita no ambiente.
- Fase 2 e fases seguintes não foram iniciadas.

### Como testar

```sh
cd ~/Dev/guitar-exercises-app
nvm use 24
pnpm build:app
open "target/release/bundle/macos/Prática.app"
# Web local:
pnpm web
# Verificações completas fora do bloqueio a localhost:
pnpm --filter desktop exec playwright install chromium
pnpm test
pnpm --filter desktop build:web
```

1. Em Roadmap, alternar Timeline/Fases/Lista/Grid; combinar fase e tipo, conferir contadores, limpar filtros e abrir um exercício. Conferir também filtro sem resultados.
2. Em Hoje, escolher Leve, Normal ou Puxado e clicar Editar rotina. Trocar exercícios, alterar minutos, adicionar, remover e mover blocos.
3. Abrir outra tela e voltar: o rascunho deve continuar. Cancelar deve restaurar a rotina anterior.
4. Salvar a rotina, conferir o nome e o total em Minha rotina. Reabrir o app e conferir persistência. Alternar para Sugestão e voltar para Minha rotina, preservando a rotina salva.
5. Conferir teclado, modo claro e janela estreita. No navegador, repetir gravação/reabertura; dados do navegador e do app são independentes.
6. Ainda pendentes no Laboratório do Mac: YouTube embutido/erro 153 e login Spotify com redirect `http://127.0.0.1/callback` e Client ID próprio.

## Etapa 1A: implementação, validação pendente (20/11/2026)

### Atualização após compilação local
- Pedro executou o build no Terminal: Rust em release compilou e gerou `target/release/bundle/macos/Prática.app`. O aplicativo foi substituído por ele.
- A etapa posterior de criação do DMG falhou ao desmontar `disk6` com `Resource busy`. Isso não invalida o `.app` gerado.
- Com as dependências agora no cache, `cargo test -p practice-store --offline` passou: **4 testes Rust**, incluindo fusão, falha de exportação, versão futura e relógio persistente.
- Ainda pendentes: suíte compartilhada de contrato, teste visual/funcional e uso real do iCloud entre dois Macs. Os bloqueios descritos abaixo registram a tentativa anterior.


### Implementado
- Contrato assíncrono `PracticeStore` no core; validação de registros, eventos, ajustes e rotinas; agrupamento por dia local e soma de tempo real.
- Adaptadores SQLite via Tauri e IndexedDB no navegador. A UI recebe `PracticeStore`; a seleção do adaptador fica na composição. Ajustes antigos do `localStorage` são migrados uma vez. Conteúdo inválido preserva a cópia original e exibe aviso, sem bloquear os registros.
- SQLite isolado em `crates/practice-store`, com `rusqlite` síncrono e SQLite bundled. O crate não depende de Tauri nem do motor de áudio, permitindo testar o banco real por um executável de contrato.
- A sugestão de Hoje considera o histórico anterior ao dia local, para não trocar os blocos a cada registro durante a prática.
- Registro em Hoje e no exercício, com BPM, contagem, tempo ou feito conforme o seed, nota opcional e duração real opcional separada da métrica. Contador representa registros, não acertos do metrônomo.
- Progressão no exercício: cinco acertos sugerem +4 BPM, aceitar aplica o novo andamento, erro zera a sequência. Modo manual mantém o ajuste livre. O formulário registra o BPM praticado; cada acerto não cria um registro separado. Ao reabrir, recupera o último BPM registrado. Sequência de acertos é da sessão.
- Calendário mensal, seleção por teclado, marcação dos dias, práticas, métricas, notas e duração do dia. Não usa a duração planejada como tempo praticado.
- Eventos imutáveis com versão, ID, dispositivo, timestamp, tipo e dados; evento e projeção salvos na mesma transação. Práticas fundem por ID; ajustes por chave e rotina por ID usam última gravação, com desempate por ID do evento.
- Relógio lógico persistido, reservado em transação e avançado pelos eventos já importados, para evitar que um relógio remoto adiantado impeça ajustes locais posteriores.
- Sincronização do Mac a cada 15 s, ao voltar ao app e depois de gravar: leitura de JSONL de todos os dispositivos, incluindo cópias de conflito, fusão idempotente e publicação atômica do log próprio. Falhas deixam os dados locais intactos e a fila pendente. Linhas incompletas aguardam nova leitura; arquivo próprio incompatível é preservado.
- Ajustes mostram o estado da sincronização. IDs de dispositivos de áudio e canal ficam por aparelho.

### Arquivos de dados
- Mac: `pratica.sqlite3` no diretório local do app identificado por `com.peeeo.pratica`, resolvido por `app_local_data_dir()` do Tauri. Nunca no iCloud.
- iCloud: `~/Library/Mobile Documents/com~apple~CloudDocs/Pratica/events/<deviceId>.jsonl`. O app cria a subpasta apenas se o iCloud Drive já estiver disponível.
- Web: IndexedDB `pratica.v1`, só neste navegador e nesta origem. Sem sincronização automática com iCloud. O histórico do domínio publicado e o do localhost são independentes.
- Tabelas/stores: `practice_logs`, `routines`, `settings`, `events`, `sync_outbox`, `local_meta`. SQLite usa `user_version=1` e recusa banco de versão futura. Eventos usam `version=1`.

### Validação realizada e bloqueios
- Passaram os **25 testes do core** e o TypeScript do core e do desktop.
- Passou `pnpm --filter desktop build:web`.
- `pnpm test` foi executado: core passou; o contrato SQLite parou na resolução de dependências Rust. `cargo test -p practice-store --offline` confirmou que `rusqlite` não está no cache. Não houve execução dos testes novos Rust nem da suíte de contrato.
- `pnpm build` foi executado: frontend passou; a parte Rust e o empacotamento ficaram bloqueados pelo mesmo problema. O `Cargo.lock` ainda precisa ser atualizado pelo Cargo com acesso ao crates.io.
- Ambiente de execução sem resolução de DNS para npm/crates.io, sem permissão para ouvir em localhost e sem navegador disponível. Chromium de testes não estava instalado; tentativa com Chrome existente também foi bloqueada. Portanto, **não houve teste visual nem teste funcional da UI/IndexedDB**.
- Foi utilizado Node 24 e o pnpm disponível no runtime para executar os scripts; o projeto continua fixado em pnpm 10.28.0. O pnpm fixado não pôde ser baixado neste ambiente.
- Revisão estática independente identificou e levou à correção do campo de contagem, recuperação da migração e relógio dos eventos. Isso não equivale a aprovação visual.
- Os commits ficaram bloqueados: o ambiente não permite criar `.git/index.lock`. As alterações permanecem no diretório de trabalho; o commit local anterior de STATUS foi preservado.
- **A 1A não está concluída** até passar os testes de contrato, os testes Rust, o build nativo e o uso real no Mac/navegador. Nenhum push ou publicação foi feito. Naquele ponto, a 1B ainda não havia sido iniciada.

### Como validar em um ambiente sem esses bloqueios

```sh
pnpm install
pnpm --filter desktop exec playwright install chromium
cargo generate-lockfile
pnpm test
pnpm build
pnpm --filter desktop build:web
pnpm dev
# Em outro terminal, para o navegador:
pnpm web
# Contrato só do IndexedDB, sem compilar Rust:
pnpm --filter desktop test:web
```

A suíte em `apps/desktop/test/store-contract.ts` é a mesma para SQLite real (via `examples/bridge.rs`) e IndexedDB real (Chromium). Cobre as quatro métricas, intervalos com fuso, idempotência, validação, rollback, LWW fora de ordem, desempate, relógio após importação nativa, seleção de áudio local e reabertura de registros/ajustes/rotina. Testes Rust adicionais cobrem fusão entre dois dispositivos, conflito de arquivos, cauda incompleta, falha de exportação e versão futura do banco.

Roteiro manual:
1. Em Hoje, usar Registrar, preencher métrica/nota/duração e conferir contador. Testar contagem inteira, tempo e feito em exercícios correspondentes.
2. Abrir Spider, registrar cinco acertos, aceitar +4 BPM e conferir que erro zera a sequência. Trocar para manual e ajustar pelas setas. Registrar o BPM atingido.
3. Abrir Calendário, selecionar o dia e conferir exercícios, notas e minutos. Navegar dias pelas setas e mudar o mês pelos botões. Reabrir o app/navegador e conferir persistência.
4. Alterar tema, fase e som; reabrir e conferir os ajustes. Testar claro/escuro, janela estreita e teclado.
5. No Mac com iCloud Drive ativo, verificar o estado em Ajustes e o JSONL em `Pratica/events`. Num segundo Mac, abrir o app na mesma conta, aguardar a sincronização e conferir união dos registros sem duplicar. Testar offline e reconectar.
6. Ainda pendentes no Laboratório do Mac: YouTube embutido/erro 153 e Spotify com redirect `http://127.0.0.1/callback` e Client ID próprio.

## Braço, tabs e webapp (20/11/2026)

### Feito
- Tela de exercício: abre ao clicar num exercício no Hoje ou no Roadmap. Mostra o braço da guitarra (SVG, dedos, raiz em laranja, pestana, cordas soltas e abafadas), a tab e o metrônomo. A cada clique do metrônomo a tab avança um passo e a nota acende no braço. Dá para clicar num passo da tab, voltar ao começo ou desligar o "seguir o metrônomo". Mostra também o critério para passar, as metas e os vídeos.
- Tabs geradas em `packages/core/src/fretboard.ts` para 16 exercícios técnicos (spider, cromático, trocas e acordes abertos, dedo-guia, escala maior, pestanas F e Bm, formas móveis, power chords, pentatônica nas 5 posições, hammer-on e pull-off, CAGED, acordes com sétima, dórico). Os de música e teoria mostram "sem tab". Testes conferem as notas de cada acorde e escala.
- Webapp: fora do Tauri, o app usa um motor em Web Audio (`apps/desktop/src/lib/web-engine.ts`) com os mesmos sons e o mesmo YIN do Rust, portados para `packages/core/src/dsp.ts`. Escolha de entrada pelo navegador; escolha de saída onde o navegador deixa (Chrome).
- Deploy pronto: `.github/workflows/pages.yml` faz o build e publica em `/pratica/`.

### Publicado (20/11/2026)
- Repositório público: https://github.com/pedronogueiranunes/pratica (branch `main`).
- Pages com fonte GitHub Actions. O workflow `pages.yml` roda os testes do core, gera o build web e publica.
- Endereço: https://pedronogueiranunes.github.io/pratica/ redireciona para https://pedronogueira.dev/pratica/ (domínio próprio do portfólio).
- Conferido no Chrome: o app abre, a tela do exercício Spider mostra braço e tab, o metrônomo toca e a tab avança a cada clique, espaço liga e desliga.
- Para publicar uma mudança: `git push` na `main`. O deploy leva cerca de 30 s.

### Limites do webapp
- O login do Spotify do Laboratório só existe no app do Mac por enquanto (no web ele vai precisar de redirect para o endereço do site, na Fase 3).
- Latência: o navegador não deixa escolher o buffer; o app do Mac continua melhor para o afinador.

## Fase 0: fundação e provas de risco (18/11/2026)

### Feito
- Monorepo em `~/Dev/guitar-exercises-app` (pnpm + Cargo workspace), fora do iCloud.
- `crates/audio-engine` (Rust): metrônomo com precisão de amostra (5 sons sintetizados, volume, compasso, subdivisão, acento), afinador YIN (nota e cents, Lá ajustável), lista de dispositivos com tipo de conexão, latência medida nos streams, ranking do melhor dispositivo para instrumento e para saída, checagem de dispositivos a cada 3 s. 16 testes.
- `packages/core` (TypeScript): modelos, leitura e validação do seed, rotina sugerida em 3 níveis (Leve 20 min, Normal 40 min, Puxado 60 min), regra do metrônomo (+4 bpm depois de 5 execuções limpas, modo automático ou manual), tap tempo, i18n pt-BR e en, contrato `MusicSource`. 12 testes.
- `data/exercises.seed.json`: campo `metrica` adicionado pelo script `scripts/add-metrics.mjs` (o resto do arquivo ficou intacto).
- `apps/desktop` (Tauri 2 + React 19): barra lateral translúcida do macOS, telas Hoje, Roadmap (lista), Ferramentas (metrônomo e afinador), Ajustes (tema, idioma, dispositivos com recomendação e latência) e Laboratório. Calendário, Músicas e Tocar junto estão como telas vazias.
- Visual: estrutura de app do Mac com a estética de pedronogueira.dev (ver `apps/desktop/DESIGN.md`).
- Atalhos: espaço liga e desliga o metrônomo, setas mudam o bpm (Shift: de 4 em 4), Cmd+1 a 8 trocam de tela.

### Provas para testar no Mac (Laboratório)
1. **Motor de áudio:** metrônomo e afinador em Ferramentas. Antes, dá para testar sem interface: `cargo run -p audio-engine --example smoke`.
2. **YouTube embutido:** carregar um vídeo e ver se toca e se a posição anda. Erro 153 = Referer recusado.
3. **Spotify:** criar um app no dashboard com o redirect `http://127.0.0.1/callback`, colar o Client ID e testar.

### O que ainda não foi verificado
- Nada rodou num Mac ainda. Os testes rodaram em Linux; o build do Tauri e o áudio real (CoreAudio) precisam do primeiro `pnpm dev` aí.
- O cpal 0.18 pede macOS 14.2 ou mais novo.
- No `tauri dev`, o pedido de microfone aparece em nome do Terminal (ou do editor). No app empacotado aparece "Prática".

### Como rodar
Pré-requisitos no Mac: Xcode Command Line Tools, Rust (`rustup`), Node 22+ e pnpm 10.

```sh
cd ~/Dev/guitar-exercises-app
pnpm install
pnpm dev          # abre o app (primeira compilação do Rust demora alguns minutos)
pnpm test         # testes do core e do motor de áudio
pnpm web          # webapp local (motor em Web Audio)
pnpm build        # gera o .app e o .dmg em target/release/bundle
```

### Pendências de teste no app do Mac (Laboratório)
- YouTube embutido: ver se toca e se dá erro 153.
- Login do Spotify: criar o app no dashboard com o redirect `http://127.0.0.1/callback` e colar o Client ID.

### Próximo: Fase 1
Registro de prática com contador e SQLite, calendário, as quatro visões do roadmap, rotina editável, metrônomo ligado à regra de progressão por exercício, log de eventos para o iCloud Drive.
