import { Composition } from "remotion";
import { TaikoPractice } from "./TaikoPractice";
import { TaikoPracticeRender } from "./TaikoPracticeRender";
import { taikoPracticeSchema, taikoPracticeRenderSchema } from "./schema";
import type { TaikoPracticeProps } from "./schema";
import type { TaikoPracticeRenderProps } from "./schema";
import type { Score } from "./types/score";

export const RemotionRoot: React.FC = () => {
  const defaultFps = 30;

  return (
    <>
      {/* 編集用Composition（Studio環境用） */}
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
          console.log(
            "[Root calculateMetadata] TaikoPractice - 受け取ったprops:",
            {
              hasScore: !!props.score,
              scoreDuration: props.score?.duration,
              scoreFps: props.score?.fps,
              hasWindowScore:
                typeof window !== "undefined" &&
                !!(window as any).__TAIKO_PRACTICE_SCORE__,
            }
          );

          // propsからscoreを取得
          let score: Score | null = null;

          if (props.score) {
            score = props.score;
            console.log("[Root calculateMetadata] props.scoreを使用:", {
              duration: score.duration,
              fps: score.fps,
            });
          } else if (
            typeof window !== "undefined" &&
            (window as any).__TAIKO_PRACTICE_SCORE__
          ) {
            score = (window as any).__TAIKO_PRACTICE_SCORE__;
            console.log(
              "[Root calculateMetadata] window.__TAIKO_PRACTICE_SCORE__を使用:",
              {
                duration: score.duration,
                fps: score.fps,
              }
            );
          }

          // scoreにdurationとfpsが含まれている場合はそれを使用
          if (score && score.duration && score.fps) {
            const durationInFrames = Math.ceil(score.duration * score.fps);
            console.log("[Root calculateMetadata] durationInFramesを計算:", {
              duration: score.duration,
              fps: score.fps,
              durationInFrames,
            });
            return {
              durationInFrames,
            };
          }

          // デフォルト値を返す
          console.log(
            "[Root calculateMetadata] デフォルト値900フレームを返します"
          );
          return {
            durationInFrames: 900,
          };
        }}
      />
      {/* 
        レンダリング用Composition（CLI / Node.js環境用）
        
        ⚠️ 重要: このCompositionを使用するには、必ず以下のpropsを設定してください:
        - CLI: --input-props='{"score": {...}, "videoUrl": "https://..."}'
        - Studio: Render UIの「Props」タブで score と videoUrl を設定
        
        propsが設定されていない場合はエラーになります。
        defaultPropsは設定していません（props未設定時にエラーを出すため）。
      */}
      <Composition
        id="TaikoPracticeRender"
        component={TaikoPracticeRender}
        durationInFrames={900} // デフォルト値（calculateMetadataで上書きされる）
        fps={defaultFps}
        width={1920}
        height={1080}
        schema={taikoPracticeRenderSchema}
        calculateMetadata={async (props: TaikoPracticeRenderProps) => {
          // propsを必ずログ出力（デバッグ用）
          console.log(
            "[Root calculateMetadata] レンダリング用 - 受け取ったprops:",
            {
              score: props.score
                ? {
                    name: props.score.name,
                    duration: props.score.duration,
                    fps: props.score.fps,
                    notesCount: props.score.notes?.length || 0,
                  }
                : null,
              videoUrl: props.videoUrl
                ? `${props.videoUrl.substring(0, 50)}...`
                : null,
            }
          );

          // scoreが無い場合はエラー
          if (!props.score) {
            throw new Error(
              "[Root calculateMetadata] レンダリング用: props.scoreが設定されていません。\n" +
                "CLIの場合は --input-props で score を指定してください。\n" +
                "Studioの場合は Render UIの「Props」タブで score を設定してください。"
            );
          }

          // videoUrlが無い場合はエラー
          if (!props.videoUrl || props.videoUrl.trim() === "") {
            throw new Error(
              "[Root calculateMetadata] レンダリング用: props.videoUrlが設定されていません。\n" +
                "CLIの場合は --input-props で videoUrl を指定してください。\n" +
                "Studioの場合は Render UIの「Props」タブで videoUrl を設定してください。"
            );
          }

          const score = props.score;

          // score.durationが無い、または0以下の場合はエラー
          if (!score.duration || score.duration <= 0) {
            throw new Error(
              `[Root calculateMetadata] レンダリング用: score.durationが無効です (値: ${score.duration})。\n` +
                "score.durationは0より大きい数値である必要があります。"
            );
          }

          // score.fpsが無い、または0以下の場合はエラー
          if (!score.fps || score.fps <= 0) {
            throw new Error(
              `[Root calculateMetadata] レンダリング用: score.fpsが無効です (値: ${score.fps})。\n` +
                "score.fpsは0より大きい数値である必要があります。"
            );
          }

          // duration * fps から durationInFrames を計算
          const durationInFrames = Math.ceil(score.duration * score.fps);

          console.log(
            `[Root calculateMetadata] レンダリング用: 動画の長さ: ${score.duration}秒, フレーム数: ${durationInFrames}フレーム (@${score.fps}fps)`
          );

          return {
            durationInFrames,
          };
        }}
      />
    </>
  );
};
