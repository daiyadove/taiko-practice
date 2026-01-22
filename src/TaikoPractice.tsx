import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export const TaikoPractice: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1a1a2e",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 上部：元動画エリア（後で実装） */}
      <div
        style={{
          flex: 1,
          backgroundColor: "#16213e",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          fontSize: 32,
        }}
      >
        元動画エリア
      </div>

      {/* 下部：ノーツUI（後で実装） */}
      <div
        style={{
          height: 200,
          backgroundColor: "#0f3460",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          fontSize: 24,
        }}
      >
        ノーツUIエリア - Frame: {frame} ({(frame / fps).toFixed(2)}秒)
      </div>
    </AbsoluteFill>
  );
};
