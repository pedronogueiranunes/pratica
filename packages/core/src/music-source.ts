// Interface comum para todas as fontes de música (arquivos locais, YouTube,
// Spotify, Jamendo...). O resto do app só conhece este contrato.

export type SourceId = "local" | "youtube" | "spotify" | "jamendo" | "audius" | "soundcloud" | "deezer";

export interface TrackRef {
  source: SourceId;
  /** ID na fonte (caminho do arquivo, ID do vídeo, URI do Spotify...). */
  id: string;
  title: string;
  artist?: string;
  durationMs?: number;
  /** Atribuição exigida pela licença (Jamendo, GetSongBPM...). */
  attribution?: string;
}

export interface SourceCapabilities {
  search: boolean;
  /** Dá para ler o áudio bruto (e então analisar BPM e tom). */
  rawAudio: boolean;
  /** A posição atual é confiável o bastante para sincronizar a cifra. */
  precisePosition: boolean;
  /** Precisa de login para tocar. */
  needsLogin: boolean;
  /** Precisa mostrar um player visível (regra do YouTube). */
  visiblePlayer: boolean;
}

export interface MusicSource {
  readonly id: SourceId;
  readonly capabilities: SourceCapabilities;
  search(query: string): Promise<TrackRef[]>;
  play(track: TrackRef, fromMs?: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(ms: number): Promise<void>;
  /** Posição atual em ms, ou null se nada estiver tocando. */
  position(): Promise<number | null>;
}
