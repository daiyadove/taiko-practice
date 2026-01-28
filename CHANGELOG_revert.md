# 変更ログ: 「Supabase-only管理」と「動画の出力準備時の画面切り替え」実装時点までの変更

## 実装された変更内容

### 1. Supabase-only管理への移行

#### 1.1 `src/types/score.ts`
- `Score`インターフェースに以下を追加：
  - `supabaseProjectId?: string` - SupabaseのプロジェクトID
  - `supabaseVideoPath?: string` - Supabase Storageの動画パス
  - `supabaseJsonPath?: string` - Supabase StorageのJSONパス

#### 1.2 `src/schema.ts`
- `scoreSchema`に以下を追加：
  - `supabaseProjectId: z.string().optional()`
  - `supabaseVideoPath: z.string().optional()`
  - `supabaseJsonPath: z.string().optional()`

#### 1.3 `src/TaikoPractice.tsx`
- ローカルファイル（`staticFile("videos/...")`, `staticFile("score.json")`）への依存を削除
- `videoSrc`の初期値を空文字列に変更（`staticFile`を使用しない）
- `loadProjectFromSupabase`で`score`にSupabase情報を保存：
  ```typescript
  scoreData.supabaseProjectId = videoInfo.id;
  scoreData.supabaseVideoPath = videoInfo.video_path;
  scoreData.supabaseJsonPath = videoInfo.json_path;
  ```
- レンダリング時にSupabaseから動画を読み込む処理を追加（パスからダウンロード）

#### 1.4 `src/Root.tsx`
- `calculateMetadata`でローカルファイルからの読み込みを削除
- `score`が`props.score`として渡された場合のみ使用
- ローカルファイルからの読み込みは行わない

### 2. 「動画の出力準備」ボタン時の画面切り替え

#### 2.1 `src/TaikoPractice.tsx`
- 「動画の出力準備」ボタンの`onClick`ハンドラで以下を設定：
  ```typescript
  setScreenMode('edit'); // edit画面に強制切り替え
  setShowPassedNotes(false);
  setShowSelectedNoteAnimation(false);
  setHideUI(true);
  ```
- 画面の条件分岐を修正：
  - `home`, `new`, `select`画面は`!score && !scoreFromProps`の時のみ表示
  - レンダリング時は常に`edit`画面を表示

## 削除した変更（この時点以降に追加されたもの）

### 削除済み
1. ✅ `supabaseVideoUrl`と`supabaseJsonUrl`関連のコード - 削除完了
2. ✅ `localStorageScore`と`effectiveScoreFromProps`関連のコード - 削除完了
3. ✅ 「動画の出力準備」ボタンでのURL生成処理 - 削除完了
4. ✅ `Root.tsx`でのlocalStorageからの読み込み処理 - 削除完了

## 現在の状態

指定された時点（「Supabase-only管理」と「動画の出力準備時の画面切り替え」実装時点）まで戻しました。

### 保持されている機能
- Supabase-only管理（ローカルファイルへの依存なし）
- 「動画の出力準備」ボタンで`setScreenMode('edit')`を設定
- レンダリング時にSupabaseから動画を読み込む処理（パスからダウンロード）
- `Score`インターフェースに`supabaseProjectId`, `supabaseVideoPath`, `supabaseJsonPath`を含む

### 削除された機能
- `supabaseVideoUrl`と`supabaseJsonUrl`（URL生成処理）
- `localStorage`を使用したscoreの保存・読み込み
- `effectiveScoreFromProps`（`scoreFromProps`のみ使用）
