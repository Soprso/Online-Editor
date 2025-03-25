import black
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import subprocess
import uuid
import os
import shutil
from typing import Optional

app = FastAPI()

# Enhanced CORS Configuration for Render deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (replace with your frontend URL later)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CodeRequest(BaseModel):
    code: str
    language: str  # "python", "c", or "cpp"
    input_data: str = ""
    timeout: int = 5

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"}
    )

@app.post("/run-code")
async def run_code(request: CodeRequest):
    try:
        print(f"Received request for {request.language} code")  # Debug log
        
        if not request.code.strip():
            raise HTTPException(status_code=400, detail="Empty code")
            
        if request.language == "python":
            result = await run_python(request)
        elif request.language in ["c", "cpp"]:
            result = await run_c_cpp(request)
        else:
            raise HTTPException(status_code=400, detail="Unsupported language")
            
        return result
        
    except subprocess.TimeoutExpired:
        print("Timeout occurred")  # Debug log
        raise HTTPException(status_code=408, detail="Execution timed out")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))

async def run_python(request: CodeRequest):
    try:
        formatted_code = black.format_str(request.code, mode=black.Mode())
        process = subprocess.Popen(
            ["python", "-c", formatted_code],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate(
            input=request.input_data,
            timeout=request.timeout
        )
        return {
            "output": stdout.strip(),
            "error": stderr.strip(),
            "formatted_code": formatted_code
        }
    except black.NothingChanged:
        process = subprocess.Popen(
            ["python", "-c", request.code],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate(
            input=request.input_data,
            timeout=request.timeout
        )
        return {
            "output": stdout.strip(),
            "error": stderr.strip(),
            "formatted_code": request.code
        }

async def run_c_cpp(request: CodeRequest):
    # Render-specific adjustments
    temp_dir = "temp_exec"
    os.makedirs(temp_dir, exist_ok=True)
    base_path = os.path.join(temp_dir, str(uuid.uuid4()))
    src_file = f"{base_path}.{'c' if request.language == 'c' else 'cpp'}"
    executable = f"{base_path}"

    try:
        # Write source file
        with open(src_file, "w") as f:
            f.write(request.code)

        # Determine compiler (gcc/g++ must be available in Render's environment)
        compiler = "gcc" if request.language == "c" else "g++"
        
        # Compile command (note: no .exe extension on Render)
        compile_command = [compiler, src_file, "-o", executable]
        print(f"Compiling with: {' '.join(compile_command)}")  # Debug log
        
        compile_result = subprocess.run(
            compile_command,
            capture_output=True,
            text=True,
            timeout=5
        )

        if compile_result.returncode != 0:
            return {"error": compile_result.stderr}

        # Execute the compiled program
        print(f"Executing: ./{executable}")  # Debug log
        exec_result = subprocess.run(
            [f"./{executable}"],  # Note the ./ prefix for Linux environments
            input=request.input_data,
            capture_output=True,
            text=True,
            timeout=request.timeout
        )

        return {
            "output": exec_result.stdout.strip(),
            "error": exec_result.stderr.strip()
        }
    except FileNotFoundError as e:
        print(f"Compiler not found: {str(e)}")  # Debug log
        return {
            "error": f"Compiler ({compiler}) not available. Render's environment may not have GCC installed."
        }
    finally:
        # Clean up files
        for f in [src_file, executable]:
            if os.path.exists(f):
                os.remove(f)
        if os.path.exists(temp_dir) and not os.listdir(temp_dir):
            shutil.rmtree(temp_dir)

@app.get("/")
async def health_check():
    return {"status": "running"}