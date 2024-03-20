import { rm } from "fs/promises";
import { getWorkDir } from "./common";

export async function run(argv : string[] = [], development = false) : Promise<void> {
    let workDir : string | null = null
    try {
        workDir = getWorkDir(development)
        console.log("workdir:", workDir)
    }
    finally {
        console.log("cleaning up...")
        if (workDir !== null) {
            await rm(workDir, {recursive: true, force: true})
       }
    }
}