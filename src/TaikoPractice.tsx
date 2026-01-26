import { AbsoluteFill, useCurrentFrame, useVideoConfig, OffthreadVideo, staticFile, Img } from "remotion";
import { useState, useEffect, useRef, useCallback } from "react";
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
  const [showPassedNotes, setShowPassedNotes] = useState<boolean>(false); // 通過ノーツ表示の有効/無効
  
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
  
  // 一番近いノーツを常に取得
  // showPassedNotesがtrueの場合は判定枠を過ぎたノーツも含める
  const nearestNote = score ? (() => {
    if (score.notes.length === 0) return null;
    
    let candidateNotes: NoteType[];
    if (showPassedNotes) {
      // 通過ノーツ表示ONの場合：すべてのノーツから選択
      candidateNotes = score.notes;
    } else {
      // 通過ノーツ表示OFFの場合：未来のノーツのみ
      candidateNotes = score.notes.filter(note => note.time > currentTime);
    }
    
    if (candidateNotes.length === 0) return null;
    
    // 一番近い（時間の差が最小の）ノーツを選択
    const nearest = candidateNotes.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.time - currentTime);
      const currDiff = Math.abs(curr.time - currentTime);
      return currDiff < prevDiff ? curr : prev;
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
  const addNote = useCallback((noteImageFile?: NoteImageFile) => {
    if (!score) return;
    
    // ノーツ種類が指定されていない場合は、選択中のノーツ種類を使用
    const imageFile: NoteImageFile = noteImageFile || selectedImageFile;
    
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
      imageFile: imageFile,
    };
    
    const updatedNotes = [...score.notes, newNote].sort((a, b) => a.time - b.time);
    setScore({ ...score, notes: updatedNotes });
  }, [score, currentTime, frame, fps, selectedImageFile]);
  
  // キーボード入力でノーツを追加
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // テキスト入力フィールドにフォーカスがある場合は無視
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      // キーに応じたノーツ種類のマッピング
      const keyToNoteMap: Record<string, NoteImageFile> = {
        'z': 'red_left_2.png',
        'Z': 'red_left_2.png',
        'x': 'red_left_1.png',
        'X': 'red_left_1.png',
        'c': 'big.png',
        'C': 'big.png',
        'v': 'blue_right_1.png',
        'V': 'blue_right_1.png',
        'b': 'blue_right_2.png',
        'B': 'blue_right_2.png',
      };
      
      const noteImageFile = keyToNoteMap[event.key];
      if (noteImageFile) {
        event.preventDefault(); // デフォルト動作を防ぐ
        addNote(noteImageFile);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addNote]);
  
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
  
  // 選択されたノーツをXフレーム移動する関数
  const moveSelectedNote = useCallback((frameOffset: number) => {
    if (!score || !nearestNote) return;
    
    // 移動後の時間を計算
    const newTime = nearestNote.time + (frameOffset / fps);
    const newFrame = (nearestNote.frame !== undefined ? nearestNote.frame : Math.floor(nearestNote.time * fps)) + frameOffset;
    
    // 最も近いノーツの時間を更新（時間とimageFileが一致する最初のノーツ）
    const updatedNotes = score.notes.map((note, index) => {
      const isNearest = isSameNote(note, nearestNote);
      // 最初に一致したノーツのみを更新
      if (isNearest && score.notes.findIndex(n => isSameNote(n, nearestNote)) === index) {
        return {
          ...note,
          time: Math.max(0, newTime), // 時間が負の値にならないように
          frame: Math.max(0, newFrame), // フレームが負の値にならないように
        };
      }
      return note;
    }).sort((a, b) => a.time - b.time);
    setScore({ ...score, notes: updatedNotes });
  }, [score, nearestNote, fps]);
  
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
  
  // ノーツUIエリアの設定（visibleNotesの計算で使用するため、ここで定義）
  const judgeLineX = width * 0.25; // 判定ラインの位置（画面左から25%、左に寄せる）
  const noteOffsetX = -45; // ノーツを右に移動させるオフセット（px）
  const startX = width * 0.9 + noteOffsetX; // ノーツの開始位置
  const endX = judgeLineX + noteOffsetX; // 判定ラインの位置
  const leftEdgeX = 0; // 左端の位置
  
  // 表示すべきノーツをフィルタリング（scoreがnullの場合は空配列）
  // 現在時刻の前後±notePreviewSeconds秒以内のノーツを表示
  // showPassedNotesがfalseの場合、ノーツが判定枠の中央にきたタイミング（note.time <= currentTime）で非表示にする
  const notePreviewSeconds = 3; // ノーツを何秒前に表示するか
  const normalSpeed = (startX - endX) / notePreviewSeconds; // 通常のノーツの速度（px/秒）
  const timeToReachLeftEdge = (endX - leftEdgeX) / normalSpeed; // 判定ラインから左端に到達するまでの時間
  
  const visibleNotes = score ? score.notes.filter((note) => {
    // showPassedNotesがfalseの場合、判定枠の中央にきたノーツを非表示
    if (!showPassedNotes && note.time <= currentTime) {
      return false;
    }
    
    // showPassedNotesがtrueの場合、通過したノーツが左端に到達したら非表示
    if (showPassedNotes && note.time <= currentTime) {
      const timePassed = currentTime - note.time; // 通過してからの時間
      if (timePassed >= timeToReachLeftEdge) {
        return false; // 左端に到達したので非表示
      }
    }
    
    // 表示範囲内のノーツのみ表示
    const timeDiff = note.time - currentTime;
    // showPassedNotesがtrueの場合は過去のノーツも表示範囲内なら表示
    if (showPassedNotes) {
      return Math.abs(timeDiff) <= notePreviewSeconds;
    }
    // showPassedNotesがfalseの場合は未来のノーツのみ
    return timeDiff >= -0.5 && timeDiff <= notePreviewSeconds;
  }) : [];
  
  // ノーツが判定枠に触れたタイミングを検出して判定枠にエフェクトを追加
  useEffect(() => {
    if (!score) return;
    
    // 古いエフェクト開始フレームをリセット（10フレーム以上経過した場合、または巻き戻しで現在フレームより前の場合）
    if (judgeLineEffectFrame !== null) {
      const elapsedFrames = frame - judgeLineEffectFrame;
      if (elapsedFrames >= 10 || frame < judgeLineEffectFrame) {
        setJudgeLineEffectFrame(null);
      }
    }
    
    // ノーツが判定枠に触れたタイミングを検出（currentTimeに非常に近いノーツ）
    const frameTimeThreshold = 1 / fps; // 1フレーム分の時間
    const touchedNotes = score.notes.filter(note => {
      const timeDiff = Math.abs(note.time - currentTime);
      return timeDiff < frameTimeThreshold; // 1フレーム以内のノーツ
    });
    
    // 前フレームで判定枠に触れていなかったノーツが、現在触れている場合、エフェクトを開始
    const previousTouchedKeys = previousVisibleNotesRef.current;
    const currentTouchedKeys = new Set(
      touchedNotes.map(note => `${note.time}-${note.imageFile || 'default'}`)
    );
    
    // 新しく触れたノーツを検出
    const newlyTouchedNotes = Array.from(currentTouchedKeys).filter(
      key => !previousTouchedKeys.has(key)
    );
    
    // ノーツが判定枠に触れた場合、エフェクトを開始（現在のフレームを記録）
    if (newlyTouchedNotes.length > 0) {
      setJudgeLineEffectFrame(frame);
    }
    
    // 現在の判定枠に触れたノーツを記録
    previousVisibleNotesRef.current = currentTouchedKeys;
  }, [frame, currentTime, score, fps, judgeLineEffectFrame]);
  
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
    const leftEdgeX = 0; // 左端の位置
    
    if (timeUntilHit <= 0) {
      // 既に判定ラインを通過した場合
      if (showPassedNotes) {
        // 通過ノーツ表示ONの場合：左端まで流す（通常のノーツと同じ速度で）
        // 通常のノーツの速度: (startX - endX) / notePreviewSeconds
        const timePassed = Math.abs(timeUntilHit); // 通過してからの時間（正の値）
        const normalSpeed = (startX - endX) / notePreviewSeconds; // 通常のノーツの速度（px/秒）
        const distanceMoved = timePassed * normalSpeed; // 通過してから移動した距離
        const newX = endX - distanceMoved; // 新しい位置（左方向に移動）
        return Math.max(leftEdgeX, newX); // 左端を超えないように
      } else {
        // 通過ノーツ表示OFFの場合：判定ラインの位置に表示
        return endX;
      }
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
      {/* キー操作ガイド（左上） */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: "24px",
          borderRadius: "12px",
          color: "white",
          fontSize: "18px",
          zIndex: 999,
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "16px", fontSize: "22px" }}>
          キー操作
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ minWidth: "30px", fontWeight: "bold", fontSize: "20px" }}>Z :</span>
            <Img 
              src={staticFile("images/notes/red_left_2.png")} 
              style={{ width: "60px", height: "60px", objectFit: "contain" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ minWidth: "30px", fontWeight: "bold", fontSize: "20px" }}>X :</span>
            <Img 
              src={staticFile("images/notes/red_left_1.png")} 
              style={{ width: "60px", height: "60px", objectFit: "contain" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ minWidth: "30px", fontWeight: "bold", fontSize: "20px" }}>C :</span>
            <Img 
              src={staticFile("images/notes/big.png")} 
              style={{ width: "60px", height: "60px", objectFit: "contain" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ minWidth: "30px", fontWeight: "bold", fontSize: "20px" }}>V :</span>
            <Img 
              src={staticFile("images/notes/blue_right_1.png")} 
              style={{ width: "60px", height: "60px", objectFit: "contain" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ minWidth: "30px", fontWeight: "bold", fontSize: "20px" }}>B :</span>
            <Img 
              src={staticFile("images/notes/blue_right_2.png")} 
              style={{ width: "60px", height: "60px", objectFit: "contain" }}
            />
          </div>
        </div>
      </div>
      
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
          
          {/* 操作ボタン */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              onClick={() => setShowPassedNotes(!showPassedNotes)}
              style={{
                padding: "14px",
                backgroundColor: showPassedNotes ? "#10b981" : "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = showPassedNotes ? "#059669" : "#4b5563";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = showPassedNotes ? "#10b981" : "#6b7280";
              }}
            >
              {showPassedNotes ? "通過ノーツ表示ON" : "通過ノーツ表示OFF"}
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
            
            {/* フレーム移動ボタン（横並び） */}
            <div style={{ display: "flex", flexDirection: "row", gap: "8px" }}>
              <button
                onClick={() => moveSelectedNote(-3)}
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
                  flex: 1,
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
                &lt;3
              </button>
              <button
                onClick={() => moveSelectedNote(-2)}
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
                  flex: 1,
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
                &lt;2
              </button>
              <button
                onClick={() => moveSelectedNote(-1)}
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
                  flex: 1,
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
                &lt;1
              </button>
              <button
                onClick={() => moveSelectedNote(1)}
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
                  flex: 1,
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
                1&gt;
              </button>
              <button
                onClick={() => moveSelectedNote(2)}
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
                  flex: 1,
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
                2&gt;
              </button>
              <button
                onClick={() => moveSelectedNote(3)}
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
                  flex: 1,
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
                3&gt;
              </button>
            </div>
            
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
