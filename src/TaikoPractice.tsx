import { AbsoluteFill, useCurrentFrame, useVideoConfig, OffthreadVideo, staticFile } from "remotion";
import { useState, useEffect } from "react";
import { Note } from "./components/Note";
import { JudgeLine } from "./components/JudgeLine";
import type { Score } from "./types/score";
import type { TaikoPracticeProps } from "./schema";

export const TaikoPractice: React.FC<TaikoPracticeProps> = ({ scoreFile, score: scoreFromProps }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  
  // 動画ファイルのパス
  const videoSrc = staticFile("videos/basunotori_short_test.mp4");
  
  // 譜面データを読み込み
  const [score, setScore] = useState<Score | null>(null);
  
  useEffect(() => {
    // propsで直接譜面データが指定されている場合はそれを使用
    if (scoreFromProps) {
      setScore(scoreFromProps);
      return;
    }
    
    // そうでない場合はファイルから読み込む
    // scoreFileが未定義または空の場合はデフォルト値を使用
    const fileToLoad = scoreFile || "score.json";
    
    // scoreFileが変更されたときに再読み込み
    setScore(null); // 読み込み中状態にリセット
    
    fetch(staticFile(fileToLoad))
      .then((res) => res.json())
      .then((data: Score) => setScore(data))
      .catch((error) => {
        console.error(`譜面データの読み込みに失敗しました: ${fileToLoad}`, error);
        // フォールバック用の空の譜面データ
        setScore({
          videoPath: "basunotori_short_test.mp4",
          duration: 0,
          fps: 30,
          notes: [],
        });
      });
  }, [scoreFile, scoreFromProps]);
  
  // 譜面データが読み込まれるまで待つ
  if (!score) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#1a1a2e",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          fontSize: 24,
        }}
      >
        譜面データを読み込み中...
      </AbsoluteFill>
    );
  }
  
  // 現在の時刻（秒）
  const currentTime = frame / fps;
  
  // ノーツUIエリアの設定
  const notesAreaHeight = 200;
  const judgeLineX = width * 0.2; // 判定ラインの位置（画面左から20%）
  const notePreviewSeconds = 3; // ノーツを何秒前に表示するか
  
  // 表示すべきノーツをフィルタリング
  // 現在時刻の前後±notePreviewSeconds秒以内のノーツを表示
  const visibleNotes = score.notes.filter((note) => {
    const timeDiff = note.time - currentTime;
    return timeDiff >= -0.5 && timeDiff <= notePreviewSeconds;
  });
  
  // ノーツのx座標を計算する関数
  const calculateNoteX = (noteTime: number): number => {
    const timeUntilHit = noteTime - currentTime; // 判定ラインに到達するまでの時間
    const startX = width * 0.9; // ノーツの開始位置（画面右から10%）
    const endX = judgeLineX; // 判定ラインの位置
    
    if (timeUntilHit <= 0) {
      // 既に判定ラインを通過した場合、判定ラインの位置に表示
      return endX;
    }
    
    // ノーツが右から左へ流れるアニメーション
    // notePreviewSeconds秒かけてstartXからendXへ移動
    const progress = 1 - (timeUntilHit / notePreviewSeconds);
    return startX + (endX - startX) * progress;
  };

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
          position: "relative",
        }}
      >
        <OffthreadVideo
          src={videoSrc}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
          startFrom={0}
        />
      </div>

      {/* 下部：ノーツUI */}
      <div
        style={{
          height: notesAreaHeight,
          backgroundColor: "#0f3460",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 判定ライン */}
        <JudgeLine x={judgeLineX} height={notesAreaHeight} />
        
        {/* ノーツを表示 */}
        {visibleNotes.map((note, index) => {
          const x = calculateNoteX(note.time);
          return (
            <Note
              key={`${note.time}-${index}`}
              x={x}
              hand={note.hand}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
