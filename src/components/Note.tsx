import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import type { NoteHand, NoteImageFile } from "../types/score";

interface NoteProps {
  x: number;
  hand: NoteHand;
  imageFile?: NoteImageFile;
  onClick?: () => void;
  isSelected?: boolean;
}

/**
 * ノーツ（流れてくる音符）
 * 画像ファイルが指定されている場合はそれを使用、なければhandに基づいて決定
 */
export const Note: React.FC<NoteProps> = ({ x, hand, imageFile, onClick, isSelected = false }) => {
  const frame = useCurrentFrame();
  
  // 画像のパスを決定
  const getImageSrc = (): string => {
    if (imageFile) {
      return staticFile(`images/notes/${imageFile}`);
    }
    // デフォルト: handに基づいて決定
    // left → red_left_1, right → blue_right_1
    return hand === "left" 
      ? staticFile("images/notes/red_left_1.png")
      : staticFile("images/notes/blue_right_1.png");
  };

  const imageSrc = getImageSrc();
  
  // 画像ファイルに基づいて基本サイズを決定
  const getBaseSize = (): number => {
    if (imageFile) {
      if (imageFile === "big.png") {
        return 100;
      } else if (imageFile === "red_left_1.png" || imageFile === "blue_right_1.png") {
        return 80;
      } else if (imageFile === "red_left_2.png" || imageFile === "blue_right_2.png") {
        return 60;
      }
    }
    // デフォルト: handに基づいて決定（red_left_1 または blue_right_1）
    return 80;
  };
  
  const baseSize = getBaseSize();
  
  // 選択中のノーツのエフェクト（パルスアニメーション）
  const pulseScale = isSelected ? 1 + Math.sin(frame * 0.2) * 0.15 : 1;
  const pulseBrightness = isSelected ? 1.5 + Math.sin(frame * 0.2) * 0.3 : 1;
  const ringScale = isSelected ? 1 + Math.sin(frame * 0.2) * 0.1 : 1;
  const ringOpacity = isSelected ? 0.7 + Math.sin(frame * 0.2) * 0.3 : 0;
  const ringSize = baseSize + 20; // リングのサイズは基本サイズより20px大きい

  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        left: x,
        top: "50%",
        transform: `translateY(-50%) scale(${pulseScale})`,
        width: baseSize,
        height: baseSize,
        cursor: onClick ? "pointer" : "default",
        zIndex: isSelected ? 20 : onClick ? 10 : 1,
        // 選択中のノーツにエフェクトを追加
        filter: isSelected 
          ? `brightness(${pulseBrightness}) drop-shadow(0 0 ${15 + Math.sin(frame * 0.2) * 5}px rgba(255, 255, 255, 0.9))`
          : "none",
      }}
    >
      <Img
        src={imageSrc}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
      {/* 選択中のノーツにリングを表示 */}
      {isSelected && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${ringScale})`,
            width: `${ringSize}px`,
            height: `${ringSize}px`,
            border: "3px solid rgba(255, 255, 255, 0.9)",
            borderRadius: "50%",
            pointerEvents: "none",
            opacity: ringOpacity,
          }}
        />
      )}
    </div>
  );
};
