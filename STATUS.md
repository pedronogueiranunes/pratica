# Status

## Braço, tabs e webapp (20/11/2026)

### Feito
- Tela de exercício: abre ao clicar num exercício no Hoje ou no Roadmap. Mostra o braço da guitarra (SVG, dedos, raiz em laranja, pestana, cordas soltas e abafadas), a tab e o metrônomo. A cada clique do metrônomo a tab avança um passo e a nota acende no braço. Dá para clicar num passo da tab, voltar ao começo ou desligar o "seguir o metrônomo". Mostra também o critério para passar, as metas e os vídeos.
- Tabs geradas em `packages/core/src/fretboard.ts` para 16 exercícios técnicos (spider, cromático, trocas e acordes abertos, dedo-guia, escala maior, pestanas F e Bm, formas móveis, power chords, pentatônica nas 5 posições, hammer-on e pull-off, CAGED, acordes com sétima, dórico). Os de música e teoria mostram "sem tab". Testes conferem as notas de cada acorde e escala.
- Webapp: fora do Tauri, o app usa um motor em Web Audio (`apps/desktop/src/lib/web-engine.ts`) com os mesmos sons e o mesmo YIN do Rust, portados para `packages/core/src/dsp.ts`. Escolha de entrada pelo navegador; escolha de saída onde o navegador deixa (Chrome).
- Deploy pronto: `.github/workflows/pages.yml` faz o build e publica em `/pratica/`.

### Para publicar (precisa ser feito por você ou pelo Claude com acesso ao seu GitHub)
1. Criar o repositório público `pedronogueiranunes/pratica`.
2. `git add -A && git commit -m "Fase 0 e webapp" && git remote add origin git@github.com:pedronogueiranunes/pratica.git && git push -u origin main`
3. Em Settings > Pages, Source: GitHub Actions.
4. O site fica em https://pedronogueiranunes.github.io/pratica/ (se o seu site usa domínio próprio, o GitHub redireciona para o mesmo caminho nele).

### Limites do webapp
- O login do Spotify do Laboratório só existe no app do Mac por enquanto (no web ele vai precisar de redirect para o endereço do site, na Fase 3).
- Latência: o navegador não deixa escolher o buffer; o app do Mac continua melhor para o afinador.

## Fase 0: fundação e provas de risco (18/11/2026)

### Feito
- Monorepo em `~/Dev/guitar-exercises-app` (pnpm + Cargo workspace), fora do iCloud.
- `crates/audio-engine` (Rust): metrônomo com precisão de amostra (5 sons sintetizados, volume, compasso, subdivisão, acento), afinador YIN (nota e cents, Lá ajustável), lista de dispositivos com tipo de conexão, latência medida nos streams, ranking do melhor dispositivo para instrumento e para saída, checagem de dispositivos a cada 3 s. 16 testes.
- `packages/core` (TypeScript): modelos, leitura e validação do seed, rotina sugerida em 3 níveis (Leve 20 min, Normal 40 min, Puxado 60 min), regra do metrônomo (+4 bpm depois de 5 execuções limpas, modo automático ou manual), tap tempo, i18n pt-BR e en, contrato `MusicSource`. 12 testes.
- `data/exercises.seed.json`: campo `metrica` adicionado pelo script `scripts/add-metrics.mjs` (o resto do arquivo ficou intacto).
- `apps/desktop` (Tauri 2 + React 19): barra lateral translúcida do macOS, telas Hoje, Roadmap (lista), Ferramentas (metrônomo e afinador), Ajustes (tema, idioma, dispositivos com recomendação e latência) e Laboratório. Calendário, Músicas e Tocar junto estão como telas vazias.
- Visual: estrutura de app do Mac com a estética de pedronogueira.dev (ver `apps/desktop/DESIGN.md`).
- Atalhos: espaço liga e desliga o metrônomo, setas mudam o bpm (Shift: de 4 em 4), Cmd+1 a 8 trocam de tela.

### Provas para testar no Mac (Laboratório)
1. **Motor de áudio:** metrônomo e afinador em Ferramentas. Antes, dá para testar sem interface: `cargo run -p audio-engine --example smoke`.
2. **YouTube embutido:** carregar um vídeo e ver se toca e se a posição anda. Erro 153 = Referer recusado.
3. **Spotify:** criar um app no dashboard com o redirect `http://127.0.0.1/callback`, colar o Client ID e testar.

### O que ainda não foi verificado
- Nada rodou num Mac ainda. Os testes rodaram em Linux; o build do Tauri e o áudio real (CoreAudio) precisam do primeiro `pnpm dev` aí.
- O cpal 0.18 pede macOS 14.2 ou mais novo.
- No `tauri dev`, o pedido de microfone aparece em nome do Terminal (ou do editor). No app empacotado aparece "Prática".

### Como rodar
Pré-requisitos no Mac: Xcode Command Line Tools, Rust (`rustup`), Node 22+ e pnpm 10.

```sh
cd ~/Dev/guitar-exercises-app
pnpm install
pnpm dev          # abre o app (primeira compilação do Rust demora alguns minutos)
pnpm test         # testes do core e do motor de áudio
pnpm web          # webapp local (motor em Web Audio)
pnpm build        # gera o .app e o .dmg em target/release/bundle
```

### Próximo: Fase 1
Registro de prática com contador e SQLite, calendário, as quatro visões do roadmap, rotina editável, metrônomo ligado à regra de progressão por exercício, log de eventos para o iCloud Drive.
