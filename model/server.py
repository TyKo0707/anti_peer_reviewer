from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, T5ForConditionalGeneration

app = FastAPI()

print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained("grammarly/coedit-large")
print("Tokenizer loaded.")

print("Loading model...")
model = T5ForConditionalGeneration.from_pretrained("grammarly/coedit-large")
print("Model loaded.")


class TextIn(BaseModel):
    text: str


@app.post("/correct")
def correct(text_in: TextIn):
    input_text = f"Fix grammatical errors in this sentence: {text_in.text}"
    input_ids = tokenizer(input_text, return_tensors="pt").input_ids
    output_ids = model.generate(input_ids, max_length=512)
    output = tokenizer.decode(output_ids[0], skip_special_tokens=True)
    return {"corrected": output}
