import { spawn } from "node:child_process"
import { ExternalProcess, ProcessEventEmmiter, ProcessFactory, parseTimeStamp } from "./common"
import { EventEmitter, Writable } from "node:stream"

export class AudioVideoMergeProcessFactory implements ProcessFactory {
    videoFile : string
    audioFile : string
    outputFile : string
    bitrate?: number
    stdout?: Writable
    stderr?: Writable
    startCutoffSeconds?: number
    volume: number
    progressEndMs?: number

    constructor({videoFile, audioFile, outputFile, bitrate, stdout, stderr, startCutoffSeconds, volume} : {videoFile: string, audioFile: string, outputFile: string, bitrate?: number, stdout?: Writable, stderr?: Writable, startCutoffSeconds?: number, volume: number}) {
        this.videoFile = videoFile
        this.audioFile = audioFile
        this.outputFile = outputFile
        this.bitrate = bitrate
        this.stdout = stdout
        this.stderr = stderr
        this.startCutoffSeconds = startCutoffSeconds
        this.volume = volume
    }

    spawnProcess(): ExternalProcess {
        const eventEmitter : ProcessEventEmmiter = new EventEmitter()

        const args : string[] = [
            "-i", this.videoFile,
            "-i", this.audioFile
        ]

        if (this.volume !== 1) {
            args.push("-af", `volume=${this.volume.toFixed(3)}`)
        }

        args.push(
            "-y",
            "-progress", "pipe:1"
        )

        if (this.outputFile.toLowerCase().endsWith(".avi")) {
            args.push("-c:v", "copy") // speeds up operation if the output file is also AVI
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

            const msgStr = msg.toString()

            const timestampMatch = msgStr.match(/out_time_us=(\d+)/) // us (microseconds) and ms (miliseconds) metrics are the same at the moment, taking us and dividing by 1000 to prevent breaking hehavior if/when fixed

            if (timestampMatch === null) { return }

            const msProgress = Math.trunc(parseInt(timestampMatch[1]) / 1000)

            const isEnd = msgStr.includes("progress=end")
            if (isEnd) {
                // we've reached the end of the operation, updating progressEndMs accordingly
                this.progressEndMs = msProgress
            }
            
            eventEmitter.emit("progress", msProgress, 0, this.progressEndMs)
        })

        ffmpegProcess.stderr.on("data", (msg) => {
            if (!(msg instanceof Buffer)) { return }

            // getting input lengths to approximate current progress
            const matches = msg.toString().matchAll(/Input #\d+[\S\s]*?Duration:\s+([\d:\.]+)/g)

            for (const match of matches) {
                const time = parseTimeStamp(match[1])
                if (time === null) { continue }

                const ms = (time.hours * 3600 + time.minutes * 60 + time.seconds) * 1000
                if (this.progressEndMs === undefined || this.progressEndMs < ms) {
                    this.progressEndMs = ms
                }
            }

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