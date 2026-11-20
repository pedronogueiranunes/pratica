// Textos da interface. Português do Brasil é a língua principal; o inglês
// existe para o app nascer pronto para traduzir. Regras de escrita: curto,
// direto, humano, sem travessão longo.

const ptBR = {
  "app.name": "Prática",

  "nav.hoje": "Hoje",
  "nav.roadmap": "Roadmap",
  "nav.calendario": "Calendário",
  "nav.musicas": "Músicas",
  "nav.companion": "Tocar junto",
  "nav.ferramentas": "Ferramentas",
  "nav.ajustes": "Ajustes",
  "nav.laboratorio": "Laboratório",

  "block.aquecimento": "Aquecimento",
  "block.dexteridade": "Dexteridade",
  "block.teoria": "Teoria aplicada",
  "block.musica": "Música",
  "block.ouvido": "Ouvido e improviso",

  "type.dexteridade": "Dexteridade",
  "type.acordes": "Acordes",
  "type.escalas": "Escalas",
  "type.ritmo": "Ritmo",
  "type.teoria": "Teoria",
  "type.repertorio": "Repertório",
  "type.ouvido": "Ouvido",
  "type.composicao": "Composição",

  "level.baixa": "Leve",
  "level.media": "Normal",
  "level.alta": "Puxado",

  "minutes": "{n} min",
  "phase": "Fase {n}",

  "metronome.title": "Metrônomo",
  "metronome.start": "Começar",
  "metronome.stop": "Parar",
  "metronome.bpm": "bpm",
  "metronome.sound": "Som",
  "metronome.volume": "Volume",
  "metronome.beats": "Tempos",
  "metronome.subdivision": "Subdivisão",
  "metronome.accent": "Acento no 1",
  "metronome.tap": "Tap",

  "sound.madeira": "Madeira",
  "sound.bip": "Bip",
  "sound.aro": "Aro",
  "sound.cowbell": "Cowbell",
  "sound.suave": "Suave",

  "tuner.title": "Afinador",
  "tuner.start": "Ouvir",
  "tuner.stop": "Parar",
  "tuner.listening": "Toque uma corda",
  "tuner.inTune": "Afinada",
  "tuner.flat": "Baixa",
  "tuner.sharp": "Alta",
  "tuner.reference": "Lá = {hz} Hz",
  "tuner.input": "Entrada",
  "tuner.channel": "Canal {n}",

  "devices.output": "Saída",
  "devices.input": "Entrada",
  "devices.default": "Padrão do sistema",
  "devices.latency": "{ms} ms",
  "devices.suggest": "{name} deve responder mais rápido. Trocar?",
  "devices.reason.audioInterface": "Interface de áudio",
  "devices.reason.lowestLatency": "Menor atraso",
  "devices.reason.onlyOption": "Único disponível",
  "devices.reason.bluetoothWarning": "Bluetooth atrasa o som",

  "today.title": "Hoje",
  "today.empty": "Nada por aqui ainda.",
  "today.soon": "A rotina do dia chega na próxima fase.",

  "placeholder.soon": "Em breve",

  "theme.sistema": "Sistema",
  "theme.claro": "Claro",
  "theme.escuro": "Escuro",

  "error.noDevice": "Não achei nenhum dispositivo de áudio.",
  "error.deviceLost": "O dispositivo de áudio desconectou.",
  "error.streamFailed": "Não consegui abrir o áudio.",
  "error.unsupportedFormat": "Esse dispositivo usa um formato que ainda não sei ler.",
} as const;

export type MessageKey = keyof typeof ptBR;
export const MESSAGE_KEYS = Object.keys(ptBR) as MessageKey[];

