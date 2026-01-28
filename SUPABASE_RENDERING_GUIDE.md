# Supabaseから動画と譜面データを持ってきてRemotionで出力する機能

このドキュメントは、Supabaseから動画と譜面データを読み込んでRemotionで出力するために必要なコード部分をまとめたものです。

## 1. 型定義 (`src/types/score.ts`)

```typescript
export interface Score {
  /** プロジェクト名（オプション） */
  name?: string;
  /** 元動画のパス */
  videoPath: string;
  /** SupabaseのプロジェクトID（レンダリング時に動画と譜面データを読み込むために使用） */
  supabaseProjectId?: string;
  /** Supabase Storageの動画パス（レンダリング時に使用） */
  supabaseVideoPath?: string;
  /** Supabase StorageのJSONパス（レンダリング時に使用） */
  supabaseJsonPath?: string;
  /** 動画の長さ（秒） */
  duration: number;
  /** フレームレート */
  fps: number;
  /** ノーツのリスト */
  notes: Note[];
}
```

## 2. スキーマ定義 (`src/schema.ts`)

```typescript
const scoreSchema = z.object({
  name: z.string().optional().describe("プロジェクト名（オプション）"),
  videoPath: z.string().describe("元動画のパス"),
  supabaseProjectId: z.string().optional().describe("SupabaseのプロジェクトID（レンダリング時に動画と譜面データを読み込むために使用）"),
  supabaseVideoPath: z.string().optional().describe("Supabase Storageの動画パス（レンダリング時に使用）"),
  supabaseJsonPath: z.string().optional().describe("Supabase StorageのJSONパス（レンダリング時に使用）"),
  duration: z.number().describe("動画の長さ（秒）"),
  fps: z.number().describe("フレームレート"),
  notes: z.array(noteSchema).describe("ノーツのリスト"),
});
```

## 3. Supabaseからプロジェクトを読み込む機能 (`src/TaikoPractice.tsx`)

### 3.1 Supabaseから動画とJSONを取得して編集画面に遷移

