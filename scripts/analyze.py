#!/usr/bin/env python3
"""
太鼓練習動画の解析スクリプト

使い方:
    python scripts/analyze.py <動画ファイルパス> [--output score.json]

処理内容:
1. 動画から音声を抽出
2. 打撃音のタイミングを検出（オンセット検出）
3. 各タイミングのフレーム画像を抽出
4. 左手/右手を判別（※将来実装）
5. 譜面データ（JSON）を出力
"""

import argparse
import json
import os
import tempfile
from pathlib import Path
from typing import Optional

import cv2
import ffmpeg
import librosa
import numpy as np


def extract_audio(video_path: str, output_path: str) -> None:
    """動画から音声をWAVファイルとして抽出"""
    print(f"音声を抽出中: {video_path}")
    (
        ffmpeg
        .input(video_path)
        .output(output_path, ac=1, ar=22050)  # モノラル, 22050Hz
        .overwrite_output()
        .run(quiet=True)
    )
    print(f"音声抽出完了: {output_path}")


def detect_onsets(audio_path: str) -> list[float]:
    """音声から打撃音のタイミングを検出"""
    print("打撃音を検出中...")

    # 音声を読み込み
    y, sr = librosa.load(audio_path, sr=22050)

    # オンセット検出
    # 太鼓の打撃音は低周波の打撃音なので、適切なパラメータを設定
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        units='frames',
        backtrack=False,
    )

    # フレームを秒に変換
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)

    print(f"検出された打撃数: {len(onset_times)}")
    return onset_times.tolist()


def get_video_info(video_path: str) -> dict:
    """動画のメタ情報を取得"""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps if fps > 0 else 0
    cap.release()

    return {
        "fps": fps,
        "frame_count": frame_count,
        "duration": duration,
    }


def extract_frame(video_path: str, time_sec: float) -> Optional[np.ndarray]:
    """指定時刻のフレーム画像を抽出"""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_num = int(time_sec * fps)

    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
    ret, frame = cap.read()
    cap.release()

    return frame if ret else None


def determine_hand(frame: Optional[np.ndarray]) -> str:
    """
    フレーム画像から左手/右手を判別

    TODO: 画像解析による判別ロジックを実装
    現在はプレースホルダーとして交互に返す
    """
    # 将来的にはOpenCVやMLモデルで手の位置を検出
    # 今はランダムまたは交互で仮実装
    return "right"  # プレースホルダー


def analyze_video(video_path: str) -> dict:
    """動画を解析して譜面データを生成"""

    # 動画情報を取得
    video_info = get_video_info(video_path)
    print(f"動画情報: {video_info}")

    # 一時ファイルに音声を抽出
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        audio_path = tmp.name

    try:
        # 音声抽出
        extract_audio(video_path, audio_path)

        # 打撃音検出
        onset_times = detect_onsets(audio_path)

        # 各打撃タイミングでフレームを解析
        notes = []
        for i, time_sec in enumerate(onset_times):
            frame = extract_frame(video_path, time_sec)
            hand = determine_hand(frame)

            # 仮実装: 交互に左右を割り当て
            hand = "left" if i % 2 == 0 else "right"

            notes.append({
                "time": round(time_sec, 3),
                "hand": hand,
                "frame": int(time_sec * video_info["fps"]),
            })

        # 譜面データを構築
        score = {
            "videoPath": os.path.basename(video_path),
            "duration": round(video_info["duration"], 3),
            "fps": video_info["fps"],
            "notes": notes,
        }

        return score

    finally:
        # 一時ファイルを削除
        if os.path.exists(audio_path):
            os.remove(audio_path)


def main():
    parser = argparse.ArgumentParser(description="太鼓練習動画の解析")
    parser.add_argument("video", help="入力動画ファイルのパス")
    parser.add_argument("-o", "--output", default="score.json", help="出力JSONファイルのパス")
    args = parser.parse_args()

    if not os.path.exists(args.video):
        print(f"エラー: ファイルが見つかりません: {args.video}")
        return 1

    print(f"動画を解析中: {args.video}")
    score = analyze_video(args.video)

    # JSON出力
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(score, f, ensure_ascii=False, indent=2)

    print(f"\n譜面データを出力しました: {args.output}")
    print(f"検出されたノーツ数: {len(score['notes'])}")

    return 0


if __name__ == "__main__":
    exit(main())
