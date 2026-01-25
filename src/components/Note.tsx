import React from "react";
import { Img, staticFile } from "remotion";
import type { NoteHand } from "../types/score";

interface NoteProps {
  x: number;
  hand: NoteHand;
}

/**
 * ノーツ（流れてくる音符）
 * 左手=blue_right_1.png、右手=red_left_1.png
 */
export const Note: React.FC<NoteProps> = ({ x, hand }) => {
  // 画像のパスを決定
  const imageSrc = hand === "left" 
    ? staticFile("images/notes/blue_right_1.png")
    : staticFile("images/notes/red_left_1.png");

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: "50%",
        transform: "translateY(-50%)",
        width: 60,
        height: 60,
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
    </div>
  );
};
