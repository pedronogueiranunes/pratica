# Stack, APIs e decisões (18/11/2026)

Decisões tomadas com o Pedro antes da Fase 0. Atualizar quando algo mudar.

## Decisões de produto
- **Roadmap sem datas.** O app mostra fases, blocos e exercícios, e registra no calendário o que foi feito. Sem cobrança de prazo. A troca de fase é decisão do Pedro.
- **Métrica por exercício.** Cada exercício tem um tipo de métrica: `bpm` (BPM atingido), `contagem` (por exemplo, trocas limpas por minuto), `tempo` (segundos ou minutos) ou `feito` (só marcar). O campo entra no seed por script, sem copiar texto à mão.
- **Regra do metrônomo, dois modos.** Automático: o app conta as execuções limpas com botões de acerto e erro, e depois de 5 seguidas sugere +4 bpm. Manual: o Pedro ajusta o BPM.
- **Rotina do dia.** O app sugere em três níveis de dedicação (baixa, média, alta), ou o Pedro monta a rotina. Os blocos não têm timer.
- **Entradas de áudio.** O Pedro escolhe o dispositivo. Cada um tem o seu perfil de latência. O app revê a latência de tempos em tempos e sugere o melhor dispositivo conectado.
- **Distribuição.** Local, só para o Pedro, por alguns meses. Sem assinatura paga da Apple por enquanto.
- **i18n desde o início.** Português do Brasil agora, inglês depois.

## Stack
**Tauri 2 + React 19 + TypeScript + Vite, com o motor de áudio em Rust.**

| | Tauri 2 + Rust | Electron | Flutter | SwiftUI |
|---|---|---|---|---|
| Interface | Web | Web | Dart | Nativa |
| Áudio | Nativo (cpal/CoreAudio), buffer e latência sob controle | Web Audio do Chromium, sem controle real de buffer | Plugins nativos bons | O melhor |
| Mobile | Mesmo projeto (iOS e Android) | Não tem | Excelente | Só iOS |
| Windows e Linux | Sim | Sim | Sim | Não |
| Tamanho | Pequeno | Grande | Médio | Pequeno |

Motivo principal: o WebView do Mac não dá controle de buffer, de dispositivo nem de latência, e tem histórico de problemas com permissão de microfone. Por isso o áudio fica em Rust, e a interface fica no que o Pedro domina.

### Camadas
- `packages/core` (TypeScript puro): modelos, regras do roadmap, sugestão de rotina, registros de prática, i18n. Sem dependência de interface.
- `crates/audio-engine` (Rust): relógio do metrônomo com precisão de amostra, sons de clique, afinador (YIN), dispositivos e latência. Compila para iOS e Android no futuro.
- `packages/music-sources` (a partir da Fase 1): interface comum `buscar, tocar, pausar, irPara, posicaoAtual`, com um adaptador por serviço.
- `apps/desktop`: app Tauri. A interface em React conversa com o Rust por comandos e eventos.
- Dados: SQLite local, via Rust.

### Desempenho da interface
React é suficiente. As partes que atualizam rápido (agulha do afinador, cifra rolando) vão por `requestAnimationFrame` e transform no elemento, fora do estado do React.

## iCloud
- O CloudKit exige o Apple Developer Program (US$ 99 por ano).
- Por enquanto, o SQLite fica local e o app grava um log de eventos em arquivos (uma linha por evento, um arquivo por dispositivo) numa pasta do iCloud Drive. Os outros Macs leem e fundem os eventos. Os registros de prática só crescem, então a fusão é simples. Ajustes usam a última gravação.
- O arquivo SQLite nunca vai para o iCloud Drive, porque pode corromper.
- Quando chegar a vez do iPhone, a conta paga vai ser necessária de qualquer jeito, e migramos para o CloudKit.

## Fontes de música (verificado em 18/11/2026)
Na tela Ajustes, a seção **Conexões** tem um botão por serviço e mostra o que cada um libera.

| Serviço | Situação | Login | O que oferece |
|---|---|---|---|
| Arquivos locais | Sem terceiros | Não | Tocar, analisar BPM e tom, loop, sincronia exata |
| YouTube (IFrame Player API) | Ativo. Player com no mínimo 200 por 200 px, visível e sem sobreposição. Em desktop, o Referer precisa ser definido (senão dá erro 153) | Chave de API para buscar. Google OAuth só para ler playlists | Tocar ao fundo, posição atual. Cota de 10.000 unidades por dia, e cada busca custa 100, então a busca usa cache |
| Spotify | Modo de desenvolvimento desde fev/2026: dono com Premium, até 5 usuários, busca com no máximo 10 resultados. Vários endpoints de lote, browse e top tracks foram removidos | OAuth com PKCE. O redirect precisa ser `http://127.0.0.1:PORTA` (localhost é proibido) | Controle de reprodução (Premium), metadados, playlists próprias. Sem áudio e sem análise. Plano B só para Mac: AppleScript no app do Spotify, a confirmar |
| Jamendo | Ativo. Livre para uso não comercial, 35.000 requisições por mês | Client ID. OAuth para favoritos | Backing tracks Creative Commons (a licença varia por faixa) |
| GetSongBPM | Grátis, link de volta obrigatório | Chave | BPM e tom sugeridos pelo nome. Sempre como sugestão, que o Pedro confirma |
| SoundCloud | Cadastro reaberto, mas exige Artist Pro | OAuth 2.1 | Depois, se fizer sentido |
| Audius | Aberto, chave em Settings, Manage Your Apps | Chave, OAuth opcional | Faixas independentes e eletrônicas |
| Deezer | Cadastro de apps novos não confirmado | | Busca e metadados |
| Apple Music | Fora (exige conta paga) | | |

## Cifras
- Não há API oficial do Cifra Club. O Songsterr não publica API documentada com termos para terceiros.
- O caminho é colar o texto, importar arquivos e guardar o link de origem. O cache é local.
- O formato interno é o ChordPro. Há um parser para o formato colado, com os acordes em cima da letra.

## Fases (ajustadas)
0. **Fundação e provas de risco:** monorepo, motor de áudio (metrônomo e afinador), YouTube dentro do WebView, login do Spotify por loopback, sistema de design, navegação.
1. **Núcleo:** metrônomo completo, catálogo e as quatro visões do roadmap, registro de prática com contador, calendário, tela Hoje, rotina sugerida, interface de fontes de música (só arquivos locais).
2. **Afinador** completo, com escolha de dispositivo e perfil de latência.
3. **Músicas, playlists e cifras.** Conexões com login.
4. **Adaptação de exercícios e música de fundo.**
5. **Companion.**
6. **Tela cheia ultrawide, polimento, empacotamento para Mac.**
7. **Portabilidade.**

## Fontes
- Spotify, mudanças de fev/2026: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- Spotify, anúncio: https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security
- Spotify, redirect URIs: https://developer.spotify.com/documentation/web-api/concepts/redirect_uri
- YouTube, requisitos mínimos: https://developers.google.com/youtube/terms/required-minimum-functionality
- YouTube, custo de cota: https://developers.google.com/youtube/v3/determine_quota_cost
- Jamendo, termos da API: https://devportal.jamendo.com/api_terms_of_use
- GetSongBPM, API: https://getsongbpm.com/api
- SoundCloud, chave de API: https://developers.soundcloud.com/docs/api/register-app
- Audius, SDK: https://docs.audius.org/developers/sdk/overview
- CloudKit: https://developer.apple.com/documentation/cloudkit/enabling-cloudkit-in-your-app
