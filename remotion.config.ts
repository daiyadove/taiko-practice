import { Config } from "@remotion/cli/config";
import dotenv from "dotenv";
import path from "path";

// .envファイルを読み込む
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
