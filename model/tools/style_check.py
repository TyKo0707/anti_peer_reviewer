from openai import OpenAI
import json
from environs import Env

env = Env()
env.read_env()
api_key = env.str("OPENAI_API_KEY")

client = OpenAI(api_key=api_key)


def style_check(text):
    """
    Evaluate the writing style of the given text.

    Args:
        text (str): The text to evaluate.

    Returns:
        dict: A dictionary containing the style score.
    """

    prompt = f"""
    Evaluate the following academic abstract for writing style rigorously, considering:
    - Formality and professionalism of tone
    - Clarity and conciseness
    - Avoidance of excessive hedging or vague language
    - Do not consider formulas, equations, tables and figures, concentrate only on plain text
    
    Examples:
    
    Text:
    This paper investigates how transformer models can be used in multilingual parsing. We evaluate performance across 25 languages and demonstrate improvements over existing benchmarks.
    {{ "style_score": 9 }}
    
    Text:
    We sort of try to show that there may be a correlation between neural activation patterns and general intelligence, but it's hard to be totally sure. This paper presents some observations.
    {{ "style_score": 4.5 }}
    
    Text:
    In this work, we describe an approach for classifying temporal expressions using rule-based logic and statistical tagging. Our results indicate reliable improvements on annotated corpora.
    {{ "style_score": 8 }}
    
    Return your score as JSON:
    {{ "style_score": X }}
    Do not write nothing except JSON.
    
    Now evaluate the following text:
    
    Text:
    {text}
    """

    response = client.chat.completions.create(
        model="gpt-4.1-mini",  # or "gpt-4o"
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=20
    )

    output_text = response.choices[0].message.content.strip()
    score = json.loads(output_text)["style_score"]
    return score


if __name__ == '__main__':
    text = "This paper investigates how transformer models can be used in multilingual parsing. We evaluate performance across 25 languages and demonstrate improvements over existing benchmarks."
    style_score = style_check(text)