```typescript
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
    
    // Supabaseの情報をscoreに保存（レンダリング時に使用）
    scoreData.supabaseProjectId = videoInfo.id;
    scoreData.supabaseVideoPath = videoInfo.video_path;
    scoreData.supabaseJsonPath = videoInfo.json_path;
    
    // 動画をBlob URLに変換（videoDataはBlob）
    const blobUrl = URL.createObjectURL(videoData as Blob);
    
    // 既存のBlob URLをクリーンアップ
    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
    }
    
    setVideoBlobUrl(blobUrl);
    setVideoSrc(blobUrl);
    setScore(scoreData);
    setScreenMode('edit');
  } catch (error) {
    console.error('プロジェクトの読み込みに失敗しました:', error);
    alert(`プロジェクトの読み込みに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }
}, [videoBlobUrl]);
```

## 4. レンダリング時にSupabaseから動画を読み込む機能 (`src/TaikoPractice.tsx`)

```typescript
// 編集画面の場合のみ、既存のscoreFile/scoreFromPropsから読み込む
useEffect(() => {
  // レンダリング時は、scoreFromPropsを優先的に使用
  if (isRenderingMode && scoreFromProps) {
    setScore(scoreFromProps);
    return;
  }
  
  // レンダリング時は、scoreFromPropsまたはSupabaseから読み込む
  // ローカルファイルからの読み込みは行わない（全てSupabaseで管理）
  if (isRenderingMode) {
    // scoreFromPropsが既に設定されている場合はスキップ
    if (scoreFromProps) {
      // scoreFromPropsにsupabaseVideoPathとsupabaseJsonPathが含まれている場合、動画を読み込む
      if (scoreFromProps.supabaseVideoPath && scoreFromProps.supabaseJsonPath && !videoSrc) {
        // Supabaseから動画と譜面データを読み込む
        supabase.storage
          .from('assets')
          .download(scoreFromProps.supabaseVideoPath)
          .then(({ data: videoData, error: videoError }) => {
            if (videoError || !videoData) {
              console.error('[Render] 動画ファイルの読み込みエラー:', videoError);
              return;
            }
            // 動画をBlob URLに変換
            const blobUrl = URL.createObjectURL(videoData as Blob);
            setVideoBlobUrl(blobUrl);
            setVideoSrc(blobUrl);
          })
          .catch((error) => {
            console.error('[Render] 動画ファイルの読み込みエラー:', error);
          });
      }
      return;
    }
    // scoreFromPropsがない場合、scoreにsupabaseProjectIdが含まれている場合はSupabaseから読み込む
    if (score && score.supabaseProjectId && score.supabaseVideoPath && score.supabaseJsonPath) {
      // Supabaseから動画と譜面データを読み込む
      supabase.storage
        .from('assets')
        .download(score.supabaseVideoPath)
        .then(({ data: videoData, error: videoError }) => {
          if (videoError || !videoData) {
            console.error('[Render] 動画ファイルの読み込みエラー:', videoError);
            return;
          }
          // 動画をBlob URLに変換
          const blobUrl = URL.createObjectURL(videoData as Blob);
          setVideoBlobUrl(blobUrl);
          setVideoSrc(blobUrl);
        })
        .catch((error) => {
          console.error('[Render] 動画ファイルの読み込みエラー:', error);
        });
    }
    return;
  }
  
  // ... その他の処理
}, [scoreFile, scoreFromProps, screenMode, score, isRenderingMode]);
```

## 5. 「動画の出力準備」ボタン (`src/TaikoPractice.tsx`)

```typescript
{/* 動画の出力準備ボタン */}
<button
  onClick={async () => {
    if (!score) {
      alert('譜面データがありません');
      return;
    }
    
    setIsRendering(true);
    
    // 動画出力用の設定
    setShowPassedNotes(false); // 通過ノーツ表示をOFF
    setShowSelectedNoteAnimation(false); // 選択ノーツ表示を無効化
    setHideUI(true); // UIを非表示にする
    setScreenMode('edit'); // edit画面に強制切り替え（home, new, selectを非表示にする）
    
    try {
      // Remotion StudioのAPIを使用してレンダリングを開始
      if (typeof window !== "undefined") {
        // Remotion StudioのAPIを動的にインポート
        const studioModule = await import("@remotion/studio");
        
        // Studioの内部APIを使用してレンダリングを開始
        if (studioModule && (studioModule as any).openRenderModal) {
          (studioModule as any).openRenderModal('TaikoPractice');
          alert('レンダリング画面を開きました。');
        } else if ((window as any).remotionStudio) {
          const studio = (window as any).remotionStudio;
          if (studio.openRenderModal) {
            studio.openRenderModal('TaikoPractice');
            alert('レンダリング画面を開きました。');
          } else {
            // フォールバック: レンダリングUIを開くためにURLパラメータを使用
            window.location.hash = '#/render';
            alert('レンダリング画面を開きました。\n\nComposition: TaikoPractice を選択してレンダリングを開始してください。');
          }
        } else {
          // StudioのAPIが利用できない場合、URLハッシュを使用してレンダリングUIを開く
          window.location.hash = '#/render';
          alert('レンダリング画面を開きました。\n\nComposition: TaikoPractice を選択してレンダリングを開始してください。');
        }
      } else {
        alert('Remotion Studio環境で実行してください。');
      }
    } catch (error) {
      console.error('レンダリング開始エラー:', error);
      // エラーが発生した場合でも、レンダリングUIを開く
      if (typeof window !== "undefined") {
        window.location.hash = '#/render';
        alert('レンダリング画面を開きました。\n\nComposition: TaikoPractice を選択してレンダリングを開始してください。');
      }
    } finally {
      setIsRendering(false);
    }
  }}
  disabled={!score || isRendering}
>
  動画の出力準備
</button>
```

## 6. Supabaseクライアントの設定 (`src/lib/supabase.ts`)

```typescript
import { createClient } from '@supabase/supabase-js'

