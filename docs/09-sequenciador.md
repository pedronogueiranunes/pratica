# Sequenciador de acordes

Entrega local de 23/11/2026 do segundo bloco proposto em
`08-acordes-sequenciador-e-bateria.md`. A terceira aba **Sequência**, em Acordes,
permite montar e ouvir formas da Biblioteca em loop. Este documento registra o
comportamento implementado; bateria e recuperação após fechar o app continuam
nos próximos blocos.

## Comportamento entregue

- No detalhe da Biblioteca, **Adicionar à sequência** copia a forma selecionada,
  incluindo variação, baixo, posição, cordas soltas e abafadas. O bloco recebe um
  identificador próprio e começa com quatro tempos. Alterar a seleção depois
  não muda o bloco já adicionado.
- A sequência aceita até **16 blocos**, cada um com **1, 2, 4 ou 8 tempos**.
  **Repetir** duplica o bloco logo após o original; setas sobem ou descem um
  bloco; **Remover** exclui apenas o escolhido. Os controles têm nomes
  acessíveis e usam botões e seletores operáveis pelo teclado.
- **Ouvir em loop** começa pelo primeiro bloco e volta ao início ao terminar.
  Há um ataque por bloco, sem padrão de batida ou sustentação garantida durante
  toda a duração. O som reutiliza a síntese de referência da prévia.
- O **BPM** é global, compartilhado com o metrônomo, entre 20 e 400. Pode mudar
  durante o loop. O relógio continua no motor de áudio; a interface mostra o
  bloco atual, os tempos restantes e o próximo.
- **Acordes** controla o volume próprio da sequência, inicialmente 50%.
  **Ouvir clique** começa ligado e permite ouvir só os acordes sem o clique.
  Volume dos acordes e opção de clique são ajustados com o transporte parado;
  o volume do clique usa a configuração existente do metrônomo.
- Durante reprodução ou preparação, adicionar, editar, duplicar, reordenar,
  remover, volume dos acordes e clique ficam bloqueados. BPM permanece editável.
  **Parar loop** interrompe também o metrônomo e cancela o áudio pendente.
- Sair da aba Sequência, navegar para outra tela ou ocultar a página interrompe
  o loop. Abrir a tela ou voltar a ela nunca inicia áudio automaticamente.
  Erros de saída encerram o estado de reprodução e aparecem em texto.

## Rascunho desta sessão

Os blocos ficam em memória no módulo de Acordes: sobrevivem à navegação entre
abas e telas, mas **fechar o app ou recarregar a página perde a sequência**.
A preferência de aba já existente é separada do conteúdo dos blocos. Volume dos
acordes e opção de clique são locais ao componente e voltam aos valores iniciais
quando ele é remontado.

Esta entrega não grava sequência no SQLite, IndexedDB ou eventos de prática.
A recuperação sem autoplay, exportação/importação e fusão pelo PracticeStore
ficam para o bloco de persistência após a bateria, conforme o plano. Ouvir o
loop não registra automaticamente uma prática.

## Modelo e reprodução

| Camada | Responsabilidade |
|---|---|
| `packages/core/src/chord-sequence.ts` | Modelo com ID, diagrama exato e tempos; validação de 1 a 16 blocos, IDs únicos e durações; compilação em frequências pela mesma `chordVoicing` usada na Biblioteca; cálculo de posição visual por tempo. |
| `crates/audio-engine/src/sequence.rs` | Plano de memória fixa para até 16 blocos; avanço por tempos, ataque no início do bloco e retorno ao primeiro; validação antes de tocar. |
| `crates/audio-engine/src/engine.rs` | Comandos e eventos do transporte; avanço pelo metrônomo e ataques no frame correspondente dentro da callback; mistura na saída existente, com limites e sem alocação ou locks na callback. |
| `apps/desktop/src/lib/web-engine.ts` | Buffers preparados antes da reprodução e agendamento no relógio do `AudioContext`, com janela antecipada de 0,12 s alimentada a cada 25 ms; cancelamento de fontes e caudas na parada. |
| `ChordSequence.tsx` e `Chords.tsx` | Montagem do rascunho, controles, parada ao sair/ocultar e indicação visual recebida do motor. |

