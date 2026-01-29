# レンダリング機能の詳細まとめ

## 概要

このプロジェクトには、**編集用コンポーネント**（`TaikoPractice`）と**レンダリング専用コンポーネント**（`TaikoPracticeRender`）の2つのCompositionが実装されています。

- **編集用**: Remotion Studio環境で使用。Blob URLやブラウザAPIを使用可能
- **レンダリング用**: CLI/Node.js環境で使用。Blob URL禁止、Supabase StorageのURLを直接使用

---

## 1. アーキテクチャ

### 1.1 2つのComposition

#### `TaikoPractice` (編集用)
- **ID**: `TaikoPractice`
- **用途**: Remotion Studioでの編集・プレビュー
- **環境**: ブラウザ環境（Studio）
- **特徴**:
  - Blob URLを使用可能
  - Supabase SDKを使用して動画をダウンロード可能
  - インタラクティブな編集機能あり

#### `TaikoPracticeRender` (レンダリング専用)
- **ID**: `TaikoPracticeRender`
- **用途**: CLI/Node.js環境での動画レンダリング
- **環境**: Node.js環境（CLI）
- **特徴**:
  - Blob URLを一切使用しない
  - Supabase Storageのpublic URLを直接使用
  - `useState`, `useEffect`などのブラウザAPIを最小限に
  - propsで`score`と`videoUrl`を必須で受け取る

---

## 2. レンダリング専用コンポーネント (`TaikoPracticeRender.tsx`)

### 2.1 重要な制約

```typescript
/**
 * ⚠️ 重要: このコンポーネントを使用するには、必ず以下のpropsを設定してください:
 * - CLI: --input-props='{"score": {...}, "videoUrl": "https://..."}'
 * - Studio: Render UIの「Props」タブで score と videoUrl を設定
 * 
 * 絶対条件:
 * - Blob URLを一切使用しない
 * - URL.createObjectURL(), Blob, supabase.storage.download()を呼ばない
 * - useState, useEffectなどのブラウザ専用APIを最小限に
 * - propsで渡されたvideoUrl（Supabase StorageのURL）をそのまま使用
 * - scoreもpropsから取得
 * - windowオブジェクトやSupabase SDKは使用しない
 */
```

### 2.2 Props

```typescript
interface TaikoPracticeRenderProps {
  score: Score;        // 必須: 譜面データ
  videoUrl: string;   // 必須: Supabase Storageのpublic URL
}
```

### 2.3 エラーハンドリング

- `score`が未設定の場合、即座にエラーをスロー
- `videoUrl`が未設定または空文字の場合、即座にエラーをスロー
- エラーメッセージには、CLI/Studioでの設定方法を明記

### 2.4 レンダリング時の動作

1. **動画表示**: `OffthreadVideo`コンポーネントで`videoUrl`を直接使用
2. **ノーツ表示**: `score.notes`から現在フレームに表示すべきノーツをフィルタリング
3. **通過ノーツ表示**: レンダリング時は`showPassedNotes = false`（通過したノーツは非表示）
4. **判定ラインエフェクト**: ノーツが判定ラインに触れたタイミングで10フレーム間エフェクトを表示

### 2.5 ノーツのアニメーション

- **開始位置**: 画面右端から90%の位置（`startX = width * 0.9`）
- **判定ライン位置**: 画面左から25%の位置（`judgeLineX = width * 0.25`）
- **プレビュー時間**: 3秒前からノーツを表示（`notePreviewSeconds = 3`）
- **速度計算**: `(startX - endX) / notePreviewSeconds`で計算

---

## 3. Root.tsxでの設定

### 3.1 メタデータ計算 (`calculateMetadata`)

#### `TaikoPractice` (編集用)
```typescript
calculateMetadata={async (props: TaikoPracticeProps) => {
  // props.scoreまたはwindow.__TAIKO_PRACTICE_SCORE__から取得
  // score.durationとscore.fpsからdurationInFramesを計算
  // デフォルト値: 900フレーム
}}
```

#### `TaikoPracticeRender` (レンダリング用)
```typescript
calculateMetadata={async (props: TaikoPracticeRenderProps) => {
  // props.scoreが必須（無い場合はエラー）
  // props.videoUrlが必須（無い場合はエラー）
  // score.durationとscore.fpsが必須（無効な場合はエラー）
  // durationInFrames = Math.ceil(score.duration * score.fps)
}}
```

### 3.2 スキーマ定義

#### 編集用スキーマ (`taikoPracticeSchema`)
```typescript
{
  scoreFile?: string;      // 譜面ファイル名（publicフォルダ内）
  score?: Score;           // 譜面データ（直接指定）
}
```

#### レンダリング用スキーマ (`taikoPracticeRenderSchema`)
```typescript
{
  score: Score;            // 必須: 譜面データ
  videoUrl: string;        // 必須: Supabase Storageのpublic URL
}
```

---

## 4. Supabase連携

### 4.1 Supabaseクライアント (`src/lib/supabase.ts`)

**環境変数の読み込み**:
- `process.env`（Remotion/Webpack環境）
- `import.meta.env`（Vite環境）
- `window.__ENV__`（ブラウザ環境）

**環境変数**:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4.2 Score型の拡張

