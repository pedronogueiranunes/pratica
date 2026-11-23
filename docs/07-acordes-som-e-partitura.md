# Acordes: som ao clicar e partitura

Pedido do Pedro em 23/11/2026, com referências visuais enviadas na conversa.
**Implementado na biblioteca Acordes nesta sessão.** Este registro substitui o
plano inicial e descreve o comportamento, as decisões e os limites da entrega.

## Comportamento entregue

- Clicar ou ativar um cartão por Enter/Espaço seleciona o acorde e, com
  **Som ao selecionar** ligado, toca a prévia. Ativar o mesmo cartão repete o som
  da forma selecionada e mantém o detalhe aberto; **Fechar** encerra o detalhe.
- **Tocar** repete a prévia. O seletor nativo **Posição no braço**, com nome
  acessível **Forma do acorde**, oferece as opções **Forma 1**, **Forma 2** etc.
  Trocar de forma atualiza o diagrama, a partitura e as alturas reproduzidas
  juntos, e toca automaticamente se a opção estiver ligada.
- A prévia automática começa ligada e o volume em 50%. Os dois controles são
  estado da sessão da biblioteca, sem persistência; remontar a biblioteca restaura
  os valores iniciais. Desligar a prévia automática permite navegar em silêncio e
  mantém o botão Tocar disponível. Volume zero desabilita Tocar.
- Foco, busca e abertura da tela não disparam som. Os cartões usam um único botão,
  sem botões aninhados. Os controles conservam o foco visível do app.
- Fechar, sair da biblioteca, navegar para outra tela ou ocultar a aba interrompe
  a prévia. Alterar volume ou desligar a prévia automática também interrompe o som.
  Uma nova prévia substitui a anterior com transição curta e polifonia limitada.
- Sem forma válida, o detalhe informa a indisponibilidade; não inventa notas para
  preencher áudio ou partitura. Falhas de reprodução aparecem como alerta textual.
- Ouvir uma prévia não cria registro de prática nem evento de sincronização.
  A troca de acordes com metrônomo não ganhou acompanhamento automático.

## Variação, baixo e posição no braço

O detalhe da biblioteca ganhou três seletores nativos, operáveis pelo teclado:

| Rótulo visível | Nome acessível | Comportamento |
|---|---|---|
| Variação | Variação do acorde | Muda a qualidade ou extensão do acorde sobre a mesma fundamental; por exemplo, C para Cm ou C7. Volta ao baixo fundamental. |
| Baixo / inversão | Baixo ou inversão | Mantém a variação e escolhe a fundamental ou outro grau como baixo; por exemplo, C para C/E. Preserva também um baixo explícito digitado. |
| Posição no braço | Forma do acorde | Escolhe entre as formas disponíveis para o nome completo, incluindo o baixo. Cada opção indica cordas soltas ou a casa inicial. |

Variação e inversão são escolhas diferentes: a primeira muda o acorde; a segunda
muda o baixo. Alterar qualquer uma reinicia a posição na primeira forma e
interrompe a prévia anterior. Com **Som ao selecionar** ligado, toca a nova forma;
com ele desligado, mantém a navegação silenciosa. **Treinar troca** recebe o nome
completo escolhido no detalhe, mas continua sem acompanhamento automático.

`packages/core/src/chord-options.ts` concentra as opções musicais. `chordVariations`
inclui a variação atual e as alternativas suportadas; `chordInversions` deriva os
baixos dos graus do acorde e conserva o baixo explícito informado.
`alternativeChordShapes` combina primeiro formas conhecidas e depois calculadas,
remove duplicatas pela posição de cada uma das seis cordas, rejeita formas que
`chordVoicing` não valida e limita o resultado a **seis formas**. Formas calculadas
não são garantia de conforto: a interface pede que o músico confira a posição
na mão.

O detalhe usa uma única forma selecionada para o diagrama, o som e a pauta. Não
mostra uma inversão no título enquanto reproduz outra forma. Se não houver forma
válida, o seletor de posição fica desabilitado com **Sem forma disponível**,
**Tocar** fica desabilitado e uma mensagem sugere outro baixo ou variação; a pauta
não é preenchida com notas inventadas.

O parser de nomes de acordes aceita acidentes simples nos nomes de inversão.
Quando um grau exigiria acidente duplo, essa opção não é oferecida com uma grafia
enarmônica de outro grau apenas para preencher o seletor. Isso não altera o
suporte de acidentes duplos na grafia da pauta descrito abaixo.

Variação, baixo e posição são estado local da sessão da biblioteca, sem salvar
preferência. Abrir outro cartão seleciona seu nome e a primeira forma; remontar
a biblioteca limpa essas escolhas. A persistência já existente da aba e da
configuração de treino permanece separada.

## Uma forma para diagrama, som e partitura

`packages/core/src/chord-voicing.ts` deriva MIDI, frequência, grafia e posição na
pauta a partir da mesma forma validada que alimenta o diagrama. Usa `fretMidi` do
core, sem duplicar a afinação na UI ou nos adaptadores. `Chords.tsx` passa a forma
selecionada a `chordVoicing` e usa o resultado tanto para o áudio quanto para
`ChordStaff`.

- Respeita cordas abafadas e soltas, baixo/inversão e as notas efetivas da forma.
  Não completa artificialmente graus ausentes. Alturas em oitavas distintas são
  preservadas; uníssonos de mesma grafia aparecem uma vez na pauta, embora as
  cordas continuem representadas no modelo e na síntese.
