// ✅ Web Worker Script for JavaScript Execution
onmessage = async function (e) {
    let executionTimedOut = false;
    const start = performance.now();
    const executionTimeout = e.data.timeout;
    
    // ✅ Set Timeout to Stop Execution if it Runs Too Long
    const timeout = setTimeout(() => {
        executionTimedOut = true;
        postMessage({ error: "⏳ Execution timed out!" });
        close(); // Terminate the worker
    }, executionTimeout);

    try {
        // ✅ Capture console.log output
        let capturedLogs = [];
        const originalConsoleLog = console.log;
        console.log = function (...args) {
            const message = args.map(arg => 
                typeof arg === "object" ? JSON.stringify(arg) : arg
            ).join(" ");
            capturedLogs.push(message);
        };

        // ✅ Safe Execution with Loop Limit (Prevents Infinite Loops)
        let loopCounter = 0;
        const LOOP_LIMIT = 1e6; // 1 million iterations max

        function checkLoopLimit() {
            if (++loopCounter > LOOP_LIMIT) {
                throw new Error("⏳ Infinite Loop Detected! Execution stopped.");
            }
            if (executionTimedOut) {
                throw new Error("⏳ Execution timed out!");
            }
        }

        // ✅ Modify User Code to Inject `checkLoopLimit()` in `while(true)`
        let modifiedCode = e.data.code.replace(/while\s*\(true\)/g, "while(true) { checkLoopLimit(); }");

        // ✅ Wrap Code in an Async Function (Fixes `await` issue)
        const safeCode = `
            (async function() {
                try {
                    ${modifiedCode}
                } catch (error) {
                    console.error("❌ Runtime Error:", error.message);
                    postMessage({ error: "❌ JavaScript Error: " + error.message });
                }
            })();
        `;

        // ✅ Execute the User Code and AWAIT it
        await eval(safeCode); // Ensure `await` is handled properly

        // ✅ Clear Timeout if Execution Completes Normally
        clearTimeout(timeout);

        if (!executionTimedOut) {
            const executionTime = (performance.now() - start).toFixed(2);
            postMessage({ output: capturedLogs.join("\n"), time: executionTime });
        }
    } catch (err) {
        postMessage({ error: `❌ JavaScript Error: ${err.message}` });
    }
};
