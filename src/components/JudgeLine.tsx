import React from "react";

interface JudgeLineProps {
  x: number;
  height: number;
}

/**
 * 判定ライン（ノーツを叩くポイント）
 */
export const JudgeLine: React.FC<JudgeLineProps> = ({ x, height }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 0,
        width: 8,
        height: height,
        backgroundColor: "#ffffff",
        boxShadow: "0 0 10px rgba(255, 255, 255, 0.8)",
        borderRadius: 4,
      }}
    />
  );
};
