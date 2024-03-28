import { spawnSync } from "node:child_process"

export function mergeAviVideoAndAudio(videoFile: string, audioFile: string, output: string) {
    if (!output.toLowerCase().endsWith(".avi")) {
        output += ".avi"
    }
    return spawnSync("ffmpeg", [
        "-i", videoFile,
        "-i", audioFile,
        "-c", "copy",
        output
    ])
}