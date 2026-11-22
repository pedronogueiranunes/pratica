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
- SQLite `user_version=2` e IndexedDB `pratica.v2`, migração só aditiva.

## Achado antes de começar
Em `crates/practice-store/src/sync.rs`, um evento de tipo desconhecido faz `apply` falhar e o arquivo do outro aparelho é tratado como incompatível. Um Mac desatualizado deixaria de sincronizar tudo. Primeiro commit da fase: guardar eventos desconhecidos sem aplicar e seguir a fila, com teste Rust; espelhar no IndexedDB.

## Entregas
- **3A:** tolerância a eventos desconhecidos, migração v2, core de músicas/ChordPro/importação, tela Músicas (lista, detalhe, editor, importar com prévia, cifra com transposição e capo), semente do repertório.
- **3B:** playlists, exportar/importar (.chordpro e pacote .json), service worker e persistência no web, conflito de revisões na interface.
- **3C:** braço completo (core: mapa de notas, identificação de acordes por conjunto de notas, cromagrama; interface: painel em Ferramentas e na música).

## Como testar
- 3A: testes do core com cifras coladas que o Pedro fornecer; contrato SQLite/IndexedDB ampliado; testes Rust de revisões e evento desconhecido; no app, colar, corrigir, salvar, transpor e reabrir.
- 3B: contrato de playlists; web offline após deploy aprovado; exportar no Mac e importar no Chrome; edição concorrente em dois Macs.
- 3C: testes de identificação de acordes e cromagrama com sinais sintéticos; no app, tocar notas e acordes com a guitarra e conferir o destaque.
