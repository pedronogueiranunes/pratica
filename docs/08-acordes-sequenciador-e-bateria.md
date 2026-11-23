# Acordes, sequenciador e bateria: próximo bloco

Pedidos do Pedro em 23/11/2026. Este documento planeja a extensão da biblioteca
Acordes; não descreve funcionalidade já implementada. A prévia sonora e a
partitura entregues estão documentadas em `07-acordes-som-e-partitura.md`.
Não alterar a interface em paralelo aos ajustes que o Pedro está fazendo nela.

## Comportamento esperado

### Inversões e variações

- Escolher a inversão pelo baixo: por exemplo, C, C/E e C/G. Inversão troca o
  baixo mantendo o acorde; uma forma diferente pode manter o mesmo baixo.
- Oferecer formas alternativas em posições diferentes do braço, separadas das
  variações harmônicas, como C, Cm, C7, C7M e Csus4.
- Diagrama, notas escritas e áudio sempre representam a mesma forma selecionada,
  incluindo baixo, oitavas, cordas soltas e abafadas. Conferir o baixo pela altura
  MIDI real, não apenas pela ordem das cordas.
- Não garantir todas as inversões em todas as posições. Sem forma validada,
  explicar a indisponibilidade e não completar notas artificialmente.

### Sequenciador simples

- Adicionar a forma selecionada a uma sequência, repetir acordes, remover e
  reordenar com botões operáveis pelo teclado.
- Definir duração por bloco em tempos, inicialmente 1, 2, 4 ou 8, e ouvir em loop.
  A primeira versão toca um ataque do acorde no início de cada bloco.
- BPM compartilhado com o metrônomo. Mostrar o bloco atual e o próximo; a
  animação acompanha o relógio de áudio, sem comandar a reprodução.
- Guardar a forma exata, não só o nome ou o índice numa lista de formas geradas.
  Recuperar a sequência após fechar o app. Nunca iniciar som automaticamente.
- Proposta de localização: terceira aba em Acordes, ao lado de Biblioteca e Troca
  de acordes, com ação Adicionar à sequência no detalhe. Ajustar o encaixe depois
  que o Pedro terminar a interface, sem criar nova tela principal por enquanto.

### Bateria de acompanhamento

- Liga/desliga independente dos acordes e do clique. Deve funcionar também sem
  sequência, como acompanhamento para tocar guitarra ou praticar um exercício.
- Estilos pedidos: **rock, reggae, indie rock, metal, ska, afrobeat** e uma opção
  de **loops simples**. Começar com um padrão original por estilo e padrões
  simples de estudo. São padrões sintetizados inspirados nos estilos, sem alegar
  transcrição de gravações ou representação completa de cada gênero.
- Três volumes independentes: **acordes**, **bateria** e **metrônomo**. É possível
  zerar ou desligar o clique mantendo a bateria. Começar com ganhos conservadores
  e limitar a soma na saída.
- Um único transporte/relógio mantém o BPM e a fase entre camadas. Ligar a bateria
  com o transporte rodando entra na grade; trocar o estilo entra no próximo
  compasso. Volume e mute respondem com rampas curtas, sem reiniciar o loop.
- Proposta inicial: padrões em 4/4; não alterar silenciosamente o compasso do
  metrônomo. Em outro compasso, informar a limitação antes de ativar o padrão.
  Se a sequência não ocupar compassos inteiros, a bateria continua na grade do
  transporte, sem reiniciar a cada volta dos acordes.
- Fechar a área de acompanhamento ou ocultar a página interrompe a reprodução
  nesta primeira versão. Um futuro modo persistente entre telas terá controle
  visível de parada; não deixar áudio invisível tocando.
- Funciona offline, sem microfone, downloads, serviços ou samples de terceiros.

## Divisão técnica proposta

