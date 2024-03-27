#!/usr/bin/env node

(async function () {
    const { run } = await import("../dist/index.js")
    await run(process.argv, false)
})().catch((e) => {
    if (e instanceof Error) {
        console.error("error:", e.message)
    }
    else {
        console.error("an error ocurred")
    }
    process.exit(1)
})