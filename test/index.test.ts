import { ok, equal } from "node:assert"
import { spawnSync } from "node:child_process"

import { parseTimeStamp, msToTimestamp } from "../src/common"

describe("run cmd", () => {

    it("should show help on stderr", () => {
        const cmd = spawnSync("./bin/dev.ts")
        ok(cmd.status !== 0)
        ok(!cmd.stdout.toString())
        ok(!!cmd.stderr.toString())
    })
    
    it("should show help on stdout", () => {
        const cmd = spawnSync("./bin/dev.ts", ["-h"])
        ok(cmd.status === 0)
        ok(!!cmd.stdout.toString())
        ok(!cmd.stderr.toString())
    })
})

describe("test timestamp parser", () => {
    it("parse timestamp 1:2:3.4", () => {
        const time = parseTimeStamp("1:2:3.4")
        ok(time !== null)
        ok(time.hours === 1)
        ok(time.minutes === 2)
        ok(time.seconds === 3.4)
    })

    it("parse timestamp 5:6", () => {
        const time = parseTimeStamp("5:6")
        ok(time !== null)
        ok(time.hours === 0)
        ok(time.minutes === 5)
        ok(time.seconds === 6)
    })

    it("parse timestamp 7.8", () => {
        const time = parseTimeStamp("7.8")
        ok(time !== null)
        ok(time.hours === 0)
        ok(time.minutes === 0)
        ok(time.seconds === 7.8)
    })

    it("don't parse malformed timestamp", () => {
        const time = parseTimeStamp("9::10")
        ok(time === null)
    })
})

describe("test timestamp generator", () => {
    it("generate timestamp for 1000 ms", () => {
        equal(msToTimestamp(1000), "00:01.000")
    })

    it("generate timestamp for 3600000 ms", () => {
        equal(msToTimestamp(3600000), "1:00:00.000")
    
    })
})