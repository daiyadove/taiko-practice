import React from "react";
import { Img, staticFile } from "remotion";

interface JudgeLineProps {
  x: number;
  height: number;
  showEffect?: boolean; // エフェクト表示フラグ
  effectStartFrame?: number | null; // エフェクト開始フレーム
  currentFrame: number; // 現在のフレーム
}

/**
 * 判定ライン（ノーツを叩くポイント）
 * big.pngの画像を使用し、110pxサイズ、60%黒ずみ（透明度40%）
 */
export const JudgeLine: React.FC<JudgeLineProps> = ({ x, height, showEffect = false, effectStartFrame = null, currentFrame }) => {
  const judgeBoxSize = 110;
  const centerY = height / 2;
  
  // エフェクトの減衰計算（1→0）
  // エフェクト開始フレームから現在フレームまでの経過フレーム数
  const effectDuration = 10; // 10フレーム間
  const elapsedFrames = effectStartFrame !== null ? currentFrame - effectStartFrame : effectDuration;
  
  // 巻き戻し時の対応：経過フレーム数が負の値や10より大きい場合はエフェクトを無効化
  const isValidEffect = showEffect && 
    effectStartFrame !== null && 
    elapsedFrames >= 0 && 
    elapsedFrames <= effectDuration;
  
  // 1から0に減衰（経過フレーム数が0の時は1、effectDurationの時は0）
  const glowIntensity = isValidEffect
    ? Math.max(0, 1 - (elapsedFrames / effectDuration))
    : 0;
  
  // エフェクトの値
  const effectScale = 1; // 拡大縮小なし
  const effectBrightness = isValidEffect ? 1 + glowIntensity * 2.0 : 1; // 1から3.0に変化
  const effectRingOpacity = glowIntensity; // 1から0に減衰
  
  return (
    <div
      style={{
        position: "absolute",
        left: x - judgeBoxSize / 2, // 中央に配置
        top: centerY - judgeBoxSize / 2,
        width: judgeBoxSize,
        height: judgeBoxSize,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* 光るグロー背景（エフェクト時のみ） */}
      {isValidEffect && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${effectScale * 1.3})`,
            width: `${judgeBoxSize}px`,
            height: `${judgeBoxSize}px`,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(255, 255, 255, ${0.6 + glowIntensity * 0.3}) 0%, rgba(255, 255, 200, ${0.3 + glowIntensity * 0.2}) 50%, transparent 100%)`,
            pointerEvents: "none",
            opacity: effectRingOpacity,
            zIndex: 0,
            filter: `blur(${10 + glowIntensity * 5}px)`,
          }}
        />
      )}
      
      {/* big.pngの画像 */}
      <Img
        src={staticFile("images/notes/big.png")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          position: "relative",
          zIndex: 1,
          transform: `scale(${effectScale})`,
          filter: isValidEffect 
            ? `brightness(${effectBrightness}) drop-shadow(0 0 ${15 + glowIntensity * 20}px rgba(255, 255, 255, ${0.8 + glowIntensity * 0.2})) drop-shadow(0 0 ${25 + glowIntensity * 30}px rgba(255, 255, 200, ${0.6 + glowIntensity * 0.3}))`
            : "none",
          transition: "transform 0.1s, filter 0.1s",
        }}
      />
      {/* 60%黒ずみのオーバーレイ（画像の上に配置、エフェクト時は薄く） */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: isValidEffect ? `rgba(0, 0, 0, ${0.7 - glowIntensity * 0.3})` : "rgba(0, 0, 0, 0.7)",
          borderRadius: "50%",
          zIndex: 2,
          pointerEvents: "none", // クリックイベントを無効化
          transition: "background-color 0.1s",
        }}
      />
    </div>
  );
};
