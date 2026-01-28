const fs = require('fs');
const path = require('path');

const videosDir = path.join(__dirname, '../public/videos');
const outputFile = path.join(__dirname, '../public/videos-list.json');

try {
  const files = fs.readdirSync(videosDir);
  const videoFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.mp4', '.mov', '.webm', '.avi'].includes(ext);
  });

  const videosList = {
    videos: videoFiles.map(file => `videos/${file}`),
    defaultVideo: videoFiles.length > 0 ? `videos/${videoFiles[0]}` : null
  };

  fs.writeFileSync(outputFile, JSON.stringify(videosList, null, 2), 'utf-8');
  console.log(`動画ファイルリストを生成しました: ${outputFile}`);
  console.log(`検出された動画: ${videoFiles.length}個`);
  if (videoFiles.length > 0) {
    console.log(`デフォルト動画: ${videosList.defaultVideo}`);
  }
} catch (error) {
  console.error('エラー:', error);
  // エラー時は空のリストを生成
  fs.writeFileSync(outputFile, JSON.stringify({ videos: [], defaultVideo: null }, null, 2), 'utf-8');
}
