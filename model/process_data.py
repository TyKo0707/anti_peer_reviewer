import json

from datasets import load_from_disk
import re
import pandas as pd
from tqdm import tqdm


def naive_sentence_split(text):
    # Split on ., !, ? followed by space or newline and capital letter
    sentences = re.split(r'(?<=[.!?])[\s\n]+(?=[A-Z])', text.strip())

    result = []
    for s in sentences:
        s = s.strip()
        if s and s[0].isupper() and (s.endswith(('.', '!', '?')) or s == sentences[-1]):
            result.append(s)
    return " ".join(result)


def remove_number_only_lines(text):
    lines = text.splitlines()
    filtered = [line for line in lines if not re.fullmatch(r"\s*[\d ]+\s*", line)]
    return "\n".join(filtered)


def process_text(text):
    text = remove_number_only_lines(text)
    text = naive_sentence_split(text)
    return text


def extract_texts(papers, reviews):
    df = pd.DataFrame(columns=['id', 'title', 'text', 'sections', 'references', 'conference', 'abstract', 'review_result'])
    for i in tqdm(range(len(papers))):
        paper = papers[i]
        review = reviews[i]
        sections = paper['metadata']['sections']
        if len(sections['heading']) == len(sections['text']):
            if len(sections['text']) > 2:
                if sections['heading'][0] == 'None':
                    sections['heading'] = sections['heading'][1:]
                    sections['text'] = sections['text'][1:]
                sections['heading'] = [h.lower() for h in sections['heading']]

                text = ''
                if paper['metadata']['abstractText']:
                    text += f"Abstract: {process_text(paper['metadata']['abstractText'])}\n\n"

                for j in range(len(sections['text'])):
                    section_text = process_text(sections['text'][j])
                    text += f'{sections["heading"][j]}: {section_text}\n\n'

                # Add new line to df
                text = text.strip()
                if text:
                    try:
                        df = df._append({
                            'id': review['id'],
                            'title': review['title'],
                            'text': text,
                            'sections': '|'.join(sections['heading']),
                            'references': paper['metadata']['references'],
                            'conference': review['conference'],
                            'abstract': paper['metadata']['abstractText'],
                            'review_result': int(review['accepted'])
                        }, ignore_index=True)
                    except:
                        pass
    return df


if __name__ == "__main__":
    # parsed_pdfs = load_from_disk("/Users/tyko0707/Desktop/anti_peer_reviewer/model/parsed_pdfs")
    # reviews = load_from_disk("/Users/tyko0707/Desktop/anti_peer_reviewer/model/reviews")
    # df1 = extract_texts(parsed_pdfs['train'], reviews['train'])
    # df2 = extract_texts(parsed_pdfs['test'], reviews['test'])
    # df3 = extract_texts(parsed_pdfs['validation'], reviews['validation'])
    # df = pd.concat([df1, df2, df3], ignore_index=True)
    # df.to_parquet("/Users/tyko0707/Desktop/anti_peer_reviewer/model/processed_data.parquet")
    df = pd.read_parquet("/Users/tyko0707/Desktop/anti_peer_reviewer/model/processed_data.parquet")
    print(df.review_result.value_counts())
