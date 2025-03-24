onmessage = async function (e) {
    let executionTimedOut = false;
    const MAX_TIMEOUT = e.data.timeout || 5000; // Default timeout: 5s
    let capturedLogs = []; // ✅ Stores all console logs
    const originalConsoleLog = console.log;

    // ✅ Override console.log to capture output
    console.log = function (...args) {
        const message = args.map(arg =>
            typeof arg === "object" ? JSON.stringify(arg) : arg
        ).join(" ");
        capturedLogs.push(message);
    };

    // ✅ Infinite Loop Protection
    let loopCounter = 0;
    const LOOP_LIMIT = 1e6; // Stop loops after 1 million iterations

    function checkLoopLimit() {
        if (++loopCounter > LOOP_LIMIT) {
            throw new Error("⏳ Infinite Loop Detected! Your loop runs indefinitely.");
        }
        if (executionTimedOut) {
            throw new Error("⏳ Execution Timed Out! Your code exceeded the allowed time.");
        }
    }

    // ✅ Modify user code to inject loop protection
    let modifiedCode = e.data.code
        .replace(/while\s*\(true\)/g, "while(true) { checkLoopLimit(); }")
        .replace(/for\s*\(\s*;\s*;\s*\)/g, "for(;;) { checkLoopLimit(); }");

    // ✅ Create a Blob Worker to execute the user code
    const blob = new Blob([`
        onmessage = async function() {
            let executionTimedOut = false;
            const capturedLogs = [];

            // ✅ Override console.log to capture output
            console.log = function (...args) {
                const message = args.map(arg =>
                    typeof arg === "object" ? JSON.stringify(arg) : arg
                ).join(" ");
                capturedLogs.push(message);
            };

            // ✅ Infinite Loop Protection
            let loopCounter = 0;
            function checkLoopLimit() {
                if (++loopCounter > ${LOOP_LIMIT}) {
                    throw new Error("⏳ Infinite Loop Detected! Your loop runs indefinitely.");
                }
                if (executionTimedOut) {
                    throw new Error("⏳ Execution Timed Out! Your code exceeded the allowed time.");
                }
            }

            // ✅ Set timeout to stop execution if needed
            const timeout = setTimeout(() => {
                executionTimedOut = true;
                postMessage({ error: "⏳ Execution Timed Out! Your code exceeded ${MAX_TIMEOUT / 1000}s." });
                close(); // ✅ Terminate worker inside Blob
            }, ${MAX_TIMEOUT});

            try {
                await (async function() {
                    ${modifiedCode} // ✅ Injected user code with loop protection
                    clearTimeout(timeout);
                    postMessage({ output: capturedLogs.join("\\n") }); // ✅ Send captured output to UI
                    close(); // ✅ Terminate Blob Worker after execution
                })();
            } catch (error) {
                clearTimeout(timeout);
                let errorMessage = "❌ JavaScript Error: " + error.message;
                
                // ✅ Handle Syntax Errors
                if (error instanceof SyntaxError) {
                    errorMessage += "\\n🔍 Suggestion: Check your quotes, parentheses, and syntax.";
                }
                
                // ✅ Handle Reference Errors
                else if (error instanceof ReferenceError) {
                    errorMessage += "\\n🔍 Suggestion: Did you forget to declare a variable?";
                }
                
                // ✅ Handle Type Errors
                else if (error instanceof TypeError) {
                    errorMessage += "\\n🔍 Suggestion: Are you calling a function on an undefined value?";
                }

                postMessage({ error: errorMessage });
            }
        };
    `], { type: "application/javascript" });

    const blobUrl = URL.createObjectURL(blob);
    const worker = new Worker(blobUrl);

    // ✅ Handle Worker Messages
    worker.onmessage = function (event) {
        if (event.data.error) {
            postMessage({ error: event.data.error });
        } else {
            postMessage({ output: event.data.output }); // ✅ Send output to UI
        }
        worker.terminate();
        URL.revokeObjectURL(blobUrl);
    };

    // ✅ Start execution
    worker.postMessage({});
};
