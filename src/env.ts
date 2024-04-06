/**
 * File where all the environment variables can be accessed in a typesafe manner
 */
const envPrefix = "SLP_TO_VIDEO_"
export const DOLPHIN_PATH = process.env[envPrefix + "DOLPHIN_PATH"] || ""
export const FFMPEG_PATH = process.env[envPrefix + "FFMPEG_PATH"] || ""

export const APPDATA = process.env["APPDATA"] || ""