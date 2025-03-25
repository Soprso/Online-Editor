import black
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import subprocess
import uuid
import os
import shutil
import signal
from typing import Optional

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
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
        print(f"Received request for {request.language} code")  

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
        print("Timeout occurred")  
        raise HTTPException(status_code=408, detail="Execution timed out")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")  
        raise HTTPException(status_code=500, detail=str(e))

# ✅ Function to Terminate Process on Timeout
def terminate_process(process):
    try:
        process.terminate()  # Try graceful termination
        process.wait(2)  # Wait 2 seconds for termination
    except subprocess.TimeoutExpired:
        process.kill()  # Force kill if still running
    except Exception as e:
        print(f"Error terminating process: {e}")

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

        try:
            stdout, stderr = process.communicate(
                input=request.input_data,
                timeout=request.timeout
            )
        except subprocess.TimeoutExpired:
            terminate_process(process)
            raise HTTPException(status_code=408, detail="Python execution timed out")

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

        try:
            stdout, stderr = process.communicate(
                input=request.input_data,
                timeout=request.timeout
            )
        except subprocess.TimeoutExpired:
            terminate_process(process)
            raise HTTPException(status_code=408, detail="Python execution timed out")

        return {
            "output": stdout.strip(),
            "error": stderr.strip(),
            "formatted_code": request.code
        }

async def run_c_cpp(request: CodeRequest):
    temp_dir = "temp_exec"
    os.makedirs(temp_dir, exist_ok=True)
    base_path = os.path.join(temp_dir, str(uuid.uuid4()))
    src_file = f"{base_path}.{'c' if request.language == 'c' else 'cpp'}"
    executable = f"{base_path}"

    try:
        with open(src_file, "w") as f:
            f.write(request.code)

        compiler = "gcc" if request.language == "c" else "g++"
        compile_command = [compiler, src_file, "-o", executable]

        print(f"Compiling with: {' '.join(compile_command)}")  

        compile_result = subprocess.run(
            compile_command,
            capture_output=True,
            text=True,
            timeout=5
        )

        if compile_result.returncode != 0:
            return {"error": compile_result.stderr}

        print(f"Executing: ./{executable}")  

        process = subprocess.Popen(
            [f"./{executable}"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        try:
            stdout, stderr = process.communicate(
                input=request.input_data, timeout=request.timeout
            )
        except subprocess.TimeoutExpired:
            terminate_process(process)
            raise HTTPException(status_code=408, detail="C/C++ execution timed out")

        return {
            "output": stdout.strip(),
            "error": stderr.strip()
        }

    except FileNotFoundError as e:
        print(f"Compiler not found: {str(e)}")  
        return {
            "error": f"Compiler ({compiler}) not available. Render's environment may not have GCC installed."
        }

    finally:
        for f in [src_file, executable]:
            if os.path.exists(f):
                os.remove(f)
        if os.path.exists(temp_dir) and not os.listdir(temp_dir):
            shutil.rmtree(temp_dir)

@app.get("/")
async def health_check():
    return {"status": "running"}
