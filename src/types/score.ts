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
 * imageFileからhandを推論する関数
 */
export function getHandFromImageFile(imageFile?: NoteImageFile): NoteHand {
  if (!imageFile) {
    return "right"; // デフォルトはright
  }
  if (imageFile.includes("red_left")) {
    return "left";
  }
  // blue_right_1, blue_right_2, big.png は right
  return "right";
}

/**
 * 個々のノーツ（音符）データ
 */
export interface Note {
  /** タイミング（秒） */
  time: number;
  /** フレーム番号（オプション） */
  frame?: number;
  /** 画像ファイル名（必須、handはimageFileから推論される） */
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
