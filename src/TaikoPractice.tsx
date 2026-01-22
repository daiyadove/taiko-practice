import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Video,
  staticFile,
  continueRender,
  delayRender,
} from "remotion";
import { useEffect, useState } from "react";
import { Note } from "./components/Note";
import { JudgeLine } from "./components/JudgeLine";
import type { Score, Note as NoteType } from "./types/score";

// 判定ラインのX座標
const JUDGE_LINE_X = 150;
// ノーツが画面に表示され始める時間（秒）- ノーツ到達の何秒前から表示するか
const NOTE_APPROACH_TIME = 2;
// ノーツUIエリアの幅
const NOTE_AREA_WIDTH = 1920;
// ノーツUIエリアの高さ
const NOTE_AREA_HEIGHT = 200;

interface TaikoPracticeProps {
  scoreData?: Score;
}

export const TaikoPractice: React.FC<TaikoPracticeProps> = ({ scoreData }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [score, setScore] = useState<Score | null>(scoreData || null);
  const [handle] = useState(() => delayRender("Loading score data"));

  // 現在の時間（秒）
  const currentTime = frame / fps;

  // スコアデータの読み込み
  useEffect(() => {
    if (scoreData) {
      setScore(scoreData);
      continueRender(handle);
      return;
    }

    fetch(staticFile("score.json"))
      .then((res) => res.json())
      .then((data: Score) => {
        setScore(data);
        continueRender(handle);
      })
      .catch((err) => {
        console.error("Failed to load score:", err);
        continueRender(handle);
      });
  }, [handle, scoreData]);

  // ノーツのX座標を計算
  const calculateNoteX = (noteTime: number): number => {
    // ノーツが判定ラインに到達するまでの残り時間
    const timeUntilHit = noteTime - currentTime;

    // NOTE_APPROACH_TIME秒前に右端から出現し、0秒で判定ラインに到達
    // 進捗率: 1 = 右端、0 = 判定ライン
    const progress = timeUntilHit / NOTE_APPROACH_TIME;

    // X座標を計算（判定ラインから右端までの距離を進捗率で補間）
    const travelDistance = NOTE_AREA_WIDTH - JUDGE_LINE_X;
    return JUDGE_LINE_X + travelDistance * progress;
  };

  // 表示すべきノーツをフィルタリング
  const visibleNotes: NoteType[] = score
    ? score.notes.filter((note) => {
        const noteX = calculateNoteX(note.time);
        // 判定ラインを少し過ぎたノーツも表示（-100px）、右端を超えたノーツは非表示
        return noteX >= -100 && noteX <= NOTE_AREA_WIDTH + 100;
      })
    : [];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1a1a2e",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 上部：元動画エリア */}
      <div
        style={{
          flex: 1,
          backgroundColor: "#16213e",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        {score?.videoPath ? (
          <Video
            src={staticFile(score.videoPath)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        ) : (
          <div style={{ color: "white", fontSize: 32 }}>
            動画を読み込み中...
          </div>
        )}
      </div>

      {/* 下部：ノーツUI */}
      <div
        style={{
          height: NOTE_AREA_HEIGHT,
          backgroundColor: "#0f3460",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 判定ライン */}
        <JudgeLine x={JUDGE_LINE_X} height={NOTE_AREA_HEIGHT} />

        {/* ノーツ */}
        {visibleNotes.map((note, index) => (
          <Note
            key={`${note.time}-${index}`}
            x={calculateNoteX(note.time)}
            hand={note.hand}
          />
        ))}

        {/* 時間表示（デバッグ用） */}
        <div
          style={{
            position: "absolute",
            right: 20,
            top: 10,
            color: "white",
            fontSize: 18,
            fontFamily: "monospace",
          }}
        >
          {currentTime.toFixed(2)}s / Frame: {frame}
        </div>
      </div>
    </AbsoluteFill>
  );
};
