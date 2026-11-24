# Guias dos exercícios e nova bateria

## Guias dos exercícios sem tab

Os 29 exercícios da rotina diária que mostravam "Sem tab para este" agora abrem um guia: introdução, passos, pontos de atenção e, quando faz sentido, ritmo, trecho, vídeo embutido e andamento sugerido.

- Conteúdo em `packages/core/src/exercise-guide.ts` (`EXERCISE_GUIDES`, `exerciseGuide(id)`, `studyTempo(bpmOriginal, porcentagem)` com mínimo de 30 bpm).
- Interface em `apps/desktop/src/components/ExerciseGuide.tsx`, usada na tela do exercício. O andamento sugerido aplica no metrônomo.
- Teste em `packages/core/test/exercise-guide.test.ts`.

## Bateria do backing track

A bateria foi refeita porque os ritmos não batiam com os gêneros e o som era genérico.

- Oito instrumentos sintetizados: bumbo, caixa, chimbal fechado, chimbal aberto, aro, nota fantasma, prato de condução e sino. Sem samples de terceiros.
- Doze padrões: rock, reggae, indie, metal, ska, afrobeat, bumbo simples, bumbo e chimbal, funk, disco, bossa e drum and bass. Os ids antigos foram mantidos para não quebrar sequências salvas.
- Cada compasso tem 16 passos em máscara de bits: bumbo 1, caixa 2, chimbal 4, chimbal aberto 8, aro 16, fantasma 32, ride 64, sino 128. Chimbal fechado corta o aberto.
- O mesmo desenho existe em TypeScript (`packages/core/src/drums.ts`, usado pelo webapp) e em Rust (`crates/audio-engine/src/drums.rs`, usado pelo app). O teto de amostra do Rust é 0,95. O armazenamento aceita os novos ids (`crates/practice-store`).

## Pendente

Ouvir os doze estilos no Mac, no Safari e no celular, e ajustar o que soar fora do gênero.
