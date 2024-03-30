import { spawn } from "node:child_process"
import { ExternalProcess, ProcessFactory } from "./common"
import { Writable } from "node:stream"

export class AudioVideoMergeProcessFactory implements ProcessFactory {
    videoFile : string
    audioFile : string
    outputFile : string
    bitrate?: number
    stdout?: Writable
    stderr?: Writable

    constructor({videoFile, audioFile, outputFile, bitrate, stdout, stderr} : {videoFile: string, audioFile: string, outputFile: string, bitrate?: number, stdout?: Writable, stderr?: Writable}) {
        this.videoFile = videoFile
        this.audioFile = audioFile
        this.outputFile = outputFile
        this.bitrate = bitrate
        this.stdout = stdout
        this.stderr = stderr
    }

    spawnProcess(): ExternalProcess {
        const args = [
            "-y",
            "-i", this.videoFile,
            "-i", this.audioFile
        ]

        if (this.outputFile.toLowerCase().endsWith(".avi")) {
            args.push("-c", "copy") // speeds up operation if the output file is also AVI
        }

        args.push(this.outputFile)

        const ffmpegProcess = spawn("ffmpeg", args)
        
        if (this.stdout !== undefined) {
            ffmpegProcess.stdout.pipe(this.stdout)
        }
        if (this.stderr !== undefined) {
            ffmpegProcess.stderr.pipe(this.stderr)
        }

        return {
            onExit(callback) {
                ffmpegProcess.on("exit", callback)
            },
            onProgress() {
                //TODO
            }
        }
    }
}