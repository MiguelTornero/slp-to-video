import { spawnSync } from "node:child_process"

export function mergeVideoAndAudio(videoFile: string, audioFile: string, output: string) {
    return spawnSync("ffmpeg", [
        "-i", videoFile,
        "-i", audioFile,
        "-c", "copy",
        output
    ])
}