- A grafia segue o grau do acorde, com alterações simples ou duplas, e respeita
  o baixo explícito. Formas incompatíveis com o acorde são rejeitadas.
- A referência de frequência A4 vem do ajuste existente do afinador, entre
  400 e 480 Hz. Não há outra referência de afinação própria da biblioteca.
- A pauta usa a convenção transpositora da guitarra: clave de sol com indicação
  de oitava e escrita **12 semitons acima** da altura que soa. O texto sob a pauta
  e sua descrição acessível explicam essa relação e enumeram as notas sonoras.
- A representação é um acorde estático. Não infere duração, compasso, ritmo ou
  BPM de música a partir do nome do acorde.

## Áudio e notação locais

A prévia é síntese original de senoidais com parciais, envelope de ataque e
liberação, decaimento e ganho baixo. Dura até 1,4 segundo, aceita até seis notas e
normaliza o ganho pela quantidade de vozes. Não usa samples de terceiros, novas
licenças de conteúdo nem fontes empacotadas adicionais; é som de referência,
sem promessa de reproduzir o timbre de uma guitarra gravada.

- **Mac:** `crates/audio-engine/src/preview.rs` sintetiza a prévia e `engine.rs`
  mistura esse sinal na saída existente usada pelo metrônomo. Não abre uma saída
  concorrente para o acorde. A transição é de 10 ms e a soma tem teto de saída.
- **Web:** `apps/desktop/src/lib/web-engine.ts` compartilha o `AudioContext` do
  metrônomo, iniciado/retomado pela ação do usuário. Substituição e parada usam
  liberação curta; a soma passa por limitação na saída. Navegadores sem seleção
  de dispositivo mantêm a saída padrão.
- **Partitura:** `apps/desktop/src/components/ChordStaff.tsx` é um renderizador
  SVG local, sem biblioteca adicional. Desenha notas, acidentes e linhas
  suplementares; posiciona notas vizinhas e acidentes em colunas para evitar
  colisões. A clave usa fallbacks musicais nativos, sem carregar nova fonte.
- **Interface:** controla seleção e comandos de reprodução. O cálculo musical
  fica no core e o agendamento de áudio não depende de timers do React.

## Preservação do sistema visual

A extensão conserva a identidade existente descrita em `apps/desktop/DESIGN.md`:
neutros quentes, acento laranja, Manrope nos títulos, Hanken Grotesk no corpo,
Geist Mono nos números, botões em pílula e painéis contidos. A pauta herda as
cores de texto, fundo e linhas do tema; não introduz uma paleta independente.

Não houve escolha de novo mundo visual, comp aprovado ou mudança deliberada de
tokens. O acréscimo reutiliza painéis, botões, seletores nativos, controles
segmentados e foco visível existentes. No desktop, diagrama e pauta ficam lado a
lado; quando o conteúdo fica estreito (até 620 px), empilham. Em 390 px, cabeçalho e controles
quebram linhas e a pauta acompanha a largura disponível.

## Evidências e limites da validação

- Core: **119 testes aprovados**. Motor de áudio: **20 testes aprovados**.
  Testes da prévia web, typecheck e build web também passaram.
- Revisão externa da extensão: parecer **ship**, sem achados materiais, com seis
  capturas válidas em `target/qa-chords/`: `desktop-light.png`,
  `desktop-dark.png`, `mobile-light.png`, `mobile-dark.png`,
  `mobile-light-staff.png` e `mobile-dark-staff.png`.
- As capturas cobrem claro/escuro e 390 px, incluindo a pauta. A interação usa
  controles nativos de teclado e o SVG oferece título, descrição e notas em
  texto; isso não equivale a uma prova completa com leitor de tela.
- Os builds `pnpm build:app` e `pnpm --filter desktop build:web` passaram.
  Os testes automatizados não comprovam escuta em saída física, volume real,
  ausência perceptiva de estalos ou funcionamento em todo dispositivo/navegador.
  Não foi declarado teste de áudio físico nesta entrega.

### Validação da extensão de variações e inversões

- Core: **136 testes aprovados**; typecheck, `build:web` e `build:app` passaram.
- Revisão independente, em contexto novo: parecer **ship**, sem correções
  materiais. As seis capturas desta extensão estão em `target/qa-inversions/`:
  `desktop-light.png`, `desktop-dark.png`, `mobile-light.png`, `mobile-dark.png`,
  `mobile-light-staff.png` e `mobile-dark-staff.png`.
- A extensão segue a direção **Operate**, preservando o sistema visual existente
  e reutilizando seus campos e temas. Não estabelece novos tokens nem outro
  mundo visual; não exige alteração de `DESIGN.md` ou do sidecar de design.
- Áudio em saída física continua **não testado**. As evidências automatizadas e
  visuais não comprovam escuta, timbre ou ausência perceptiva de estalos.

## Fora desta entrega

Importação automática de tablaturas por URL é um pedido futuro separado,
registrado em `docs/06-fase-3-plano.md` e nos requisitos; não foi
implementada por esta extensão. Reaproveitar a prévia nos exercícios ou nas
cifras também exige trabalho posterior.

A prova Amp A0 permanece bloqueada pela necessidade de `.nam` real, interface e
loopback físico. Esta entrega não aprova A1, TONE3000, uma nova fase ou a Fase 4.
