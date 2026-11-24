# Requisitos do app de exercícios de guitarra

Dono: Pedro (desenvolvedor front-end sênior, Webflow e design engineering). Idioma da interface: português do Brasil, com opção de inglês depois.

## Objetivo
Um app para a prática diária de guitarra, focado em dexteridade, acordes e escalas, que guia o roadmap de 6 meses descrito em `01-roadmap.md` e usa as músicas que o Pedro escuta.

## Features pedidas (palavras dele, organizadas)

1. **Exercícios diários de dexteridade**, para desenvolver independência de dedos e de membros (mão esquerda, mão direita, palhetada).
2. **Metrônomo interno**, com vários tipos de som e escolha de volume.
3. **Roadmap com todos os exercícios**, em quatro visões: timeline, fases, lista geral e grid.
4. **Contador de práticas:** registrar quantas vezes fez cada exercício, para controle interno.
5. **Calendário** onde se vê todos os exercícios já feitos.
6. **Plataforma:** por enquanto só Mac. Depois portar para iOS/Android e Windows/Linux. A arquitetura precisa permitir isso sem reescrever a lógica.
7. **Músicas e playlists:** o usuário insere músicas ou playlists, e o app adapta exercícios para elas ou as coloca como fundo.
8. **Afinador (tuner):** recebe o som da guitarra ou violão e mostra a nota e o desvio em cents.
9. **Interface minimalista**, inspirada em apps da Apple, com poucas telas bem organizadas. Sem emojis, usar ícones SVG de line art quando precisar de ícone. Modo claro e escuro.
10. **Modo tela cheia** que mostra mais painéis em telas maiores. Ele usa um monitor ultrawide, então o layout precisa aproveitar bem essa proporção.
11. **Cache de cifras**, para acompanhar as músicas e playlists do banco de músicas, funcionando offline depois de baixadas.
12. **Modo companion**, que acompanha a cifra tocando junto, como um Guitar Hero.
13. **Prévia dos acordes (implementada localmente, 23/11/2026):** tocar o acorde ao clicar no cartão, com a forma selecionada e possibilidade de repetir o som.
14. **Partitura do acorde (implementada localmente, 23/11/2026):** visualizar o acorde selecionado na pauta, coerente com as notas e oitavas do diagrama. Comportamento e limites em `07-acordes-som-e-partitura.md`.
15. **Importação por link (pedido futuro, 23/11/2026):** colar o link de uma cifra/tab na música e preencher o conteúdo automaticamente nos serviços compatíveis, com prévia, origem e confirmação. Compatibilidade, APIs, permissões e formatos precisam ser pesquisados por serviço antes da implementação; o pedido não reabre automaticamente a decisão anterior de descartar raspagem.
16. **Inversões e variações de acordes (implementadas localmente, 23/11/2026):** selecionar baixo/inversão, formas em outras posições e variações harmônicas, mantendo diagrama, som e pauta coerentes. Até seis formas validadas; limites em `07-acordes-som-e-partitura.md`.
17. **Sequenciador de acordes (implementado, 23/11/2026):** adicionar até 16 formas exatas, definir 1/2/4/8 tempos, reordenar e ouvir em loop no BPM do metrônomo. Salvar por nome e eventos, recuperar sem autoplay e transferir pelo pacote JSON. Ver `09-sequenciador.md` e `10-bateria-e-sequencias-salvas.md`.
18. **Bateria de acompanhamento (implementado localmente, 23/11/2026):** ligar/desligar padrões originais de rock, reggae, indie rock, metal, ska, afrobeat e dois loops simples, em 4/4. Volume próprio ao vivo, independente do metrônomo e dos acordes, com relógio compartilhado; também utilizável sem sequência em Ferramentas e no exercício. Ver `10-bateria-e-sequencias-salvas.md`.
19. **Canais por interface (implementado localmente, 24/11/2026):** escolher em Ajustes o canal de entrada e o canal de saída de cada interface de áudio, lembrados por interface neste aparelho.

## Pontos técnicos que o desenvolvimento precisa resolver cedo

Ferramenta adicional solicitada e implementada localmente em 24/11/2026:
**Círculo de quintas**, em Ferramentas, com relativos maiores/menores naturais,
armaduras, enarmonias, notas e campo harmônico. Ver `15-circulo-de-quintas.md`.

Estes itens podem mudar o escopo, então decidir com o Pedro antes de construir.

- **Áudio do Spotify não é acessível.** O áudio é protegido, e a análise de faixas (BPM, tom, batidas) do Spotify não está disponível para apps novos. Então "adaptar exercícios à música" não pode depender de analisar o áudio do Spotify. Opções: usar BPM e tom informados ou tocados no tap tempo pelo usuário, analisar arquivos de áudio locais que ele importe, ou usar dados da própria cifra. O Spotify pode servir para tocar a faixa ao fundo (o Pedro agora tem Premium) controlando o app do Spotify, sem acesso ao áudio bruto.
- **Cifras e direitos autorais.** Cifra Club, Songsterr e similares têm termos de uso. Antes de baixar em massa, verificar se há API ou licença. Alternativa segura: o usuário cola a cifra, importa arquivos, ou o app guarda só links e o que o usuário salvar manualmente. Cache sempre local ao usuário.
- **Sincronia do modo companion.** Para os acordes rolarem em sincronia, é preciso de tempo (BPM, compasso, ponto de início) por música. Começar com gráficos de acordes simples, criados ou ajustados à mão, sobre um metrônomo, e só depois tentar sincronia com a faixa real.
- **Latência de áudio.** O metrônomo precisa de agendamento preciso (lookahead scheduler, sem depender de setTimeout) e o afinador de detecção de altura em tempo real (por exemplo, YIN ou autocorrelação) com baixa latência.
- **Permissão de microfone no Mac** para o afinador e, depois, para entrada de interface de áudio.

