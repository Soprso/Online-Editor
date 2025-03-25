// console.log("SQL Formatter Loaded:", typeof window.sqlFormatter !== "undefined" ? "Yes" : "No");

document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 Page Loaded");

  // Hide the loading screen after the page is fully loaded
  hideLoadingScreen();

  // ===============================
  // ✅ Firebase Authentication Setup
  // ===============================
  if (typeof firebase === "undefined") {
    console.error("❌ Firebase SDK not loaded. Check index.html script order.");
    return;
  }
  console.log("✅ Firebase SDK loaded successfully!");

  // Firebase Config
  const firebaseConfig = {
    apiKey: "AIzaSyCX9GbECMPsHsFlLF6nwyYwThxEjQo6wjY",
    authDomain: "easy-code-editor-e872b.firebaseapp.com",
    projectId: "easy-code-editor-e872b",
    storageBucket: "easy-code-editor-e872b.appspot.com",
    messagingSenderId: "508383158085",
    appId: "1:508383158085:web:d034066154798e6c04682c",
    measurementId: "G-P9HGH70TN4",
  };

  // Initialize Firebase (Prevent Multiple Initializations)
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

  // Ensure Elements Exist Before Adding Listeners
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
  require.config({
    paths: {
      vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs",
    },
  });

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

    // Create the Editor
    window.editor = monaco.editor.create(editorContainer, {
      value:
        localStorage.getItem("editorCode") || 'console.log("Hello, World!");',
      language: "javascript",
      theme: "vs-dark",
      automaticLayout: true,
      fontSize: parseInt(localStorage.getItem("editorFontSize") || 14),
      tabSize: parseInt(localStorage.getItem("editorTabSize") || 4),
    });

    // Save the editor's content to localStorage whenever it changes
    window.editor.getModel().onDidChangeContent(() => {
      const code = window.editor.getValue();
      localStorage.setItem("editorCode", code);
    });

    // ✅ Language Change Event  
      const languageDropdown = document.getElementById("language");
      const formatButton = document.getElementById("format");
  
      if (languageDropdown) {
          // ✅ Add C and C++ to the language selection dropdown if not already present
          if (!document.querySelector("option[value='c']")) {
              languageDropdown.innerHTML += `
                  <option value="c">C</option>
                  <option value="cpp">C++</option>
              `;
          }
  
          // ✅ Restore the selected language from localStorage, default to C++
          const savedLanguage = localStorage.getItem("selectedLanguage") || "cpp";
          languageDropdown.value = savedLanguage;
  
          // ✅ Load default code immediately on page load
          updateEditorLanguage(savedLanguage);
  
          // ✅ Check language on page load & hide format button for Python
          formatButton.style.display = ["python"].includes(savedLanguage) ? "none" : "inline-block";
  
          // ✅ Event Listener: Update editor when a new language is selected
          languageDropdown.addEventListener("change", function () {
              const selectedLanguage = this.value;
              localStorage.setItem("selectedLanguage", selectedLanguage);
              updateEditorLanguage(selectedLanguage);
  
              // ✅ Hide format button if Python is selected
              formatButton.style.display = ["python"].includes(selectedLanguage) ? "none" : "inline-block";
          });
      }
    
  
    function updateEditorLanguage(language) {
      let defaultCode;
  
      if (language === "python") {
          defaultCode = 'print("Hello, Python!")';
      } else if (language === "javascript") {
          defaultCode = 'console.log("Hello, JavaScript!");';
      } else if (language === "sql") {
          defaultCode = `-- Sample SQL Query
  CREATE TABLE users (id INTEGER, name TEXT);
  INSERT INTO users (id, name) VALUES (1, 'Alice'), (2, 'Bob');
  SELECT * FROM users;`;
      } else if (language === "c") {
        defaultCode = `#include <stdio.h>
int main() {
printf("Hello, C!\\n");
return 0;
}`;
      } else if (language === "cpp") {
        defaultCode = `#include <iostream>
using namespace std;
int main() {
cout << "Hello, C++!" << endl;
return 0;
}`;
      } else {
          console.error("❌ Unsupported language:", language);
          return;
      }
  
      // ✅ Fix: Ensure `editor` exists before modifying it
      if (!window.editor) {
          console.error("❌ Monaco Editor is not initialized!");
          return;
      }
  
      // ✅ Fix: Prevent errors by ensuring proper disposal of old models
      let oldModel = editor.getModel();
      let newModel = monaco.editor.createModel(defaultCode, language === "sql" ? "sql" : language);
  
      if (newModel) {
          editor.setModel(newModel);
          if (oldModel) {
              oldModel.dispose(); // Dispose only AFTER assigning newModel
          }
          console.log(`✅ Loaded default code for ${language}`);
      } else {
          console.error("❌ Failed to create new Monaco model!");
      }
    }

    // ✅ Keyboard Shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      document.getElementById("run").click();
    });
  });

  // ===============================
  // ✅ Clear Output
  // ===============================
  document.getElementById("clear").addEventListener("click", function () {
    if (window.editor) {
      window.editor.setValue(""); // Clear the editor content
      console.log("✅ Editor cleared successfully!");
    } else {
      console.error("❌ Monaco Editor is not initialized!");
    }
  });

  // ===============================
  // ✅ Download Code
  // ===============================
  document.getElementById("download").addEventListener("click", function () {
    const code = window.editor.getValue(); // Get the code from Monaco Editor
    const lang = document.getElementById("language").value; // Get the selected language
    let extension = "txt";
    
    // Set file extension based on language
    switch(lang) {
      case "javascript": extension = "js"; break;
      case "python": extension = "py"; break;
      case "sql": extension = "sql"; break;
      case "c": extension = "c"; break;
      case "cpp": extension = "cpp"; break;
    }

    // Create a downloadable file
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
  // ✅ Loading Screen Functions
  // ===============================
  function showLoadingScreen(estimatedTime = 3000) {
    const loadingScreen = document.getElementById("loadingScreen");
    const progressBar = document.getElementById("progressBar");

    if (loadingScreen && progressBar) {
        console.log("🟢 Showing loading screen");

        progressBar.style.width = "0";
        loadingScreen.style.display = "flex";
        loadingScreen.style.opacity = "1";

        let progress = 0;
        const startTime = Date.now();
        const interval = 100; // Update every 100ms
        const maxTime = estimatedTime * 1.2; // Allow extra time if execution is slow

        const updateProgress = () => {
            const elapsedTime = Date.now() - startTime;
            progress = Math.min((elapsedTime / estimatedTime) * 100, 95); // Cap at 95% before completion
            progressBar.style.width = `${progress}%`;

            if (elapsedTime < maxTime) {
                setTimeout(updateProgress, interval);
            }
        };

        updateProgress();
    }
  }

  function hideLoadingScreen() {
    const loadingScreen = document.getElementById("loadingScreen");
    const progressBar = document.getElementById("progressBar");

    if (loadingScreen && progressBar) {
        console.log("🟢 Hiding loading screen");

        progressBar.style.width = "100%"; // Instantly fill progress bar
        setTimeout(() => {
            loadingScreen.style.opacity = "0";
            setTimeout(() => (loadingScreen.style.display = "none"), 300);
        }, 300);
    }
  }

  // ===============================
  // ✅ Theme Logic
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
// ✅ Function to Run C/C++ Code (Render-hosted version)
// ===============================
async function runC_CPP(code, language, outputArea, errorOutput, inputData) {
  const API_URL = "https://bangu-python.onrender.com/run-code";

  try {
      outputArea.textContent = "";
      errorOutput.textContent = "";

      console.log("[Debug] Sending to backend:", { code, language, inputData });

      const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              code: code,
              language: language,
              input_data: inputData, // ✅ Pass user input
              timeout: 10  
          }),
      });

      console.log("[Debug] Response status:", response.status);

      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server error: ${response.status}\n${errorText}`);
      }

      const data = await response.json();
      console.log("[Debug] Response data:", data);

      outputArea.textContent = data.output || "";
      errorOutput.textContent = data.error || "";

      return data;
  } catch (error) {
      console.error("[Debug] Full error:", error);
      errorOutput.textContent = `❌ Execution Error: ${error.message}`;
      return { error: error.message };
  }
}

  // ===============================
  // ✅ SQL Execution Function
  // ===============================
  async function runSQL(code, outputArea) {
    try {
        showLoadingScreen(); // ✅ Show loading screen before execution
        const SQL = await initSqlJs({
            locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm`,
        });
        const db = new SQL.Database(); // In-memory database
  
        // Sample table creation for testing
        db.run(`
            CREATE TABLE products (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                stock INTEGER DEFAULT 0
            );
        `);
  
        db.run(`
            INSERT INTO products (id, name, price, stock) VALUES
            (1, 'Laptop', 999.99, 10),
            (2, 'Smartphone', 599.99, 25),
            (3, 'Tablet', 299.99, 15),
            (4, 'Wireless Mouse', 19.99, 50),
            (5, 'Mechanical Keyboard', 89.99, 30);
        `);
  
        // Define max execution time (in milliseconds)
        const MAX_WAIT_TIME = (localStorage.getItem("executionTimeout") || 30) * 1000; // Default: 20s
  
        return new Promise((resolve, reject) => {
            let executionCompleted = false;
  
            // Set a timeout to enforce max execution time
            const timeout = setTimeout(() => {
                if (!executionCompleted) {
                    reject(new Error("⏳ SQL Execution Timeout! Query took too long."));
                }
            }, MAX_WAIT_TIME);
  
            try {
                const queries = code.split(";").filter((q) => q.trim() !== ""); // Remove empty queries
                let allResultsHTML = "";
  
                for (let query of queries) {
                    const startTime = performance.now();
                    const results = db.exec(query);
                    const endTime = performance.now();
  
                    if (endTime - startTime > MAX_WAIT_TIME) {
                        reject(new Error("⏳ SQL Execution Timeout! Query exceeded time limit."));
                        return;
                    }
  
                    if (results.length > 0) {
                        allResultsHTML += formatSQLResults(results);
                    }
                }
  
                executionCompleted = true; // Mark execution as done
                clearTimeout(timeout); // Clear timeout
  
                // If no results, show a success message
                outputArea.innerHTML = allResultsHTML || "<p>✅ Query executed successfully. No results.</p>";
                resolve();
            } catch (error) {
                reject(new Error(`❌ SQL Error: ${error.message}`));
            }
        });
    } catch (error) {
        outputArea.innerText = `❌ SQL Error: ${error.message}`;
    }
    finally {
        hideLoadingScreen(); // ✅ Hide loading screen after execution completes
    }
  }

  // ✅ Format SQL Results
  function formatSQLResults(results) {
    let tableHTML = "";

    results.forEach((result) => {
      tableHTML += "<table border='1'><tr>";

      // Add column headers
      result.columns.forEach((col) => {
        tableHTML += `<th>${col}</th>`;
      });
      tableHTML += "</tr>";

      // Add row data
      result.values.forEach((row) => {
        tableHTML += "<tr>";
        row.forEach((value) => {
          tableHTML += `<td>${value}</td>`;
        });
        tableHTML += "</tr>";
      });

      tableHTML += "</table><br>";
    });

    return tableHTML;
  }

  // ===============================
  // ✅ Run Code Logic (Supports JavaScript, Python, and SQL)
  // ===============================
  document.getElementById("run").addEventListener("click", async function () {
    const code = window.editor.getValue();
    const lang = document.getElementById("language").value;
    const outputArea = document.getElementById("output");
    const errorOutput = document.getElementById("error-output");
    const inputArea = document.getElementById("input");

    const inputData = inputArea.value.trim(); // ✅ Get user input

    if (!code.trim()) {
        errorOutput.innerText = "❌ Error: The code editor is empty. Please write some code.";
        return;
    }

    // ✅ Clear previous output and errors
    outputArea.innerText = "";
    errorOutput.textContent = "";
    showLoadingScreen();

    try {
        const startTime = performance.now(); // ✅ Start execution timer
        const MAX_WAIT_TIME = (localStorage.getItem("executionTimeout") || 5) * 1000;
        let executionTimedOut = false;

        // ✅ Setup AbortController for request timeout handling
        const controller = new AbortController();
        const signal = controller.signal;

        // ✅ Define Execution Timeout
        const executionTimeout = new Promise((_, reject) => {
            setTimeout(() => {
                executionTimedOut = true;
                controller.abort(); // ✅ Abort the request
                reject(new Error(`⏳ Execution Timeout! Code exceeded ${MAX_WAIT_TIME / 1000}s.`));
            }, MAX_WAIT_TIME);
        });

        // ✅ Select Language & Execute Accordingly
        let executionPromise;
        if (lang === "javascript") {
            executionPromise = runJavaScriptWithWorker(code, outputArea, errorOutput, MAX_WAIT_TIME);
        } else if (lang === "python") {
            executionPromise = runPython(code, outputArea, errorOutput, inputData, signal);
        } else if (lang === "sql") {
            executionPromise = runSQLWithTimeout(code, outputArea, MAX_WAIT_TIME);
        } else if (lang === "c" || lang === "cpp") {
            executionPromise = runC_CPP(code, lang, outputArea, errorOutput, inputData);
        } else {
            throw new Error(`Unsupported language: ${lang}`);
        }

        // ✅ Run Code & Ensure Timeout Works
        if (executionPromise) {
            await Promise.race([executionPromise, executionTimeout]);
        }

        // ✅ Capture Execution Time if no timeout occurred
        if (!executionTimedOut) {
            const endTime = performance.now();
            outputArea.innerText += `\n\n⏳ Execution Time: ${(endTime - startTime).toFixed(2)} ms`;
        }
    } catch (error) {
        console.error("❌ Execution Error:", error);
        errorOutput.textContent = error.message;
    } finally {
        hideLoadingScreen(); // ✅ Hide loading animation
    }
});

  // ===============================
  // ✅ JavaScript Execution using Web Worker
  // ===============================
  async function runJavaScriptWithWorker(code, outputArea, errorOutput, timeout) {
    return new Promise((resolve, reject) => {
        outputArea.innerText = "";
        errorOutput.innerText = "";
        showLoadingScreen(timeout);

        const worker = new Worker("userWorker.js");

        worker.onmessage = function (e) {
            if (e.data.error) {
                errorOutput.innerText = e.data.error;
                reject(new Error(e.data.error));
            } else {
                outputArea.innerText += e.data.output + "\n";
                resolve();
            }
            hideLoadingScreen();
            worker.terminate();
        };

        worker.onerror = function (e) {
            errorOutput.innerText = `❌ JavaScript Error: ${e.message}`;
            reject(new Error(e.message));
            hideLoadingScreen();
        };

        worker.postMessage({ code, timeout });
    });
}


  // ===============================
  // ✅ Python Execution with Timeout, Input Support & Execution Time
  // ===============================
  async function runPython(code, outputArea, errorOutput, inputData, signal) {
    showLoadingScreen();

    const userTimeout = parseInt(localStorage.getItem("executionTimeout")) || 5;
    const MAX_WAIT_TIME = Math.min(userTimeout, 20) * 1000;

    try {
        const response = await fetch("https://bangu-python.onrender.com/run-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, language: "python", input_data: inputData, timeout: userTimeout }),
            signal: signal
        });

        if (!response.ok) {
            throw new Error(`❌ FastAPI Error: HTTP ${response.status} - ${response.statusText}`);
        }

        const result = await response.json();

        if (result.error) {
            errorOutput.innerText = `❌ Error: ${result.error}`;
        } else {
            outputArea.innerText = `${result.output}\n\n⏳ Execution Time: ${userTimeout}s`;
        }
    } catch (error) {
        console.error("❌ Execution Error:", error);
        errorOutput.innerText = `❌ Execution Error: ${error.message}`;
    } finally {
        hideLoadingScreen();
    }
}

  // ✅ SQL Execution with Timeout
  async function runSQLWithTimeout(code, outputArea, timeout) {
    return new Promise(async (resolve, reject) => {
        const executionTimeout = setTimeout(() => {
            reject(new Error("⏳ SQL Execution Timeout!"));
        }, timeout);

        try {
            let startTime = performance.now();
            await runSQL(code, outputArea);
            let endTime = performance.now();
            outputArea.innerHTML += `<br><br><strong>Execution Time: ${(endTime - startTime).toFixed(2)} ms</strong>`;
            clearTimeout(executionTimeout);
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}


  // ===============================
  // ✅ Clear Errors Function
  // ===============================
  function clearErrors() {
    const errorOutput = document.getElementById("error-output");
    if (errorOutput) {
      errorOutput.textContent = ""; // Clear the error output
    }
  }

  // Attach clearErrors to the button
  const clearErrorsButton = document.querySelector("#error-console button");
  if (clearErrorsButton) {
    clearErrorsButton.addEventListener("click", clearErrors);
  }

  // ===============================
  // ✅ Settings Modal Logic
  // ===============================
  const settingsBtn = document.getElementById("settings");
  const settingsModal = document.getElementById("settingsModal");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const cancelSettingsBtn = document.getElementById("cancelSettingsBtn");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const executionTimeoutInput = document.getElementById("executionTimeout");
  const editorFontSizeInput = document.getElementById("editorFontSize");
  const editorTabSizeInput = document.getElementById("editorTabSize");

  // Load saved settings
  executionTimeoutInput.value = localStorage.getItem("executionTimeout") || 20;
  editorFontSizeInput.value = localStorage.getItem("editorFontSize") || 14;
  editorTabSizeInput.value = localStorage.getItem("editorTabSize") || 4;

  // Open settings modal
  settingsBtn.addEventListener("click", () => {
    settingsModal.style.display = "flex";
  });

  // Close settings modal
  closeSettingsBtn.addEventListener("click", () => {
    settingsModal.style.display = "none";
  });

  // Cancel button (close without saving)
  cancelSettingsBtn.addEventListener("click", () => {
    settingsModal.style.display = "none";
  });

  // Save settings
  saveSettingsBtn.addEventListener("click", () => {
    const value = Math.min(
      Math.max(parseInt(executionTimeoutInput.value || 20), 5),
      60
    ); // Clamp between 5-60s
    const fontSize = Math.min(
      Math.max(parseInt(editorFontSizeInput.value || 14), 12),
      24
    );
    const tabSize = Math.min(
      Math.max(parseInt(editorTabSizeInput.value || 4), 2),
      8
    );
    localStorage.setItem("executionTimeout", value);
    localStorage.setItem("editorFontSize", fontSize);
    localStorage.setItem("editorTabSize", tabSize);

    // Update Editor Settings
    if (window.editor) {
      editor.updateOptions({
        fontSize: fontSize,
        tabSize: tabSize,
      });
    }

    settingsModal.style.display = "none";
  });

  // ===============================
  // ✅ Visual Feedback for Keyboard Shortcut
  // ===============================
  function animateRunButton() {
    const runBtn = document.getElementById("run");
    runBtn.style.transform = "scale(0.95)";
    setTimeout(() => {
      runBtn.style.transform = "scale(1)";
    }, 100);
  }

  // ===============================
  // ✅ Format Code Functionality
  // ===============================
  async function formatCode() {
    const code = window.editor.getValue();
    const language = document.getElementById("language").value;

    try {
        let formattedCode;
        const options = {
            tabWidth: parseInt(localStorage.getItem("editorTabSize") || 4),
            useTabs: false,
        };

        if (language === "javascript" && window.prettierPlugins && window.prettierPlugins.babel) {
            formattedCode = window.prettier.format(code, {
                ...options,
                parser: "babel",
                plugins: [window.prettierPlugins.babel],
                semi: true,
                singleQuote: false,
                trailingComma: "es5",
            });
        } else if (language === "python" && window.prettierPlugins && window.prettierPlugins.python) {
            formattedCode = window.prettier.format(code, {
                ...options,
                parser: "python",
                plugins: [window.prettierPlugins.python],
            });
        } else if (language === "sql") {
            formattedCode = await formatSQLUsingAPI(code); // ✅ Call API function
        } else {
            console.error("❌ Unsupported language or missing formatter:", language);
            return;
        }

        window.editor.setValue(formattedCode);
        console.log("✅ Code formatted successfully!");
    } catch (error) {
        console.error("❌ Error formatting code:", error);
    }
  }

  // ✅ Function to Format SQL using API
  async function formatSQLUsingAPI(sqlCode) {
    try {
        const response = await fetch("https://sqlformat.org/api/v1/format", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                sql: sqlCode,
                reindent: 1,   // Enable indentation
                indent_width: 4, // Use 4 spaces for indentation
                keyword_case: "upper", // Convert SQL keywords to uppercase
                strip_comments: 0, // Keep comments in formatted SQL
            }),
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.result;
    } catch (error) {
        console.error("❌ Failed to format SQL:", error);
        return sqlCode; // Return original SQL if formatting fails
    }
  }

  // ✅ Attach Format Button Event Listener
  const formatButton = document.getElementById("format");
  if (formatButton) {
    formatButton.addEventListener("click", formatCode);
    console.log("✅ Format button event listener attached.");
  } else {
    console.error("❌ Format button not found in the DOM.");
  }

  // ===============================
  // ✅ Keyboard Shortcut for Run
  // ===============================
  document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + Enter to run code
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      document.getElementById("run").click();
      animateRunButton();
    }
  });
});