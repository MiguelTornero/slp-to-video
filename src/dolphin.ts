import { EventEmitter } from "node:events";
import { ExternalProcess, ProcessEventEmmiter, assetDir } from "./common";
import { join } from "node:path";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

type ValidInternalResultionMultiplier = 1 | 1.5 | 2 | 2.5 | 3 | 4 | 5 | 6 | 7 | 8
type ValidInternalResolution = `${ValidInternalResultionMultiplier}x` | "720p" | "1080p"  | "WQHD" | "4K" | "auto"

type JSONInputFileCommon = {
    replay?: string,
    mode?: "normal" | "queue" | "mirror"
    startFrame?: number,
    endFrame?: number,
    commandId?: string,
    outputOverlayFiles?: boolean,
    isRealTimeMode?: boolean,
    shouldResync?: boolean,
    rollbackDisplayMethod?: "off" | "normal" | "visible",
    gameStation?: string,
    queue?: JSONQueueItem[]
}

type JSONInputFileNormal = JSONInputFileCommon & {
    replay: string,
    mode?: "normal"
}

type JSONInputFileQueue = JSONInputFileCommon & {
    mode: "queue",
    queue: JSONQueueItem[]
}

type JSONInputFile = JSONInputFileNormal | JSONInputFileQueue

type JSONQueueItem = {
    path: string,
    startFrame?: number,
    endFrame?: number,
    gameStartAt?: string,
    gameStation?: string
}


export class DolphinProcess implements ExternalProcess {
    static dolphinIniFilename = "Dolphin.ini"
    static gfxIniFilename = "GFX.ini"
    static geckoFilename = "GALE01.ini"

    static audioDumpFilename = "dspdump.wav"
    static videoDumpFilename = "framedump0.avi"
    static outputAviFilename = "output.avi"
    
    static defaultSlpStartFrame = -123

    // used to get the EFBScale option for the INI file, might break in the future
    static internalResToEfbScale : Record<ValidInternalResolution, number> = {
        "auto": 0,
        "1x": 2,
        "1.5x": 3,
        "2x": 4,
        "720p": 4,
        "2.5x": 5,
        "3x": 6,
        "1080p": 6,
        "4x": 7,
        "WQHD": 7,
        "5x": 8,
        "6x": 9,
        "4K": 9,
        "7x": 10,
        "8x": 11
    }

    private eventEmitter : ProcessEventEmmiter

    dolphinPath: string
    enableWidescreen : boolean
    workDir: string
    userDir: string
    slpInputFile: string
    meleeIso: string
    timeout: number
    inputJsonPath: string

    constructor({dolphinPath, slpInputFile, workDir, meleeIso, timeout, enableWidescreen}: {dolphinPath: string, slpInputFile: string, workDir: string, meleeIso: string, timeout: number, enableWidescreen: boolean}) {
        this.eventEmitter = new EventEmitter()
        this.dolphinPath = dolphinPath
        this.enableWidescreen = enableWidescreen
        this.workDir = workDir
        this.slpInputFile = slpInputFile
        this.meleeIso = meleeIso
        this.timeout = timeout

        this.userDir = join(workDir, "User")
        this.inputJsonPath = join(workDir, "input.json")
    }

    prepareWorkDir() {
        const userConfigDir = join(this.userDir, "Config")

        mkdirSync(this.workDir, {recursive: true}) // "recursive: true" makes it so it doesn't throw an error if the dir exists

        mkdirSync(userConfigDir, {recursive: true})
        copyFileSync(join(assetDir, DolphinProcess.dolphinIniFilename), join(userConfigDir, DolphinProcess.dolphinIniFilename))
        copyFileSync(join(assetDir, DolphinProcess.gfxIniFilename), join(userConfigDir, DolphinProcess.gfxIniFilename))

        if (this.enableWidescreen) {
            const userGameSettingsDir = join(this.userDir, "GameSettings")
    
            mkdirSync(userGameSettingsDir, {recursive: true})
            copyFileSync(join(assetDir, DolphinProcess.geckoFilename), join(userGameSettingsDir, DolphinProcess.geckoFilename))
        }

        const inputJsonData : JSONInputFile = {
            mode: "queue",
            queue: [
                {
                    path: this.slpInputFile
                }
            ]
        }
    
        writeFileSync(this.inputJsonPath, JSON.stringify(inputJsonData))
    }

    spawnProcess() {
        this.prepareWorkDir()
        const dolphinProcess = spawn(this.dolphinPath, [
            "-u", this.userDir,
            "--output-directory", this.workDir,
            "-i", this.inputJsonPath,
            "-e", this.meleeIso,
            "-b",
            "--cout",
            "--hide-seekbar"
        ], {timeout: this.timeout})

        dolphinProcess.stdout.on("data", (msg) => {
            if (!(msg instanceof Buffer)) { return }

            const msgStr = msg.toString()

            // Kill dolphin process after the game finishes
            if (msgStr.startsWith("[NO_GAME]")) {
                dolphinProcess.kill()
                return
            }

            const match = msgStr.match(/\[CURRENT_FRAME\]\s+(-?\d+)/)
            if (match) {
                const frame = parseInt(match[1])
                this.eventEmitter.emit("progress", frame)
            }
        })

        dolphinProcess.on("exit", (code) => {
            this.eventEmitter.emit("done", code)
        })

        return dolphinProcess
    }

    onExit(callback: (code: number | null) => void): void {
        this.eventEmitter.on("done", callback)
    }

    onProgress(callback: (progress: number) => void): void {
        this.eventEmitter.on("progress", callback)
    }
}