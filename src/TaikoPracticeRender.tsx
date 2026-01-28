/**
 * TaikoPracticeRender.tsx
 * 
 * レンダリング専用コンポーネント（Remotion CLI / Node.js環境）
 * 
 * ⚠️ 重要: このコンポーネントを使用するには、必ず以下のpropsを設定してください:
 * - CLI: --input-props='{"score": {...}, "videoUrl": "https://..."}'
 * - Studio: Render UIの「Props」タブで score と videoUrl を設定
 * 
 * propsが設定されていない場合はエラーになります。
 * 
 * 絶対条件:
 * - Blob URLを一切使用しない
 * - URL.createObjectURL(), Blob, supabase.storage.download()を呼ばない
 * - useState, useEffectなどのブラウザ専用APIを最小限に
 * - propsで渡されたvideoUrl（Supabase StorageのURL）をそのまま使用
 * - scoreもpropsから取得
 * - windowオブジェクトやSupabase SDKは使用しない
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig, OffthreadVideo } from "remotion";
import { useMemo, useRef } from "react";
import { Note } from "./components/Note";
import { JudgeLine } from "./components/JudgeLine";
import type { Score, Note as NoteType } from "./types/score";
import { getHandFromImageFile } from "./types/score";
import type { TaikoPracticeRenderProps } from "./schema";

export const TaikoPracticeRender: React.FC<TaikoPracticeRenderProps> = ({ score, videoUrl }) => {
  // ⚠️ 必須チェック: scoreがundefinedの場合は即エラー
  if (!score) {
    throw new Error(
      '[TaikoPracticeRender] props.scoreが設定されていません。\n' +
      'CLIの場合は --input-props で score を指定してください。\n' +
      'Studioの場合は Render UIの「Props」タブで score を設定してください。'
    );
  }

  // ⚠️ 必須チェック: videoUrlがundefinedまたは空文字の場合は即エラー
  if (!videoUrl || videoUrl.trim() === '') {
    throw new Error(
      '[TaikoPracticeRender] props.videoUrlが設定されていません。\n' +
      'CLIの場合は --input-props で videoUrl を指定してください。\n' +
      'Studioの場合は Render UIの「Props」タブで videoUrl を設定してください。\n' +
      'videoUrlはSupabase Storageのpublic URLである必要があります（例: https://xxx.supabase.co/storage/v1/object/public/assets/videos/xxx.mp4）。'
    );
  }

  // デバッグ用: propsの内容をログ出力
  console.log('[TaikoPracticeRender] レンダリング開始:', {
    score: {
      name: score.name,
      duration: score.duration,
      fps: score.fps,
      notesCount: score.notes?.length || 0,
    },
    videoUrl: videoUrl.substring(0, 50) + '...',
  });

  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  
  // 現在の時刻（秒）
  const currentTime = frame / fps;
  
  // ノーツUIエリアの設定
  const judgeLineX = width * 0.25; // 判定ラインの位置（画面左から25%）
  const noteOffsetX = -45; // ノーツを右に移動させるオフセット（px）
  const startX = width * 0.9 + noteOffsetX; // ノーツの開始位置
  const endX = judgeLineX + noteOffsetX; // 判定ラインの位置
  const leftEdgeX = 0; // 左端の位置
  
  // ノーツを何秒前に表示するか
  const notePreviewSeconds = 3;
  const normalSpeed = (startX - endX) / notePreviewSeconds; // 通常のノーツの速度（px/秒）
  const timeToReachLeftEdge = (endX - leftEdgeX) / normalSpeed; // 判定ラインから左端に到達するまでの時間
  
  // レンダリング時は通過ノーツ表示をOFFにする（デフォルト）
  const showPassedNotes = false;
  
  // 表示すべきノーツをフィルタリング
  // scoreは必ず存在する（冒頭のチェックで保証）
  const visibleNotes = useMemo(() => {
    if (!score.notes || score.notes.length === 0) return [];
    
    return score.notes.filter((note) => {
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
      // showPassedNotesがfalseの場合は未来のノーツのみ
      return timeDiff >= -0.5 && timeDiff <= notePreviewSeconds;
    });
  }, [score, currentTime, notePreviewSeconds, timeToReachLeftEdge, showPassedNotes]);
  
  // ノーツが判定枠に触れたタイミングを検出して判定枠にエフェクトを追加
  const previousTouchedKeysRef = useRef<Set<string>>(new Set());
  const judgeLineEffectFrameRef = useRef<number | null>(null);
  
  // エフェクトの表示状態を計算（10フレーム間表示）
  // scoreは必ず存在する（冒頭のチェックで保証）
  const judgeLineEffect = useMemo(() => {
    // 古いエフェクト開始フレームをリセット（10フレーム以上経過した場合、または巻き戻しで現在フレームより前の場合）
    if (judgeLineEffectFrameRef.current !== null) {
      const elapsedFrames = frame - judgeLineEffectFrameRef.current;
      if (elapsedFrames >= 10 || frame < judgeLineEffectFrameRef.current) {
        judgeLineEffectFrameRef.current = null;
      }
    }
    
    // ノーツが判定枠に触れたタイミングを検出（currentTimeに非常に近いノーツ）
    const frameTimeThreshold = 1 / fps; // 1フレーム分の時間
    const touchedNotes = score.notes.filter(note => {
      const timeDiff = Math.abs(note.time - currentTime);
      return timeDiff < frameTimeThreshold; // 1フレーム以内のノーツ
    });
    
    // 前フレームで判定枠に触れていなかったノーツが、現在触れている場合、エフェクトを開始
    const previousTouchedKeys = previousTouchedKeysRef.current;
    const currentTouchedKeys = new Set(
      touchedNotes.map(note => `${note.time}-${note.imageFile || 'default'}`)
    );
    
    // 新しく触れたノーツを検出
    const newlyTouchedNotes = Array.from(currentTouchedKeys).filter(
      key => !previousTouchedKeys.has(key)
    );
    
    // ノーツが判定枠に触れた場合、エフェクトを開始（現在のフレームを記録）
    if (newlyTouchedNotes.length > 0) {
      judgeLineEffectFrameRef.current = frame;
    }
    
    // 現在の判定枠に触れたノーツを記録
    previousTouchedKeysRef.current = currentTouchedKeys;
    
    // エフェクトの表示状態を返す
    return judgeLineEffectFrameRef.current !== null && 
      frame >= judgeLineEffectFrameRef.current && 
      (frame - judgeLineEffectFrameRef.current) < 10;
  }, [frame, currentTime, score, fps]);
  
  // ノーツのx座標を計算する関数
  const calculateNoteX = (noteTime: number): number => {
    const timeUntilHit = noteTime - currentTime; // 判定ラインに到達するまでの時間
    
    if (timeUntilHit <= 0) {
      // 既に判定ラインを通過した場合
      // レンダリング時は通過ノーツ表示OFFなので、判定ラインの位置に表示
      return endX;
    }
    
    // ノーツが右から左へ流れるアニメーション
    // notePreviewSeconds秒かけてstartXからendXへ移動
    const progress = 1 - (timeUntilHit / notePreviewSeconds);
    return startX + (endX - startX) * progress;
  };
  
  // ノーツUIエリアの高さ
  const notesAreaHeight = 200;
  
  // ノーツが同じかどうかを判定するヘルパー関数
  const isSameNote = (note1: NoteType, note2: NoteType): boolean => {
    return note1.time === note2.time && 
      (note1.imageFile === note2.imageFile || (!note1.imageFile && !note2.imageFile));
  };
  
  // 一番近いノーツを取得（レンダリング時は使用しないが、型の互換性のため）
  // scoreは必ず存在する（冒頭のチェックで保証）
  const nearestNote = useMemo(() => {
    if (!score.notes || score.notes.length === 0) return null;
    
    // 未来のノーツのみから選択
    const candidateNotes = score.notes.filter(note => note.time > currentTime);
    
    if (candidateNotes.length === 0) return null;
    
    // 一番近い（時間の差が最小の）ノーツを選択
    const nearest = candidateNotes.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.time - currentTime);
      const currDiff = Math.abs(curr.time - currentTime);
      return currDiff < prevDiff ? curr : prev;
    });
    
    return nearest;
  }, [score, currentTime]);
  
  // ここまで来た時点で、scoreとvideoUrlは必ず存在する（上記のチェックで保証）
  // fallback表示やsilent returnは禁止（エラーで即終了する設計）
  
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
          src={videoUrl}
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
          showEffect={judgeLineEffect}
          effectStartFrame={judgeLineEffectFrameRef.current}
          currentFrame={frame}
        />
        
        {/* ノーツを表示 */}
        {visibleNotes.map((note, index) => {
          const x = calculateNoteX(note.time);
          const isNearest = nearestNote && isSameNote(note, nearestNote);
          
          return (
            <Note
              key={`${note.time}-${index}`}
              x={x}
              hand={getHandFromImageFile(note.imageFile)}
              imageFile={note.imageFile}
              onClick={() => {}} // レンダリング時はクリック無効
              isSelected={false} // レンダリング時は選択表示なし
              showSelectedAnimation={false} // レンダリング時は選択アニメーションなし
              frame={note.frame}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
