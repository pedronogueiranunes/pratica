# Design

Direção fixada pelo Pedro: estrutura de app de Mac no padrão da Apple (barra lateral, hierarquia clara, contenção), vestida com a estética pessoal dele, tirada do design system de pedronogueira.dev (`~/Dev/pedronogueira-portfolio-2026/DESIGN.md`): laranja #FF5A1F, neutros quentes, Manrope nos títulos, Hanken Grotesk no corpo, Geist Mono nos números e rótulos técnicos, Silkscreen (pixel) em toques pequenos, botões em pílula.

## Cena
Sala de prática, luz de casa ou de monitor à noite, guitarra no colo, tela a 1 m. Claro e escuro seguem o sistema; o escuro é o caso mais comum à noite e precisa ser tão cuidado quanto o claro.

## Estrutura
- Janela com barra de título integrada (botões de semáforo sobre a barra lateral).
- Barra lateral translúcida do macOS (efeito "sidebar"), 224 px, com as telas. Conteúdo em fundo sólido.
- Em telas largas (container ≥ 1400 px) as Ferramentas e o Hoje mostram painéis lado a lado; no ultrawide (≥ 2200 px) cabem três colunas.

## Cor (estratégia contida)
Neutros quentes do portfólio e um acento: **laranja #FF5A1F**, só para o que está vivo (tempo tocando, botão principal, seleção). "Afinada" usa o verde-oliva do portfólio no claro (#53634F) e o lima (#D4FF4F) no escuro.

| Token | Claro | Escuro |
|---|---|---|
| `--bg` | #FBF9F5 | #161616 |
| `--bg-raised` | #F5F1EA | #1E1E1E |
| `--bg-sunken` | #EDE7DC | #0D0D0D |
| `--fg` | #111111 | #F5F3EF |
| `--fg-2` | #6B6660 | #9C9890 |
| `--line` | #E6DFD2 | #2A2A2A |
| `--accent` | #FF5A1F | #FF5A1F |
| `--in-tune` | #53634F | #D4FF4F |

## Tipo
- Títulos: Manrope 700, tracking -0.025em. Números grandes (BPM, nota): Manrope 700, 88 a 160 px, tabular.
- Corpo: Hanken Grotesk 14/20.
- Números e rótulos técnicos (minutos, bpm, ms, cents, atalhos): Geist Mono.
- Marca e rótulos pequenos: Silkscreen (pixel), em minúsculas, uso raro.
Fontes empacotadas com o app via @fontsource (funcionam offline).

## Forma e profundidade
Botões em pílula (999 px), campos com raio 8 a 10 px, painéis com 16 px. As batidas do metrônomo são quadradinhos de pixel, eco do pixel art do portfólio. Painéis separados por espaço e uma linha de 1 px, sem sombra. Sombra só em elementos flutuantes (menus): `0 8px 24px rgba(0,0,0,.18)`.

## Ícones
SVG line art próprios, grade de 20 px, traço 1.5 px, pontas e junções arredondadas, `currentColor`.

## Movimento
Um momento autoral: o pulso do metrônomo (o quadradinho do tempo acende em laranja e apaga em ease-out exponencial, 180 ms). O resto é quase imóvel: transições de 120 ms em hover e seleção. Respeita `prefers-reduced-motion`.

## Superfícies do navegador
Seleção de texto no laranja suave, foco visível com anel de 3 px no acento, barras de rolagem finas no tom da linha, sem rubber band no fundo.