// Remotionでは環境変数の読み込み方法が異なる可能性があるため、両方をサポート
const getEnvVar = (key: string): string => {
  // 1. process.envから読み込み（Remotion/Webpack環境）
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[key];
    if (value && !value.includes('your_') && value !== '' && value.trim() !== '') {
      return value.trim();
    }
  }
  
  // 2. import.meta.envから読み込み（Vite環境）
  try {
    if (typeof import.meta !== 'undefined') {
      const env = (import.meta as any).env;
      if (env && env[key]) {
        const value = env[key];
        if (value && !value.includes('your_') && value !== '' && value.trim() !== '') {
          return value.trim();
        }
      }
    }
  } catch (e) {
    // import.metaが利用できない場合は無視
  }
  
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
```

### 環境変数の設定 (`.env`)

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## 7. Root.tsxでのメタデータ計算 (`src/Root.tsx`)

```typescript
calculateMetadata={async (props: TaikoPracticeProps) => {
  // propsからscoreを取得
  let score: Score | null = null;
  
  // scoreが直接指定されている場合のみ使用（Supabaseから読み込まれたデータ）
  // ローカルファイルからの読み込みは行わない（全てSupabaseで管理）
  if (props.score) {
    score = props.score;
  }

  // scoreにdurationとfpsが含まれている場合はそれを使用
  if (score && score.duration && score.fps) {
    const durationInFrames = Math.ceil(score.duration * score.fps);
    console.log(`譜面データから取得: 動画の長さ: ${score.duration}秒, フレーム数: ${durationInFrames}フレーム (@${score.fps}fps)`);
    return {
      durationInFrames,
    };
  }

  // scoreがない場合、またはduration/fpsがない場合はデフォルト値を返す
  // 動画ファイルはSupabaseから読み込まれるため、ローカルファイルからの読み込みは行わない
  if (!score || !score.duration || !score.fps) {
    console.log('譜面データが不完全なため、デフォルト値を使用: 900フレーム');
    return {
      durationInFrames: 900,
    };
  }
}}
```

## 7. Supabaseクライアントの設定 (`src/lib/supabase.ts`)

```typescript
import { createClient } from '@supabase/supabase-js'

// Remotionでは環境変数の読み込み方法が異なる可能性があるため、両方をサポート
const getEnvVar = (key: string): string => {
  // 1. process.envから読み込み（Remotion/Webpack環境）
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[key];
    if (value && !value.includes('your_') && value !== '' && value.trim() !== '') {
      return value.trim();
    }
  }
  
  // 2. import.meta.envから読み込み（Vite環境）
  try {
    if (typeof import.meta !== 'undefined') {
      const env = (import.meta as any).env;
      if (env && env[key]) {
        const value = env[key];
        if (value && !value.includes('your_') && value !== '' && value.trim() !== '') {
          return value.trim();
        }
      }
    }
  } catch (e) {
    // import.metaが利用できない場合は無視
  }
  
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
```

### 環境変数の設定 (`.env`)

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## 動作フロー

### 1. プロジェクト読み込み時
   - `loadProjectFromSupabase`が呼ばれる
   - Supabase Storageから動画とJSONファイルをダウンロード
   - `score`に`supabaseProjectId`, `supabaseVideoPath`, `supabaseJsonPath`を保存
   - 動画をBlob URLに変換して`videoSrc`に設定

### 2. レンダリング時
   - `isRenderingMode`が`true`になる
   - `scoreFromProps`または`score`に`supabaseVideoPath`が含まれている場合、Supabaseから動画をダウンロード
   - 動画をBlob URLに変換して`videoSrc`に設定
   - Remotionが`videoSrc`を使用して動画をレンダリング

### 3. 「動画の出力準備」ボタン押下時
   - `setScreenMode('edit')`でedit画面に強制切り替え
   - UIを非表示にする設定
   - Remotion StudioのレンダリングUIを開く

## 必要な依存関係

- `@supabase/supabase-js`: Supabaseクライアント
- `remotion`: Remotionフレームワーク
- `@remotion/media-utils`: 動画メタデータ取得用
