# taiko-practice

太鼓練習のための太鼓の達人っぽい動画を作るツール

## プロジェクト概要

このプロジェクトは、小太鼓と大太鼓を用いた民族太鼓の練習用動画を作成するためのツールです。

### 目的

太鼓の達人風のUIで、「このタイミングで左手を叩く」「右手で叩く」といった指示を視覚的に表示する練習用動画を生成します。これにより、民族太鼓の初学者が正しいタイミングと手順を学べるようになります。

### 主な機能

1. **動画解析による譜面生成**
   - 既存の太鼓演奏動画を解析
   - 音声から打撃音を検出し、叩いたタイミング（秒数）を特定
   - そのタイミングのフレーム画像から左手/右手を判別
   - 譜面データ（タイミングと叩く手の情報）をコードとして出力

2. **練習用動画の生成**
   - [Remotion](https://www.remotion.dev/)を使用して動画を作成
   - 元動画の下部にノーツUIをオーバーレイ表示
   - 太鼓の達人風のUIで叩くタイミングを視覚的に表示
   - 判定ラインは視覚的な目安として表示（実際の判定処理は不要）
   - 左手・右手の区別を色分けなどで明示

### ワークフロー

```
演奏動画 → 動画解析 → 譜面データ生成 → Remotionで練習動画作成
```

## セットアップ

### 必要なシステム依存

- Node.js (v18以上)
- Python (v3.10以上)
- ffmpeg (システムにインストール)

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```

### インストール

```bash
# Node.jsパッケージ
npm install

# Python仮想環境とパッケージ
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 使い方

### クイックスタート

```bash
# 1. 動画を public/videos/ に配置
cp your_video.mp4 public/videos/

# 2. 動画を解析して譜面データを生成
source venv/bin/activate
python scripts/analyze.py public/videos/your_video.mp4 -o public/score.json

# 3. Remotion Studioでプレビュー
npm start
# ブラウザで http://localhost:3000 にアクセス

# 4. 練習動画を出力
npm run build
# out/video.mp4 に出力されます
```

### 詳細な手順

#### Step 1: 動画解析（譜面データ生成）

演奏動画から打撃タイミングを検出し、譜面データを生成します。

```bash
source venv/bin/activate
python scripts/analyze.py <動画ファイル> -o public/score.json
```

**オプション:**
- `-o, --output`: 出力ファイルパス（デフォルト: score.json）
- `--threshold`: 打撃検出の感度（0.0-1.0、デフォルト: 0.5）

#### Step 2: 練習動画のプレビュー

Remotion Studioを起動して、ブラウザでリアルタイムプレビューできます。

```bash
npm start
```

ブラウザで `http://localhost:3000` にアクセスすると：
- 再生/一時停止ボタンで動画を制御
- タイムラインをドラッグして任意の位置にジャンプ
- フレーム単位での確認が可能

#### Step 3: 練習動画の出力

最終的な動画ファイルをレンダリングします。

```bash
npm run build
```

出力先: `out/video.mp4`（1920x1080、30fps）

---

## 譜面データ形式

`public/score.json` の形式：

```json
{
  "videoPath": "videos/your_video.mp4",
  "duration": 60,
  "fps": 30,
  "notes": [
    { "time": 0.5, "hand": "right" },
    { "time": 1.0, "hand": "left" },
    { "time": 1.5, "hand": "right" }
  ]
}
```

| フィールド | 型 | 説明 |
|-----------|------|------|
| `videoPath` | string | 元動画のパス（public/からの相対パス） |
| `duration` | number | 動画の長さ（秒） |
| `fps` | number | フレームレート |
| `notes` | array | ノーツ（打撃）のリスト |
| `notes[].time` | number | 打撃タイミング（秒） |
| `notes[].hand` | "left" \| "right" | 叩く手 |

---

## UI仕様

### 画面構成

```
┌─────────────────────────────────────┐
│                                     │
│           元動画エリア               │
│         (演奏動画を表示)             │
│                                     │
├─────────────────────────────────────┤
│  │  ●→  ●→  ●→               │
│  │  ノーツが右から左へ流れる        │
│  判定ライン                         │
└─────────────────────────────────────┘
```

### ノーツの色分け

- **右手**: 赤色 (#ef4444)
- **左手**: 青色 (#3b82f6)

### パラメータ調整

`src/TaikoPractice.tsx` で以下の定数を変更できます：

```typescript
const JUDGE_LINE_X = 150;        // 判定ラインのX座標（px）
const NOTE_APPROACH_TIME = 2;    // ノーツが到達するまでの時間（秒）
const NOTE_AREA_HEIGHT = 200;    // ノーツUIエリアの高さ（px）
```
