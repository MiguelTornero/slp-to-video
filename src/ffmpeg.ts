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
    startCutoffSeconds?: number

    constructor({videoFile, audioFile, outputFile, bitrate, stdout, stderr, startCutoffSeconds} : {videoFile: string, audioFile: string, outputFile: string, bitrate?: number, stdout?: Writable, stderr?: Writable, startCutoffSeconds?: number}) {
        this.videoFile = videoFile
        this.audioFile = audioFile
        this.outputFile = outputFile
        this.bitrate = bitrate
        this.stdout = stdout
        this.stderr = stderr
        this.startCutoffSeconds = startCutoffSeconds
    }

    spawnProcess(): ExternalProcess {
        const args : string[] = [
            "-i", this.videoFile,
            "-i", this.audioFile,    
            "-y",
            "-progress", "pipe:1"
        ]

        if (this.outputFile.toLowerCase().endsWith(".avi")) {
            args.push("-c", "copy") // speeds up operation if the output file is also AVI
        }

        if (this.startCutoffSeconds !== undefined && this.startCutoffSeconds > 0) {
            args.push("-ss", this.startCutoffSeconds.toFixed(3))
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