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
import time

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
    timeout: int = 5  # Default timeout in seconds

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"}
    )

@app.post("/run-code")
async def run_code(request: CodeRequest):
    start_time = time.time()
    try:
        print(f"Received request for {request.language} code with timeout {request.timeout}s")

        if not request.code.strip():
            raise HTTPException(status_code=400, detail="Empty code")
            
        if request.language == "python":
            result = await run_python(request)
        elif request.language in ["c", "cpp"]:
            result = await run_c_cpp(request)
        else:
            raise HTTPException(status_code=400, detail="Unsupported language")
            
        execution_time = time.time() - start_time
        print(f"Execution completed in {execution_time:.2f} seconds")
        return result
        
    except subprocess.TimeoutExpired:
        execution_time = time.time() - start_time
        print(f"Timeout occurred after {execution_time:.2f} seconds")
        raise HTTPException(status_code=408, detail="Execution timed out")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def terminate_process(process):
    try:
        # Try to terminate the entire process group
        if hasattr(os, 'killpg'):
            try:
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            except ProcessLookupError:
                pass
        else:
            process.terminate()
        
        # Wait for process to terminate
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            # Force kill if still running
            if hasattr(os, 'killpg'):
                try:
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                except ProcessLookupError:
                    pass
            else:
                process.kill()
            process.wait()
    except Exception as e:
        print(f"Error terminating process: {e}")

async def run_python(request: CodeRequest):
    try:
        formatted_code = black.format_str(request.code, mode=black.Mode())
        code_to_run = formatted_code
    except black.NothingChanged:
        code_to_run = request.code
    except Exception as e:
        print(f"Code formatting error: {e}")
        code_to_run = request.code

    process = None
    try:
        process = subprocess.Popen(
            ["python", "-c", code_to_run],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            preexec_fn=os.setsid if hasattr(os, 'setsid') else None,
            start_new_session=True
        )

        stdout, stderr = process.communicate(
            input=request.input_data,
            timeout=request.timeout
        )

        return {
            "output": stdout.strip(),
            "error": stderr.strip(),
            "formatted_code": code_to_run
        }
    except subprocess.TimeoutExpired:
        if process:
            terminate_process(process)
        raise HTTPException(status_code=408, detail="Python execution timed out")
    except Exception as e:
        if process:
            terminate_process(process)
        raise

async def run_c_cpp(request: CodeRequest):
    temp_dir = "temp_exec"
    os.makedirs(temp_dir, exist_ok=True)
    base_path = os.path.join(temp_dir, str(uuid.uuid4()))
    src_file = f"{base_path}.{'c' if request.language == 'c' else 'cpp'}"
    executable = f"{base_path}"

    try:
        # Write source file with proper headers
        with open(src_file, "w") as f:
            f.write(request.code)

        compiler = "gcc" if request.language == "c" else "g++"
        
        # Enhanced compilation flags
        compile_flags = ["-std=c++17", "-pthread", "-O2"]
        if request.language == "c":
            compile_flags = ["-O2"]  # C doesn't need thread flags
            
        compile_command = [compiler, src_file, "-o", executable] + compile_flags

        # Compile with extended timeout
        compile_result = subprocess.run(
            compile_command,
            capture_output=True,
            text=True,
            timeout=min(20, request.timeout * 2)  # Double timeout for compilation
        )

        if compile_result.returncode != 0:
            return {"error": compile_result.stderr}

        # Run with proper process group killing
        process = None
        try:
            process = subprocess.Popen(
                [f"./{executable}"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                preexec_fn=os.setsid,
                start_new_session=True
            )

            # Use communicate with timeout
            stdout, stderr = process.communicate(
                input=request.input_data,
                timeout=request.timeout
            )

            return {
                "output": stdout.strip(),
                "error": stderr.strip()
            }

        except subprocess.TimeoutExpired:
            # Kill entire process group
            try:
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
            except ProcessLookupError:
                pass
            raise HTTPException(status_code=408, detail="Execution timed out")
            
        except Exception as e:
            if process and process.poll() is None:
                try:
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                except ProcessLookupError:
                    pass
            raise

    finally:
        # Cleanup files
        for f in [src_file, executable]:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except:
                pass
        try:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
        except:
            pass
@app.get("/")
async def health_check():
    return {"status": "running"}