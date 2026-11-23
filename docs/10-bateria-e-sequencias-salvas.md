# Bateria e sequências salvas

Extensão local de 23/11/2026. Atualiza o comportamento descrito em
`09-sequenciador.md`: bateria, mixer durante o loop e recuperação persistente
estão implementados. Não registra uma prática automaticamente.

## Uso

- Em **Acordes → Sequência**, ative a bateria, escolha o ritmo e pressione
  **Ouvir em loop**. Funciona com ou sem acordes. Os oito ritmos são Rock,
  Reggae, Indie rock, Metal, Ska, Afrobeat, Simples · bumbo e
  Simples · bumbo e chimbal.
- **Acordes**, **Clique** e **Bateria** têm volumes independentes, ajustáveis
  durante a reprodução. **Ouvir clique** e **Ativar bateria** também podem mudar
  durante o loop. BPM continua global, entre 20 e 400.
- A bateria aceita apenas **4/4**, com 16 posições por compasso. A interface
  oferece **Usar compasso 4/4** quando necessário. Trocas de ritmo entram no
  próximo compasso; a grade da bateria não reinicia a cada volta dos acordes.
- **Ferramentas** e a área de prática de **Exercício** mostram o mesmo painel
  de acompanhamento, com bateria e clique, sem reproduzir os acordes do rascunho.
  O rascunho e seus ajustes são compartilhados com a Sequência.
- **Parar loop** para também o metrônomo. Sair do painel ou ocultar a página
  interrompe o transporte. Abrir, carregar ou recuperar uma sequência nunca
  inicia áudio automaticamente. Para editar os blocos, pare o loop.

## Salvar e recuperar

Em Sequência, dê um nome e use **Salvar sequência**. São guardados o ID, o nome,
as formas exatas e tempos dos blocos, BPM, volume dos acordes, opção e volume
do clique, ritmo, ativação e volume da bateria. O limite permanece 16 blocos,
com 1, 2, 4 ou 8 tempos cada. Também é possível salvar sem acordes.

**Carregar** recupera a seleção em **Salvas**, com o transporte parado.
Na abertura, a sequência salva mais recente hidrata o rascunho, desde que o
usuário ainda não o tenha alterado durante a leitura. Alterações exigem novo
salvamento. **Novo rascunho** cria outro ID e limpa os blocos, mantendo os ajustes
de acompanhamento; **Apagar salva** remove da lista e mantém o rascunho atual.

Cada salvamento gera `sequence.saved`, com `updatedAt` igual à data do evento.
A exclusão usa o mesmo evento com `deleted: true`. O PracticeStore projeta os
eventos em `sequences`: **SQLite, esquema 3**, no desktop e **IndexedDB, versão
4**, no navegador. As migrações são aditivas; eventos antes adiados podem ser
reprocessados. Conflitos usam data e ID do evento como desempate. Sequências
participam da exportação/importação de repertório existente.

Os cinco sons são sintetizados localmente: bumbo, caixa, chimbal fechado,
chimbal aberto e aro. Os padrões e sons são originais para estudo, inspirados
nos estilos, sem samples ou promessa de reprodução de gravações conhecidas.
O núcleo TypeScript e o motor Rust preparam os bancos de som antes da reprodução.

## Sistema preservado e evidências

A comparação de `ChordSequence.tsx`, `DrumPanel.tsx`, `styles.css` (trecho de
sequências, a partir de 2320) e capturas em `target/qa-drums/` com
`apps/desktop/PRODUCT.md` e `apps/desktop/DESIGN.md` sustenta uma extensão
**Operate**: neutros quentes e laranja existentes, Manrope/Hanken/Geist,
painéis contidos, botões em pílula, campos e seletores existentes, foco visível
e controles que se reorganizam em janela estreita. Nenhum novo mundo visual ou
mudança de tokens foi aprovado; os documentos do sistema foram preservados.
A lista de telas de PRODUCT já divergia da navegação e não foi corrigida aqui.

- Verificações informadas nesta entrega: **149 testes de core**, **25 de áudio
  Rust**, **11 do store Rust**, **17 SQLite** e **18 IndexedDB em Chrome real**,
  incluindo migrações e eventos de sequência adiados.
- Capturas cobrem 1440 e 390 px, claro e escuro, além de Ferramentas e Exercício.
  A revisão visual pediu duas correções, aplicadas no código: estilo do campo
  de nome com `type="text"` e texto contextual de acompanhamento. O parecer
  posterior marcou ambas como resolvidas, disposition **ship**, sem regressões
  visuais nas oito recapturas. A aprovação cobre essas correções.
- Typecheck, Clippy com `-D warnings`, build:web e build:app finais passaram.
  Bundle local de 16,14 MiB. `pnpm test` não recebeu aprovação global: Chrome headless
  abortou com SIGABRT/EPERM após as etapas anteriores.
- Essas provas não aprovam escuta em saída física, timbre, sincronismo
  perceptivo ou ausência de estalos em equipamento real.

O teste Rust de processamento conta alocações e liberações durante reprodução,
troca e mute: zero operações de heap. Isso não mede CPU ou latência física.
Atualize os dois Macs antes de trocar sequências pelo iCloud: versões antigas
preservam tipos desconhecidos, mas o app antigo não abre um SQLite já migrado
para o esquema 3. O banco continua local; só eventos seguem pelo iCloud.

Teste manual sugerido: em saída física, ouvir os oito ritmos com e sem clique,
alterar BPM e volumes, conferir a troca no próximo compasso, parar e navegar.
Salvar uma forma diferente da Biblioteca com bateria, fechar e reabrir, conferir
forma e mixer recuperados sem autoplay; carregar e apagar uma salva. Repetir
em janela estreita, claro/escuro e teclado. Registrar resultados antes de tratar
essas verificações como aprovadas.
