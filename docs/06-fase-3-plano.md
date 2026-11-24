# Fase 3: músicas e cifras (plano aprovado em 22/11/2026)

## Decisões do Pedro
- Fontes de cifra: colar texto, arquivo ChordPro/.txt e link de origem. Raspagem de Cifra Club, Songsterr e similares descartada. Fonte licenciada com API fica para depois (contrato `origin: "fonte"` reservado).
- Login e importação de playlists do Spotify/YouTube: Fase 4.
- Semente: músicas da tabela de `03-gosto-musical-e-repertorio.md` só com título, artista e fase. Sem BPM, tom ou cifra.
- Cifra com revisões imutáveis; edições concorrentes aparecem como conflito, sem LWW silencioso.
- Webapp ganha service worker e `navigator.storage.persist()`.
- Braço completo em SVG em Ferramentas e ao lado da cifra: todas as notas, acordes e escalas destacáveis, com animação do que está soando. Origens: microfone (notas, via YIN), microfone (acordes, cromagrama, experimental), cifra avançando pelo metrônomo e clique no braço com identificação do acorde.

## Modelo
- `Song`, `Playlist`, `Chart` em `packages/core` (`songs.ts`, `chordpro.ts`, `chart-import.ts`).
- Eventos `song.saved` e `playlist.saved` (LWW por id, exclusão por tombstone) e `chart.revised` (só acrescenta, fusão por revisão).
- Origem explícita de BPM e tom: usuário, arquivo, diretiva da cifra ou fonte licenciada. O app nunca estima BPM.
- SQLite `user_version=2` e IndexedDB `pratica.v1` na versão 2 (mesmo nome, para o webapp publicado não perder dados), migração só aditiva.

## Achado antes de começar
Em `crates/practice-store/src/sync.rs`, um evento de tipo desconhecido faz `apply` falhar e o arquivo do outro aparelho é tratado como incompatível. Um Mac desatualizado deixaria de sincronizar tudo. Primeiro commit da fase: guardar eventos desconhecidos sem aplicar e seguir a fila, com teste Rust; espelhar no IndexedDB.

## Entregas
- **3A:** tolerância a eventos desconhecidos, migração v2, core de músicas/ChordPro/importação, tela Músicas (lista, detalhe, editor, importar com prévia, cifra com transposição e capo), semente do repertório.
- **3B:** playlists, exportar/importar (.chordpro e pacote .json), service worker e persistência no web, conflito de revisões na interface.
- **3C:** braço completo (core: mapa de notas, identificação de acordes por conjunto de notas, cromagrama; interface: painel em Ferramentas e na música).

### Progresso da 3C em 23/11

Primeiro bloco implementado localmente em `12-braco-interativo.md`: mapa das
150 posições (casas 0–24), acordes e cinco escalas, seleção manual, identificação
exata com ambiguidades e som de referência. Integrado a Ferramentas e ao acorde
explorado na cifra, com casas reais do capo. Não encerra a 3C: falta ligar YIN
ao braço, cromagrama experimental e avanço da cifra pelo metrônomo. Esses modos
não são simulados por animações do bloco manual.

### Progresso da 3C em 24/11

Segundo bloco implementado localmente: notas captadas pelo YIN destacadas no
braço, usando a entrada compartilhada do afinador, sem inferir a corda ou mudar
a seleção manual. Testes sintéticos e UI documentados em
`13-notas-captadas-no-braco.md`. Ainda faltam cromagrama experimental e avanço
da cifra pelo metrônomo; a 3C permanece parcial.

### Progresso da 3C: cromagrama (24/11)

Terceiro bloco local em `14-cromagrama-experimental.md`: espectro opt-in na mesma
captura do afinador, cromagrama e correspondência exata de classes no core,
anéis no braço em todas as oitavas. Experimental, sem inferir baixo/corda e sem
transcrição. Testado com sinais sintéticos; guitarra real e carga/atraso no Mac
pendentes. Falta o avanço da cifra pelo metrônomo para concluir a 3C.

## Como testar

- 3A: testes do core com cifras coladas que o Pedro fornecer; contrato SQLite/IndexedDB ampliado; testes Rust de revisões e evento desconhecido; no app, colar, corrigir, salvar, transpor e reabrir.
- 3B: contrato de playlists; web offline após deploy aprovado; exportar no Mac e importar no Chrome; edição concorrente em dois Macs.
- 3C: testes de identificação de acordes e cromagrama com sinais sintéticos; no app, tocar notas e acordes com a guitarra e conferir o destaque.

## Backlog de Acordes, solicitado em 23/11/2026

Som ao clicar e partitura do acorde selecionado foram implementados localmente.
Comportamento, validação e limites em `07-acordes-som-e-partitura.md`.

O próximo bloco solicitado inclui inversões e formas alternativas, sequenciador
de acordes e bateria de acompanhamento com volumes independentes. Plano e divisão
em entregas em `08-acordes-sequenciador-e-bateria.md`. Inversões e formas alternativas
implementadas; sequenciador, bateria e persistência entregues em
`09-sequenciador.md` e `10-bateria-e-sequencias-salvas.md`. A extensão local
`11-acordes-na-cifra.md` leva som, pauta, inversões e formas para os acordes
das músicas, incluindo conversão de capo ao enviar à sequência. Braço completo,
notas YIN e cromagrama experimental foram entregues nos blocos `12`, `13` e `14`.
Falta o avanço pelo metrônomo para concluir a 3C. Preservar os
ajustes do Pedro na interface. Não inicia a Fase 4 de integrações
de música de fundo e adaptação de exercícios.

## Backlog: importar cifra/tab pelo link (23/11/2026)

- Desejo do Pedro: colar o link de um serviço popular na música e o app preencher
  automaticamente a cifra/tab, reduzindo o trabalho de copiar e colar texto.
- Fluxo proposto: URL, identificação da fonte, importação quando permitida, prévia
  editável e confirmação. Guardar link, autor e atribuições exigidas com o conteúdo.
- Antes de implementar, pesquisar cada serviço, API/licença e formatos oferecidos,
  apresentar opções e esperar aprovação. Não prometer qualquer URL. Raspagem segue
  descartada até uma nova decisão explícita; não contornar login, paywall ou bloqueios.
- Distinguir cifra com acordes/letra, tablatura textual e tablatura com duração/
  múltiplas pistas. ChordPro sozinho não representa todos esses formatos; a escolha
  do modelo e de renderização de tabs rítmicas precisa de plano próprio.
- Importação usa validação, revisões e conflito visível já existentes, sem sobrescrever
  o conteúdo salvo silenciosamente. Sem dados musicais estimados para preencher lacunas.
- Se a fonte não for compatível, manter o caminho existente de texto/arquivo/link.
  Considerar limitações do webapp estático e funcionamento no Mac antes da integração.
