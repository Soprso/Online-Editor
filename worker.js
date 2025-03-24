onmessage = async function (e) {
    const start = performance.now();
    const userWorker = new Worker("userWorker.js");

    const result = await new Promise((resolve, reject) => {
        let executionTimedOut = false;

        let timeout = setTimeout(() => {
            executionTimedOut = true;
            console.log("🔴 [Main Worker] Execution forcefully stopped due to timeout.");
            userWorker.terminate();
            reject({ error: "⏳ Execution timed out!" });
        }, e.data.timeout);

        userWorker.onmessage = function (event) {
            if (event.data.log) {
                postMessage({ output: event.data.log }); // ✅ Send logs to UI
            } else if (event.data.output) {
                clearTimeout(timeout);
                const executionTime = (performance.now() - start).toFixed(2);
                userWorker.terminate();
                resolve({ output: event.data.output, time: executionTime });
            }
        };

        userWorker.onerror = function (error) {
            reject({ error: `❌ Execution Error: ${error.message}` });
        };

        userWorker.postMessage({ code: e.data.code });
    });

    postMessage(result);
};
