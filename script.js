document.addEventListener("DOMContentLoaded", async function () {
    console.log("🚀 Page Loaded");

    // ===============================
    // ✅ Firebase Authentication Setup
    // ===============================
    if (typeof firebase === "undefined") {
        console.error("❌ Firebase SDK not loaded. Check index.html script order.");
        return;
    }
    console.log("✅ Firebase SDK loaded successfully!");

    // ✅ Firebase Config
    const firebaseConfig = {
        apiKey: "AIzaSyCX9GbECMPsHsFlLF6nwyYwThxEjQo6wjY",
        authDomain: "easy-code-editor-e872b.firebaseapp.com",
        projectId: "easy-code-editor-e872b",
        storageBucket: "easy-code-editor-e872b.appspot.com",
        messagingSenderId: "508383158085",
        appId: "1:508383158085:web:d034066154798e6c04682c",
        measurementId: "G-P9HGH70TN4"
    };

    // ✅ Initialize Firebase (Prevent Multiple Initializations)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log("✅ Firebase Initialized Successfully");
    } else {
        console.log("⚠️ Firebase Already Initialized");
    }

    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();

    const signInButton = document.getElementById("signInBtn");
    const signOutButton = document.getElementById("signOutBtn");
    const userInfo = document.getElementById("userInfo");

    // ✅ Ensure Elements Exist Before Adding Listeners
    if (signInButton && signOutButton && userInfo) {
        auth.onAuthStateChanged((user) => {
            if (user) {
                userInfo.innerHTML = `👤 Welcome, <strong>${user.displayName}</strong>`;
                signInButton.style.display = "none";
                signOutButton.style.display = "block";
            } else {
                userInfo.innerHTML = "Not signed in";
                signInButton.style.display = "block";
                signOutButton.style.display = "none";
            }
        });

        signInButton.addEventListener("click", async () => {
            try {
                const result = await auth.signInWithPopup(provider);
                console.log("✅ Signed in:", result.user);
            } catch (error) {
                console.error("❌ Error signing in:", error.message);
            }
        });

        signOutButton.addEventListener("click", async () => {
            try {
                await auth.signOut();
                console.log("✅ Signed out");
            } catch (error) {
                console.error("❌ Error during sign-out:", error.message);
            }
        });
    }

    // ===============================
    // ✅ Monaco Editor Initialization
    // ===============================
    require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs" } });

    require(["vs/editor/editor.main"], function () {
        if (typeof monaco === "undefined") {
            console.error("❌ Monaco Editor failed to load!");
            return;
        }

        console.log("✅ Monaco Editor Loaded Successfully");

        const editorContainer = document.getElementById("editor");
        if (!editorContainer) {
            console.error("❌ Editor container not found!");
            return;
        }

        // ✅ Create the Editor
        window.editor = monaco.editor.create(editorContainer, {
            value: localStorage.getItem("editorCode") || 'console.log("Hello, World!");',
            language: "javascript",
            theme: "vs-dark",
            automaticLayout: true
        });

        // Save the editor's content to localStorage whenever it changes
        window.editor.getModel().onDidChangeContent(() => {
            const code = window.editor.getValue();
            localStorage.setItem("editorCode", code);
        });

        // ✅ Language Change Event
        const languageDropdown = document.getElementById("language");
        if (languageDropdown) {
            // Restore the selected language from localStorage
            const savedLanguage = localStorage.getItem("selectedLanguage") || "javascript";
            languageDropdown.value = savedLanguage;

            // Update the editor's language and default code
            updateEditorLanguage(savedLanguage);

            // Save the selected language to localStorage when changed
            languageDropdown.addEventListener("change", function () {
                const selectedLanguage = this.value;
                localStorage.setItem("selectedLanguage", selectedLanguage);
                updateEditorLanguage(selectedLanguage);
            });
        }

        function updateEditorLanguage(language) {
            const defaultCode = language === "python"
                ? 'print("Hello, Python!")'
                : 'console.log("Hello, JavaScript!");';

            let oldModel = editor.getModel();
            let newModel = monaco.editor.createModel(defaultCode, language);

            if (newModel) {
                editor.setModel(newModel);
                if (oldModel) {
                    oldModel.dispose();
                }
            } else {
                console.error("❌ Failed to create new Monaco model!");
            }
        }
    });

    // ✅ Clear Output
    document.getElementById("clear").addEventListener("click", function () {
        document.getElementById("output").textContent = ""; // Clears the output
        console.log("✅ Output cleared");
    });

    // ✅ Download Code
    document.getElementById("download").addEventListener("click", function () {
        const code = editor.getValue(); // Get the code from Monaco Editor
        const lang = document.getElementById("language").value; // Get the selected language
        const extension = lang === "javascript" ? "js" : "py"; // Set file extension

        // ✅ Create a downloadable file
        const blob = new Blob([code], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `code.${extension}`;
        link.click();

        console.log("✅ Code downloaded as:", `code.${extension}`);
    });

    // ===============================
    // ✅ Resize Handle Logic
    // ===============================
    const editorContainer = document.querySelector(".editor-container");
const ioContainer = document.querySelector(".io-container");
const resizeHandle = document.querySelector(".resize-handle");

let isDragging = false;

// Start dragging
resizeHandle.addEventListener("mousedown", function (e) {
    isDragging = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopDragging);
});

// Handle mouse movement during dragging
function handleMouseMove(e) {
    if (!isDragging) return;

    // Calculate new width for io-container
    const editorWidth = editorContainer.offsetWidth; // Fixed width of editor-container
    const ioWidth = window.innerWidth - e.clientX - editorWidth; // Adjust for editor width
    const minWidth = 200; // Minimum width for io-container

    // Apply new width if it's above the minimum
    if (ioWidth >= minWidth) {
        ioContainer.style.flex = `0 0 ${ioWidth}px`;
    }
}

// Stop dragging
function stopDragging() {
    isDragging = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopDragging);
}
    // ===============================
    // ✅ Apply Theme on Page Load
    // ===============================
    const themeToggle = document.getElementById("themeToggle");
    const savedTheme = localStorage.getItem("theme") || "dark-theme"; // Default to dark mode

    function applyTheme(isLightMode) {
        document.body.classList.toggle("light-theme", isLightMode);
        themeToggle.textContent = isLightMode ? "🌙" : "☀️";
        localStorage.setItem("theme", isLightMode ? "light-theme" : "dark-theme");

        if (window.monaco && window.editor) {
            monaco.editor.setTheme(isLightMode ? "vs-light" : "vs-dark");
        } else {
            console.warn("⚠️ Monaco Editor not loaded yet!");
        }
    }

    // Apply saved theme on page load
    applyTheme(savedTheme === "light-theme");

    // Theme Toggle Button Click Event
    themeToggle.addEventListener("click", function () {
        const isLightMode = !document.body.classList.contains("light-theme"); // Toggle the theme
        applyTheme(isLightMode);
    });

    // ===============================
    // ✅ Python Execution with Pyodide
    // ===============================
    const loadingSpinner = document.getElementById("loadingSpinner");
    const pythonStatus = document.getElementById("pythonStatus");

    async function initializePyodide() {
        if (window.pyodide) return window.pyodide;

        console.log("⏳ Loading Pyodide...");

        if (loadingSpinner) loadingSpinner.style.display = "inline-block";
        if (pythonStatus) pythonStatus.textContent = "";

        try {
            window.pyodide = await loadPyodide();
            console.log("✅ Pyodide loaded successfully!");

            // Redirect stdout to #output
            const outputArea = document.getElementById("output");
            if (!outputArea) {
                console.error("❌ #output element not found!");
                return;
            }

            window.pyodide.setStdout({
                batched: (text) => {
                    outputArea.innerText += text + "\n"; // Add newline after each output
                    outputArea.scrollTop = outputArea.scrollHeight; // Auto-scroll
                },
            });

            if (pythonStatus) {
                pythonStatus.textContent = "✅ Python loaded successfully!";
                pythonStatus.style.color = "green";
            }
            return window.pyodide;
        } catch (error) {
            console.error("❌ Pyodide Load Error:", error);

            if (pythonStatus) {
                pythonStatus.textContent = "❌ Failed to load Python.";
                pythonStatus.style.color = "red";
            }
        } finally {
            if (loadingSpinner) loadingSpinner.style.display = "none";
        }
    }

    document.getElementById("language").addEventListener("change", async function () {
        if (this.value === "python" && !window.pyodide) {
            await initializePyodide();
        }
    });

    // ===============================
    // ✅ Run Code (JavaScript & Python)
    // ===============================
    document.getElementById("run").addEventListener("click", async function () {
        const code = editor.getValue();
        const lang = document.getElementById("language").value;
        const outputArea = document.getElementById("output");

        outputArea.innerText = "Running...";

        if (lang === "javascript") {
            try {
                let logOutput = [];
                const oldConsoleLog = console.log;

                console.log = function (message) {
                    logOutput.push(message);
                    outputArea.innerText = logOutput.join("\n");
                };

                let result = new Function(code)();
                if (logOutput.length === 0 && result !== undefined) {
                    outputArea.innerText = result;
                }

                console.log = oldConsoleLog;
            } catch (error) {
                outputArea.innerText = `JavaScript Error: ${error.message}`;
            }
        } else if (lang === "python") {
            if (!window.pyodide) {
                outputArea.innerText = "Python is still loading... Please wait.";
                await initializePyodide();
            }

            try {
                outputArea.innerText = ""; // Clear output before running Python code
                await window.pyodide.runPythonAsync(code);
            } catch (error) {
                outputArea.innerText = `Python Error: ${error.message}`;
            }
        }
    });

    // ===============================
    // ✅ Warn Before Reloading
    // ===============================
    window.addEventListener("beforeunload", function (e) {
        const code = window.editor.getValue();
        if (code.trim() !== "") {
            e.preventDefault();
            e.returnValue = "Your code will be lost if you reload the page. Are you sure you want to leave?";
            return "Your code will be lost if you reload the page. Are you sure you want to leave?";
        }
    });
});