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

### 1. 動画解析（譜面データ生成）

```bash
source venv/bin/activate
python scripts/analyze.py <動画ファイル> -o score.json
```

### 2. 練習動画のプレビュー

```bash
npm start  # Remotion Studio起動
```

### 3. 練習動画の出力

```bash
npm run build  # out/video.mp4 に出力
```
