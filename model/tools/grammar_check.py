import difflib
import requests


def grammar_correct_local(text, model, tokenizer):
    input_text = f"Fix grammatical errors in this sentence: {text}"
    input_ids = tokenizer(input_text, return_tensors="pt").input_ids

    outputs = model.generate(input_ids, max_length=512)

    return tokenizer.decode(outputs[0], skip_special_tokens=True)


def grammar_correct_server(text):
    response = requests.post("http://localhost:8000/correct", json={"text": text})
    return response.json()["corrected"]


def count_text_differences(original, corrected):
    diff = difflib.ndiff(original.split(), corrected.split())
    changes = [d for d in diff if d.startswith("- ") or d.startswith("+ ")]
    return len(changes) // 2


if __name__ == '__main__':
    from transformers import AutoTokenizer, T5ForConditionalGeneration

    tokenizer = AutoTokenizer.from_pretrained("grammarly/coedit-large")
    model = T5ForConditionalGeneration.from_pretrained("grammarly/coedit-large")
    correct = grammar_correct('This is a test sentence with a grammatical error.', model, tokenizer)
    print(correct)