## Fontes de música (pesquisa de 18/11/2026)
O app deve ter uma camada "fonte de música" com a mesma interface para todas as fontes: buscar, tocar, pausar, ir para uma posição e ler a posição atual. Assim dá para somar ou trocar serviços sem mexer no resto. Ordem de prioridade sugerida:

1. **Arquivos de áudio locais** que o usuário importa. É a fonte mais confiável, a única em que dá para analisar BPM e tom, e não depende de regras de terceiros.
2. **YouTube (player embutido, IFrame Player API).** Grátis, catálogo enorme e muito backing track de reggae, indie e drum n bass. Regras: o player precisa ficar visível e manter os recursos padrão (volume, legendas, anúncios), com limites de tamanho e sem sobreposição que altere o visual. Em app desktop é preciso definir o Referer (cabeçalho HTTP) ou o app ID. Dá para ler a posição atual do vídeo (útil para sincronizar a cifra no modo companion). Não dá para extrair o áudio nem obter BPM. A busca usa a YouTube Data API, que tem cota diária grátis.
3. **Spotify, controlando o app do Spotify** (o Pedro tem Premium) para tocar ao fundo. Sem acesso ao áudio bruto e sem análise de faixas.
4. **Jamendo.** Música com licença Creative Commons, uso não comercial com limite mensal de requisições. Boa fonte de backing tracks legais, mas sem as músicas que o Pedro escuta.
5. **Outras, se fizer sentido depois:** SoundCloud (embed e SDK em JavaScript, conferir se o cadastro de apps novos está aberto), Audius (API aberta, música independente e eletrônica), Deezer (API grátis, mas só trechos de 30 segundos pela API, faixa completa só pelos plugins deles, serve para busca e metadados). Apple Music (MusicKit) exige conta de desenvolvedor paga, então fica de fora por enquanto.
6. **Metadados:** MusicBrainz e Last.fm (grátis). Para BPM e tom, o GetSongBPM é uma opção a conferir, com termos de uso atuais ainda não verificados.

Antes de adotar qualquer serviço, conferir os termos de uso e a situação atual da API, porque mudam com frequência.

## Dados principais (rascunho)
- **Exercicio:** id, nome, tipo (dexteridade, acordes, escalas, ritmo, teoria, repertório, ouvido, composição), fase, descrição, bpm inicial, bpm alvo, duração, critério de sucesso, vídeos, tags.
- **RegistroDePratica:** exercício, data e hora, duração, bpm usado, repetições ou contagem, nota livre.
- **Musica, Playlist, Cifra:** título, artista, bpm, tom, origem, acordes com tempos, texto da cifra, estado de cache.
- **Configuracoes:** tema, som e volume do metrônomo, dispositivo de entrada de áudio, afinação de referência (padrão 440 Hz).

Catálogo inicial dos exercícios: `data/exercises.seed.json`.

## Telas (poucas e bem organizadas)
1. **Hoje:** rotina do dia (os 5 blocos de 40 minutos), metrônomo à mão, botão para registrar prática.
2. **Roadmap:** alternador entre timeline, fases, lista e grid, com contador por exercício e filtro por fase e tipo.
3. **Calendário:** histórico de práticas por dia, com detalhe do dia.
4. **Músicas:** banco de músicas e playlists, cifras em cache, ação de adaptar exercícios.
5. **Companion:** modo de tocar junto, estilo Guitar Hero.
6. **Ferramentas:** metrônomo completo e afinador (também acessíveis como painéis em tela cheia).
7. **Ajustes.**

## Design
- Minimalista e calmo, referência em apps da Apple (hierarquia clara, bastante espaço, tipografia forte, movimento sutil).
- Sem emojis. Ícones SVG de line art, traço consistente.
- Claro e escuro, seguindo o sistema por padrão.
- Em telas largas (ultrawide), mostrar painéis lado a lado: por exemplo roadmap, metrônomo e cifra ao mesmo tempo.
- Textos da interface devem soar humanos, curtos e diretos. Sem travessão longo e sem frases com cara de texto gerado por IA.
- Se a interface for feita com tecnologia web, usar a skill Impeccable (github.com/pbakaus/impeccable), preferência do Pedro para trabalho de design web.

## Fases de desenvolvimento sugeridas
- **Fase 0, fundação:** escolher a stack, criar o projeto, sistema de design (tokens, claro e escuro, ícones) e o esqueleto de navegação.
- **Fase 1, núcleo (primeiro app utilizável):** metrônomo, catálogo de exercícios com as visões do roadmap, registro de prática com contador e calendário, tela Hoje. Dados locais.
- **Fase 2, afinador.**
- **Fase 3, músicas e cifras:** banco de músicas e playlists, importação, cache de cifras offline.
- **Fase 4, adaptação de exercícios e fundo:** sugerir exercícios para cada música, tocar a faixa ao fundo, tap tempo.
- **Fase 5, companion:** cifra rolando em sincronia com metrônomo e depois com a faixa.
- **Fase 6, tela cheia e polimento:** layouts ultrawide, atalhos, empacotamento e assinatura para Mac.
- **Fase 7, portabilidade:** iOS, Android, Windows, Linux.

Cada fase termina com algo que o Pedro consegue abrir e usar.
