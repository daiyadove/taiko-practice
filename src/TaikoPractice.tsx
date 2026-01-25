import { AbsoluteFill, useCurrentFrame, useVideoConfig, OffthreadVideo, staticFile } from "remotion";
import { useState, useEffect } from "react";
import { Note } from "./components/Note";
import { JudgeLine } from "./components/JudgeLine";
import type { Score, Note as NoteType, NoteImageFile } from "./types/score";
import type { TaikoPracticeProps } from "./schema";

// Remotion Studioのseek関数を使用する関数
const seekToFrame = (frame: number) => {
  // Remotion Studio環境でのみ動作
  if (typeof window !== "undefined") {
    // @remotion/studioからseek関数を動的にインポート
    import("@remotion/studio")
      .then((module) => {
        if (module.seek) {
          module.seek(frame);
        }
      })
      .catch(() => {
        // Studio環境でない場合は無視
      });
  }
};

// 利用可能なノーツ画像ファイル
// left → red_left_1, red_left_2
// right → blue_right_1, blue_right_2, big
const NOTE_IMAGE_FILES: NoteImageFile[] = [
  "red_left_1.png",
  "red_left_2.png",
  "blue_right_1.png",
  "blue_right_2.png",
  "big.png",
];

export const TaikoPractice: React.FC<TaikoPracticeProps> = ({ scoreFile, score: scoreFromProps }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  
  // 動画ファイルのパス
  const videoSrc = staticFile("videos/basunotori_short_test.mp4");
  
  // 譜面データを読み込み
  const [score, setScore] = useState<Score | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<NoteImageFile>("red_left_1.png");
  
  // 現在の時刻（秒）
  const currentTime = frame / fps;
  
  // 通過判定を1フレーム遅らせる（1フレーム分の時間を加算）
  const adjustedCurrentTime = currentTime - (1 / fps);
  
  // 一番近いノーツを常に取得（未来のノーツのみ、消えていないノーツ）
  const nearestNote = score ? (() => {
    if (score.notes.length === 0) return null;
    
    // 調整後の現在時刻より後のノーツ（未来のノーツ、消えていないノーツ）のみをフィルタリング
    const futureNotes = score.notes.filter(note => note.time > adjustedCurrentTime);
    
    if (futureNotes.length === 0) return null;
    
    // 未来のノーツの中で一番近い（時間が最小の）ノーツを選択
    const nearest = futureNotes.reduce((prev, curr) => {
      return curr.time < prev.time ? curr : prev;
    });
    
    return nearest;
  })() : null;
  
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
  
  // 一番近いノーツが変更されたときに、ノーツ種類を自動的に更新
  useEffect(() => {
    if (nearestNote && nearestNote.imageFile) {
      setSelectedImageFile(nearestNote.imageFile);
    } else if (nearestNote && !nearestNote.imageFile) {
      // imageFileが指定されていない場合は、handに基づいてデフォルトを設定
      const defaultImageFile: NoteImageFile = nearestNote.hand === "left" 
        ? "red_left_1.png"
        : "blue_right_1.png";
      setSelectedImageFile(defaultImageFile);
    }
  }, [nearestNote?.time, nearestNote?.hand, nearestNote?.imageFile]);
  
  // ノーツを追加
  const addNote = () => {
    if (!score) return;
    
    // 画像ファイル名に基づいてhandを決定
    // red_left → left, blue_right → right, big → right（デフォルト）
    const hand: "left" | "right" = selectedImageFile.includes("red_left")
      ? "left"
      : selectedImageFile.includes("blue_right") || selectedImageFile === "big.png"
      ? "right"
      : "right"; // デフォルト
    
    const newNote: NoteType = {
      time: currentTime,
      hand: hand,
      frame: frame,
      imageFile: selectedImageFile,
    };
    
    const updatedNotes = [...score.notes, newNote].sort((a, b) => a.time - b.time);
    setScore({ ...score, notes: updatedNotes });
  };
  
  // ノーツを削除
  const deleteNote = () => {
    if (!score || !nearestNote) return;
    
    // 最も近いノーツを削除（時間とhandが一致する最初のノーツ）
    const noteIndex = score.notes.findIndex(
      (note) => note.time === nearestNote.time && note.hand === nearestNote.hand
    );
    
    if (noteIndex === -1) return;
    
    const updatedNotes = [...score.notes];
    updatedNotes.splice(noteIndex, 1);
    setScore({ ...score, notes: updatedNotes });
  };
  
  // ノーツの時間を現在時刻に変更
  const updateNoteTime = () => {
    if (!score || !nearestNote) return;
    
    // 最も近いノーツの時間を更新（時間とhandが一致する最初のノーツ）
    const updatedNotes = score.notes.map((note, index) => {
      const isNearest = note.time === nearestNote.time && note.hand === nearestNote.hand;
      // 最初に一致したノーツのみを更新
      if (isNearest && score.notes.findIndex(n => n.time === nearestNote.time && n.hand === nearestNote.hand) === index) {
        return {
          ...note,
          time: currentTime,
          frame: frame,
        };
      }
      return note;
    }).sort((a, b) => a.time - b.time);
    setScore({ ...score, notes: updatedNotes });
  };
  
  // ノーツをクリックしたときの処理
  const handleNoteClick = (note: NoteType) => {
    // Remotion Studioのseek関数を使用して動画をシーク
    const targetFrame = note.frame !== undefined ? note.frame : Math.floor(note.time * fps);
    seekToFrame(targetFrame);
  };
  
  // 譜面データをダウンロード
  const downloadScore = () => {
    if (!score) return;
    
    const dataStr = JSON.stringify(score, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "score.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  
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
          // 一番近いノーツかどうかを判定（未来のノーツのみ）
          const isNearest = nearestNote && 
            nearestNote.time === note.time && 
            nearestNote.hand === note.hand &&
            (nearestNote.imageFile === note.imageFile || (!nearestNote.imageFile && !note.imageFile));
          
          return (
            <Note
              key={`${note.time}-${index}`}
              x={x}
              hand={note.hand}
              imageFile={note.imageFile}
              onClick={() => handleNoteClick(note)}
              isSelected={isNearest || false}
            />
          );
        })}
      </div>
      
      {/* 編集UI（Remotion Studio環境でのみ表示） */}
      {typeof window !== "undefined" && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            padding: "24px",
            borderRadius: "12px",
            color: "white",
            fontSize: "18px",
            zIndex: 1000,
            minWidth: "400px",
            maxWidth: "500px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div style={{ marginBottom: "20px", fontWeight: "bold", fontSize: "22px" }}>
            編集パネル
          </div>
          
          <div style={{ marginBottom: "16px", fontSize: "16px" }}>
            現在位置: {currentTime.toFixed(3)}秒 (フレーム: {frame})
          </div>
          
          {/* ノーツ画像選択 */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ marginBottom: "8px", fontSize: "16px", fontWeight: "500" }}>ノーツ種類:</div>
            <select
              value={selectedImageFile}
              onChange={(e) => {
                const newImageFile = e.target.value as NoteImageFile;
                setSelectedImageFile(newImageFile);
                
                // 一番近いノーツが存在する場合は、そのノーツの種類も変更
                if (score && nearestNote) {
                  // 画像ファイル名に基づいてhandを決定
                  const newHand: "left" | "right" = newImageFile.includes("red_left")
                    ? "left"
                    : newImageFile.includes("blue_right") || newImageFile === "big.png"
                    ? "right"
                    : "right"; // デフォルト
                  
                  const updatedNotes = score.notes.map((note, index) => {
                    // 一番近いノーツを特定（時間とhandが一致する最初のノーツ）
                    const isNearest = note.time === nearestNote.time && 
                                     note.hand === nearestNote.hand &&
                                     score.notes.findIndex(n => n.time === nearestNote.time && n.hand === nearestNote.hand) === index;
                    
                    if (isNearest) {
                      return {
                        ...note,
                        hand: newHand,
                        imageFile: newImageFile,
                      };
                    }
                    return note;
                  });
                  setScore({ ...score, notes: updatedNotes });
                }
              }}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "16px",
                backgroundColor: "#1a1a2e",
                color: "white",
                border: "2px solid #555",
                borderRadius: "6px",
              }}
            >
              {NOTE_IMAGE_FILES.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>
          </div>
          
          {/* 操作ボタン */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              onClick={addNote}
              style={{
                padding: "14px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#2563eb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#3b82f6";
              }}
            >
              ノーツ追加
            </button>
            
            <button
              onClick={deleteNote}
              disabled={!nearestNote}
              style={{
                padding: "14px",
                backgroundColor: nearestNote ? "#ef4444" : "#666",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: nearestNote ? "pointer" : "not-allowed",
                fontSize: "16px",
                fontWeight: "500",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                if (nearestNote) {
                  e.currentTarget.style.backgroundColor = "#dc2626";
                }
              }}
              onMouseLeave={(e) => {
                if (nearestNote) {
                  e.currentTarget.style.backgroundColor = "#ef4444";
                }
              }}
            >
              ノーツ削除
            </button>
            
            <button
              onClick={updateNoteTime}
              disabled={!nearestNote}
              style={{
                padding: "14px",
                backgroundColor: nearestNote ? "#f59e0b" : "#666",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: nearestNote ? "pointer" : "not-allowed",
                fontSize: "16px",
                fontWeight: "500",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                if (nearestNote) {
                  e.currentTarget.style.backgroundColor = "#d97706";
                }
              }}
              onMouseLeave={(e) => {
                if (nearestNote) {
                  e.currentTarget.style.backgroundColor = "#f59e0b";
                }
              }}
            >
              時間を現在位置に変更
            </button>
            
            <button
              onClick={downloadScore}
              style={{
                padding: "14px",
                backgroundColor: "#8b5cf6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                marginTop: "8px",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#7c3aed";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#8b5cf6";
              }}
            >
              譜面をダウンロード
            </button>
          </div>
          
          {/* 一番近いノーツ情報（常に表示） */}
          {nearestNote && (
            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                backgroundColor: "rgba(59, 130, 246, 0.3)",
                borderRadius: "6px",
                fontSize: "14px",
                border: "1px solid rgba(59, 130, 246, 0.5)",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "8px" }}>一番近いノーツ:</div>
              <div>時間: {nearestNote.time.toFixed(3)}秒</div>
              <div>種類: {nearestNote.hand}</div>
              {nearestNote.imageFile && <div>画像: {nearestNote.imageFile}</div>}
              <div style={{ marginTop: "4px", fontSize: "12px", opacity: 0.8 }}>
                距離: {Math.abs(nearestNote.time - currentTime).toFixed(3)}秒
              </div>
            </div>
          )}
          {!nearestNote && score && score.notes.length > 0 && (
            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                backgroundColor: "rgba(100, 100, 100, 0.3)",
                borderRadius: "6px",
                fontSize: "14px",
                border: "1px solid rgba(100, 100, 100, 0.5)",
              }}
            >
              <div style={{ opacity: 0.7 }}>近くにノーツがありません</div>
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
