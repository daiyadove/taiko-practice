import { Composition } from "remotion";
import { TaikoPractice } from "./TaikoPractice";
import { staticFile } from "remotion";
import { getVideoMetadata } from "@remotion/media-utils";
import { taikoPracticeSchema } from "./schema";

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
        defaultProps={{}}
        calculateMetadata={async () => {
          try {
            // 動画ファイルリストを読み込む
            const videosListResponse = await fetch(staticFile("videos-list.json"));
            const videosList: { videos: string[]; defaultVideo: string | null } = await videosListResponse.json();
            
            // デフォルト動画を取得
            const videoPath = videosList.defaultVideo;
            
            if (!videoPath) {
              console.warn("動画ファイルが見つかりません。デフォルト値を使用します。");
              return {
                durationInFrames: 900,
              };
            }
            
            // 動画のメタデータを取得
            const videoSrc = staticFile(videoPath);
            const videoMetadata = await getVideoMetadata(videoSrc);

            // 動画の長さ（秒）からフレーム数を計算
            const durationInFrames = Math.ceil(
              videoMetadata.durationInSeconds * defaultFps
            );

            console.log(`動画の長さ: ${videoMetadata.durationInSeconds}秒`);
            console.log(`フレーム数: ${durationInFrames}フレーム (@${defaultFps}fps)`);
            console.log(`使用動画: ${videoPath}`);

            return {
              durationInFrames,
            };
          } catch (error) {
            // 動画ファイルが見つからない場合はデフォルト値を使用
            console.warn(`動画ファイルの読み込みに失敗しました:`, error);
            console.log(`デフォルトのフレーム数を使用: 900フレーム (@${defaultFps}fps)`);
            return {
              durationInFrames: 900,
            };
          }
        }}
      />
    </>
  );
};
