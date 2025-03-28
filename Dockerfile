FROM mcr.microsoft.com/dotnet/sdk:7.0 AS build

# Install Python and C/C++ tools
RUN apt-get update && \
    apt-get install -y python3 python3-pip gcc g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Set environment variables for Python.NET
ENV PYTHONNET_RUNTIME=coreclr
ENV DOTNET_ROOT=/usr/share/dotnet

# Start FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]