const en: Record<MessageKey, string> = {
  "app.name": "Practice",
  "nav.hoje": "Today",
  "nav.roadmap": "Roadmap",
  "nav.calendario": "Calendar",
  "nav.musicas": "Songs",
  "nav.companion": "Play along",
  "nav.ferramentas": "Tools",
  "nav.ajustes": "Settings",
  "nav.laboratorio": "Lab",
  "block.aquecimento": "Warm-up",
  "block.dexteridade": "Dexterity",
  "block.teoria": "Applied theory",
  "block.musica": "Music",
  "block.ouvido": "Ear and improv",
  "type.dexteridade": "Dexterity",
  "type.acordes": "Chords",
  "type.escalas": "Scales",
  "type.ritmo": "Rhythm",
  "type.teoria": "Theory",
  "type.repertorio": "Repertoire",
  "type.ouvido": "Ear",
  "type.composicao": "Writing",
  "level.baixa": "Light",
  "level.media": "Normal",
  "level.alta": "Intense",
  "minutes": "{n} min",
  "phase": "Phase {n}",
  "metronome.title": "Metronome",
  "metronome.start": "Start",
  "metronome.stop": "Stop",
  "metronome.bpm": "bpm",
  "metronome.sound": "Sound",
  "metronome.volume": "Volume",
  "metronome.beats": "Beats",
  "metronome.subdivision": "Subdivision",
  "metronome.accent": "Accent on 1",
  "metronome.tap": "Tap",
  "sound.madeira": "Wood",
  "sound.bip": "Beep",
  "sound.aro": "Rim",
  "sound.cowbell": "Cowbell",
  "sound.suave": "Soft",
  "tuner.title": "Tuner",
  "tuner.start": "Listen",
  "tuner.stop": "Stop",
  "tuner.listening": "Play a string",
  "tuner.inTune": "In tune",
  "tuner.flat": "Flat",
  "tuner.sharp": "Sharp",
  "tuner.reference": "A = {hz} Hz",
  "tuner.input": "Input",
  "tuner.channel": "Channel {n}",
  "devices.output": "Output",
  "devices.input": "Input",
  "devices.default": "System default",
  "devices.latency": "{ms} ms",
  "devices.suggest": "{name} should respond faster. Switch?",
  "devices.reason.audioInterface": "Audio interface",
  "devices.reason.lowestLatency": "Lowest delay",
  "devices.reason.onlyOption": "Only one available",
  "devices.reason.bluetoothWarning": "Bluetooth delays the sound",
  "today.title": "Today",
  "today.empty": "Nothing here yet.",
  "today.soon": "Your daily routine arrives in the next phase.",
  "placeholder.soon": "Coming soon",
  "theme.sistema": "System",
  "theme.claro": "Light",
  "theme.escuro": "Dark",
  "error.noDevice": "No audio device found.",
  "error.deviceLost": "The audio device disconnected.",
  "error.streamFailed": "Couldn't open audio.",
  "error.unsupportedFormat": "This device uses a format I can't read yet.",
};

export type Locale = "pt-BR" | "en";
const dictionaries: Record<Locale, Record<MessageKey, string>> = { "pt-BR": ptBR, en };

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export function createTranslator(locale: Locale): Translate {
  const dict = dictionaries[locale] ?? ptBR;
  const numberFmt = new Intl.NumberFormat(locale);
  return (key, params) => {
    const template = dict[key] ?? ptBR[key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => {
      const v = params[name];
      if (v === undefined) return `{${name}}`;
      return typeof v === "number" ? numberFmt.format(v) : v;
    });
  };
}

/** Notas em solfejo, como se fala no Brasil. */
const SOLFEGE: Record<string, string> = {
  C: "Dó",
  "C#": "Dó#",
  D: "Ré",
  "D#": "Ré#",
  E: "Mi",
  F: "Fá",
  "F#": "Fá#",
  G: "Sol",
  "G#": "Sol#",
  A: "Lá",
  "A#": "Lá#",
  B: "Si",
};

export function noteLabel(name: string, style: "cifra" | "solfejo"): string {
  return style === "solfejo" ? (SOLFEGE[name] ?? name) : name;
}
