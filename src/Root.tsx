import { Composition } from "remotion";
import { TaikoPractice } from "./TaikoPractice";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TaikoPractice"
        component={TaikoPractice}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