No Mac, o motor usa os tempos inteiros do metrônomo, sem contar subdivisões como
novos tempos do acorde. Os offsets de frame alinham o ataque com o clique no
mesmo stream. No web, o timer apenas abastece a janela de agendamento; os
instantes sonoros vêm do `AudioContext`. Os acordes e o clique compartilham a
saída existente, sem outro stream ou contexto concorrente.

Os eventos `sequenceState` e `sequenceBeat` carregam `runId`. A UI ignora eventos
de outra execução e invalida callbacks visuais ao parar. `audibleInMs` orienta
somente o destaque visual; timers do React não comandam ataques nem avanços do
áudio. O adaptador web interrompe o transporte com erro se detectar atraso
excessivo após suspensão, em vez de tentar recuperar uma fila antiga.

## Preservação visual

A extensão segue **Operate**, dentro do sistema existente de
`apps/desktop/PRODUCT.md` e `apps/desktop/DESIGN.md`. Reutiliza a navegação
segmentada de Acordes, painéis, botões em pílula, seletores nativos, tipografia,
cores de tema e foco visível. Em janela estreita, lista e controles se reorganizam
para manter as ações acessíveis.

Não foi criado outro mundo visual nem foram introduzidos novos tokens. Os
arquivos `DESIGN.md` e o sidecar de design foram preservados. Eventual divergência
preexistente entre a implementação e esses arquivos não é uma mudança normativa
desta entrega nem autoriza atualizar o sistema visual silenciosamente.

## Evidências e limites

- **Core:** 139 testes aprovados. **Rust:** 22 testes do motor e 10 do armazenamento
  aprovados. Os mocks web do sequenciador, typecheck e clippy passaram.
- `pnpm --filter desktop build:web` e o build final `pnpm build:app` passaram.
  Bundle de 16,10 MiB em `target/release/bundle/macos/Prática.app`; a cópia em
  `/Applications/Prática.app` foi substituída com autorização do Pedro. Os três
  arquivos do bundle instalado foram comparados por SHA-256 com o build, sem
  divergências. Cópia anterior preservada em `target/app-backups/`.
- A suíte `pnpm test` passou pelas etapas de core, captura, prévia, sequência,
  service worker e pelos 15 testes SQLite. A etapa de navegador IndexedDB não
  concluiu: Chrome headless encerrou com SIGABRT/EPERM. Isso não é aprovação
  integral da suíte nem falha comprovada de persistência do produto.
- Revisão independente em contexto novo: parecer **ship**, sem correções
  materiais, a partir de seis capturas em `target/qa-sequence/`:
  `desktop-dark.png`, `desktop-light.png`, `mobile-dark.png`,
  `mobile-light.png`, `mobile-dark-controls.png` e `mobile-light-controls.png`.
- A verificação interativa cobriu estado vazio, adição de inversão, reordenação,
  duplicação, remoção, BPM pelo teclado, clique desligado, play/stop e navegação.
  As capturas cobrem desktop e 390 px nos dois temas; não substituem uma
  avaliação completa com leitor de tela.
- Áudio em saída física, Safari e iPhone real **não foram testados**. Launcher e
  detector tiveram bloqueio de permissão no ambiente e dependem de revisão
  manual. As provas automatizadas e visuais não comprovam escuta, timbre,
  sincronismo perceptivo ou ausência perceptiva de estalos em hardware real.

## Próximos blocos

Bateria de acompanhamento com padrões originais e mixer independente vem antes
da persistência por eventos. Depois, salvar e recuperar a forma exata sem
autoplay, integrar os controles de acompanhamento e validar as mesmas regras no
SQLite e IndexedDB. Esta entrega não inclui importação de tablaturas por URL,
companion, Fase 4 ou avanço dos blocos do Amp.
