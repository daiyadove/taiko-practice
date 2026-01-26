import { AbsoluteFill, useCurrentFrame, useVideoConfig, OffthreadVideo, staticFile } from "remotion";
import { useState, useEffect, useRef } from "react";
import { Note } from "./components/Note";
import { JudgeLine } from "./components/JudgeLine";
import type { Score, Note as NoteType, NoteImageFile } from "./types/score";
import { getHandFromImageFile } from "./types/score";
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
  const scoreRef = useRef<Score | null>(null); // scoreの最新値を保持
  const [judgeLineEffectFrame, setJudgeLineEffectFrame] = useState<number | null>(null); // エフェクト開始フレーム
  const previousVisibleNotesRef = useRef<Set<string>>(new Set()); // 前フレームの表示ノーツを記録
  const [showSelectedNoteAnimation, setShowSelectedNoteAnimation] = useState<boolean>(true); // 選択ノーツ表示の有効/無効
  
  // scoreが変更されたときにrefを更新
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  
  // 現在の時刻（秒）
  const currentTime = frame / fps;
  
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
  
  // 一番近いノーツを常に取得（未来のノーツのみ、消えていないノーツ）
  const nearestNote = score ? (() => {
    if (score.notes.length === 0) return null;
    
    // 現在時刻より後のノーツ（未来のノーツ、消えていないノーツ）のみをフィルタリング
    const futureNotes = score.notes.filter(note => note.time > currentTime);
    
    if (futureNotes.length === 0) return null;
    
    // 未来のノーツの中で一番近い（時間が最小の）ノーツを選択
    const nearest = futureNotes.reduce((prev, curr) => {
      return curr.time < prev.time ? curr : prev;
    });
    
    return nearest;
  })() : null;
  
  // 一番近いノーツが変更されたときに、ノーツ種類を自動的に更新
  useEffect(() => {
    if (nearestNote && nearestNote.imageFile) {
      setSelectedImageFile(nearestNote.imageFile);
    } else if (nearestNote && !nearestNote.imageFile) {
      // imageFileが指定されていない場合は、デフォルトを設定
      setSelectedImageFile("red_left_1.png");
    }
  }, [nearestNote?.time, nearestNote?.imageFile]);
  
  // ノーツを追加
  const addNote = () => {
    if (!score) return;
    
    // ノーツ追加時は常にred_left_1.pngを使用
    const noteImageFile: NoteImageFile = "red_left_1.png";
    
    // 現在時刻でノーツを追加
    const noteTime = currentTime;
    const noteFrame = frame;
    
    // 同じ時間（1フレーム以内）に既にノーツが存在するかチェック
    const frameTimeThreshold = 1 / fps; // 1フレーム分の時間
    const hasDuplicateNote = score.notes.some(note => {
      const timeDiff = Math.abs(note.time - noteTime);
      return timeDiff < frameTimeThreshold;
    });
    
    // 同じ時間にノーツが既に存在する場合は追加しない
    if (hasDuplicateNote) {
      return;
    }
    
    const newNote: NoteType = {
      time: noteTime,
      frame: noteFrame,
      imageFile: noteImageFile,
    };
    
    const updatedNotes = [...score.notes, newNote].sort((a, b) => a.time - b.time);
    setScore({ ...score, notes: updatedNotes });
    
    // 再生フレームを1フレーム前にシーク
    if (frame > 0) {
      seekToFrame(frame - 1);
    }
  };
  
  // ノーツを削除
  const deleteNote = () => {
    if (!score || !nearestNote) return;
    
    // 最も近いノーツを削除（時間とimageFileが一致する最初のノーツ）
    const noteIndex = score.notes.findIndex(
      (note) => isSameNote(note, nearestNote)
    );
    
    if (noteIndex === -1) return;
    
    const updatedNotes = [...score.notes];
    updatedNotes.splice(noteIndex, 1);
    setScore({ ...score, notes: updatedNotes });
  };
  
  // ノーツの時間を現在時刻に変更
  const updateNoteTime = () => {
    if (!score || !nearestNote) return;
    
    // 最も近いノーツの時間を更新（時間とimageFileが一致する最初のノーツ）
    const updatedNotes = score.notes.map((note, index) => {
      const isNearest = isSameNote(note, nearestNote);
      // 最初に一致したノーツのみを更新
      if (isNearest && score.notes.findIndex(n => isSameNote(n, nearestNote)) === index) {
        return {
          ...note,
          time: currentTime,
          frame: frame,
        };
      }
      return note;
    }).sort((a, b) => a.time - b.time);
    setScore({ ...score, notes: updatedNotes });
    
    // 再生フレームを1フレーム前にシーク
    if (frame > 0) {
      seekToFrame(frame - 1);
    }
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
  
  // 表示すべきノーツをフィルタリング（scoreがnullの場合は空配列）
  // 現在時刻の前後±notePreviewSeconds秒以内のノーツを表示
  // ノーツが判定枠の中央にきたタイミング（note.time <= currentTime）で非表示にする
  const notePreviewSeconds = 3; // ノーツを何秒前に表示するか
  const visibleNotes = score ? score.notes.filter((note) => {
    // ノーツが判定枠の中央にきたタイミングで非表示（削除はしない）
    if (note.time <= currentTime) {
      return false;
    }
    // 未来のノーツで、表示範囲内のもののみ表示
    const timeDiff = note.time - currentTime;
    return timeDiff >= -0.5 && timeDiff <= notePreviewSeconds;
  }) : [];
  
  // ノーツが非表示になったタイミングを検出して判定枠にエフェクトを追加
  useEffect(() => {
    if (!score) return;
    
    // 古いエフェクト開始フレームをリセット（10フレーム以上経過した場合、または巻き戻しで現在フレームより前の場合）
    if (judgeLineEffectFrame !== null) {
      const elapsedFrames = frame - judgeLineEffectFrame;
      if (elapsedFrames >= 10 || frame < judgeLineEffectFrame) {
        setJudgeLineEffectFrame(null);
      }
    }
    
    // 現在のフレームの表示ノーツのキーを生成
    const currentVisibleKeys = new Set(
      visibleNotes.map(note => `${note.time}-${note.imageFile || 'default'}`)
    );
    
    // 前フレームで表示されていたが、現在は非表示になったノーツを検出
    const disappearedNotes = Array.from(previousVisibleNotesRef.current).filter(
      key => !currentVisibleKeys.has(key)
    );
    
    // ノーツが非表示になった場合、エフェクトを開始（現在のフレームを記録）
    if (disappearedNotes.length > 0) {
      setJudgeLineEffectFrame(frame);
    }
    
    // 現在の表示ノーツを記録
    previousVisibleNotesRef.current = currentVisibleKeys;
  }, [frame, visibleNotes, score, judgeLineEffectFrame]);
  
  // エフェクトの表示状態を計算（10フレーム間表示）
  // 巻き戻し時の対応：現在フレームが開始フレームより前の場合や、10フレーム以上経過した場合は無効化
  const judgeLineEffect = judgeLineEffectFrame !== null && 
    frame >= judgeLineEffectFrame && 
    (frame - judgeLineEffectFrame) < 10;
  
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
  const judgeLineX = width * 0.25; // 判定ラインの位置（画面左から25%、左に寄せる）
  
  // ノーツが同じかどうかを判定するヘルパー関数
  const isSameNote = (note1: NoteType, note2: NoteType): boolean => {
    return note1.time === note2.time && 
      (note1.imageFile === note2.imageFile || (!note1.imageFile && !note2.imageFile));
  };
  
  // ノーツのx座標を計算する関数
  const calculateNoteX = (noteTime: number): number => {
    const timeUntilHit = noteTime - currentTime; // 判定ラインに到達するまでの時間
    const noteOffsetX = -45; // ノーツを右に移動させるオフセット（px）
    const startX = width * 0.9 + noteOffsetX; // ノーツの開始位置（画面右から10%、さらに右にオフセット）
    const endX = judgeLineX + noteOffsetX; // 判定ラインの位置（判定枠の中央）+ オフセット
    
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
        {/* 判定ライン（判定枠） */}
        <JudgeLine 
          x={judgeLineX} 
          height={notesAreaHeight} 
          showEffect={judgeLineEffect || false}
          effectStartFrame={judgeLineEffectFrame}
          currentFrame={frame}
        />
        
        {/* ノーツを表示 */}
        {visibleNotes.map((note, index) => {
          const x = calculateNoteX(note.time);
          // 一番近いノーツかどうかを判定（未来のノーツのみ）
          const isNearest = nearestNote && isSameNote(note, nearestNote);
          
          return (
            <Note
              key={`${note.time}-${index}`}
              x={x}
              hand={getHandFromImageFile(note.imageFile)}
              imageFile={note.imageFile}
              onClick={() => handleNoteClick(note)}
              isSelected={isNearest || false}
              showSelectedAnimation={showSelectedNoteAnimation}
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
                  const updatedNotes = score.notes.map((note, index) => {
                    // 一番近いノーツを特定（時間とimageFileが一致する最初のノーツ）
                    const isNearest = isSameNote(note, nearestNote) &&
                                     score.notes.findIndex(n => isSameNote(n, nearestNote)) === index;
                    
                    if (isNearest) {
                      return {
                        ...note,
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
              onClick={() => setShowSelectedNoteAnimation(!showSelectedNoteAnimation)}
              style={{
                padding: "14px",
                backgroundColor: showSelectedNoteAnimation ? "#10b981" : "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = showSelectedNoteAnimation ? "#059669" : "#4b5563";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = showSelectedNoteAnimation ? "#10b981" : "#6b7280";
              }}
            >
              {showSelectedNoteAnimation ? "選択ノーツ表示を無効化" : "選択ノーツ表示を有効化"}
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
              <div>種類: {getHandFromImageFile(nearestNote.imageFile)}</div>
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
