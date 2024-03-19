#!/usr/bin/env node

(async function () {
    const { run } = await import("../dist/index.js")
    await run()
})().catch(console.error)