/**
 * ノーツの種類（左手・右手）
 */
export type NoteHand = "left" | "right";

/**
 * ノーツの画像ファイル名
 */
export type NoteImageFile = 
  | "big.png"
  | "blue_right_1.png"
  | "blue_right_2.png"
  | "red_left_1.png"
  | "red_left_2.png";

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
  /** 画像ファイル名（オプション、指定がない場合はhandに基づいて決定） */
  imageFile?: NoteImageFile;
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