```typescript
interface Score {
  name?: string;
  videoPath: string;
  supabaseProjectId?: string;      // SupabaseのプロジェクトID
  supabaseVideoPath?: string;      // Supabase Storageの動画パス
  supabaseJsonPath?: string;       // Supabase StorageのJSONパス
  duration: number;
  fps: number;
  notes: Note[];
}
```

### 4.3 プロジェクト読み込み時の処理

1. Supabase Storageから動画とJSONファイルをダウンロード
2. JSONをパースして`Score`オブジェクトに変換
3. `supabaseProjectId`, `supabaseVideoPath`, `supabaseJsonPath`を`score`に保存
4. 動画をBlob URLに変換（編集画面でのみ使用）

---

## 5. レンダリング実行方法

### 5.1 Remotion Studioから実行

1. **「動画の出力準備」ボタンをクリック**
   - `setScreenMode('edit')`でedit画面に強制切り替え
   - `setHideUI(true)`でUIを非表示
   - Remotion StudioのレンダリングUIを開く

2. **Compositionを選択**
   - `TaikoPracticeRender`を選択

3. **Propsを設定**
   - `score`: 譜面データ（JSONオブジェクト）
   - `videoUrl`: Supabase Storageのpublic URL（例: `https://xxx.supabase.co/storage/v1/object/public/assets/videos/xxx.mp4`）

4. **レンダリング開始**

### 5.2 CLIから実行

```bash
remotion render TaikoPracticeRender out/video.mp4 \
  --input-props='{
    "score": {
      "name": "プロジェクト名",
      "videoPath": "video.mp4",
      "duration": 30,
      "fps": 30,
      "notes": [...]
    },
    "videoUrl": "https://xxx.supabase.co/storage/v1/object/public/assets/videos/xxx.mp4"
  }'
```

### 5.3 レンダリング設定 (`remotion.config.ts`)

```typescript
import { Config } from "@remotion/cli/config";
import dotenv from "dotenv";
import path from "path";

// .envファイルを読み込む
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
```

---

## 6. 動作フロー

### 6.1 プロジェクト読み込み時

```
1. Supabaseから動画一覧を取得
2. プロジェクトを選択
3. Supabase Storageから動画とJSONをダウンロード
4. JSONをパースしてscoreに変換
5. supabaseProjectId, supabaseVideoPath, supabaseJsonPathをscoreに保存
6. 動画をBlob URLに変換（編集画面でのみ使用）
7. 編集画面に遷移
```

### 6.2 レンダリング時

```
1. 「動画の出力準備」ボタンをクリック
2. Remotion StudioのレンダリングUIを開く
3. TaikoPracticeRenderを選択
4. PropsでscoreとvideoUrlを設定
   - score: 現在の譜面データ（supabaseVideoPath, supabaseJsonPathを含む）
   - videoUrl: Supabase Storageのpublic URL（score.supabaseVideoPathから生成）
5. calculateMetadataでdurationInFramesを計算
6. TaikoPracticeRenderコンポーネントでレンダリング
   - OffthreadVideoでvideoUrlを直接使用
   - score.notesからノーツを表示
   - アニメーションを適用
7. 動画ファイルを出力
```

---

## 7. 重要な注意事項

### 7.1 Blob URLの制約

- **レンダリング時**: Blob URLは使用不可（Node.js環境では動作しない）
- **編集時**: Blob URLを使用可能（ブラウザ環境）

### 7.2 Supabase StorageのURL形式

レンダリング時は、Supabase Storageの**public URL**を使用する必要があります：

```
https://{project-id}.supabase.co/storage/v1/object/public/{bucket}/{path}
```

例:
```
https://abcdefgh.supabase.co/storage/v1/object/public/assets/videos/basunotori.mp4
```

### 7.3 エラーハンドリング

- propsが未設定の場合、即座にエラーをスロー（デフォルト値は設定しない）
- エラーメッセージには、CLI/Studioでの設定方法を明記
- デバッグ用のログを出力（開発環境のみ）

---

## 8. ファイル構成

```
src/
├── TaikoPractice.tsx          # 編集用コンポーネント
├── TaikoPracticeRender.tsx    # レンダリング専用コンポーネント
├── Root.tsx                    # Remotion Root（2つのCompositionを定義）
├── schema.ts                   # Zodスキーマ定義
├── types/
│   └── score.ts                # Score型定義
└── lib/
    └── supabase.ts             # Supabaseクライアント設定

remotion.config.ts              # Remotion設定（.env読み込み）
SUPABASE_RENDERING_GUIDE.md    # Supabaseレンダリングガイド
```

---

## 9. 依存関係

```json
{
  "dependencies": {
    "@remotion/cli": "^4.0.407",
    "@remotion/renderer": "^4.0.407",
    "@supabase/supabase-js": "^2.91.1",
    "remotion": "^4.0.407",
    "zod": "3.22.3"
  }
}
```

---

## 10. まとめ

レンダリング機能は、**編集環境とレンダリング環境を完全に分離**することで、Node.js環境での安定した動画レンダリングを実現しています。

- **編集時**: `TaikoPractice`コンポーネントでBlob URLやSupabase SDKを使用
- **レンダリング時**: `TaikoPracticeRender`コンポーネントでSupabase Storageのpublic URLを直接使用

この設計により、CLI/Node.js環境でもSupabaseから動画と譜面データを読み込んで、太鼓の達人風の練習用動画を生成できます。
