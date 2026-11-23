# Braço interativo

Primeiro bloco de 3C, em 23/11/2026. Exploração manual em afinação padrão:
seis cordas, casas 0 a 24, total de 150 posições. Mi agudo fica em cima.

## Uso

- Em **Ferramentas**, use **Braço** para ver todas as notas ou destacar um
  acorde ou escala. **Usar uma forma** carrega uma forma disponível do catálogo.
  Os destaques mostram classes de notas, não uma sugestão de digitação.
- Clique para escolher uma nota por corda. Outra casa na mesma corda substitui
  a anterior; repetir a posição a desmarca. **Limpar notas** esvazia a seleção.
- A identificação exige todas as classes de notas do acorde e não completa
  notas ausentes. O catálogo compara 18 sufixos: maior, m, 5, dim, aug, sus2,
  sus4, 6, m6, 7, 7M, m7, m7(b5), dim7, add9, 9, m9 e 6/9. Pode haver mais de
  uma resposta, como **C6** e **Am7/C**. O baixo considera a altura real das
  posições, não a ordem dos cliques. Sem correspondência exata, o app informa
  a limitação, sem inventar um acorde.
- As cinco escalas são maior, menor natural, pentatônica menor, pentatônica
  maior e dórica, calculadas por intervalos. **Usar bemóis** alterna a grafia;
  o destaque de acorde respeita sua grafia teórica.
- Na forma de um acorde da cifra, expanda **Ver no braço completo**. O braço
  recebe as casas reais, já convertidas pelo capo; o diagrama pequeno continua
  relativo ao capo. Uma forma de C com capo 2 aparece no braço nas posições
  absolutas e soa como D. **Repor forma da cifra** restaura essas posições.
  A exploração não altera a cifra, não persiste a seleção e não cria tablatura
  por clique.
- **Ouvir seleção** aciona a API de prévia já existente, com ganho inicial de
  40%, saída escolhida em Ajustes e referência A4 do afinador. Não há autoplay
  ao abrir o braço ou clicar nas notas. A seleção é som de referência com os
  recursos de áudio existentes, sem novas amostras. Alterar notas ou volume,
  ocultar a página ou desmontar o painel interrompe a prévia.
- Tab entra em uma única posição do grid. Setas percorrem casas e cordas;
  Home e End vão às casas 0 e 24; Enter ou Espaço seleciona. O foco acompanha
  a rolagem. Em janela estreita, role o braço horizontalmente para ver as
  outras casas; os controles se reorganizam acima dele.

## Sistema preservado

A leitura de `packages/core/src/fretboard-explorer.ts`, `FretboardExplorer.tsx`,
`Tools.tsx`, `SongChords.tsx` e dos estilos `fret-*` sustenta uma extensão
**Operate** do sistema existente. A paleta continua neutra e quente, com
laranja para fundamental, seleção e foco. Mantém Manrope/Hanken e usa Geist
Mono nas notas e casas, botões em pílula, controles de pelo menos 44 px e
foco visível. A fundamental tem contorno; a seleção tem preenchimento,
distinguindo os estados além do texto. O braço preserva células de 52 × 48 px
e rolagem horizontal em vez de comprimir as notas no celular.

`apps/desktop/PRODUCT.md`, `apps/desktop/DESIGN.md` e os tokens permanecem
preservados. A divergência preexistente entre a lista de telas de PRODUCT e
a navegação não foi corrigida nem promovida a regra para novas superfícies.
Os dados são teoria musical calculada e os recursos originais de áudio já
existentes; não foram acrescentados metadados de músicas ou amostras externas.

## Evidências e limites

- Há oito capturas em `target/qa-fretboard/`, cobrindo 1440 e 390 px, claro e
  escuro, controles, seleção, ponta do braço e integração à cifra.
- Resultados informados nesta etapa: **166 testes de core** e **17 do contrato
  SQLite** passaram. A suíte web controlada de prévia, captura, sequência e
  service worker também passou.
- Testes Rust separados: **25 audio-engine + 11 practice-store** passaram.
  Typecheck e build:web passaram. Revisão independente **ship**, sem correções
  materiais nas oito capturas e no código examinado. Launcher/detector visual
  bloqueados por permissão; conferência manual.
- Build:app final passou (16,14 MiB). Instalado em `/Applications/Prática.app`
  pelo Finder; três arquivos conferidos por SHA-256, sem divergências do bundle.
  Backup anterior em `target/app-backups/Pratica-antes-braco-20261123-185052.app`.
- `pnpm test` não teve aprovação global: Chrome headless abortou no ambiente
  com SIGABRT/EPERM depois das etapas anteriores.
- Não houve teste físico de áudio nem teste no Safari. Capturas e validação
  controlada não comprovam a escuta ou o comportamento de todo WebView.
- Este bloco não implementa microfone/YIN no braço, cromagrama polifônico ou
  avanço automático da cifra pelo metrônomo. A identificação usa somente a
  seleção manual e o catálogo exato descrito acima.
