import { Composition } from "remotion";
import { TaikoPractice } from "./TaikoPractice";
import { staticFile } from "remotion";
import { getVideoMetadata } from "@remotion/media-utils";
import { taikoPracticeSchema } from "./schema";
import type { TaikoPracticeProps } from "./schema";
import type { Score } from "./types/score";

export const RemotionRoot: React.FC = () => {
  const defaultFps = 30;

  return (
    <>
      <Composition
        id="TaikoPractice"
        component={TaikoPractice}
        durationInFrames={900} // デフォルト値（calculateMetadataで上書きされる）
        fps={defaultFps}
        width={1920}
        height={1080}
        schema={taikoPracticeSchema}
        defaultProps={{ scoreFile: "" }}
        calculateMetadata={async (props: TaikoPracticeProps) => {
          // propsからscoreを取得
          let score: Score | null = null;
          
          // scoreが直接指定されている場合のみ使用（Supabaseから読み込まれたデータ）
          // ローカルファイルからの読み込みは行わない（全てSupabaseで管理）
          if (props.score) {
            score = props.score;
          } else if (typeof window !== "undefined") {
            // props.scoreがない場合、localStorageから読み込む（レンダリング準備時に保存されたデータ）
            try {
              const savedScore = localStorage.getItem('taiko-practice-render-score');
              if (savedScore) {
                score = JSON.parse(savedScore);
                console.log('[Root calculateMetadata] localStorageからscoreを読み込みました:', score);
              }
            } catch (error) {
              console.error('[Root calculateMetadata] localStorageからの読み込みエラー:', error);
            }
          }

          // scoreにdurationとfpsが含まれている場合はそれを使用
          if (score && score.duration && score.fps) {
            const durationInFrames = Math.ceil(score.duration * score.fps);
            console.log(`譜面データから取得: 動画の長さ: ${score.duration}秒, フレーム数: ${durationInFrames}フレーム (@${score.fps}fps)`);
            return {
              durationInFrames,
            };
          }

          // scoreがない場合、またはduration/fpsがない場合はデフォルト値を返す
          // 動画ファイルはSupabaseから読み込まれるため、ローカルファイルからの読み込みは行わない
          if (!score || !score.duration || !score.fps) {
            console.log('譜面データが不完全なため、デフォルト値を使用: 900フレーム');
            return {
              durationInFrames: 900,
            };
          }
        }}
      />
    </>
  );
};
