# 本番環境デプロイガイド

このプロジェクトを本番環境にデプロイする際の推奨方法と選択肢をまとめています。

## プロジェクト構成の確認

- **フロントエンド**: Remotion Studio（編集・プレビュー用）
- **バックエンド**: Remotion CLI（動画レンダリング）
- **データストレージ**: Supabase（動画・譜面データ）
- **解析ツール**: Python（動画解析）

## デプロイ方法の選択肢

### 1. **推奨: Vercel + 別サーバー（動画レンダリング用）**

#### 構成
- **Vercel**: Remotion Studio（フロントエンド）のホスティング
- **別サーバー**: Remotion CLIでの動画レンダリング（VPS/EC2等）

#### メリット
- ✅ Remotion Studioは簡単にデプロイ可能
- ✅ 動画レンダリングはリソースが必要なため、別サーバーで柔軟に対応可能
- ✅ コスト効率が良い（Vercelは無料枠あり）

#### デプロイ手順

##### Vercelでのデプロイ（Studio用）

```bash
# Vercel CLIのインストール
npm i -g vercel

# プロジェクトのデプロイ
vercel

# 環境変数の設定（VercelダッシュボードまたはCLI）
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

**注意点**: Remotion Studioはブラウザで動作するため、Vercelの静的ホスティングで問題なく動作します。

##### 動画レンダリングサーバーのセットアップ

**オプションA: Dockerコンテナ（推奨）**

```dockerfile
# Dockerfile
FROM node:18

# システム依存のインストール
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Node.js依存のインストール
COPY package*.json ./
RUN npm ci

# Python依存のインストール
COPY requirements.txt ./
RUN pip3 install -r requirements.txt

# アプリケーションコードのコピー
COPY . .

# レンダリング用のエントリーポイント
CMD ["node", "server.js"]
```

```javascript
// server.js (簡易APIサーバー例)
const express = require('express');
const { exec } = require('child_process');
const app = express();

app.use(express.json());

app.post('/render', async (req, res) => {
  const { score, videoUrl } = req.body;
  
  // Remotion CLIでレンダリング
  const command = `npx remotion render TaikoPracticeRender out/video.mp4 --props='${JSON.stringify({ score, videoUrl })}'`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    // レンダリング完了後、Supabase Storageにアップロード
    res.json({ success: true, output: stdout });
  });
});

app.listen(3000);
```

**オプションB: Railway / Render.com**

- RailwayやRender.comなどのPaaSを使用
- Dockerfileを用意すれば簡単にデプロイ可能
- 自動スケーリングに対応

---

### 2. **AWS構成（本格運用向け）**

#### 構成
- **CloudFront + S3**: Remotion Studioのホスティング
- **ECS/Fargate**: Dockerコンテナで動画レンダリング
- **Lambda**: レンダリングジョブのトリガー（オプション）
- **SQS**: レンダリングジョブのキュー管理（オプション）

#### メリット
- ✅ スケーラブル
- ✅ 高可用性
- ✅ 本格的な運用に適している

#### デメリット
- ❌ セットアップが複雑
- ❌ コストが高い

---

### 3. **単一サーバー構成（小規模運用向け）**

#### 構成
- **VPS（DigitalOcean, Linode等）**: すべてを1台のサーバーで実行

#### セットアップ例

```bash
# サーバーにSSH接続後

# Node.jsのインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# ffmpegのインストール
sudo apt-get install -y ffmpeg

# Pythonのインストール
sudo apt-get install -y python3 python3-pip

# プロジェクトのクローン
git clone <your-repo-url>
cd taiko-practice

# 依存関係のインストール
npm install
pip3 install -r requirements.txt

# PM2でプロセス管理
npm install -g pm2

# Remotion Studioを起動
pm2 start npm --name "remotion-studio" -- start

# レンダリングAPIサーバーを起動（上記のserver.js）
pm2 start server.js --name "render-api"

# Nginxでリバースプロキシ設定
sudo apt-get install -y nginx
```

**Nginx設定例** (`/etc/nginx/sites-available/taiko-practice`):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Remotion Studio
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # レンダリングAPI
    location /api/render {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

---

### 4. **Docker Compose構成（開発・小規模運用向け）**

#### 構成
- Docker Composeで全てのサービスを管理

```yaml
# docker-compose.yml
version: '3.8'

services:
  studio:
    build: .
    ports:
      - "3000:3000"
    environment:
      - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
    command: npm start
    volumes:
      - ./out:/app/out

  render-api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
    command: node server.js
    volumes:
      - ./out:/app/out
```

---

## 環境変数の設定

どの方法でも、以下の環境変数を設定する必要があります：

```bash
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## 推奨デプロイ方法（規模別）

### 小規模・個人利用
→ **Vercel + Railway/Render.com** または **単一VPS**

### 中規模・チーム利用
→ **Vercel + Dockerコンテナ（Railway/Render.com）**

### 大規模・本格運用
→ **AWS構成** または **GCP/Azure**

## 注意事項

1. **動画レンダリングのリソース要件**
   - CPU: 4コア以上推奨
   - メモリ: 8GB以上推奨
   - ストレージ: レンダリング出力用に十分な容量

2. **Supabase Storageの設定**
   - 動画ファイルは大きいため、ストレージ容量に注意
   - CDN設定を有効化してパフォーマンス向上

3. **セキュリティ**
   - レンダリングAPIには認証を追加することを推奨
   - SupabaseのRow Level Security (RLS)を適切に設定

4. **コスト管理**
   - 動画レンダリングはリソースを大量に消費するため、使用量を監視
   - 不要なレンダリングを防ぐためのキューシステムの導入を検討

## 次のステップ

1. デプロイ方法を選択
2. 環境変数を設定
3. テストデプロイを実行
4. パフォーマンステスト
5. 本番環境への移行
