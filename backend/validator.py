from PyPDF2 import PdfReader
import re


def validate_pdf_format(file_path: str) -> dict:
    try:
        reader = PdfReader(file_path)
        num_pages = len(reader.pages)
        if num_pages < 3:
            return {"valid": False, "reason": "Too few pages (<3)"}

        text = ""
        for page in reader.pages[:min(5, num_pages)]:  # Analyze only first few pages
            text += page.extract_text() or ""

        text = text.lower()

        # Check for presence of academic section headings
        academic_keywords = [
            "abstract", "introduction", "methodology", "methods",
            "results", "discussion", "conclusion", "references", "bibliography"
        ]
        keyword_hits = [kw for kw in academic_keywords if kw in text]
        if len(keyword_hits) < 3:
            return {
                "valid": False,
                "reason": "Missing common academic sections: found only {}".format(', '.join(keyword_hits))
            }

        # Check for DOIs or citations
        if not re.search(r'doi:\s*10\.\d{4,9}/[-._;()/:a-z0-9]+', text) and \
                not re.search(r'arxiv:\s*\d{4}\.\d{4,5}', text) and \
                not re.search(r'\[\d+\]', text):  # e.g., [1], [2]
            return {"valid": False, "reason": "No DOI, arXiv, or citation references found"}

        return {"valid": True}

    except Exception as e:
        return {"valid": False, "reason": f"Error reading PDF: {str(e)}"}


if __name__ == "__main__":
    # Example usage
    result = validate_pdf_format("example.pdf")
    print(result)
