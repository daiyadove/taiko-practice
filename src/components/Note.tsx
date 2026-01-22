import React from "react";
import type { NoteHand } from "../types/score";

interface NoteProps {
  x: number;
  hand: NoteHand;
}

/**
 * ノーツ（流れてくる音符）
 * 左手=青、右手=赤
 */
export const Note: React.FC<NoteProps> = ({ x, hand }) => {
  const color = hand === "left" ? "#3b82f6" : "#ef4444";

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: "50%",
        transform: "translateY(-50%)",
        width: 60,
        height: 60,
        backgroundColor: color,
        borderRadius: "50%",
        border: "4px solid white",
        boxShadow: `0 0 15px ${color}`,
      }}
    />
  );
};
