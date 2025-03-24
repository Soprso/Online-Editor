self.importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js");

let pyodide = null; // Store Pyodide instance globally

async function initializePyodide() {
    if (!pyodide) {
        pyodide = await loadPyodide();
        await pyodide.loadPackage(["micropip"]); // Load dependencies once
    }
}

let pyodideReady = initializePyodide();

self.onmessage = async function (event) {
    await pyodideReady; // Ensure Pyodide is initialized

    let { code, inputData, packages } = event.data;
    let output = "";
    let error = "";

    try {
        // ✅ Load additional Python packages (if required)
        if (packages && packages.length > 0) {
            await pyodide.loadPackage(packages);
        }

        // ✅ Fix input handling: Ensure input() doesn’t block execution
        let inputQueue = inputData ? inputData.split("\n") : [];
        pyodide.setStdin({
            readline: () => (inputQueue.length > 0 ? inputQueue.shift() : "\n")
        });

        // ✅ Capture standard output and errors efficiently
        pyodide.setStdout({ batched: (text) => (output += text + "\n") });
        pyodide.setStderr({ batched: (text) => (error += text + "\n") });

        // ✅ Faster execution with error handling
        await pyodide.runPythonAsync(code);
    } catch (err) {
        error = `Execution Error: ${err.message}`;
    }

    self.postMessage({ output: output.trim(), error: error.trim() });
};
