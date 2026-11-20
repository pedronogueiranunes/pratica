# Guitar Exercises App

App de prática diária de guitarra do Pedro. Leia primeiro, nesta ordem:

1. `docs/04-requisitos-do-app.md`: features, telas, design, riscos técnicos e fases de desenvolvimento.
2. `docs/01-roadmap.md`: o plano de 6 meses que o app precisa guiar.
3. `data/exercises.seed.json`: catálogo inicial de exercícios, com fases, bpm, metas e vídeos.
4. `docs/02-exercicios-videos.md` e `docs/03-gosto-musical-e-repertorio.md`: material de apoio.

## Regras de trabalho
- Responder e escrever textos da interface em português do Brasil.
- Textos soam humanos, curtos e diretos. Sem travessão longo e sem frases com cara de texto gerado por IA.
- Sem emojis na interface. Ícones SVG de line art, traço consistente.
- Por enquanto só Mac, mas a lógica (dados, regras do roadmap, agendamento do metrônomo, detecção de altura) deve ficar separada da camada de interface para portar depois para iOS, Android, Windows e Linux.
- Se a interface usar tecnologia web, usar a skill Impeccable (github.com/pbakaus/impeccable).
- Fontes de música ficam atrás de uma interface comum (buscar, tocar, pausar, posição atual). Ver "Fontes de música" em `docs/04-requisitos-do-app.md`.
- Não inventar dados musicais. Cifras, BPM e tom vêm do usuário ou de fontes com licença. Ver "Pontos técnicos" em `docs/04-requisitos-do-app.md`.
- Trabalhar por fases. Ao fim de cada uma, o Pedro deve conseguir abrir e usar o app. Atualizar `STATUS.md` ao terminar cada fase (decisões, o que falta, como rodar).
- Antes de decisões grandes (stack, fonte de cifras, integração com Spotify), propor opções e esperar a resposta do Pedro.
- Nunca enviar, publicar ou postar nada em nome do Pedro sem aprovação explícita dele para aquela ação.

## Contexto do Pedro
Desenvolvedor front-end sênior (Webflow, design engineering), no Mac. Toca violão há anos, está começando na guitarra elétrica, conhece acordes abertos básicos, troca acordes devagar e não conhece escalas. Gosta de indie rock, reggae e drum n bass. Produz música eletrônica no Ableton Live sob o nome "peeeo". Usa monitor ultrawide.
