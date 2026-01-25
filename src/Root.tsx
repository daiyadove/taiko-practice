import { Composition } from "remotion";
import { TaikoPractice } from "./TaikoPractice";
import { staticFile } from "remotion";
import { getVideoMetadata } from "@remotion/media-utils";
import { taikoPracticeSchema } from "./schema";

export const RemotionRoot: React.FC = () => {
  const videoSrc = staticFile("videos/basunotori_short_test.mp4");
  const fps = 30;

  return (
    <>
      <Composition
        id="TaikoPractice"
        component={TaikoPractice}
        durationInFrames={900} // デフォルト値（calculateMetadataで上書きされる）
        fps={fps}
        width={1920}
        height={1080}
        schema={taikoPracticeSchema}
        defaultProps={{ scoreFile: "" }}
        calculateMetadata={async () => {
          // 動画のメタデータを取得
          const videoMetadata = await getVideoMetadata(videoSrc);

          // 動画の長さ（秒）からフレーム数を計算
          const durationInFrames = Math.ceil(
            videoMetadata.durationInSeconds * fps
          );

          console.log(`動画の長さ: ${videoMetadata.durationInSeconds}秒`);
          console.log(`フレーム数: ${durationInFrames}フレーム (@${fps}fps)`);

          return {
            durationInFrames,
          };
        }}
      />
    </>
  );
};
