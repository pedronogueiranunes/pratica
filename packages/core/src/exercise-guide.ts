// Guias dos exercícios que não têm tab. Texto original, sem depender de rede.
// Cada guia diz o que fazer, o que observar e, quando ajuda, mostra uma grade
// rítmica, um trecho de tab/tabela, o braço ou a calculadora de andamento.

export interface RhythmCell { beat: string; stroke: string; accent?: boolean }
export interface ExerciseGuide {
  intro: string;
  steps: string[];
  watch: string[];
  /** Grade de uma volta de 4 tempos (colcheias). */
  rhythm?: { label: string; cells: RhythmCell[] };
  /** Texto em fonte monoespaçada: mini tab, tabela ou fórmulas. */
  snippet?: { title: string; text: string };
  /** Mostra o braço interativo ou o círculo de quintas abaixo do guia. */
  embed?: "fretboard" | "circle";
  /** Calculadora de andamento: mostra o bpm de estudo a partir do original. */
  tempo?: { percent: number; label: string };
}

const eighths = (strokes: string[], accents: number[] = []): RhythmCell[] =>
  ["1", "e", "2", "e", "3", "e", "4", "e"].map((beat, i) => ({ beat, stroke: strokes[i] ?? "·", accent: accents.includes(i) || undefined }));

