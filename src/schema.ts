import { z } from "zod";

// ノーツのスキーマ定義
const noteSchema = z.object({
  time: z.number().describe("タイミング（秒）"),
  frame: z.number().optional().describe("フレーム番号"),
  imageFile: z.enum([
    "big.png",
    "blue_right_1.png",
    "blue_right_2.png",
    "red_left_1.png",
    "red_left_2.png",
  ]).optional().describe("ノーツの画像ファイル名（handはimageFileから推論される）"),
});

// 譜面データのスキーマ定義
const scoreSchema = z.object({
  name: z.string().optional().describe("プロジェクト名（オプション）"),
  videoPath: z.string().describe("元動画のパス"),
  supabaseProjectId: z.string().optional().describe("SupabaseのプロジェクトID（レンダリング時に動画と譜面データを読み込むために使用）"),
  supabaseVideoPath: z.string().optional().describe("Supabase Storageの動画パス（レンダリング時に使用）"),
  supabaseJsonPath: z.string().optional().describe("Supabase StorageのJSONパス（レンダリング時に使用）"),
  duration: z.number().describe("動画の長さ（秒）"),
  fps: z.number().describe("フレームレート"),
  notes: z.array(noteSchema).describe("ノーツのリスト"),
});

// 譜面ファイル名または譜面データのスキーマ定義（編集用）
export const taikoPracticeSchema = z.object({
  scoreFile: z.string().optional().describe("譜面データファイル名（publicフォルダ内）"),
  score: scoreSchema.optional().describe("譜面データ（直接指定する場合）"),
});

export type TaikoPracticeProps = z.infer<typeof taikoPracticeSchema>;

// レンダリング用のスキーマ定義（Blob URL禁止、Supabase URL必須）
export const taikoPracticeRenderSchema = z.object({
  score: scoreSchema.describe("譜面データ（必須）"),
  videoUrl: z.string().url().describe("Supabase Storageの動画URL（必須、Blob URL不可）"),
});

export type TaikoPracticeRenderProps = z.infer<typeof taikoPracticeRenderSchema>;
