/**
 * ノーツの種類（左手・右手）
 */
export type NoteHand = "left" | "right";

/**
 * 個々のノーツ（音符）データ
 */
export interface Note {
  /** タイミング（秒） */
  time: number;
  /** 左手/右手 */
  hand: NoteHand;
  /** フレーム番号（オプション） */
  frame?: number;
}

/**
 * 譜面データ全体
 */
export interface Score {
  /** 元動画のパス */
  videoPath: string;
  /** 動画の長さ（秒） */
  duration: number;
  /** フレームレート */
  fps: number;
  /** ノーツのリスト */
  notes: Note[];
}