| Camada | Trabalho |
|---|---|
| `packages/core` | Opções de inversão/variação e formas validadas; modelo da sequência; duração e grade do transporte; catálogo de padrões com ataques, instrumentos e intensidades; validação e compilação para os motores |
| `crates/audio-engine` | Síntese original de bumbo, caixa e pratos; vozes e filas limitadas; transporte por amostra; mistura com acordes e clique no stream de saída já existente |
| `apps/desktop/src/lib/web-engine.ts` | Bancos sintetizados e pré-calculados; agendamento antecipado no AudioContext; gains separados, cancelamento dos eventos pendentes e limitação da soma |
| `apps/desktop/src/lib/engine.ts` e Tauri | Contrato comum de transporte, sequência, padrão, volumes e estado; limites validados antes de chegar ao áudio |
| Persistência existente | Salvar sequência e preferências por eventos no PracticeStore; mesma validação e contrato no SQLite/IndexedDB, sem persistir buffers de áudio ou eventos a cada batida |
| Interface Acordes/Ferramentas/exercício | Controles de acompanhamento reutilizáveis; estado visível, teclado, leitura do bloco atual e parada acessível |

Reaproveitar `chordTones`, `generateShapes`, `fretMidi` e `chordVoicing`.
`shapesFor` hoje prioriza a tabela e não enumera todas as posições; a extensão
deve combinar formas conhecidas e geradas, validar e remover duplicatas.
O treino de troca existente é visual; não usá-lo como scheduler de áudio.

No Mac, preparar modelos/bancos fora da callback. A callback não aloca, libera
heap, faz I/O ou usa locks; comandos, vozes e trabalho por bloco têm limites.
No web, o timer apenas alimenta a janela de lookahead; o instante sonoro vem do
relógio do AudioContext. Ao parar ou editar, cancelar sons já agendados para
evitar batidas antigas. Não abrir outro stream de saída ou AudioContext.

## Entregas e commits sugeridos

1. **`Adiciona inversões e formas alternativas de acordes`**: regras no core,
   testes de notas/baixo e seleção coerente com som e partitura.
2. **`Adiciona transporte e sequência de acordes em loop`**: contratos e motores
   Mac/web, play/stop, duração, repetição e mudança de BPM sem deriva. Conferir
   sincronismo com o clique antes de adicionar bateria.
3. **`Adiciona padrões e síntese de bateria de acompanhamento`**: padrões originais
   e testes, relógio compartilhado, liga/desliga, estilo e mixer independente.
4. **`Salva sequências e integra os controles de acompanhamento`**: persistência
   por eventos, recuperação sem autoplay, integração com Acordes e prática,
   verificação renderizada desktop/390 px nos dois temas e documentação real.

Cada entrega termina utilizável no Mac e web, com STATUS atualizado. Esta extensão
não inicia integrações de música de fundo/adaptação da Fase 4, importação de tabs
por URL, companion ou os próximos blocos do Amp.

## Como validar

- **Core:** inversões maiores/menores/com sétima, grafia de acidentes, baixo real,
  deduplicação e forma indisponível; sequência vazia, limite de blocos, durações
  inválidas, repetição e voltas que não coincidem com o compasso; padrões com
  ataques dentro da grade, intensidades válidas e identificação estável.
- **Motores:** sinais sintéticos finitos e limitados; execução longa sem deriva
  entre clique/bateria/acordes, BPM mínimo/máximo, troca de estilo no compasso,
  mudança de volume/mute sem pico; limite de vozes e descarte/cancelamento ao parar.
  No Rust, verificar ausência de alocação/liberação no processamento.
- **Persistência:** salvar/reabrir, exportar/importar e fusão entre dispositivos
  pelas mesmas regras de eventos; nenhum autoplay ou áudio serializado.
- **Uso real:** tocar só bateria, depois somar clique e acordes; comparar os três
  volumes, desligar cada camada, trocar estilo e BPM e repetir play/stop. Conferir
  saída física no Mac, Safari/Chrome e celular real; capturas não provam áudio.
- **Interface:** teclado e foco, claro/escuro, 390 px, movimento reduzido, erros de
  saída e retomada após suspensão. Nenhum som ao abrir ou restaurar dados.
- Ao implementar, rodar core/Rust/contratos, typecheck, suíte web,
  `pnpm --filter desktop build:web` e `pnpm build:app`. Separar no STATUS o que
  passou, o que foi bloqueado pelo ambiente e o que depende do teste físico.