export const EXERCISE_GUIDES: Record<string, ExerciseGuide> = {
  "rotina-teoria-aplicada": {
    intro: "Um conceito por dia, aplicado no braço. Teoria que não vira som não fica.",
    steps: [
      "Escolha o tema do dia: um intervalo, um acorde, uma escala ou um grau do campo harmônico.",
      "Ache o tema no braço abaixo e toque três exemplos em lugares diferentes.",
      "Diga o nome de cada nota em voz alta enquanto toca.",
      "Feche escrevendo uma frase sua explicando o conceito. Se não sair, volte ao passo 2.",
    ],
    watch: ["Tocar sem falar o nome das notas não conta como estudo de teoria.", "Um tema só. Dois temas no mesmo dia viram nenhum."],
    embed: "fretboard",
  },
  "rotina-musica-loop": {
    intro: "Pegue o trecho mais difícil da música do mês e repita até ficar chato. Depois ele fica fácil.",
    steps: [
      "Marque 4 a 8 compassos do pedaço que mais trava.",
      "Comece em andamento reduzido e só suba depois de tocar três vezes seguidas sem errar.",
      "Quando errar, pare no erro, toque só aquela troca lenta cinco vezes e volte ao loop.",
      "No fim, toque o trecho com o resto da música em volta, para encaixar a entrada e a saída.",
    ],
    watch: ["Errar e continuar ensina o erro. Pare e corrija.", "Tensão no ombro ou no polegar é sinal de ir mais devagar."],
    tempo: { percent: 70, label: "Andamento de estudo" },
  },
  "rotina-ouvido-improviso": {
    intro: "Duas ou três notas, bem tocadas, soam mais música do que vinte notas soltas.",
    steps: [
      "Escolha 2 ou 3 notas da pentatônica de Lá menor, por exemplo A, C e D.",
      "Ponha um fundo: a bateria do app e uma sequência simples como Am, C, G, Am.",
      "Cante uma frase curta e toque o que cantou. Depois toque primeiro e cante em seguida.",
      "Faça frases com começo e fim, e deixe silêncio entre elas.",
    ],
    watch: ["Repetir uma frase com pequenas mudanças é improviso, não falta de ideia.", "Se estiver correndo pelas notas, diminua para duas e foque no ritmo."],
    embed: "fretboard",
  },
  "f1-palhetada-colcheias": {
    intro: "A mão direita não para de mexer. O que muda é se a palheta encosta nas cordas.",
    steps: [
      "Conte em voz alta: 1 e 2 e 3 e 4 e. Palhetada para baixo no número, para cima no e.",
      "Comece numa corda solta, no andamento inicial do metrônomo.",
      "Quando ficar limpo por 2 minutos, suba 5 bpm.",
      "Depois troque a corda solta por um acorde de duas cordas.",
    ],
    watch: ["O pulso balança, o braço fica quieto.", "Se tropeçar no andamento novo, volte 5 bpm e tente de novo amanhã."],
    rhythm: { label: "Colcheias alternadas", cells: eighths(["D", "U", "D", "U", "D", "U", "D", "U"], [0, 2, 4, 6]) },
  },
  "f1-duas-musicas": {
    intro: "Duas músicas inteiras, do começo ao fim, devagar. Fim de verdade, sem parar no meio.",
    steps: [
      "Escolha duas músicas do repertório da fase 1 que você já sabe os acordes.",
      "Calcule 70% do andamento original abaixo e ponha no metrônomo.",
      "Toque inteira, sem parar. Se errar, siga o compasso e anote onde errou.",
      "Depois, treine só os pontos que anotou e toque a música inteira de novo.",
    ],
    watch: ["Fazer a música chegar ao fim vale mais do que fazer o primeiro verso perfeito.", "Troca de acorde atrasada é problema de preparação: mexa o dedo antes do tempo."],
    tempo: { percent: 70, label: "Andamento de estudo (70%)" },
  },
  "f1-notas-cordas-6-5": {
    intro: "Saber o nome das notas nas duas cordas graves abre pestanas, power chords e escalas.",
    steps: [
      "Aprenda primeiro as notas naturais, sem sustenidos. Elas ficam a 2 casas uma da outra, menos E-F e B-C, que ficam a 1.",
      "Toque cada nota dizendo o nome, subindo até a casa 12 e voltando.",
      "No braço abaixo, escolha uma nota e ache todas as posições dela nas cordas 6 e 5.",
      "Faça o contrário: toque uma casa qualquer e diga a nota antes de conferir.",
    ],
    watch: ["A casa 12 repete a corda solta, uma oitava acima.", "A mesma nota aparece nas duas cordas: C é a casa 8 da corda 6 e a casa 3 da corda 5."],
    snippet: {
      title: "Naturais nas cordas 6 e 5",
      text: "Corda 6:  E0  F1  G3  A5  B7  C8  D10  E12\nCorda 5:  A0  B2  C3  D5  E7  F8  G10  A12",
    },
    embed: "fretboard",
  },
  "f1-ler-cifra-tab": {
    intro: "A cifra diz quais acordes tocar. A tab diz onde pôr os dedos, nota por nota.",
    steps: [
      "Na cifra, o nome do acorde fica acima da sílaba onde a troca acontece.",
      "Na tab, cada linha é uma corda: a de baixo é a corda 6 (grave) e a de cima é a 1 (aguda).",
      "Os números são as casas. O 0 é corda solta. Leia da esquerda para a direita.",
      "Toque o exemplo abaixo, depois escolha um trecho de uma música sua e leia só a tab.",
    ],
    watch: ["Números na mesma coluna soam juntos.", "A tab não mostra ritmo. Ouça a música para o tempo de cada nota."],
    snippet: {
      title: "Escala de Sol maior em tab",
      text: "e|---------------------|\nB|---------------------|\nG|---------------------|\nD|-----------------2-4-5|\nA|---------2-3-5-------|\nE|-3-5-----------------|",
    },
  },
  "f2-palhetada-continua": {
    intro: "Palhetada que não para, com a mão esquerda ou a palma abafando as cordas. O ritmo vem do braço, a harmonia vem do dedo.",
    steps: [
      "Mantenha o movimento para baixo e para cima sem parar, mesmo quando não toca a corda.",
      "Com a mão esquerda, solte a pressão do acorde só para abafar e volte ao acorde.",
      "Acentue os tempos 2 e 4, onde a caixa bateria.",
      "Suba o andamento de 5 em 5 bpm quando estiver limpo.",
    ],
    watch: ["Abafar com pressão leve nas cordas, sem apertar até o braço.", "Se o movimento parar quando você erra, volte a contar em voz alta."],
    rhythm: { label: "Contínuo com abafamento", cells: eighths(["D", "x", "D", "U", "x", "U", "D", "U"], [2, 6]) },
  },
  "f2-skank-reggae": {
    intro: "No reggae, o acorde cai no contratempo, no e. O silêncio no tempo é parte do ritmo.",
    steps: [
      "Conte 1 e 2 e 3 e 4 e. Toque só nos e, palhetada curta para cima nas 3 ou 4 cordas agudas.",
      "Solte a pressão logo depois de tocar, para o acorde soar seco.",
      "Ponha a bateria Reggae do app para sentir o um tempo vazio e a caixa no 3.",
      "Quando estiver firme, troque o acorde a cada dois compassos.",
    ],
    watch: ["O skank é curto. Se o acorde dura, você não soltou o dedo.", "Não toque nos números: a bateria faz isso por você."],
    rhythm: { label: "Skank", cells: eighths(["·", "U", "·", "U", "·", "U", "·", "U"], [1, 3, 5, 7]) },
  },
  "f2-palm-mute": {
    intro: "Palm mute abafa a corda com a lateral da mão direita perto da ponte. É o som seco do indie rock e do punk.",
    steps: [
      "Apoie a lateral da mão direita na ponte e nas cordas, bem perto do cavalete. Ajuste até soar um som surdo, mas com altura.",
      "Toque colcheias abafadas em uma corda grave, só para baixo.",
      "Alterne: dois compassos abafados, um compasso aberto, tirando a mão da corda.",
      "Passe para power chords abafados.",
    ],
    watch: ["Se não tem altura, a mão está perto demais do braço. Se soa aberto, está longe demais.", "Mão direita relaxada: apertar a corda mata o som."],
    rhythm: { label: "Abafado e aberto", cells: eighths(["x", "x", "x", "x", "x", "x", "D", "·"], [6]) },
  },
  "f2-gravar-semanal": {
    intro: "Gravar mostra o que o ouvido não pega enquanto você toca. Um minuto por semana basta.",
    steps: [
      "Escolha uma música ou um exercício e grave 1 minuto, sem repetir a gravação.",
      "Nomeie o arquivo com a data e guarde na mesma pasta.",
      "No dia seguinte, ouça com atenção, sem tocar junto.",
      "Compare com a gravação da semana anterior e escreva uma coisa que melhorou e uma que não.",
    ],
    watch: ["Andamento estável? Troca de acorde no tempo? Cordas limpas?", "Gravar uma vez e pronto. Regravar até ficar bom não mostra o seu nível real."],
  },
  "f2-quatro-musicas": {
    intro: "Quatro músicas completas no repertório. Mais importante que a quantidade é terminar cada uma.",
    steps: [
      "Escolha quatro músicas da tabela, duas que você já tem e duas novas.",
      "Para cada nova, aprenda os acordes, depois o ritmo da mão direita, depois a letra por cima.",
      "Toque inteira com o metrônomo, sem parar, mesmo errando.",
      "Marque como feita só quando conseguir tocar do começo ao fim duas vezes seguidas.",
    ],
    watch: ["Troque de música quando travar mais de 15 minutos na mesma parte.", "Uma música por dia de estudo é um bom ritmo."],
  },
  "f2-acordes-maior-menor": {
    intro: "Maior e menor diferem em uma única nota: a terça. É uma casa de diferença.",
    steps: [
      "Um acorde maior tem fundamental, terça maior e quinta. O menor troca a terça maior pela menor, uma casa abaixo.",
      "Toque C e Cm, depois A e Am, E e Em, D e Dm, G e Gm. Ouça o humor mudar.",
      "No braço abaixo, escolha um acorde e veja onde estão as três notas.",
      "Tente adivinhar de olhos fechados se o acorde que você tocou é maior ou menor.",
    ],
    watch: ["Maior soa aberto e claro, menor soa mais fechado e triste. Confie no ouvido primeiro.", "A terça é a única nota que muda. A fundamental e a quinta ficam."],
    snippet: {
      title: "Notas dos pares",
      text: "C   C E G     Cm  C Eb G\nA   A C# E    Am  A C E\nE   E G# B    Em  E G B\nD   D F# A    Dm  D F A\nG   G B D     Gm  G Bb D",
    },
    embed: "fretboard",
  },
  "f2-campo-harmonico": {
    intro: "O campo harmônico é o conjunto de acordes que combinam entre si num tom. É o mapa para criar progressões.",
    steps: [
      "No círculo abaixo, escolha um tom e veja os sete acordes do campo.",
      "Toque os acordes do campo em ordem, de I a vii, ouvindo cada um.",
      "Monte quatro progressões usando os graus e toque em outro tom.",
      "Reconheça progressões de músicas que você conhece pelos graus, não pelas letras.",
    ],
    watch: ["Os graus maiúsculos são acordes maiores, os minúsculos são menores, vii é diminuto.", "I, IV e V são os acordes mais fortes do tom."],
    snippet: {
      title: "Dó maior e progressões",
      text: "I C   ii Dm   iii Em   IV F   V G   vi Am   vii° Bdim\n\nI-V-vi-IV    C G Am F\nii-V-I        Dm G C\nI-IV-V        C F G\nvi-IV-I-V     Am F C G",
    },
    embed: "circle",
  },
  "f2-capo-transposicao": {
    intro: "O capo sobe todo o violão. Cada casa sobe um semitom, e você troca de tom mantendo as mesmas formas.",
    steps: [
      "Toque uma progressão simples, como G, C e D, sem capo.",
      "Ponha o capo na casa 2 e toque as mesmas formas. Agora soam A, D e E.",
      "Para tocar uma música em outro tom, ache qual capo mantém formas que você já sabe.",
      "Pratique o contrário: dado o tom da música e as formas que você quer usar, descubra a casa do capo.",
    ],
    watch: ["Capo na casa N sobe N semitons. É a mesma conta do círculo de quintas.", "Conte a casa do capo a partir da pestana do braço (o nut), casa 0."],
    snippet: {
      title: "Forma de Sol (G) com capo",
      text: "casa 0  G      casa 5  C\ncasa 2  A      casa 7  D\ncasa 3  Bb     casa 9  E",
    },
    embed: "circle",
  },
  "f3-bend-vibrato-slide": {
    intro: "Bend, vibrato e slide dão voz à nota. Todos pedem mão relaxada e o dedo apoiado por outros dedos.",
    steps: [
      "Bend: use os dedos 1 e 2 apoiando o dedo 3 na mesma corda. Empurre a corda para cima até a nota subir um tom.",
      "Confira o bend tocando a nota duas casas acima e comparando o som.",
      "Vibrato: gire o pulso, como se girasse uma maçaneta, em vez de mexer só o dedo.",
      "Slide: deslize o dedo sem soltar a pressão e chegue na casa certa de uma vez.",
    ],
    watch: ["Um bend desafinado soa pior que nenhum. Sempre confira o destino.", "Se o polegar da mão esquerda está tenso, o vibrato fica duro."],
  },
  "f3-arpejos": {
    intro: "Arpejo é tocar as notas do acorde uma de cada vez. O polegar cuida das graves, os dedos das agudas.",
    steps: [
      "Polegar (p) nas cordas 6, 5 ou 4. Indicador (i) na 3, médio (m) na 2 e anelar (a) na 1.",
      "Comece com um acorde de Am e o padrão abaixo, devagar, no metrônomo.",
      "Deixe todas as notas soando juntas, sem abafar. A mão esquerda fica firme no acorde.",
      "Depois troque o acorde a cada compasso, mantendo o padrão.",
    ],
    watch: ["A mão direita parada, só os dedos se movem.", "Cada nota com o mesmo volume. Ouça se o p está muito forte."],
    rhythm: { label: "p i m a m i", cells: eighths(["p", "i", "m", "a", "m", "i", "m", "a"], [0]) },
  },
  "f3-improviso-pentatonica": {
    intro: "Improvisar é conversar com o fundo. Use poucas notas, ouça o que o acorde pede e responda.",
    steps: [
      "Ponha um fundo: a bateria do app e uma sequência como Am, C, D, Am, ou use um backing track seu.",
      "Escolha uma posição da pentatônica de Lá menor no braço abaixo e fique nela.",
      "Toque uma frase curta, silêncio, e responda com a mesma frase mudada.",
      "Pare em notas do acorde na hora da troca: no Am, A, C ou E.",
    ],
    watch: ["Cinco notas bastam para a sessão inteira.", "O silêncio entre frases é o que faz a frase soar frase."],
    embed: "fretboard",
  },
  "f3-solo-curto": {
    intro: "Um solo curto de uma música que você gosta. É prática de frase, fraseado e andamento.",
    steps: [
      "Escolha um solo de 8 a 16 compassos de uma música da sua tabela.",
      "Divida em frases de 2 compassos e aprenda uma por vez, devagar.",
      "Junte duas frases, depois quatro, até chegar ao solo inteiro.",
      "Suba o andamento em passos de 5 bpm, sem perder a limpeza.",
    ],
    watch: ["Aprenda a dedilhação junto com as notas. Mudar depois é pior.", "Ouça o solo original várias vezes. O fraseado vem do ouvido, não da tab."],
    tempo: { percent: 60, label: "Comece a 60% do original" },
  },
  "f3-seis-musicas": {
    intro: "Seis músicas de reggae e indie em velocidade real. Aqui é fluência: tocar como se fosse tocar para alguém.",
    steps: [
      "Monte a lista: três de reggae e três de indie rock do seu repertório.",
      "Toque cada uma no andamento original, com o metrônomo ou com a música de fundo.",
      "Em cada reggae, mantenha o skank no contratempo. Em cada indie, use o palm mute onde pede.",
      "Grave uma delas e ouça no dia seguinte.",
    ],
    watch: ["Se uma música precisa de mais de duas tentativas para chegar ao fim, volte a 80% e suba de novo.", "Respire entre as trocas. Segurar a respiração trava a mão."],
    tempo: { percent: 100, label: "Andamento real" },
  },
  "f3-escala-maior-3-posicoes": {
    intro: "A mesma escala tocada em três lugares do braço. A relativa menor usa as mesmas notas, começando no sexto grau.",
    steps: [
      "Escolha o tom de Dó maior e toque a escala na posição aberta, perto da casa 0.",
      "Ache outra posição perto da casa 5 e uma terceira perto da casa 8 no braço abaixo.",
      "Toque a escala começando em Lá: é Lá menor natural, com as mesmas notas.",
      "Improvise duas frases em cada posição, terminando na fundamental.",
    ],
    watch: ["Cada posição é um recorte da mesma escala. Procure as notas em comum entre elas.", "Pense nos graus: 1 2 3 4 5 6 7. Eles ficam iguais em qualquer posição."],
    snippet: { title: "Relativas", text: "C maior    C D E F G A B\nA menor    A B C D E F G\n(mesmas notas, outro ponto de partida)" },
    embed: "fretboard",
  },
  "f3-acordes-setima-sus-add9": {
    intro: "Acordes com sétima, sus e add9 dão cor. Cada um é o acorde básico com uma nota mudada ou acrescentada.",
    steps: [
      "Toque C, depois Cmaj7, C7, Csus2, Csus4 e Cadd9, ouvindo como cada nota muda o humor.",
      "Repita em A e em E.",
      "Troque um acorde simples de uma música sua por uma dessas versões e ouça a diferença.",
      "Aprenda dois acordes novos por semana, e só então passe para os próximos.",
    ],
    watch: ["Sus não tem terça, então não é nem maior nem menor.", "Sétima maior soa sonhadora, sétima dominante pede resolução."],
    snippet: {
      title: "Fórmulas e exemplos em Dó",
      text: "Cmaj7   1 3 5 7M     C E G B\nC7      1 3 5 b7     C E G Bb\nCm7     1 b3 5 b7    C Eb G Bb\nCsus2   1 2 5        C D G\nCsus4   1 4 5        C F G\nCadd9   1 3 5 9      C E G D",
    },
  },
  "f3-pentatonica-sobre-acorde": {
    intro: "Nem toda nota da escala soa bem sobre todo acorde. Saber quais notas são do acorde ajuda a escolher onde pousar.",
    steps: [
      "Em Lá menor, a pentatônica tem A, C, D, E e G.",
      "Sobre Am, C e Em, as notas do acorde estão quase todas na escala. Sobre G e F, algumas faltam, então use as notas de passagem.",
      "No braço abaixo, escolha o acorde e veja quais notas da pentatônica fazem parte dele.",
      "Improvise sobre uma progressão pousando em notas do acorde na hora da troca.",
    ],
    watch: ["A nota do acorde na hora da troca dá a sensação de acompanhar a harmonia.", "Uma nota fora do acorde não é erro se você sai dela com intenção."],
    snippet: {
      title: "Lá menor pentatônica sobre cada acorde",
      text: "Am  A C E      cabe tudo (A C E)\nC   C E G      cabe tudo (C E G)\nDm  D F A      falta F\nEm  E G B      falta B\nG   G B D      falta B\nF   F A C      falta F",
    },
    embed: "fretboard",
  },
  "f4-dedilhado": {
    intro: "Fingerstyle: o polegar faz o baixo e os dedos fazem a melodia e o acompanhamento ao mesmo tempo.",
    steps: [
      "Posicione a mão: polegar nas cordas graves, indicador, médio e anelar nas cordas 3, 2 e 1.",
      "Comece com Am e o padrão abaixo, devagar.",
      "Alterne o baixo: raiz nas casas 1 e 3, quinta nas casas 2 e 4 do padrão.",
      "Passe para uma progressão de quatro acordes mantendo o mesmo padrão.",
    ],
    watch: ["Unhas curtas e uniformes ajudam o som.", "O polegar tem que ser o mais firme. Ele marca o tempo."],
    rhythm: { label: "Padrão p i m i", cells: eighths(["p", "i", "m", "i", "p", "i", "m", "i"], [0, 4]) },
  },
  "f4-composicao": {
    intro: "Uma ideia por semana. Terminar uma música curta ensina mais do que começar dez.",
    steps: [
      "Escolha uma progressão de 4 acordes. Use a aba Acordes para ouvir em loop com a bateria.",
      "Grave uma ideia de melodia ou riff de 8 compassos, mesmo imperfeita.",
      "Defina a estrutura: verso, refrão, e o que acontece de diferente em cada um.",
      "Feche a semana com uma gravação curta da música inteira.",
    ],
    watch: ["Limite o tempo. Duas horas por semana basta.", "Guarde as ideias abandonadas. Elas voltam em outra música."],
  },
  "meta-polyphia": {
    intro: "Meta de longo prazo. Uma música difícil dividida em partes pequenas, até ficar tocável.",
    steps: [
      "Divida a música em seções: intro, riff principal, ponte, solo.",
      "Escolha uma seção por semana e aprenda devagar, só ela.",
      "Use o andamento abaixo para estudar e só suba depois de tocar três vezes limpo.",
      "Junte as seções duas a duas até tocar a música inteira.",
    ],
    watch: ["Ouça a música várias vezes antes de pegar a guitarra.", "Meses é o prazo certo. Avance sem pressa e sem frustração."],
    tempo: { percent: 50, label: "Comece a 50% do original" },
  },
  "dnb-meio-tempo": {
    intro: "Drum n bass a meio tempo bate no andamento da metade, com a caixa no 3 e o bumbo no 1. Sente lento, mas o loop corre.",
    steps: [
      "Ponha a bateria DnB meio tempo do app no andamento entre 80 e 87 bpm.",
      "Toque o acorde ou a nota no tempo 1 e deixe soar até o 3, onde bate a caixa.",
      "Conte o pulso em colcheias, com o chimbal firme, sem acelerar.",
      "Aumente o andamento só quando o 1 e o 3 estiverem sempre onde devem.",
    ],
    watch: ["O erro comum é puxar para o tempo dobrado e perder a sensação de meio tempo.", "Ouça a caixa no 3 como âncora."],
    rhythm: { label: "Meio tempo", cells: eighths(["K", "h", "h", "h", "S", "h", "h", "h"], [0, 4]) },
  },
  "dnb-skank-sobre-loop": {
    intro: "Skank de reggae sobre um loop de drum n bass. A mistura funciona porque o contratempo do skank cai entre as batidas do loop.",
    steps: [
      "Escolha um loop de DnB a meio tempo entre 80 e 87 bpm, no Ableton ou na bateria do app.",
      "Toque o skank só nos e, palhetada curta, acorde de 3 cordas agudas.",
      "Deixe o espaço do tempo 1 e do 3 para o bumbo e a caixa.",
      "Mude o acorde a cada dois compassos e ouça como o loop sustenta.",
    ],
    watch: ["Se o skank briga com a caixa, toque mais curto e mais agudo.", "Menos é mais: o espaço faz o groove."],
    rhythm: { label: "Skank sobre o loop", cells: eighths(["·", "U", "·", "U", "·", "U", "·", "U"], [1, 3, 5, 7]) },
  },
  "dnb-riffs-fatiados": {
    intro: "Fatiar é cortar uma gravação em pedaços e rearranjar. Vira riffs novos a partir de uma ideia só.",
    steps: [
      "Grave um riff de 4 compassos no Ableton.",
      "Use Slice to New MIDI Track, fatiando por tempo, para ter cada pedaço num pad.",
      "Reordene os pedaços, repita um deles, apague outro, mude o ritmo.",
      "Guarde as 3 melhores versões e toque uma delas por cima com a guitarra.",
    ],
    watch: ["Se todos os cortes soam ao acaso, escolha só um para mexer.", "Salve cada versão com um nome, para voltar depois."],
  },
};

export function exerciseGuide(id: string): ExerciseGuide | null {
  return EXERCISE_GUIDES[id] ?? null;
}

/** Andamento de estudo arredondado, nunca abaixo de 30 bpm. */
export function studyTempo(originalBpm: number, percent: number): number {
  if (!Number.isFinite(originalBpm) || !Number.isFinite(percent) || originalBpm <= 0 || percent <= 0) return 0;
  return Math.max(30, Math.round((originalBpm * percent) / 100));
}
