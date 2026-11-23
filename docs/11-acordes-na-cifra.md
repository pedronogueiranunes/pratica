# Acordes na cifra

Extensão local de 23/11/2026. Em **Músicas**, a cifra passa a oferecer a mesma
exploração de acordes e o rascunho de sequência já existentes no app.

## Uso

- Clique em um acorde da cifra ou no diagrama da faixa de acordes para abrir
  o painel. Ele mostra diagrama, pauta, baixo/inversão e até seis formas
  validadas, conforme a disponibilidade do acorde.
- **Som ao selecionar** controla a prévia nas escolhas. **Tocar acorde**
  reproduz a forma atual; o volume é ajustável. É som de referência, não
  reprodução da gravação da música.
- **Adicionar à sequência** acrescenta a forma exata selecionada ao rascunho
  existente, com quatro tempos, preservando os blocos anteriores. O limite
  continua 16 blocos. **Abrir sequência** leva ao editor compartilhado; use
  **Salvar sequência** para manter a alteração.
- A exploração não reescreve a cifra, os metadados ou sua revisão. Seleção de
  baixo e forma vale para a sessão do painel. Transpor, trocar de música ou
  receber outra revisão remonta o painel e interrompe a prévia, sem autoplay.
  Alterar o capo também remonta o painel. Ocultar a página ou sair interrompe
  o som. **Fechar acorde** devolve o foco ao acorde inline que abriu o painel.

## Capo e altura real

O capo explícito da música (`song.capo`, de 0 a 12) prevalece sobre o da cifra
(`doc.meta.capo`); sem ambos, vale zero. Zero explícito significa **Sem capo**
e não herda a cifra. O editor oferece **Da cifra, se informado**, **Sem capo**
e **Casa 1** até **Casa 12**.

O diagrama usa casas relativas ao capo. Som e pauta usam a altura real. Por
exemplo, uma forma de C com capo na casa 2 soa como D. Ao adicionar à sequência,
`chordAtCapo` converte nome, casas e pestana para a posição absoluta: a sequência
recebe a forma que soou, sem depender depois do capo da música. A conversão usa
a validação musical existente e não altera a forma de origem.

Se não houver forma validada para o acorde e capo, o painel informa a limitação
e não oferece áudio, pauta ou adição de uma forma inventada. Experimente outro
baixo ou confira o capo. Falhas de prévia exibem orientação para conferir a
saída em Ajustes.

## Sistema preservado e evidências

A leitura de `SongChords.tsx`, `ChordChart.tsx`, `Songs.tsx`, `chord-voicing.ts`,
`chord-options.ts` e dos estilos do painel sustenta uma extensão **Operate**:
mantém neutros quentes e laranja, Manrope/Hanken/Geist, botões em pílula,
seletores existentes e foco visível. Os acordes inline têm área mínima de
44 × 44 px; ações se reorganizam em janela estreita, com diagrama e pauta
empilhados. `apps/desktop/PRODUCT.md` e `apps/desktop/DESIGN.md` permanecem
preservados, sem mudança de identidade ou tokens. A divergência preexistente
entre a lista de telas de PRODUCT e a navegação não foi corrigida nem promovida
a regra do sistema.

- Há oito PNG em `target/qa-songchords/`: desktop a 1440 px e mobile a 390 px,
  claro e escuro, pauta, cifra e estado sem forma disponível. Capturas registram
  esses estados. Revisão independente **ship**, sem correções materiais; escopo
  visual e leitura do código, sem escuta física.
- Resultados desta etapa: **152 testes de core**, **25 de áudio
  Rust**, **11 do store Rust** e **17 do contrato SQLite** passaram. A suíte web
  controlada de captura, prévia, sequência e service worker também passou.
- Build:web (inclui typecheck), build:app final e `git diff --check` passaram.
  Bundle local em `target/release/bundle/macos/Prática.app`, 16,14 MiB.
- `pnpm test` não recebeu aprovação global: o Chrome headless abortou com
  SIGABRT/EPERM. Não há validação em iPhone físico, escuta em saída física ou
  teste de sincronização iCloud nesta etapa.

Não houve mudança de esquema ou de eventos. A adição usa o rascunho e o fluxo
de salvamento existentes. As provas acima não atestam timbre, latência física
ou sincronismo perceptivo em equipamento real.

Para testar: abra uma música com cifra e clique em um acorde. Troque inversão
e forma, desative Som ao selecionar e use Tocar acorde pelo teclado. Adicione
à sequência, abra o editor e confira nome e casas. Com capo 2, C deve entrar
como D. No editor da música, compare capo explícito, Sem capo e Da cifra.
Feche o detalhe e confira o foco no acorde acionado. Repita nos dois temas.
