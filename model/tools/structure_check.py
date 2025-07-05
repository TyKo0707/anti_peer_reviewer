from openai import OpenAI
import json
from environs import Env

env = Env()
env.read_env()
api_key = env.str("OPENAI_API_KEY")

client = OpenAI(api_key=api_key)


def structure_check(text):
    """
    Evaluate the structure of the given paper.

    Args:
        text (str): The text to evaluate.

    Returns:
        dict: A dictionary containing the structure scores.
    """

    prompt = f"""
    Evaluate the structure of the following academic paper text according to the following criteria rigorously:
    
    1. Section Completeness — Does the text contain all core sections typical of an academic paper (e.g., Introduction, Method, Results, Discussion/Conclusion)? Are those sections present in content, even if not explicitly labeled?
    
    2. Logical Flow — Does the text progress logically from problem statement to methods, results, and conclusion? Are transitions clear and coherent?
    
    3. Argument Strength — Are claims supported by clear reasoning, evidence, or citations?
    
    Examples:
    
    Text:
    We introduce a neural model for syntactic parsing. The introduction explains the motivation, followed by a detailed method, quantitative evaluation, and a discussion of limitations. The paper ends with a clear conclusion.
    {{ "section_completeness": 9.5, "logical_flow": 9.5, "argument_strength": 9 }}
    
    Text:
    This work presents a new machine learning model. It includes a method and result section, but lacks an introduction or conclusion. The arguments are somewhat justified, but many claims are stated without empirical support.
    {{ "section_completeness": 6, "logical_flow": 6.5, "argument_strength": 5 }}
    
    Text:
    We kind of experimented with a model to check if it might work. It maybe improves performance? We don’t really have clear results or comparisons, but it seems promising.
    {{ "section_completeness": 3, "logical_flow": 2, "argument_strength": 1.5 }}
    
    Return a JSON object with scores (0–10) for each category, where 10 is best. Do not include explanations.
    
    Format:
    {{ "section_completeness": X, "logical_flow": Y, "argument_strength": Z }}
    
    Now evaluate the following text:
    
    Text:
    {text}
    """

    response = client.chat.completions.create(
        model="gpt-4.1-mini",  # or "gpt-4o"
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=100
    )

    output_text = response.choices[0].message.content.strip()
    scores = json.loads(output_text)
    section_score = scores["section_completeness"]
    flow_score = scores["logical_flow"]
    argument_score = scores["argument_strength"]
    return section_score, flow_score, argument_score


if __name__ == '__main__':
    text = "This paper investigates how transformer models can be used in multilingual parsing. We evaluate performance across 25 languages and demonstrate improvements over existing benchmarks."
    section_sc, flow_sc, argument_sc = structure_check(text)
