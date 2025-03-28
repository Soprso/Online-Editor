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
import threading

# Configure .NET Core runtime before importing clr
os.environ["PYTHONNET_RUNTIME"] = "coreclr"

import clr
from System import String
from System.IO import StringReader, StringWriter
from System.CodeDom.Compiler import CompilerParameters, CodeDomProvider
from Microsoft.CSharp import CSharpCodeProvider
import System

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
    language: str  # "python", "c", "cpp", "csharp"
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
        elif request.language == "csharp":
            result = await run_csharp(request)
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
                timeout=request.timeout
            )
        except subprocess.TimeoutExpired:
            terminate_process(process)
            raise HTTPException(status_code=408, detail="Python execution timed out")

        return {
            "output": stdout.strip(),
            "error": stderr.strip(),
            "formatted_code": code_to_run
        }
    except Exception as e:
        if process:
            terminate_process(process)
        raise HTTPException(status_code=500, detail=str(e))

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
        compile_flags = ["-std=c++17", "-pthread"] if request.language == "cpp" else []
        compile_command = [compiler, src_file, "-o", executable] + compile_flags

        compile_result = subprocess.run(
            compile_command,
            capture_output=True,
            text=True,
            timeout=10
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
                    timeout=request.timeout
                )
            except subprocess.TimeoutExpired:
                terminate_process(process)
                raise HTTPException(status_code=408, detail="Execution timed out")

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

async def run_csharp(request: CodeRequest):
    try:
        # Initialize .NET runtime
        if not clr.is_loaded():
            clr.AddReference("System.Console")
            clr.AddReference("System.Runtime")

        # Create compiler
        provider = CSharpCodeProvider()
        compiler_params = CompilerParameters()
        compiler_params.GenerateInMemory = True
        compiler_params.GenerateExecutable = False
        
        # Add standard assemblies
        compiler_params.ReferencedAssemblies.Add("System.dll")
        compiler_params.ReferencedAssemblies.Add("System.Core.dll")
        compiler_params.ReferencedAssemblies.Add("Microsoft.CSharp.dll")
        compiler_params.ReferencedAssemblies.Add("System.Runtime.dll")
        
        # Auto-wrap code in Main method if needed
        wrapped_code = request.code
        if "static void Main(" not in wrapped_code and "static int Main(" not in wrapped_code:
            wrapped_code = f"""
using System;
class Program
{{
    static void Main()
    {{
        {wrapped_code}
    }}
}}
"""
        # Compile with timeout
        start_time = time.time()
        results = None
        
        def compile():
            nonlocal results
            results = provider.CompileAssemblyFromSource(compiler_params, wrapped_code)
        
        compile_thread = threading.Thread(target=compile)
        compile_thread.start()
        compile_thread.join(timeout=request.timeout)
        
        if compile_thread.is_alive():
            raise HTTPException(status_code=408, detail="C# compilation timed out")
        
        if results.Errors.HasErrors:
            errors = "\n".join(str(e) for e in results.Errors)
            return {"error": f"C# compilation errors:\n{errors}"}
        
        assembly = results.CompiledAssembly
        entry_point = assembly.EntryPoint
        
        if entry_point is None:
            return {"error": "No entry point found. Add a static Main method."}
        
        # Capture output
        original_stdout = System.Console.Out
        string_writer = StringWriter()
        System.Console.SetOut(string_writer)
        
        # Handle input
        original_stdin = System.Console.In
        if request.input_data:
            System.Console.SetIn(StringReader(request.input_data))
        
        # Execute with timeout
        try:
            execution_thread = threading.Thread(target=entry_point.Invoke, args=(None, None))
            execution_thread.start()
            remaining_time = request.timeout - (time.time() - start_time)
            execution_thread.join(timeout=max(1, remaining_time))
            
            if execution_thread.is_alive():
                raise HTTPException(status_code=408, detail="C# execution timed out")
                
            output = string_writer.ToString().strip()
            return {"output": output}
            
        except Exception as e:
            return {"error": f"C# execution error: {str(e)}"}
            
        finally:
            System.Console.SetOut(original_stdout)
            System.Console.SetIn(original_stdin)
            
    except HTTPException:
        raise
    except Exception as e:
        return {"error": f"C# processing error: {str(e)}"}

@app.get("/")
async def health_check():
    return {"status": "running"}