/**
 * 動画解析スクリプト
 *
 * 使い方:
 *   npx ts-node scripts/analyze.ts <動画ファイルパス>
 *
 * このスクリプトは以下の処理を行います:
 * 1. 動画から音声を抽出
 * 2. 打撃音のタイミングを検出
 * 3. 各タイミングのフレーム画像を抽出
 * 4. 左手/右手を判別
 * 5. 譜面データ（JSON）を出力
 */

import type { Score, Note } from "../src/types/score";

async function analyzeVideo(videoPath: string): Promise<Score> {
  console.log(`動画を解析中: ${videoPath}`);

  // TODO: 動画から音声を抽出
  // TODO: 打撃音検出
  // TODO: フレーム画像抽出
  // TODO: 左手/右手判別

  // プレースホルダーの譜面データ
  const score: Score = {
    videoPath,
    duration: 0,
    fps: 30,
    notes: [],
  };

  return score;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("使い方: npx ts-node scripts/analyze.ts <動画ファイルパス>");
    process.exit(1);
  }

  const videoPath = args[0];
  const score = await analyzeVideo(videoPath);

  console.log("譜面データ:");
  console.log(JSON.stringify(score, null, 2));
}

main().catch(console.error);
