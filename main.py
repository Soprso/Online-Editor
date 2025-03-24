import black
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess

app = FastAPI()

# ✅ Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 🔒 Change "*" to frontend URL for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CodeRequest(BaseModel):
    code: str
    input_data: str = ""  # ✅ Default empty input
    timeout: int = 5  # ✅ Allow users to set a timeout (default: 5 seconds)

@app.post("/run-python")
def run_python(request: CodeRequest):
    """Formats Python code using `black` & then executes it"""
    try:
        # ✅ Auto-format the code using `black`
        formatted_code = black.format_str(request.code, mode=black.Mode())

        # ✅ Enforce a maximum limit to prevent abuse (e.g., 20 sec max)
        user_timeout = min(request.timeout, 20)

        # ✅ Run Python code with input simulation
        process = subprocess.Popen(
            ["python3", "-c", formatted_code],
            text=True,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = process.communicate(input=request.input_data.strip(), timeout=user_timeout)

        return {"formatted_code": formatted_code, "output": stdout.strip(), "error": stderr.strip()}
    
    except black.NothingChanged:
        return {"formatted_code": request.code, "output": stdout.strip(), "error": stderr.strip()}
    except subprocess.TimeoutExpired:
        return {"error": f"Execution Timeout: Code took longer than {user_timeout} seconds!"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/")
def read_root():
    return {"message": "FastAPI is running!"}
