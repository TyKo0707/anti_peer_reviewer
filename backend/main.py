from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import shutil
import tempfile
from validator import validate_pdf_format

app = FastAPI()

# Allow frontend to call it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/validate")
async def validate(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        result = validate_pdf_format(tmp_path)
        if result["valid"]:
            return JSONResponse(content={"valid": True})
        else:
            return JSONResponse(content={"valid": False, "reason": result.get("reason", "Unknown format")})
    except Exception as e:
        return JSONResponse(status_code=500, content={"valid": False, "error": str(e)})
