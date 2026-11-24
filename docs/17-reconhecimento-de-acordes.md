# Reconhecimento de acordes ao vivo (app do Mac)

Na tela Acordes (Biblioteca), o painel "Reconhecer o que você toca" ouve a entrada de áudio e mostra o acorde, a inversão, as inversões possíveis e as variações. Só no app desktop.

## Como funciona

1. O afinador entrega o espectro. `chromaFromSpectrum` gera o cromagrama de 12 notas.
2. As últimas 4 leituras são combinadas (`ChromaSmoother`): média do cromagrama e voto do baixo.
3. `recognizeChords` compara o cromagrama com modelos de 16 tipos de acorde nas 12 raízes e devolve até 4 candidatos, com nota de 0 a 1.
4. O baixo vem de `lowestPitchClass`: o pico mais grave com força, descartando picos que são harmônicos de uma nota mais grave.
5. Inversão só é aceita quando o baixo é quase tão forte quanto a fundamental. Na dúvida, o acorde aparece em posição fundamental.
6. `ChordStabilizer` confirma o acorde após 3 leituras iguais e segura o último por 1,8 s sem sinal. O painel mantém o último acorde na tela, esmaecido, até outro ser confirmado.

O acorde confirmado abre o detalhe na biblioteca sem tocar som, para evitar microfonia com a entrada aberta. Clicar numa inversão ou variação abre o detalhe do mesmo jeito.

## Interface

- Botão Ouvir liga a entrada de áudio do afinador.
- Nome do acorde com inversão e "Também pode ser" com até 3 alternativas.
- Barra com as 12 notas que o app está ouvindo, para entender erros.
- Inversões e variações em grade de mini diagramas.

## Limites

- É uma estimativa. Cordas abafadas, ruído, afinação diferente e acordes muito abertos podem confundir.
- Testado só com sinais sintéticos (G, C, Am, E, Dm, D7, C/E, C/G, Em7, G6). Falta validar com violão e interface reais.
- A lista de tipos reconhecidos é fixa: maior, menor, 7, 7M, m7, 6, m6, sus2, sus4, add9, dim, dim7, aug, m7(b5), 9, m9.

## Código

`packages/core/src/chord-recognition.ts`, teste em `packages/core/test/chord-recognition.test.ts`, interface em `apps/desktop/src/components/ChordListener.tsx`, integrada em `screens/Chords.tsx`.
