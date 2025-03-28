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
import time
from typing import Optional

app = FastAPI()

# Configuration
MAX_TIMEOUT = 60  # Maximum allowed timeout in seconds (matches frontend)
MIN_TIMEOUT = 1   # Minimum allowed timeout
DEFAULT_TIMEOUT = 5  # Default timeout if none specified

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
    language: str  # "python", "c", "cpp", "csharp"
    input_data: str = ""
    timeout: Optional[int] = None  # Make timeout optional

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"}
    )

def get_effective_timeout(request_timeout: Optional[int]) -> int:
    """Determine the effective timeout with safety limits"""
    if request_timeout is None:
        return DEFAULT_TIMEOUT
    return min(max(MIN_TIMEOUT, request_timeout), MAX_TIMEOUT)

@app.post("/run-code")
async def run_code(request: CodeRequest):
    start_time = time.time()
    effective_timeout = get_effective_timeout(request.timeout)
    
    try:
        print(f"Received request for {request.language} code with timeout {effective_timeout}s")
        print(f"Input data: {request.input_data[:100]}...")  # Log first 100 chars of input

        if not request.code.strip():
            raise HTTPException(status_code=400, detail="Empty code")
            
        if request.language == "python":
            result = await run_python(request, effective_timeout)
        elif request.language in ["c", "cpp"]:
            result = await run_c_cpp(request, effective_timeout)
        elif request.language == "csharp":
            result = await run_csharp(request, effective_timeout)
        else:
            raise HTTPException(status_code=400, detail="Unsupported language")
            
        execution_time = time.time() - start_time
        print(f"Execution completed in {execution_time:.2f} seconds")
        return result
        
    except subprocess.TimeoutExpired:
        execution_time = time.time() - start_time
        print(f"Timeout occurred after {execution_time:.2f} seconds")
        raise HTTPException(
            status_code=408, 
            detail=f"Execution timed out after {effective_timeout} seconds"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def terminate_process(process):
    try:
        if hasattr(os, 'killpg'):
            try:
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            except ProcessLookupError:
                pass
        else:
            process.terminate()

        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
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

async def run_python(request: CodeRequest, timeout: int):
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
        kwargs = {
            'stdin': subprocess.PIPE,
            'stdout': subprocess.PIPE,
            'stderr': subprocess.PIPE,
            'text': True,
        }
        
        if os.name == 'posix':
            kwargs['preexec_fn'] = os.setsid
        else:
            kwargs['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP

        process = subprocess.Popen(
            ["python", "-c", code_to_run],
            **kwargs
        )

        try:
            stdout, stderr = process.communicate(
                input=request.input_data,
                timeout=timeout
            )
        except subprocess.TimeoutExpired:
            terminate_process(process)
            raise

        return {
            "output": stdout.strip(),
            "error": stderr.strip(),
            "formatted_code": code_to_run
        }
    except Exception as e:
        if process:
            terminate_process(process)
        raise HTTPException(status_code=500, detail=str(e))

async def run_c_cpp(request: CodeRequest, timeout: int):
    temp_dir = "temp_exec"
    os.makedirs(temp_dir, exist_ok=True)
    base_path = os.path.join(temp_dir, str(uuid.uuid4()))
    src_file = f"{base_path}.{'c' if request.language == 'c' else 'cpp'}"
    executable = f"{base_path}"

    try:
        with open(src_file, "w") as f:
            f.write(request.code)

        compiler = "gcc" if request.language == "c" else "g++"
        compile_flags = ["-std=c++17", "-pthread"] if request.language == "cpp" else []
        compile_command = [compiler, src_file, "-o", executable] + compile_flags

        # Limit compile time to 10 seconds or 1/3 of total timeout
        compile_timeout = min(10, timeout // 3)
        compile_result = subprocess.run(
            compile_command,
            capture_output=True,
            text=True,
            timeout=compile_timeout
        )

        if compile_result.returncode != 0:
            return {"error": compile_result.stderr}

        process = None
        try:
            kwargs = {
                'stdin': subprocess.PIPE,
                'stdout': subprocess.PIPE,
                'stderr': subprocess.PIPE,
                'text': True,
            }
            
            if os.name == 'posix':
                kwargs['preexec_fn'] = os.setsid
            else:
                kwargs['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP

            process = subprocess.Popen(
                [f"./{executable}"],
                **kwargs
            )

            try:
                stdout, stderr = process.communicate(
                    input=request.input_data,
                    timeout=timeout - compile_timeout  # Remaining time after compilation
                )
            except subprocess.TimeoutExpired:
                terminate_process(process)
                raise

            return {
                "output": stdout.strip(),
                "error": stderr.strip()
            }

        except Exception as e:
            if process:
                terminate_process(process)
            raise

    finally:
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

async def run_csharp(request: CodeRequest, timeout: int):
    temp_dir = "temp_exec"
    os.makedirs(temp_dir, exist_ok=True)
    base_path = os.path.join(temp_dir, str(uuid.uuid4()))
    src_file = f"{base_path}.cs"
    executable = f"{base_path}.dll"

    try:
        # Write C# code to file
        with open(src_file, "w") as f:
            f.write(request.code)

        # Compile using dotnet
        compile_result = subprocess.run(
            ["dotnet", "new", "console", "-o", temp_dir, "--force"],
            capture_output=True,
            text=True,
            timeout=10
        )

        if compile_result.returncode != 0:
            return {"error": compile_result.stderr}

        # Replace Program.cs with user code
        os.replace(src_file, os.path.join(temp_dir, "Program.cs"))

        # Build the project
        build_result = subprocess.run(
            ["dotnet", "build", temp_dir, "-o", temp_dir],
            capture_output=True,
            text=True,
            timeout=timeout // 2  # Use half of timeout for compilation
        )

        if build_result.returncode != 0:
            return {"error": build_result.stderr}

        # Run the compiled program
        process = None
        try:
            kwargs = {
                'stdin': subprocess.PIPE,
                'stdout': subprocess.PIPE,
                'stderr': subprocess.PIPE,
                'text': True,
                'cwd': temp_dir
            }
            
            if os.name == 'posix':
                kwargs['preexec_fn'] = os.setsid
            else:
                kwargs['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP

            process = subprocess.Popen(
                ["dotnet", "run", "--no-build"],
                **kwargs
            )

            try:
                stdout, stderr = process.communicate(
                    input=request.input_data,
                    timeout=timeout - (timeout // 2)  # Remaining time after compilation
                )
            except subprocess.TimeoutExpired:
                terminate_process(process)
                raise

            return {
                "output": stdout.strip(),
                "error": stderr.strip()
            }

        except Exception as e:
            if process:
                terminate_process(process)
            raise

    finally:
        try:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
        except:
            pass

@app.get("/")
async def health_check():
    return {"status": "running"}