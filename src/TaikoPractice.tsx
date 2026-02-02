import { AbsoluteFill, useCurrentFrame, useVideoConfig, OffthreadVideo, staticFile, Img } from "remotion";
import { useState, useEffect, useRef, useCallback } from "react";
import { Note } from "./components/Note";
import { JudgeLine } from "./components/JudgeLine";
import type { Score, Note as NoteType, NoteImageFile } from "./types/score";
import { getHandFromImageFile } from "./types/score";
import type { TaikoPracticeProps } from "./schema";
import { supabase } from "./lib/supabase";
import { getVideoMetadata } from "@remotion/media-utils";

// 画面モードの型定義
type ScreenMode = 'home' | 'new' | 'select' | 'edit';

// Supabaseから取得する動画情報の型定義
interface VideoInfo {
  id: string;
  name: string;
  video_path: string;
  json_path: string;
  created_at?: string;
}

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


export const TaikoPractice: React.FC<TaikoPracticeProps> = ({ score: scoreFromProps }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  
  
  // 画面モード管理（編集専用なので常にブラウザ環境）
  const [screenMode, setScreenMode] = useState<ScreenMode>('home');
  
  // 動画ファイルのパス（Blob URLのみ、Supabaseから読み込む）
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null); // Blob URLを保持
  
  // 譜面データを読み込み
  // scoreFromPropsを優先的に使用
  // scoreFromPropsが有効なデータを持っているかチェック（空のオブジェクトや不完全なデータは無視）
  const hasValidScoreFromProps = scoreFromProps && 
    scoreFromProps.duration > 0 && 
    scoreFromProps.fps > 0;
  const [score, setScore] = useState<Score | null>(hasValidScoreFromProps ? scoreFromProps : null);
  const [selectedImageFile, setSelectedImageFile] = useState<NoteImageFile>("red_left_1.png");
  const scoreRef = useRef<Score | null>(null); // scoreの最新値を保持
  const [judgeLineEffectFrame, setJudgeLineEffectFrame] = useState<number | null>(null); // エフェクト開始フレーム
  const previousVisibleNotesRef = useRef<Set<string>>(new Set()); // 前フレームの表示ノーツを記録
  const [showSelectedNoteAnimation, setShowSelectedNoteAnimation] = useState<boolean>(false); // 選択ノーツ表示の有効/無効（デフォルトOFF、少し後にON）
  const [showPassedNotes, setShowPassedNotes] = useState<boolean>(false); // 通過ノーツ表示の有効/無効（デフォルトOFF、少し後にON）
  const [isUploading, setIsUploading] = useState<boolean>(false); // Supabaseアップロード中の状態
  const [isRendering, setIsRendering] = useState<boolean>(false); // 動画レンダリング中の状態
  const [hideUI, setHideUI] = useState<boolean>(true); // UI（キー操作パネル・編集パネル）を非表示にするフラグ（デフォルト非表示、少し後に表示）
  
  // 新規制作用の状態
  const [projectName, setProjectName] = useState<string>('');
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  
  // 既存プロジェクト選択用の状態
  const [videoList, setVideoList] = useState<VideoInfo[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState<boolean>(false);
  
  // scoreが変更されたときにrefを更新
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  
  // scoreが変更されたときに、Remotion StudioのComposition propsとメタデータを更新
  useEffect(() => {
    if (!score || !score.duration || !score.fps) {
      console.log('[TaikoPractice] scoreが無効なため、メタデータ更新をスキップ:', { score });
      return;
    }
    
    console.log('[TaikoPractice] scoreが変更されました。メタデータを更新します:', {
      duration: score.duration,
      fps: score.fps,
      durationInFrames: Math.ceil(score.duration * score.fps),
    });
    
    // Remotion StudioのAPIを使用してCompositionのpropsとメタデータを更新
    if (typeof window !== "undefined") {
      import("@remotion/studio")
        .then((studioModule) => {
          console.log('[TaikoPractice] @remotion/studioモジュールを読み込みました:', {
            hasUpdateDefaultProps: typeof (studioModule as any).updateDefaultProps === 'function',
            hasReevaluateComposition: typeof (studioModule as any).reevaluateComposition === 'function',
          });
          
          // updateDefaultPropsを使ってscore propsを更新
          if (studioModule && typeof (studioModule as any).updateDefaultProps === 'function') {
            try {
              (studioModule as any).updateDefaultProps({
                compositionId: 'TaikoPractice',
                defaultProps: ({ unsavedDefaultProps, savedDefaultProps }: any) => {
                  const newProps = {
                    ...unsavedDefaultProps,
                    ...savedDefaultProps,
                    score: score,
                  };
                  console.log('[TaikoPractice] updateDefaultPropsを呼び出します:', {
                    compositionId: 'TaikoPractice',
                    newScore: {
                      duration: newProps.score?.duration,
                      fps: newProps.score?.fps,
                    },
                  });
                  return newProps;
                },
              });
              
              // updateDefaultPropsの後に少し待ってからreevaluateCompositionを呼び出す
              // これにより、propsの更新が反映されてからメタデータが再計算されます
              setTimeout(() => {
                if (studioModule && typeof (studioModule as any).reevaluateComposition === 'function') {
                  try {
                    console.log('[TaikoPractice] reevaluateCompositionを呼び出します（updateDefaultPropsの後）');
                    (studioModule as any).reevaluateComposition();
                  } catch (error) {
                    console.error('[TaikoPractice] reevaluateCompositionでエラーが発生しました:', error);
                  }
                } else {
                  console.warn('[TaikoPractice] reevaluateCompositionが利用できません');
                }
              }, 100);
            } catch (error) {
              console.error('[TaikoPractice] updateDefaultPropsでエラーが発生しました:', error);
            }
          } else {
            console.warn('[TaikoPractice] updateDefaultPropsが利用できません');
          }
        })
        .catch((error) => {
          console.error('[TaikoPractice] @remotion/studioの読み込みに失敗しました:', error);
        });
    }
  }, [score]);
  
  // UIとノーツ表示を少し後に有効化（デフォルトでは非表示/OFF）
  useEffect(() => {
    // 編集画面でscoreが読み込まれた場合のみ実行
    if (screenMode === 'edit' && score) {
      // 0.5秒後にUIを表示
      const uiTimer = setTimeout(() => {
        setHideUI(false);
      }, 500);
      
      // 0.5秒後に通過ノーツ表示をON
      const passedNotesTimer = setTimeout(() => {
        setShowPassedNotes(true);
      }, 500);
      
      // 0.5秒後に選択ノーツ表示をON
      const selectedNoteTimer = setTimeout(() => {
        setShowSelectedNoteAnimation(true);
      }, 500);
      
      return () => {
        clearTimeout(uiTimer);
        clearTimeout(passedNotesTimer);
        clearTimeout(selectedNoteTimer);
      };
    }
  }, [screenMode, score]);
  
  // Supabaseから動画一覧を取得
  const loadVideoList = useCallback(async () => {
    setIsLoadingVideos(true);
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('id, name, video_path, json_path, created_at')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      setVideoList(data || []);
    } catch (error) {
      alert(`動画一覧の取得に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsLoadingVideos(false);
    }
  }, []);
  
  // Supabaseから動画とJSONを取得して編集画面に遷移
  const loadProjectFromSupabase = useCallback(async (videoInfo: VideoInfo) => {
    try {
      // 動画ファイルを取得
      const { data: videoData, error: videoError } = await supabase.storage
        .from('assets')
        .download(videoInfo.video_path);
      
      if (videoError || !videoData) {
        throw new Error(`動画ファイルの取得に失敗しました: ${videoError?.message || 'ファイルが見つかりません'}`);
      }
      
      // JSONファイルを取得
      const { data: jsonData, error: jsonError } = await supabase.storage
        .from('assets')
        .download(videoInfo.json_path);
      
      if (jsonError || !jsonData) {
        throw new Error(`JSONファイルの取得に失敗しました: ${jsonError?.message || 'ファイルが見つかりません'}`);
      }
      
      // JSONをパース（jsonDataはBlobなので、text()でテキストに変換）
      const jsonText = await jsonData.text();
      const scoreData: Score = JSON.parse(jsonText);
      
      // プロジェクト名がJSONにない場合は、Supabaseのnameを使用
      if (!scoreData.name && videoInfo.name) {
        scoreData.name = videoInfo.name;
      }
      
      // Supabaseの情報をscoreに保存
      scoreData.supabaseProjectId = videoInfo.id;
      scoreData.supabaseVideoPath = videoInfo.video_path;
      scoreData.supabaseJsonPath = videoInfo.json_path;
      
      // 既存のBlob URLをクリーンアップ（新しいBlob URLを作成する前に）
      const previousBlobUrl = videoBlobUrl;
      
      // 動画をBlob URLに変換（videoDataはBlob）
      const blobUrl = URL.createObjectURL(videoData as Blob);
      
      // Blob URLを設定（先に設定してからメタデータを取得）
      setVideoBlobUrl(blobUrl);
      setVideoSrc(blobUrl);
      
      // 古いBlob URLをクリーンアップ（新しいBlob URLを設定した後）
      if (previousBlobUrl) {
        URL.revokeObjectURL(previousBlobUrl);
      }
      
      // 動画のメタデータを取得してscoreを更新（動画の実際の長さに合わせる）
      try {
        // Blob URLが有効であることを確認してからメタデータを取得
        const videoMetadata = await getVideoMetadata(blobUrl);
        
        // 動画のメタデータでscoreを更新（durationのみ更新、fpsはJSONから取得した値を使用）
        scoreData.duration = videoMetadata.durationInSeconds;
        // fpsはJSONから取得した値を使用（動画メタデータにはfpsが含まれていないため）
        // もしJSONにfpsが含まれていない場合は、デフォルト値30を使用
        if (!scoreData.fps || scoreData.fps <= 0) {
          scoreData.fps = 30;
        }
        
        // Remotion StudioのcalculateMetadataで参照できるように、windowオブジェクトに保存
        if (typeof window !== "undefined") {
          (window as any).__TAIKO_PRACTICE_SCORE__ = scoreData;
        }
      } catch (metadataError) {
        // メタデータ取得に失敗した場合は、JSONの値をそのまま使用
        if (typeof window !== "undefined") {
          (window as any).__TAIKO_PRACTICE_SCORE__ = scoreData;
        }
      }
      
      console.log('[TaikoPractice] loadProjectFromSupabase完了。scoreを設定します:', {
        duration: scoreData.duration,
        fps: scoreData.fps,
        durationInFrames: Math.ceil(scoreData.duration * scoreData.fps),
      });
      
      setScore(scoreData);
      setScreenMode('edit');
      
      // 注意: メタデータの更新は、scoreが変更されたときのuseEffectで自動的に実行されます
    } catch (error) {
      alert(`プロジェクトの読み込みに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }, [videoBlobUrl]);
  
  // 新規制作：動画を選択して初期化
  const initializeNewProject = useCallback(async () => {
    if (!projectName.trim()) {
      alert('プロジェクト名を入力してください');
      return;
    }
    
    if (!selectedVideoFile) {
      alert('動画ファイルを選択してください');
      return;
    }
    
    try {
      // 動画のメタデータを取得
      const videoBlob = await selectedVideoFile.arrayBuffer();
      const blob = new Blob([videoBlob], { type: selectedVideoFile.type });
      const blobUrl = URL.createObjectURL(blob);
      
      // 既存のBlob URLをクリーンアップ
      if (videoBlobUrl) {
        URL.revokeObjectURL(videoBlobUrl);
      }
      
      setVideoBlobUrl(blobUrl);
      setVideoSrc(blobUrl);
      
      // 動画のメタデータを取得してscore.jsonを初期化
      const videoMetadata = await getVideoMetadata(blobUrl);
      
      const initialScore: Score = {
        name: projectName.trim(),
        videoPath: selectedVideoFile.name,
        duration: videoMetadata.durationInSeconds,
        fps: fps,
        notes: [],
      };
      
      setScore(initialScore);
      setScreenMode('edit');
    } catch (error) {
      alert(`プロジェクトの初期化に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }, [projectName, selectedVideoFile, fps, videoBlobUrl]);
  
  // コンポーネントのアンマウント時にBlob URLをクリーンアップ
  useEffect(() => {
    return () => {
      if (videoBlobUrl) {
        URL.revokeObjectURL(videoBlobUrl);
      }
    };
  }, [videoBlobUrl]);
  
  // 現在の時刻（秒）
  const currentTime = frame / fps;
  
  
  // 編集画面の場合のみ、scoreFromPropsから読み込む
  useEffect(() => {
    // 編集画面以外の場合はスキップ
    if (screenMode !== 'edit') {
      return;
    }
    
    // 既にscoreが設定されている場合はスキップ（新規作成やSupabaseから読み込んだ場合）
    if (score) {
      return;
    }
    
    // propsで直接譜面データが指定されている場合はそれを使用
    if (scoreFromProps) {
      setScore(scoreFromProps);
      return;
    }
  }, [scoreFromProps, screenMode, score]);
  
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
  
  // 選択されたノーツを現在の位置に移動する関数
  const moveSelectedNoteToCurrentTime = useCallback(() => {
    if (!score || !nearestNote) return;
    
    // 最も近いノーツの時間を現在時刻に更新（時間とimageFileが一致する最初のノーツ）
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
  }, [score, nearestNote, currentTime, frame]);
  
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
  
  // Supabaseに動画とJSONをアップロード
  const uploadToSupabase = async (videoFile: File, videoName: string) => {
    if (!score) {
      alert("譜面データがありません");
      return;
    }
    
    setIsUploading(true);
    
    try {
      // ① 既存レコードを検索（同じ名前のプロジェクトがあるか確認）
      const { data: existingVideo, error: searchError } = await supabase
        .from('videos')
        .select('id, video_path, json_path')
        .eq('name', videoName)
        .maybeSingle(); // maybeSingle(): 0件の場合はnull、1件の場合はそのレコード、2件以上の場合はエラー
      
      if (searchError && searchError.code !== 'PGRST116') { // PGRST116は「0件」のエラーコード
        throw new Error(`既存レコード検索エラー: ${searchError.message}`);
      }
      
      let videoId: string;
      let isUpdate = false;
      
      if (existingVideo && existingVideo.id) {
        // 既存レコードがある場合：上書き保存
        videoId = existingVideo.id;
        isUpdate = true;
      } else {
        // 既存レコードがない場合：新規作成
        const { data: newVideo, error: insertError } = await supabase
          .from('videos')
          .insert({
            name: videoName,
            video_path: 'temp',
            json_path: 'temp',
          })
          .select()
          .single();
        
        if (insertError) {
          throw new Error(`DBレコード作成エラー: ${insertError.message}`);
        }
        
        if (!newVideo || !newVideo.id) {
          throw new Error('video.idが取得できませんでした');
        }
        
        videoId = newVideo.id;
      }
      
      // ② Storageにアップロード（upsert: trueで上書き可能に）
      const videoPath = `videos/${videoId}.mp4`;
      const jsonPath = `metadata/${videoId}.json`;
      
      // 動画ファイルをアップロード
      // upsert: true → 同じパスのファイルが既に存在する場合は上書き、存在しない場合は新規作成
      const { error: videoUploadError } = await supabase.storage
        .from('assets')
        .upload(videoPath, videoFile, {
          cacheControl: '3600',
          upsert: true // 上書きを許可
        });
      
      if (videoUploadError) {
        throw new Error(`動画アップロードエラー: ${videoUploadError.message}`);
      }
      
      // JSONファイルをアップロード
      const jsonBlob = new Blob([JSON.stringify(score, null, 2)], {
        type: 'application/json',
      });
      
      // upsert: true → 同じパスのファイルが既に存在する場合は上書き、存在しない場合は新規作成
      const { error: jsonUploadError } = await supabase.storage
        .from('assets')
        .upload(jsonPath, jsonBlob, {
          cacheControl: '3600',
          upsert: true // 上書きを許可
        });
      
      if (jsonUploadError) {
        throw new Error(`JSONアップロードエラー: ${jsonUploadError.message}`);
      }
      
      // ③ DBを更新
      const { error: updateError } = await supabase
        .from('videos')
        .update({
          video_path: videoPath,
          json_path: jsonPath,
        })
        .eq('id', videoId);
      
      if (updateError) {
        throw new Error(`DB更新エラー: ${updateError.message}`);
      }
      
      const message = isUpdate 
        ? `上書き保存成功！\n動画ID: ${videoId}\n動画パス: ${videoPath}\nJSONパス: ${jsonPath}`
        : `アップロード成功！\n動画ID: ${videoId}\n動画パス: ${videoPath}\nJSONパス: ${jsonPath}`;
      
      alert(message);
    } catch (error) {
      alert(`アップロードエラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsUploading(false);
    }
  };
  
  // 現在読み込まれている動画と編集したJSONを自動でSupabaseにアップロード
  const handleUploadToSupabase = async () => {
    if (!score) {
      alert("譜面データがありません");
      return;
    }
    
    try {
      // 現在読み込まれている動画ファイルを取得
      const videoResponse = await fetch(videoSrc);
      if (!videoResponse.ok) {
        throw new Error(`動画ファイルの取得に失敗しました: ${videoResponse.statusText}`);
      }
      
      const videoBlob = await videoResponse.blob();
      
      // BlobをFileオブジェクトに変換
      const videoFileName = score.videoPath || 'video.mp4';
      const videoFile = new File([videoBlob], videoFileName, { type: videoBlob.type || 'video/mp4' });
      
      // プロジェクト名を取得（score.nameがあればそれを使用、なければ動画ファイル名から取得）
      const videoName = score.name || videoFileName.replace(/\.[^/.]+$/, '') || '動画';
      
      await uploadToSupabase(videoFile, videoName);
    } catch (error) {
      alert(`動画ファイルの取得に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
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
  
  
  // トップページ
  if (screenMode === 'home' && !score && !hasValidScoreFromProps) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#1a1a2e",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          gap: "40px",
        }}
      >
        <h1 style={{ fontSize: "72px", marginBottom: "30px", fontWeight: "bold" }}>
          太鼓練習動画エディタ
        </h1>
        <div style={{ display: "flex", flexDirection: "column", gap: "36px", minWidth: "600px" }}>
          <button
            onClick={() => setScreenMode('new')}
            style={{
              padding: "30px 60px",
              backgroundColor: "#8b5cf6",
              color: "white",
              border: "none",
              borderRadius: "16px",
              cursor: "pointer",
              fontSize: "36px",
              fontWeight: "600",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#7c3aed";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#8b5cf6";
            }}
          >
            新規制作
          </button>
          <button
            onClick={() => {
              setScreenMode('select');
              loadVideoList();
            }}
            style={{
              padding: "30px 60px",
              backgroundColor: "#06b6d4",
              color: "white",
              border: "none",
              borderRadius: "16px",
              cursor: "pointer",
              fontSize: "36px",
              fontWeight: "600",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#0891b2";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#06b6d4";
            }}
          >
            レビュー & 編集
          </button>
        </div>
      </AbsoluteFill>
    );
  }
  
  // 新規制作ページ
  if (screenMode === 'new' && !score && !hasValidScoreFromProps) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#1a1a2e",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          gap: "30px",
          padding: "40px",
        }}
      >
        <h2 style={{ fontSize: "54px", marginBottom: "30px", fontWeight: "bold" }}>
          新規プロジェクト作成
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "36px", minWidth: "700px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label style={{ fontSize: "28px", fontWeight: "500" }}>
              プロジェクト名
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="プロジェクト名を入力"
              style={{
                padding: "18px 24px",
                fontSize: "24px",
                borderRadius: "12px",
                border: "3px solid #3b82f6",
                backgroundColor: "#0f172a",
                color: "white",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label style={{ fontSize: "28px", fontWeight: "500" }}>
              動画ファイル
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setSelectedVideoFile(file);
                }
              }}
              style={{
                padding: "18px 24px",
                fontSize: "24px",
                borderRadius: "12px",
                border: "3px solid #3b82f6",
                backgroundColor: "#0f172a",
                color: "white",
              }}
            />
            {selectedVideoFile && (
              <div style={{ fontSize: "20px", color: "#94a3b8", marginTop: "8px" }}>
                選択済み: {selectedVideoFile.name}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "24px", marginTop: "30px" }}>
            <button
              onClick={() => {
                setScreenMode('home');
                setProjectName('');
                setSelectedVideoFile(null);
              }}
              style={{
                padding: "20px 40px",
                backgroundColor: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "12px",
                cursor: "pointer",
                fontSize: "24px",
                fontWeight: "500",
                flex: 1,
              }}
            >
              キャンセル
            </button>
            <button
              onClick={initializeNewProject}
              disabled={!projectName.trim() || !selectedVideoFile}
              style={{
                padding: "20px 40px",
                backgroundColor: (!projectName.trim() || !selectedVideoFile) ? "#666" : "#8b5cf6",
                color: "white",
                border: "none",
                borderRadius: "12px",
                cursor: (!projectName.trim() || !selectedVideoFile) ? "not-allowed" : "pointer",
                fontSize: "24px",
                fontWeight: "500",
                flex: 1,
              }}
            >
              作成して編集開始
            </button>
          </div>
        </div>
      </AbsoluteFill>
    );
  }
  
  // 既存プロジェクト選択ページ
  if (screenMode === 'select' && !score && !hasValidScoreFromProps) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#1a1a2e",
          display: "flex",
          flexDirection: "column",
          color: "white",
          padding: "40px",
        }}
      >
        <div style={{ marginBottom: "40px" }}>
          <button
            onClick={() => setScreenMode('home')}
            style={{
              padding: "16px 32px",
              backgroundColor: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "24px",
              marginBottom: "30px",
            }}
          >
            ← 戻る
          </button>
          <h2 style={{ fontSize: "54px", fontWeight: "bold" }}>
            プロジェクトを選択
          </h2>
        </div>
        {isLoadingVideos ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
            <div style={{ fontSize: "36px" }}>読み込み中...</div>
          </div>
        ) : videoList.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
            <div style={{ fontSize: "36px", color: "#94a3b8" }}>
              保存されているプロジェクトがありません
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
              gap: "30px",
              overflowY: "auto",
              padding: "30px 0",
            }}
          >
            {videoList.map((video) => (
              <div
                key={video.id}
                onClick={() => loadProjectFromSupabase(video)}
                style={{
                  padding: "36px",
                  backgroundColor: "#0f172a",
                  borderRadius: "16px",
                  border: "3px solid #3b82f6",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#1e293b";
                  e.currentTarget.style.borderColor = "#60a5fa";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#0f172a";
                  e.currentTarget.style.borderColor = "#3b82f6";
                }}
              >
                <div style={{ fontSize: "32px", fontWeight: "600", marginBottom: "12px" }}>
                  {video.name}
                </div>
                <div style={{ fontSize: "22px", color: "#94a3b8", marginBottom: "8px" }}>
                  ID: {video.id}
                </div>
                {video.created_at && (
                  <div style={{ fontSize: "18px", color: "#64748b" }}>
                    {new Date(video.created_at).toLocaleString('ja-JP')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </AbsoluteFill>
    );
  }
  
  // 譜面データが読み込まれるまで待つ（編集画面）
  // scoreFromPropsが読み込まれるまで待つ
  if (!score && hasValidScoreFromProps) {
    // scoreが読み込まれるまで編集画面のレイアウトを維持
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
  
  // scoreが存在しない場合は、トップページに戻る
  if (!score && !hasValidScoreFromProps) {
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

  // 編集画面
  // （上記の条件チェックで既にスキップされているが、念のため明示的に確認）
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1a1a2e",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* キー操作ガイド（左上） */}
      {!hideUI && (
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
      )}
      
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
        {videoSrc ? (
          <OffthreadVideo
            src={videoSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
            startFrom={0}
            volume={1}
            muted={false}
            onError={() => {
              // エラーは無視（動画読み込みエラーはユーザーに表示しない）
            }}
          />
        ) : (
          <div style={{ color: "white", fontSize: 24 }}>
            動画を読み込み中...
          </div>
        )}
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
              frame={note.frame}
            />
          );
        })}
      </div>
      
      {/* 編集UI（Remotion Studio環境でのみ表示） */}
      {typeof window !== "undefined" && !hideUI && (
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
              {showSelectedNoteAnimation ? "選択ノーツ表示ON" : "選択ノーツ表示OFF"}
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
              onClick={moveSelectedNoteToCurrentTime}
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
              現在の位置に選択したノーツを移動
            </button>
            
            <button
              onClick={handleUploadToSupabase}
              disabled={!score || isUploading}
              style={{
                padding: "14px",
                backgroundColor: (!score || isUploading) ? "#666" : "#06b6d4",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: (!score || isUploading) ? "not-allowed" : "pointer",
                fontSize: "16px",
                fontWeight: "500",
                marginTop: "8px",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                if (score && !isUploading) {
                  e.currentTarget.style.backgroundColor = "#0891b2";
                }
              }}
              onMouseLeave={(e) => {
                if (score && !isUploading) {
                  e.currentTarget.style.backgroundColor = "#06b6d4";
                }
              }}
            >
              {isUploading ? "アップロード中..." : "譜面をアップロードして保存"}
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
