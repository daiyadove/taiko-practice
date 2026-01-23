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
        defaultProps={{
          scoreFile: "score.json",
          score: {
            videoPath: "",
            duration: 0,
            fps: 0,
            notes: [
              { time: 0.163, hand: "right" as const, frame: 4 },
              { time: 0, hand: "right" as const, frame: 10 },
              { time: 1.393, hand: "left" as const, frame: 41 },
              { time: 0, hand: "right" as const, frame: 44 },
              { time: 0, hand: "left" as const, frame: 61 },
              { time: 0, hand: "right" as const, frame: 76 },
              { time: 0, hand: "left" as const, frame: 93 },
              { time: 0, hand: "right" as const, frame: 109 },
              { time: 0, hand: "left" as const, frame: 124 },
              { time: 4.667, hand: "right" as const, frame: 139 },
              { time: 0, hand: "left" as const, frame: 143 },
              { time: 0, hand: "right" as const, frame: 160 },
              { time: 5.851, hand: "left" as const, frame: 175 },
              { time: 0, hand: "right" as const, frame: 178 },
              { time: 0, hand: "left" as const, frame: 193 },
              { time: 0, hand: "right" as const, frame: 212 },
              { time: 0, hand: "left" as const, frame: 227 },
              { time: 8.127, hand: "right" as const, frame: 243 },
              { time: 0, hand: "left" as const, frame: 247 },
              { time: 0, hand: "right" as const, frame: 263 },
              { time: 0, hand: "left" as const, frame: 279 },
              { time: 9.822, hand: "left" as const, frame: 294 },
              { time: 0, hand: "left" as const, frame: 309 },
              { time: 0, hand: "right" as const, frame: 313 },
              { time: 0, hand: "left" as const, frame: 323 },
              { time: 0, hand: "right" as const, frame: 328 },
              { time: 11.494, hand: "right" as const, frame: 344 },
              { time: 0, hand: "right" as const, frame: 347 },
              { time: 0, hand: "left" as const, frame: 355 },
              { time: 12.655, hand: "left" as const, frame: 379 },
              { time: 0, hand: "left" as const, frame: 400 },
              { time: 0, hand: "right" as const, frame: 414 },
              { time: 0, hand: "left" as const, frame: 415 },
              { time: 0, hand: "right" as const, frame: 430 },
              { time: 0, hand: "left" as const, frame: 439 },
              { time: 0, hand: "right" as const, frame: 446 },
              { time: 0, hand: "left" as const, frame: 464 },
              { time: 15.906, hand: "right" as const, frame: 476 },
              { time: 16.417, hand: "left" as const, frame: 492 },
              { time: 0, hand: "right" as const, frame: 504 },
              { time: 0, hand: "left" as const, frame: 510 },
              { time: 0, hand: "right" as const, frame: 533 },
              { time: 18.042, hand: "left" as const, frame: 540 },
              { time: 0, hand: "right" as const, frame: 556 },
              { time: 0, hand: "left" as const, frame: 568 },
              { time: 19.11, hand: "right" as const, frame: 572 },
              { time: 0, hand: "left" as const, frame: 605 },
              { time: 0, hand: "right" as const, frame: 606 },
            ],
          },
        }}
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
