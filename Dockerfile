FROM python:3.9-slim

# Install GCC/G++ (required for C/C++ compilation)
RUN apt-get update && apt-get install -y gcc g++

# Copy all files to /app in the container
COPY . /app
WORKDIR /app

# Install Python dependencies
RUN pip install -r requirements.txt

# Start FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]