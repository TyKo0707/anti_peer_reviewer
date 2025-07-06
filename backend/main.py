from fastapi import FastAPI, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import shutil
import tempfile

from environs import Env
env = Env()
env.read_env()

import boto3
from botocore.config import Config
from validator import validate_pdf_format

app = FastAPI()

# === CORS ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You may restrict this to your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === PDF Validation Endpoint ===
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


# === Pre-Signed URL Generation Endpoint ===
@app.get("/sign-s3")
def sign_s3(file_name: str = Query(...), file_type: str = Query(...)):
    s3 = boto3.client(
        "s3",
        region_name=env.str("REACT_APP_AWS_REGION"),
        aws_access_key_id=env.str("REACT_APP_AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=env.str("REACT_APP_AWS_SECRET_ACCESS_KEY"),
        config=Config(signature_version="s3v4")
    )

    key = f"papers/{file_name}"
    try:
        url = s3.generate_presigned_url(
            ClientMethod='put_object',
            Params={
                'Bucket': env.str("REACT_APP_S3_BUCKET"),
                'Key': key,
                'ContentType': file_type
            },
            ExpiresIn=300
        )
        return {"url": url, "key": key}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
