import { z } from "zod";

// ノーツのスキーマ定義
const noteSchema = z.object({
  time: z.number().describe("タイミング（秒）"),
  hand: z.enum(["left", "right"]).describe("左手/右手"),
  frame: z.number().optional().describe("フレーム番号"),
});

// 譜面データのスキーマ定義
const scoreSchema = z.object({
  videoPath: z.string().describe("元動画のパス"),
  duration: z.number().describe("動画の長さ（秒）"),
  fps: z.number().describe("フレームレート"),
  notes: z.array(noteSchema).describe("ノーツのリスト"),
});

// 譜面ファイル名または譜面データのスキーマ定義
export const taikoPracticeSchema = z.object({
  scoreFile: z.string().optional().describe("譜面データファイル名（publicフォルダ内）"),
  score: scoreSchema.optional().describe("譜面データ（直接指定する場合）"),
});

export type TaikoPracticeProps = z.infer<typeof taikoPracticeSchema>;
