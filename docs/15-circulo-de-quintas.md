# Círculo de quintas (24/11/2026)

Ferramenta em Ferramentas, antes do Braço. Doze posições em ordem de quintas,
com maior e relativo menor no mesmo botão. Selecionar uma posição mostra tom,
relativo, armadura na ordem dos acidentes, sete notas e tríades diatônicas com
seus graus e notas. O modo Menor natural usa a escala e o quinto grau menores;
não aplica alterações de menor harmônica ou melódica.

## Teoria no core

`circle-of-fifths.ts` gera as 15 armaduras de -7 a +7 por ordem das quintas e
aplica acidentes às sete letras. Não usa transposição cromática com grafia
aproximada: F# maior mantém E#, Gb maior mantém Cb, Cb maior mantém Fb e C# maior
mantém B#. As tríades são empilhamentos de terças das próprias notas da escala,
conferidas nos testes contra `chordTones`.

Posições enarmônicas: B/Cb, F#/Gb e Db/C#. Grafia enarmônica permite escolher a
armadura dentro da posição selecionada. Mesma altura não significa mesma escrita.
Sem dados de músicas, progressão sugerida ou áudio automático. Não muda tom da
cifra, sequência ou ajustes. Escolha local ao painel; volta a C maior ao remontar.

## Interface e teclado

`CircleOfFifths.tsx` reutiliza painel, seletor e controle segmentado existentes.
Botões HTML com estado pressionado, foco visível e um tab stop no círculo. Setas
percorrem posições e atualizam a escolha; Home vai a C/Am, End a F/Dm. Setas
consumidas não alteram BPM. Enter/Espaço usam a ativação nativa do botão.

No desktop, círculo e informações lado a lado. Em janelas menores, informações
abaixo. Alvos de toque medidos em cerca de 56,5 px em 390 px de viewport, sem
rolagem horizontal. Claro/escuro seguem os tokens existentes. Nada de migração,
dependências ou alterações de motor/persistência nesta extensão.

## Verificação

- 202 testes core, com 19 novos casos: percurso das quintas, 15 armaduras, escalas
  maiores/menores naturais, relativas, grafias enarmônicas e todas as tríades.
- Typecheck, build:web, build:app, contratos SQLite 17 e testes web controlados.
  Rust 27 audio-engine + 11 practice-store. Nenhuma mudança Rust nesta ferramenta.
- `PRACTICE_TEST_BROWSER=chrome pnpm test` executou core/web/SQLite e abortou ao
  iniciar Chrome headless (SIGABRT/EPERM); não é aprovação da suíte global.
  IndexedDB real não repetido; armazenamento não mudou.
- Chrome conectado: C/G/F por teclado, troca F#/Gb e Eb menor natural, armadura e
  campo harmônico, um botão pressionado e um tab stop, sem alteração do BPM.
  Seis capturas em `target/qa-fifths/`, desktop1440/móvel390 claro/escuro. Corpo
  móvel com390px e console sem erros observados. Safari/iPhone físico pendentes.
- Revisão independente **ship**, incluindo conferência da teoria e das seis
  capturas. Documentação coerente; DESIGN/PRODUCT/tokens preservados.

## Como testar

Abrir `target/release/bundle/macos/Prática.app` ou rodar `pnpm web --host 127.0.0.1`.
Ir a Ferramentas → Círculo de quintas. Escolher um tom, alternar Maior/Menor natural,
ver notas e campo harmônico. Em F#/Gb, alternar a grafia e comparar E#/Cb. No teclado,
usar Tab até o círculo e navegar pelas setas, Home/End e Espaço.

Extensão de teoria solicitada pelo Pedro. Não conclui a 3C, que ainda aguarda
avanço da cifra pelo metrônomo; não inicia Fase4.
