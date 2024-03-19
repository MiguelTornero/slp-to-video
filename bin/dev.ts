#!/usr/bin/env -S node_modules/.bin/ts-node --swc

(async function () {
    const { run } = await import("../src/index")
    await run()
})().catch(console.error)