import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chordsUsed, isChord, isChordLine, mergeChordsIntoLyrics, parseChord, parseChordPro, plainTextToChordPro, serializeChordPro, transposeChord, transposeDoc } from "../src";

// Estrutura de uma cifra colada do Cifra Club pelo Pedro, com a letra trocada por texto neutro.
const pasted = readFileSync(new URL("./fixtures/cifra-colada-cifraclub.txt", import.meta.url), "utf8");

describe("acordes", () => {
  it("aceita notação brasileira e inglesa", () => {
    for (const c of ["Em7(9)", "C7M", "B7", "D7", "Bm7", "F#m7(b5)", "D°", "Cmaj7", "Asus4", "G/B", "C6/9", "Bb7(#11)", "E7(4/9)", "A+"]) expect(isChord(c), c).toBe(true);
  });
  it("recusa palavras comuns", () => {
    for (const w of ["Linha", "Verso", "Em7(9", "Do", "Amor", "Bem", "Ele", "Ah", "Fé"]) expect(isChord(w), w).toBe(false);
  });
  it("separa raiz, sufixo e baixo", () => {
    expect(parseChord("F#m7(b5)/C")).toEqual({ root: "F#", suffix: "m7(b5)", bass: "C" });
  });
  it("transpõe mantendo o sufixo", () => {
    expect(transposeChord("Em7(9)", 2)).toBe("F#m7(9)");
    expect(transposeChord("C7M", -1)).toBe("B7M");
    expect(transposeChord("Bb/D", 2)).toBe("C/E");
    expect(transposeChord("G/B", 1, true)).toBe("Ab/C");
  });
});

describe("cifra colada para ChordPro", () => {
  const { chordpro, warnings } = plainTextToChordPro(pasted);
  const doc = parseChordPro(chordpro);

  it("reconhece linhas de acorde", () => {
    expect(isChordLine("Em7(9)                      D")).toBe(true);
    expect(isChordLine("Em7(9)    D  C7M  B7")).toBe(true);
    expect(isChordLine("Verso curto um")).toBe(false);
  });
  it("insere o acorde na coluna original", () => {
    expect(mergeChordsIntoLyrics("C7M     D7", "Ponte linha um")).toBe("[C7M]Ponte li[D7]nha um");
    expect(mergeChordsIntoLyrics("Em    D", "Uuh")).toBe("[Em]Uuh   [D]");
  });
  it("converte seção com acordes na mesma linha", () => {
    expect(chordpro.startsWith("{comment: Intro}\n[Em7(9)] [D] [C7M] [B7]\n")).toBe(true);
  });
  it("preserva todos os acordes, na ordem, sem inventar", () => {
    expect(chordsUsed(doc)).toEqual(["Em7(9)", "D", "C7M", "B7", "D7", "Bm7", "Em7"]);
  });
  it("trata espaço inseparável como linha em branco e não duplica brancos", () => {
    expect(chordpro).not.toMatch(/ /);
    expect(chordpro).not.toMatch(/\n\n\n/);
  });
  it("guarda a anotação final como comentário", () => {
    expect(chordpro.trimEnd().endsWith("{comment: artista, nome da musica}")).toBe(true);
  });
  it("não deixa avisos nesta cifra", () => expect(warnings).toEqual([]));
  it("não muda o texto da letra", () => {
    const text = doc.lines.flatMap((l) => (l.type === "lyrics" ? [l.segments.map((s) => s.text).join("").trim()] : []));
    expect(text).toContain("Linha um da estrofe com palavras de teste aqui");
    expect(text).toContain("Uuuuhhhhh");
  });
});

describe("ChordPro", () => {
  const src = "{title: Teste}\n{key: Am}\n{tempo: 90}\n{soc}\n[Am]Uma [G/B]linha\n{eoc}\n";
  it("lê diretivas e segmentos", () => {
    const doc = parseChordPro(src);
    expect(doc.meta).toEqual({ title: "Teste", key: "Am", tempo: 90 });
    expect(doc.lines[1]).toEqual({ type: "lyrics", segments: [{ chord: "Am", text: "Uma " }, { chord: "G/B", text: "linha" }] });
  });
  it("ida e volta estável", () => {
    const once = serializeChordPro(parseChordPro(src));
    expect(serializeChordPro(parseChordPro(once))).toBe(once);
  });
  it("ignora tempo inválido em vez de chutar", () => {
    expect(parseChordPro("{tempo: rápido}\n").meta.tempo).toBeUndefined();
  });
  it("transpõe só para exibir", () => {
    const doc = parseChordPro(src);
    const up = transposeDoc(doc, 2);
    expect(up.meta.key).toBe("Bm");
    expect(chordsUsed(up)).toEqual(["Bm", "A/C#"]);
    expect(chordsUsed(doc)).toEqual(["Am", "G/B"]);
  });
});
