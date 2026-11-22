# Status

## Ajustes pedidos em 22/11 (depois da 3A)

### Feito
- **Atraso dos dispositivos:** Ajustes ganhou "Medir atraso" (só no Mac). O motor abre cada entrada e saída por um instante, a saída em silêncio, e lê o atraso pelos timestamps do stream. Fica guardado neste Mac (`localStorage`, IDs de áudio não valem em outro Mac). Sem medida, aparece "sem medida" em vez de "cerca de 0 ms". O selo de melhor opção só aparece no primeiro da lista quando há medida ou interface de áudio; Bluetooth continua avisado. Recusa medir com metrônomo ou afinador ligados.
- **Barra lateral no tema claro:** a janela nativa passa a seguir o tema do app (`setTheme`, permissão `core:window:allow-set-theme`). Antes, com o macOS escuro e o app claro, o material translúcido ficava escuro com texto escuro.
- **Roadmap:** trilho de fases no topo com um quadradinho por exercício (preenchido quando há prática registrada), que também filtra por fase; linhas em colunas (exercício, tipo, meta, práticas) no lugar dos selos; "tab" virou um ícone; grade, fases e timeline no mesmo estilo.
- **Tap:** anel no acento a cada toque; com movimento reduzido, só um brilho curto.
- **Acordes (nova tela, ⌘4):** biblioteca com 45 formas consagradas, filtro por tipo e busca por qualquer nome (Em7(9), D/F#, Db7M(9)); acorde fora da tabela ganha formas calculadas a partir das notas, marcadas como "forma calculada". Detalhe com as notas e todas as formas.
- **Troca de acordes:** acorde atual grande, próximo pequeno, contagem regressiva em tempos, troca a cada 1, 2, 4 ou 8 tempos no metrônomo do app, pares do roadmap (G e C, Am e E, D e A), contagem de trocas pedidas e registro em "Troca de acordes em 1 minuto" com as trocas limpas informadas por você. Abre também pela tela do exercício e pela cifra.
- **Cifra:** faixa com o diagrama de cada acorde da música, na ordem; clique mostra outra forma.

### Verificações
- Core: **99 testes passaram** (37 novos de notas, formas e troca), `tsc` passou. Toda forma da tabela e as geradas para 12 acordes fora dela conferem com as notas, abertura de até 4 casas e até 4 dedos.
- `audio-engine`: **16 testes passaram**, clippy sem avisos, compilado no Linux (ALSA). A medição em si depende do CoreAudio e **não foi executada**.
- `pnpm typecheck` e `build:web` passaram; Chromium headless: Roadmap claro/escuro/760 px, Acordes, busca, troca rodando 5 s e 11 s, Tap no meio do pulso. Console sem erros; detector da Impeccable sem apontamentos.
- **Não executado:** app do Mac (medição de atraso, barra lateral com o tema, Tauri compilando a nova permissão), uso real da troca com a guitarra.

### Sobre as capturas de 22/11
O Roadmap das capturas ainda dizia "As visões de timeline, fases e grid chegam na Fase 1", então o app aberto era a versão da 1A, provavelmente a cópia em Aplicativos. O aviso "iCloud pendente: o arquivo deste dispositivo está incompleto ou contém eventos incompatíveis" tem a mesma causa provável: o build novo, usando o mesmo banco, gravou no log tipos de evento que a versão antiga não conhece. Substituir a cópia em Aplicativos pelo build atual deve resolver; a partir da 3A, versões antigas guardam tipos novos em vez de travar.

## Fase 3, parte 3A: músicas e cifras implementadas, validação no Mac pendente (22/11/2026)

Plano e decisões em `docs/06-fase-3-plano.md`. 3B (playlists na interface, exportar/importar, web offline) e 3C (braço completo) ainda não começaram. Nada foi enviado ao GitHub: os commits estão só na `main` local.

### Implementado
- **Sync tolerante a versões:** um evento de tipo desconhecido vindo de outro Mac fica guardado em `deferred_events` e é projetado quando o app passar a conhecer o tipo, ao abrir o banco. Antes, ele fazia o arquivo inteiro do outro aparelho ser tratado como incompatível.
- **Core:** acordes em notação brasileira e inglesa; cifra colada (acordes sobre a letra) convertida para ChordPro na coluna original; leitura e escrita de ChordPro; transposição só de exibição, com grafia pelo tom de destino (Em +1 = Fm, Eb, Db7M). Modelo `Song`, `Playlist`, `ChartRevision` com validação, origem explícita de BPM e tom, revisões imutáveis com conflito visível e resolução por `supersedes`.
- **Persistência:** SQLite `user_version=2` e IndexedDB `pratica.v1` versão 2, migrações só aditivas. Eventos `song.saved` e `playlist.saved` (última gravação vence, exclusão por tombstone) e `chart.revised` (só acrescenta). Validação espelhada TS/Rust.
- **Semente:** 12 músicas do repertório (`data/repertoire.seed.json`), só título, artista e fase. IDs fixos: não duplica entre Macs e uma música apagada não volta. As linhas "(uma música da lista)" ficaram de fora.
- **Tela Músicas:** lista com busca sem acento, filtro por fase e "Só com cifra"; detalhe com tom, BPM, compasso, capo, fase e a origem de cada dado; cifra com acorde sobre a sílaba, quebrando só entre palavras; transposição; importação por texto colado ou arquivo (.cho, .chordpro, .pro, .crd, .txt) com prévia e avisos; uso opcional do tom/BPM da própria cifra; link de origem; editor; exclusão com confirmação; comparação e escolha entre versões em conflito. Rascunhos ficam acima das rotas. Janela estreita mostra um painel por vez.
- A letra da cifra de teste fornecida pelo Pedro não está no repositório (público): o fixture tem a mesma estrutura com texto neutro.

### Verificações (22/11/2026)
- Core: **62 testes passaram** (32 anteriores, 17 de cifra/acordes, 13 de músicas) e `tsc` passou. Rodados numa cópia isolada, porque os `node_modules` do projeto são de macOS.
- `practice-store`: **9 testes Rust passaram** (6 anteriores, evento de tipo futuro no sync, migração v1→v2 com reprojeção, músicas/playlists/revisões), clippy sem avisos, exemplo `bridge` compila. Rodado numa cópia do crate na nuvem, Rust 1.97. O `audio-engine` não foi alterado nem testado de novo.
- Contrato compartilhado: **SQLite real, 13 verificações passaram** (ponte Rust). **IndexedDB, 13 verificações passaram em `fake-indexeddb`** no Node, não num navegador real. Migração de um IndexedDB v1 com registro existente para v2 conferida no mesmo ambiente.
- `pnpm typecheck` (core e desktop) e `pnpm --filter desktop build:web` passaram numa cópia do repositório com dependências instaladas no Linux.
- Revisão visual no Chromium headless do webapp compilado: claro e escuro a 1440 px e janela estreita a 760 px; lista, detalhe, importação com a cifra de teste, cifra salva e transposta, editor. Console sem erros. Detector da Impeccable sem apontamentos. A comparação de conflito não foi vista renderizada.
- **Não executado:** compilação do Tauri (`src-tauri/src/storage.rs` ganhou três operações na lista permitida), app do Mac, `pnpm test` no Mac, contrato IndexedDB no Chrome, sync real entre dois Macs.

### Como testar a 3A

```sh
cd ~/Dev/guitar-exercises-app
nvm use 24
pnpm --filter @gx/core test
cargo test -p practice-store
pnpm typecheck
PRACTICE_TEST_BROWSER=chrome pnpm --filter desktop test   # SQLite + IndexedDB no Chrome
pnpm build:app && open "target/release/bundle/macos/Prática.app"
```

1. Abrir Músicas: as 12 músicas do repertório aparecem, sem tom, BPM nem cifra.
2. Escolher uma, Adicionar cifra, colar uma cifra do Cifra Club. Conferir a prévia (acordes na sílaba certa, avisos), salvar, reabrir o app e abrir sem internet.
3. Transpor para cima e para baixo; a cifra salva não muda. Editar cifra, salvar e conferir.
4. Abrir um arquivo ChordPro com `{key:}` e `{tempo:}`: a opção de usar tom e BPM aparece só se a música ainda não tiver esses dados, e a origem mostra o nome do arquivo.
5. Nova música, editar, apagar. Buscar sem acento, filtrar por fase e "Só com cifra". Janela estreita, teclado, claro e escuro.
6. Dois Macs: atualizar os dois antes de usar Músicas. Editar a mesma cifra offline nos dois, sincronizar e resolver o conflito em Comparar.

## Fase 2: afinador e perfis implementados, validação de áudio pendente (21/11/2026)

### Publicação (22/11/2026)
- A 1A/1B já estava na `main` no commit `4226a21` (publicado pelo conector GitHub). Em 22/11 o histórico local foi alinhado com `git fetch` e `git reset --mixed origin/main`, sem tocar nos arquivos de trabalho. O remoto não tinha avançado além de `4226a21`.
- Backups criados antes do reset: branch `backup/pre-alinhamento-fase2-20261122` e tag `backup-head-20261122` (HEAD antigo, com o commit local `8c0efcb`), mais a ref `refs/backup/worktree-tracked-20261122` (snapshot das alterações rastreadas).
- A Fase 2 foi publicada em commits separados na `main`. O workflow do Pages roda a cada push; veja o resultado do deploy no fim desta seção quando confirmado.

### Implementado
- Afinador mantém estado acima das rotas: entrar em Ajustes e voltar não perde a captura nem indica que está desligado enquanto o microfone está aberto.
- Nota/oitava, frequência, cents, sinal e orientação de ajuste; estados desligado, abrindo, ouvindo, sinal fraco e instável. A nota e o estado são anunciados sem anunciar cents continuamente. Agulha limitada à escala, com atualização direta quando movimento reduzido está ativo.
- Entrada e canal reais informados pelo motor. No Mac, seleção explícita ausente ou canal inválido falham com recuperação, sem cair silenciosamente em outra entrada. Mudança do padrão nativo reabre a captura quando Padrão está selecionado. No navegador, isso depende de o navegador expor alias/grupo do padrão; o rótulo Ouvindo sempre identifica a captura efetiva.
- Buffer solicitado por entrada no Mac, com Automático e opções dentro dos limites do dispositivo. Buffer incompatível pede voltar a Automático. A configuração é solicitada ao cpal, não uma garantia do tamanho de cada callback.
- Salvar perfil guarda ID real, canal, buffer solicitado, taxa de amostragem do processamento, última latência informada, origem da medida e data. Salvar também seleciona explicitamente essa entrada, como a UI informa; ao reabrir/trocar para ela, canal e buffer são recuperados. Salvar novamente atualiza o diagnóstico; não grava um evento a cada callback.
- Perfis ficam em `device:<id>:tuner.inputProfiles`, na mesma persistência por eventos da 1A, com validação TS/Rust e sem migração de tabelas. Não ativam IDs de áudio de outro aparelho. O ranking considera o perfil salvo quando não há leitura corrente; Ajustes distingue perfil salvo de leitura no stream.
- A latência do Mac vem dos timestamps de captura; a do navegador vem do track quando disponível. A UI distingue ausência de medida, medida atual e perfil salvo. A janela YIN tem 4.096 amostras e é exibida separadamente. Não há alegação de medição round trip nem calibração por cabo.
- Web: captura cancelada antes/depois da permissão não reativa o afinador; canais reais substituem a suposição de estéreo; desconexão encerra tracks e informa como retomar. O navegador continua escolhendo o buffer.
- Lógica e modelos em `packages/core/src/tuner.ts`; ciclo de captura em Rust/Web Audio; estado em `apps/desktop/src/lib/tuner.tsx`; painel conserva o sistema visual existente. Fase 3 não iniciada.

### Verificações
- Core: **32 testes passaram**, incluindo seis cordas, três desvios conhecidos e duas taxas de amostragem; estados, limites e perfis locais/validados.
- Rust (`cargo test --workspace`, 22/11): **24 testes passaram** (16 do motor de áudio, 2 adicionais e 6 de persistência/sincronização).
- Contrato SQLite real: **11 verificações passaram**, incluindo reabertura do perfil, isolamento por aparelho e rejeição no backend de perfis inválidos/globais.
- `pnpm --filter desktop test:audio`: passou o contrato do ciclo de captura web com APIs de áudio controladas (cancelar antes/depois da permissão, mono, canal indisponível e desconexão). Não é teste de microfone real ou navegador.
- `pnpm test` (22/11, Mac do Pedro): core (32), captura web e SQLite (11) passaram; o passo IndexedDB parou porque o Chromium do Playwright não está instalado. Rodado à parte com `PRACTICE_TEST_BROWSER=chrome pnpm --filter desktop test:web`: **IndexedDB, 11 verificações passaram**. Ou seja, a suíte inteira passou, mas só com o Chrome instalado; `pnpm test` puro ainda exige `pnpm exec playwright install`.
- TypeScript e `git diff --check` passaram. Em 22/11 passaram também `pnpm typecheck`, `pnpm build:app` (gera só o `.app`) e `pnpm --filter desktop build:web`. O DMG (`pnpm build`) não foi tentado de novo; na rodada anterior falhou com `hdiutil: Device not configured`, limite do ambiente.
- Revisão independente estática conferiu as correções de perfil/default, cancelamento, estado acessível e movimento reduzido. Sem aprovação visual: não havia controle de UI disponível, e o detector de design teve execução bloqueada. PRODUCT/DESIGN preservados por ser extensão do painel existente.

### Como testar

```sh
cd ~/Dev/guitar-exercises-app
nvm use 24
open "target/release/bundle/macos/Prática.app"
# Recompilar sem DMG:
pnpm build:app
# Webapp local:
pnpm web
# Testes sem microfone e sem navegador:
pnpm --filter desktop test:audio
pnpm --filter desktop test:native
# Contrato IndexedDB atualizado, para abrir no Chrome:
pnpm --filter desktop test:web:manual
open -a "Google Chrome" target/contract/practice-store.html
```

1. Ferramentas: ligar afinador, permitir microfone e tocar uma corda por vez. Conferir nota/oitava, cents, sinal baixo/silêncio e Lá 430–450 Hz. Alternar Ajustes/Ferramentas sem perder o estado; parar deve liberar a captura.
2. Com interface conectada: escolher entrada e canal da guitarra. Em Perfil da entrada, experimentar Automático e buffer suportado. Se falhar, voltar a Automático e ligar novamente. Conferir nome/canal efetivo e latência atual sem confundi-la com a janela de análise.
3. Salvar perfil, parar/reabrir o app e conferir entrada/canal/buffer. Testar outra entrada e voltar; salvar novamente para atualizar a medida. Desconectar interface, conferir erro e escolher outra entrada. Com Padrão, mudar a entrada padrão do Mac e conferir reabertura e rótulo Ouvindo.
4. Repetir permissão negada, cancelamento e desconexão no webapp. Conferir modo claro/escuro, janela estreita, teclado e preferência de movimento reduzido.

Ainda pendentes: áudio real com microfone/interface (permissão, qualidade, canal, buffer, reconexão), UI nos dois temas e tamanhos e pendências manuais da 1A/1B/iCloud entre dois Macs. A cópia em Aplicativos não foi substituída. Laboratório: YouTube/erro 153 e Spotify com redirect `http://127.0.0.1/callback` e Client ID próprio continuam pendentes.

## Revalidação da 1A (21/11/2026)

A implementação da 1A e da 1B foi preservada. Esta rodada reforçou testes de falha/retomada e tornou os contratos executáveis sem servidor local. A Fase 2 não foi iniciada.

### Alterações desta rodada
- `apps/desktop/test/run-contracts.mjs` agora empacota a suíte com Vite, sem criar servidores HTTP/WebSocket. O contrato SQLite usa o banco Rust real; o web usa IndexedDB real em contexto novo do navegador e origem HTTPS interceptada, sem rede real nem perfil pessoal.
- `pnpm --filter desktop test:native` executa só o contrato SQLite e informa explicitamente seu escopo.
- `pnpm --filter desktop test:web:manual` gera uma página autossuficiente em `target/contract/practice-store.html`. Gerar a página não significa que o contrato foi executado. A página cria um banco temporário com nome próprio, executa a mesma suíte e solicita sua remoção ao terminar.
- O runner automático usa Chromium. Para usar o Chrome instalado em um ambiente que permita iniciá-lo: `PRACTICE_TEST_BROWSER=chrome pnpm --filter desktop test:web`.
- Testes Rust adicionais conferem exportação pendente após fechar/reabrir o banco, ajustes e rotinas entre dois dispositivos simulados com cópia de conflito e retomada depois que uma linha JSONL incompleta chega inteira. Os testes usam arquivos temporários, sem tocar nos dados reais ou no iCloud do Pedro.

### Resultado atual

| Verificação | Resultado nesta rodada |
|---|---|
| Core | 29 testes passaram |
| Motor de áudio | 16 testes Rust passaram |
| Persistência e sincronização | 6 testes Rust passaram |
| Contrato SQLite | 10 verificações passaram, sem abertura de portas |
| Calendário e validação em fusos distintos | Os 5 testes de `store.test.ts` passaram com `TZ=America/Bahia` e `TZ=America/New_York` |
| TypeScript e sintaxe do runner | Passaram |
| `pnpm --filter desktop build:web` | Passou |
| `pnpm build` | Gerou o `.app`; falhou depois no DMG, com `hdiutil: create failed - Device not configured` |
| `pnpm build:app` | Passou; `.app` atualizado em `target/release/bundle/macos/Prática.app` |
| `pnpm test` completo | Core e SQLite passaram; parou ao iniciar Chromium, ausente no ambiente |
| Contrato web com Chrome instalado | A inicialização do processo foi bloqueada pelo ambiente; sem resultado de execução nesta rodada |

As 10 verificações do IndexedDB passaram na sessão anterior, no Chrome, conforme o registro da 1B. Esse resultado anterior não está sendo contado como uma nova execução do runner alterado.

### O que ainda impede declarar a 1A totalmente validada
- Repetir a suíte web neste ambiente com navegador disponível ou abrir a página manual no Chrome e confirmar o resultado `passed`.
- Durante uma prática real, conferir os quatro tipos de registro pela UI, o BPM registrado após acertos/erro/modo manual, o calendário e a persistência após reabrir. A leitura do código e os contratos de armazenamento não substituem essa verificação da interface.
- Conferir claro/escuro e janela estreita. Nesta rodada não havia ferramenta de controle de interface disponível.
- Testar o transporte real do iCloud em dois Macs da mesma conta, incluindo offline/reconexão. Os dois dispositivos dos testes Rust são simulados e não validam o serviço da Apple.
- Pendências anteriores da 1B continuam: salvar/reativar rotina própria pela UI e reabrir para confirmar.

### Como testar sem depender do DMG

```sh
cd ~/Dev/guitar-exercises-app
nvm use 24
pnpm build:app
open "target/release/bundle/macos/Prática.app"
# Webapp local:
pnpm web
# Contrato nativo, sem navegador:
pnpm --filter desktop test:native
# Página de contrato web sem servidor:
pnpm --filter desktop test:web:manual
open -a "Google Chrome" target/contract/practice-store.html
# Suíte completa em um ambiente que permita executar Chromium:
pnpm --filter desktop exec playwright install chromium
pnpm test
```

Use registros reais de prática ao conferir a interface, porque o histórico é imutável. A página de contrato usa apenas seu banco temporário. Não houve novo teste na UI nem substituição da cópia em Aplicativos nesta rodada.

Continuam pendentes no Laboratório: YouTube embutido/erro 153 e Spotify com redirect `http://127.0.0.1/callback` e Client ID próprio. Sem commits, push, PR ou publicação; o histórico local anterior foi preservado.

## Etapa 1B: organização implementada e app compilado (20/11/2026)

### Feito
- Roadmap com Timeline, Fases expansíveis, Lista e Grid. As quatro visões compartilham filtros por fase e tipo, o mesmo catálogo e o contador de registros em cada exercício. A visão escolhida é lembrada localmente.
- Timeline segue a ordem das fases, sem datas de calendário. O resumo mostra exercícios com prática registrada, sem tratar prática como conclusão. A fase continua sendo escolhida manualmente.
- Hoje alterna Sugestão/Minha rotina. A sugestão oferece Leve 20 min, Normal 40 min e Puxado 60 min. Editar rotina copia a sugestão atual ou a rotina própria.
- Editor permite nomear, trocar exercício, ajustar tipo de bloco e minutos, remover, adicionar e reordenar por botões acessíveis. O total é recalculado. Cancelar descarta; salvar persiste e ativa a rotina própria.
- Rascunho, estado de salvamento, erro e trava de gravação ficam acima das rotas: navegar e voltar mantém as alterações, inclusive durante gravação. Rascunhos são da sessão; a rotina salva persiste após reabrir.
- Rotina própria usa o ID estável `personal` e a interface `PracticeStore` existente. A preferência `routineSource` usa ajuste com LWW, espelhado na validação TS/Rust. Nenhuma migração de tabelas foi necessária.
- Ajustes só são refletidos na UI após persistirem, para não indicar fonte/fase ativa quando a gravação falha.
- Lógica de filtros e edição pura fica em `packages/core/src/roadmap.ts` e `routine-editor.ts`, separada da interface.
- Novo comando `pnpm build:app` gera apenas o `.app`, evitando o problema de empacotamento do DMG. O comando `pnpm build` continua gerando os dois formatos.

### Verificação
- **29 testes do core passaram**, incluindo filtros combinados/fase zero, edição sem mutação, reordenação, referências inválidas e durações.
- **20 testes Rust passaram**: 16 do motor de áudio e 4 de persistência/sincronização.
- **SQLite real: 10 verificações do contrato passaram** em `pnpm test`, incluindo a preferência de rotina após reabrir.
- **IndexedDB real: as mesmas 10 verificações passaram no Chrome**, usando bundle da página de contrato aberto por `file://`, com banco temporário criado e removido pelo teste. O comando automático `pnpm test` ainda termina com erro por `listen EPERM` em localhost:1421 neste ambiente; isso não foi apresentado como sucesso do comando completo.
- Passaram `pnpm typecheck` e `pnpm --filter desktop build:web`.
- `pnpm build` compilou em release e gerou o `.app`; a etapa DMG falhou em `hdiutil` com `Device not configured` no ambiente. Em seguida, **`pnpm build:app` terminou com sucesso** e gerou `target/release/bundle/macos/Prática.app` com o frontend final.
- Aplicativo compilado aberto e conferido no Mac em modo escuro: editor, edição do nome, reordenação, preservação do rascunho ao ir para Roadmap e voltar, cancelamento; quatro visões do Roadmap; combinação Fase 1 + Dexteridade exibindo 2 exercícios nas visões Grid, Fases e Timeline. Não foram criados registros de prática nem salva rotina de teste no banco do Pedro.
- Revisão estática independente resolveu perda de rascunho ao navegar, seleção de ajustes após falha e gravação pendente atravessando rotas. O sistema visual existente foi preservado.
- Pendentes de uso real: salvar/reativar rotina própria pela UI, reabrir o app para conferir essa rotina, claro e janela estreita, sincronização iCloud entre dois Macs. A revisão visual realizada não cobre todos os temas e tamanhos.
- A cópia compilada do projeto foi aberta. Não substituí automaticamente o aplicativo em `/Applications`. Sem commits, push, PR ou publicação; `.git` segue sem permissão de escrita no ambiente.
- Fase 2 e fases seguintes não foram iniciadas.

### Como testar

```sh
cd ~/Dev/guitar-exercises-app
nvm use 24
pnpm build:app
open "target/release/bundle/macos/Prática.app"
# Web local:
pnpm web
# Verificações completas fora do bloqueio a localhost:
pnpm --filter desktop exec playwright install chromium
pnpm test
pnpm --filter desktop build:web
```

1. Em Roadmap, alternar Timeline/Fases/Lista/Grid; combinar fase e tipo, conferir contadores, limpar filtros e abrir um exercício. Conferir também filtro sem resultados.
2. Em Hoje, escolher Leve, Normal ou Puxado e clicar Editar rotina. Trocar exercícios, alterar minutos, adicionar, remover e mover blocos.
3. Abrir outra tela e voltar: o rascunho deve continuar. Cancelar deve restaurar a rotina anterior.
4. Salvar a rotina, conferir o nome e o total em Minha rotina. Reabrir o app e conferir persistência. Alternar para Sugestão e voltar para Minha rotina, preservando a rotina salva.
5. Conferir teclado, modo claro e janela estreita. No navegador, repetir gravação/reabertura; dados do navegador e do app são independentes.
6. Ainda pendentes no Laboratório do Mac: YouTube embutido/erro 153 e login Spotify com redirect `http://127.0.0.1/callback` e Client ID próprio.

## Etapa 1A: implementação, validação pendente (20/11/2026)

### Atualização após compilação local
- Pedro executou o build no Terminal: Rust em release compilou e gerou `target/release/bundle/macos/Prática.app`. O aplicativo foi substituído por ele.
- A etapa posterior de criação do DMG falhou ao desmontar `disk6` com `Resource busy`. Isso não invalida o `.app` gerado.
- Com as dependências agora no cache, `cargo test -p practice-store --offline` passou: **4 testes Rust**, incluindo fusão, falha de exportação, versão futura e relógio persistente.
- Ainda pendentes: suíte compartilhada de contrato, teste visual/funcional e uso real do iCloud entre dois Macs. Os bloqueios descritos abaixo registram a tentativa anterior.


### Implementado
- Contrato assíncrono `PracticeStore` no core; validação de registros, eventos, ajustes e rotinas; agrupamento por dia local e soma de tempo real.
- Adaptadores SQLite via Tauri e IndexedDB no navegador. A UI recebe `PracticeStore`; a seleção do adaptador fica na composição. Ajustes antigos do `localStorage` são migrados uma vez. Conteúdo inválido preserva a cópia original e exibe aviso, sem bloquear os registros.
- SQLite isolado em `crates/practice-store`, com `rusqlite` síncrono e SQLite bundled. O crate não depende de Tauri nem do motor de áudio, permitindo testar o banco real por um executável de contrato.
- A sugestão de Hoje considera o histórico anterior ao dia local, para não trocar os blocos a cada registro durante a prática.
- Registro em Hoje e no exercício, com BPM, contagem, tempo ou feito conforme o seed, nota opcional e duração real opcional separada da métrica. Contador representa registros, não acertos do metrônomo.
- Progressão no exercício: cinco acertos sugerem +4 BPM, aceitar aplica o novo andamento, erro zera a sequência. Modo manual mantém o ajuste livre. O formulário registra o BPM praticado; cada acerto não cria um registro separado. Ao reabrir, recupera o último BPM registrado. Sequência de acertos é da sessão.
- Calendário mensal, seleção por teclado, marcação dos dias, práticas, métricas, notas e duração do dia. Não usa a duração planejada como tempo praticado.
- Eventos imutáveis com versão, ID, dispositivo, timestamp, tipo e dados; evento e projeção salvos na mesma transação. Práticas fundem por ID; ajustes por chave e rotina por ID usam última gravação, com desempate por ID do evento.
- Relógio lógico persistido, reservado em transação e avançado pelos eventos já importados, para evitar que um relógio remoto adiantado impeça ajustes locais posteriores.
- Sincronização do Mac a cada 15 s, ao voltar ao app e depois de gravar: leitura de JSONL de todos os dispositivos, incluindo cópias de conflito, fusão idempotente e publicação atômica do log próprio. Falhas deixam os dados locais intactos e a fila pendente. Linhas incompletas aguardam nova leitura; arquivo próprio incompatível é preservado.
- Ajustes mostram o estado da sincronização. IDs de dispositivos de áudio e canal ficam por aparelho.

### Arquivos de dados
- Mac: `pratica.sqlite3` no diretório local do app identificado por `com.peeeo.pratica`, resolvido por `app_local_data_dir()` do Tauri. Nunca no iCloud.
- iCloud: `~/Library/Mobile Documents/com~apple~CloudDocs/Pratica/events/<deviceId>.jsonl`. O app cria a subpasta apenas se o iCloud Drive já estiver disponível.
- Web: IndexedDB `pratica.v1`, só neste navegador e nesta origem. Sem sincronização automática com iCloud. O histórico do domínio publicado e o do localhost são independentes.
- Tabelas/stores: `practice_logs`, `routines`, `settings`, `events`, `sync_outbox`, `local_meta`. SQLite usa `user_version=1` e recusa banco de versão futura. Eventos usam `version=1`.

### Validação realizada e bloqueios
- Passaram os **25 testes do core** e o TypeScript do core e do desktop.
- Passou `pnpm --filter desktop build:web`.
- `pnpm test` foi executado: core passou; o contrato SQLite parou na resolução de dependências Rust. `cargo test -p practice-store --offline` confirmou que `rusqlite` não está no cache. Não houve execução dos testes novos Rust nem da suíte de contrato.
- `pnpm build` foi executado: frontend passou; a parte Rust e o empacotamento ficaram bloqueados pelo mesmo problema. O `Cargo.lock` ainda precisa ser atualizado pelo Cargo com acesso ao crates.io.
- Ambiente de execução sem resolução de DNS para npm/crates.io, sem permissão para ouvir em localhost e sem navegador disponível. Chromium de testes não estava instalado; tentativa com Chrome existente também foi bloqueada. Portanto, **não houve teste visual nem teste funcional da UI/IndexedDB**.
- Foi utilizado Node 24 e o pnpm disponível no runtime para executar os scripts; o projeto continua fixado em pnpm 10.28.0. O pnpm fixado não pôde ser baixado neste ambiente.
- Revisão estática independente identificou e levou à correção do campo de contagem, recuperação da migração e relógio dos eventos. Isso não equivale a aprovação visual.
- Os commits ficaram bloqueados: o ambiente não permite criar `.git/index.lock`. As alterações permanecem no diretório de trabalho; o commit local anterior de STATUS foi preservado.
- **A 1A não está concluída** até passar os testes de contrato, os testes Rust, o build nativo e o uso real no Mac/navegador. Nenhum push ou publicação foi feito. Naquele ponto, a 1B ainda não havia sido iniciada.

### Como validar em um ambiente sem esses bloqueios

```sh
pnpm install
pnpm --filter desktop exec playwright install chromium
cargo generate-lockfile
pnpm test
pnpm build
pnpm --filter desktop build:web
pnpm dev
# Em outro terminal, para o navegador:
pnpm web
# Contrato só do IndexedDB, sem compilar Rust:
pnpm --filter desktop test:web
```

A suíte em `apps/desktop/test/store-contract.ts` é a mesma para SQLite real (via `examples/bridge.rs`) e IndexedDB real (Chromium). Cobre as quatro métricas, intervalos com fuso, idempotência, validação, rollback, LWW fora de ordem, desempate, relógio após importação nativa, seleção de áudio local e reabertura de registros/ajustes/rotina. Testes Rust adicionais cobrem fusão entre dois dispositivos, conflito de arquivos, cauda incompleta, falha de exportação e versão futura do banco.

Roteiro manual:
1. Em Hoje, usar Registrar, preencher métrica/nota/duração e conferir contador. Testar contagem inteira, tempo e feito em exercícios correspondentes.
2. Abrir Spider, registrar cinco acertos, aceitar +4 BPM e conferir que erro zera a sequência. Trocar para manual e ajustar pelas setas. Registrar o BPM atingido.
3. Abrir Calendário, selecionar o dia e conferir exercícios, notas e minutos. Navegar dias pelas setas e mudar o mês pelos botões. Reabrir o app/navegador e conferir persistência.
4. Alterar tema, fase e som; reabrir e conferir os ajustes. Testar claro/escuro, janela estreita e teclado.
5. No Mac com iCloud Drive ativo, verificar o estado em Ajustes e o JSONL em `Pratica/events`. Num segundo Mac, abrir o app na mesma conta, aguardar a sincronização e conferir união dos registros sem duplicar. Testar offline e reconectar.
6. Ainda pendentes no Laboratório do Mac: YouTube embutido/erro 153 e Spotify com redirect `http://127.0.0.1/callback` e Client ID próprio.

## Braço, tabs e webapp (20/11/2026)

### Feito
- Tela de exercício: abre ao clicar num exercício no Hoje ou no Roadmap. Mostra o braço da guitarra (SVG, dedos, raiz em laranja, pestana, cordas soltas e abafadas), a tab e o metrônomo. A cada clique do metrônomo a tab avança um passo e a nota acende no braço. Dá para clicar num passo da tab, voltar ao começo ou desligar o "seguir o metrônomo". Mostra também o critério para passar, as metas e os vídeos.
- Tabs geradas em `packages/core/src/fretboard.ts` para 16 exercícios técnicos (spider, cromático, trocas e acordes abertos, dedo-guia, escala maior, pestanas F e Bm, formas móveis, power chords, pentatônica nas 5 posições, hammer-on e pull-off, CAGED, acordes com sétima, dórico). Os de música e teoria mostram "sem tab". Testes conferem as notas de cada acorde e escala.
- Webapp: fora do Tauri, o app usa um motor em Web Audio (`apps/desktop/src/lib/web-engine.ts`) com os mesmos sons e o mesmo YIN do Rust, portados para `packages/core/src/dsp.ts`. Escolha de entrada pelo navegador; escolha de saída onde o navegador deixa (Chrome).
- Deploy pronto: `.github/workflows/pages.yml` faz o build e publica em `/pratica/`.

### Publicado (20/11/2026)
- Repositório público: https://github.com/pedronogueiranunes/pratica (branch `main`).
- Pages com fonte GitHub Actions. O workflow `pages.yml` roda os testes do core, gera o build web e publica.
- Endereço: https://pedronogueiranunes.github.io/pratica/ redireciona para https://pedronogueira.dev/pratica/ (domínio próprio do portfólio).
- Conferido no Chrome: o app abre, a tela do exercício Spider mostra braço e tab, o metrônomo toca e a tab avança a cada clique, espaço liga e desliga.
- Para publicar uma mudança: `git push` na `main`. O deploy leva cerca de 30 s.

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

### Pendências de teste no app do Mac (Laboratório)
- YouTube embutido: ver se toca e se dá erro 153.
- Login do Spotify: criar o app no dashboard com o redirect `http://127.0.0.1/callback` e colar o Client ID.

### Próximo: Fase 1
Registro de prática com contador e SQLite, calendário, as quatro visões do roadmap, rotina editável, metrônomo ligado à regra de progressão por exercício, log de eventos para o iCloud Drive.
