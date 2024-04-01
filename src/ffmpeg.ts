import { spawn } from "node:child_process"
import { ExternalProcess, ProcessEventEmmiter, ProcessFactory } from "./common"
import { EventEmitter, Writable } from "node:stream"

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
        const eventEmitter : ProcessEventEmmiter = new EventEmitter()

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

        ffmpegProcess.stdout.on("data", (msg) => {
            if (!(msg instanceof Buffer)) { return }
            
            const match = msg.toString().match(/out_time_us=(\d+)/) // us (microseconds) and ms (miliseconds) metrics are the same at the moment, taking us and dividing by 1000 to prevent breaking hehavior if/when fixed

            if (match === null) { return }

            const msProgress = Math.trunc(parseInt(match[1]) / 1000)

            eventEmitter.emit("progress", msProgress, 0)
        })
        
        return {
            onExit(callback) {
                ffmpegProcess.on("exit", callback)
            },
            onProgress(callback) {
                eventEmitter.on("progress", callback)
            }
        }
    }
}