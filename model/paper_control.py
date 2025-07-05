from tools import grammar_check, style_check, structure_check
import pandas as pd

if __name__ == '__main__':
    import time
    df = pd.read_parquet("/Users/tyko0707/Desktop/anti_peer_reviewer/model/processed_data.parquet")
    paper = df.iloc[0]

    time1 = time.time()
    print("Starting paper analysis...")
    # Get grammar score
    print("Checking grammar...")
    corrected_sentence = grammar_check.grammar_correct_server(paper.abstract)
    diff_score = grammar_check.count_text_differences(paper.abstract, corrected_sentence)

    # Get style score
    print("Checking style...")
    style_score = style_check.style_check(paper.text)

    # Get structure score
    print("Checking structure...")
    section_score, flow_score, argument_score = structure_check.structure_check(paper.text)

    print(f"Grammar Score: {diff_score}, Style Score: {style_score}, Section Completeness: {section_score}, "
          f"Logical Flow: {flow_score}, Argument Strength: {argument_score}")

    time2 = time.time()
    print(f"Total time taken: {time2 - time1:.2f} seconds")
