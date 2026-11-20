# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Tauri 2 (WebView do macOS) + React 19 + TypeScript + Vite. Motor de áudio em Rust (`crates/audio-engine`), núcleo de regras em TypeScript (`packages/core`). Decidido com o Pedro em 18/11/2026; ver `docs/05-stack-e-apis.md`.

## Users
Um usuário: o Pedro. Dev front-end sênior, toca violão há anos e está começando na guitarra elétrica. Usa o app durante a prática diária, com a guitarra no colo, olhando a tela de longe, num monitor ultrawide, muitas vezes ao lado do Ableton Live.

## Product Purpose
Companheiro da prática diária de guitarra: guia o roadmap de 6 meses (dexteridade, acordes, escalas), dá metrônomo e afinador de baixa latência, registra o que foi praticado e, depois, usa as músicas que ele ouve. Sucesso é praticar quase todo dia sem atrito e ver o progresso acumulado.

## Positioning
Feito em cima do roadmap e do repertório do próprio Pedro, não um curso genérico. Sem pressão: roadmap sem datas, o app acompanha e registra.

## Operating Context
- Guitarra no colo, mãos ocupadas: leitura à distância, números grandes, poucos cliques.
- Teclado: atalhos para iniciar e parar o metrônomo, mudar BPM e navegar.
- Ultrawide, às vezes dividindo a tela com o Ableton: painéis lado a lado quando há espaço, bom comportamento em janela estreita.
- Entradas de áudio variadas (microfone embutido, interface USB); a escolha e a latência importam.

## Capabilities and Constraints
- Telas: Hoje, Roadmap (timeline, fases, lista, grid), Calendário, Músicas, Tocar junto (companion), Ferramentas (metrônomo e afinador), Ajustes.
- Português do Brasil, i18n pronto para inglês.
- Sem emojis. Ícones SVG line art com traço consistente.
- Claro e escuro, seguindo o sistema por padrão.
- Dados musicais nunca inventados: BPM, tom e cifras vêm do Pedro ou de fontes licenciadas.

## Brand Commitments
- Nome: Prática.
- Referência visual fixada pelo Pedro: minimalista e elegante como os apps da própria Apple (hierarquia clara, bastante espaço, tipografia forte, movimento sutil).
- Textos curtos, humanos, diretos, sem travessão longo e sem cara de texto gerado por IA.

## Evidence on Hand
- Catálogo real de 45 exercícios em `data/exercises.seed.json`, com 17 vídeos do YouTube.
- Roadmap em `docs/01-roadmap.md`, repertório em `docs/03-gosto-musical-e-repertorio.md`.
- Nada de depoimentos, métricas ou dados de uso inventados.

## Product Principles
1. A prática vem primeiro: tudo que é usado durante o exercício cabe num olhar e num atalho.
2. Sem cobrança: o app registra e sugere, nunca pune.
3. Precisão onde importa: tempo e afinação são exatos, ou o app avisa que não são.
4. Poucas telas, bem organizadas; mais painéis quando a tela é grande.

## Accessibility & Inclusion
Leitura a 1 m ou mais: números de metrônomo e afinador grandes, contraste alto. Tudo operável pelo teclado.
