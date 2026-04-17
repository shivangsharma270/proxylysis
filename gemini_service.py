import requests
import json
import os

GATEWAY_URL = os.environ.get("GEMINI_GATEWAY_URL", "https://imllm.intermesh.net/v1/chat/completions")
ACCESS_KEY = os.environ.get("GEMINI_API_KEY", "sk-tjw8L1Ya0ERxH55JuSQQQQ")
DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "google/gemini-2.5-pro")

def call_gateway(system_instruction, user_prompt, is_json=False):
    messages = [
        {"role": "system", "content": system_instruction}
    ]
    
    if isinstance(user_prompt, list):
        content = []
        for p in user_prompt:
            if isinstance(p, dict) and "text" in p:
                content.append({"type": "text", "text": p["text"]})
            elif isinstance(p, dict) and "inlineData" in p:
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{p['inlineData']['mimeType']};base64,{p['inlineData']['data']}"}
                })
            else:
                content.append(p)
        messages.append({"role": "user", "content": content})
    else:
        messages.append({"role": "user", "content": str(user_prompt)})

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ACCESS_KEY}"
    }
    
    payload = {
        "model": DEFAULT_MODEL,
        "messages": messages,
        "temperature": 0.1
    }
    
    if is_json:
        payload["response_format"] = {"type": "json_object"}

    response = requests.post(GATEWAY_URL, headers=headers, json=payload)
    
    if response.status_code != 200:
        raise Exception(f"Gateway Error: {response.status_code} - {response.text}")

    data = response.json()
    return data["choices"][0]["message"]["content"]

def analyze_activity_data(json_logs, product_name):
    system_instruction = f"""You are a specialized data analyst tracking user journeys with strict filtering requirements. 
Your task is to analyze the provided JSON CSL logs.

ANALYSIS RULES:

1. DATA TABLE (activities array): 
   - Extract and include ALL log entries present in the JSON response into the "activities" array. 
   - Do NOT filter this array. Every single log entry from the source must be present here for the frontend table.
   - Fields: glId, dateTime, domain, referer, ipAddress, modId, sectionVisited, catalogOwnerId.

2. SEQUENTIAL SUMMARY (sequentialSummary string):
   - TARGET PRODUCT: "{product_name or 'Any'}"
   - This summary is strictly filtered. ONLY include a log entry in this summary if it meets ALL these conditions:
     a) "catalog_owner_glusr_id" is NOT 0 or "0".
     b) The "referer" field is NOT empty and NOT just a generic page name.
     c) The "referer" field MUST contain keywords directly related to "{product_name}" (or semantically similar terms).
   - EXCLUSION: If the referer is empty, or if it contains generic phrases like "Show FCP / MDC Page" without mentioning the product "{product_name}", EXCLUDE that entry from the summary.
   - FALLBACK: If NO entries meet the filtering criteria above, you MUST return exactly: "No related activity found".
   - FORMAT: A sequential list of bullet points starting with "- ". 
     Format: "- [glId] visited [catalogOwnerId] at [dateTime] for the mentioned product".
   - No introductory text. No paragraphs.

TIMING CONVERSION:
- Convert all timestamps from yyyymmddhhmmss to dd-mm-yy hh:mm:ss format.

Return ONLY the JSON object with keys "activities" and "sequentialSummary"."""

    prompt = f"CSL logs to analyze:\n{json.dumps(json_logs, indent=2)}"
    return call_gateway(system_instruction, prompt, is_json=True)

def analyze_matchmaking_data(raw_match_json):
    system_instruction = """You are an expert data engineer. Parse the raw JSON Matchmaking API response and transform it into a strictly flat list of records containing exactly 28 fields.

REQUIRED FIELDS (Map raw values to these keys):
1. contact_city, 2. contact_state, 3. country_name, 4. contacts_name, 5. contacts_company, 6. contacts_mobile1, 7. contact_ph_country, 8. contact_number_type, 9. contact_last_product, 10. last_product_qty, 11. contacts_add_date, 12. last_contact_date, 13. last_contact_date_view, 14. latest_txn_date, 15. latest_txn_date_view, 16. last_message, 17. unread_message_cnt, 18. contacts_glid, 19. im_contact_id, 20. uniqueId, 21. fk_glusr_usr_id, 22. is_txn_initiator, 23. latest_txn_initiator, 24. is_call, 25. mcat_id, 26. mcat_name, 27. starred_lead_color, 28. contact_type_remarks

RULES:
- Locate the array of records within the raw input (look for keys like 'data', 'contacts', 'records', or the root array).
- For each record, map available values to the 28 required fields.
- If a field is missing, use an empty string "" or "0" for unread_message_cnt.
- Ensure all 28 keys exist in every object in the output array.
- Return ONLY the JSON object with key "contacts" containing the array."""

    prompt = f"Matchmaking Source Data: {json.dumps(raw_match_json)}"
    text = call_gateway(system_instruction, prompt, is_json=True)
    parsed = json.loads(text)
    return parsed.get("contacts", [])

def identify_involved_glids(csl_logs, matchmaking_records, product_name):
    system_instruction = f"""You are a conflict intelligence auditor. Your task is to identify GLIDs (Global User IDs) where the product "{product_name}" (or terms that resemble or match it exactly) appears in the activity records.

INPUT DATA:
- Target Product Name: {product_name}
- CSL Log Excerpts: {json.dumps([{"referer": l.get("referer"), "glId": l.get("glusr_id")} for l in csl_logs if l and isinstance(l, dict)])}
- Matchmaking Records: {json.dumps([{"glId": m.get("contacts_glid"), "lastProduct": m.get("contact_last_product"), "companyName": m.get("contacts_company")} for m in matchmaking_records if m and isinstance(m, dict)])}

AUDIT LOGIC:
1. Scan CSL log "referer" fields for the exact product name "{product_name}" or terms that resemble it.
2. Scan Matchmaking "lastProduct" and "companyName" fields for matches or resemblances to "{product_name}".
3. Identify the GLIDs associated with these entries.
4. Do NOT provide involvement logic or explanations.

OUTPUT:
Return a JSON array of objects representing the identified GLIDs in a key called "involvedGLIDs".
Each object must have:
- glId: The identified ID.
- companyName: The company name associated with this GLID from matchmaking records.
- lastProduct: The product string found in the data that matched/resembled "{product_name}".
- confidenceScore: A percentage string (e.g., "100%" for exact match, "80%" for resemblance).

Return ONLY the JSON object."""

    prompt = f"Identify GLIDs matching product: {product_name}"
    text = call_gateway(system_instruction, prompt, is_json=True)
    parsed = json.loads(text)
    return parsed.get("involvedGLIDs", [])

def analyze_product_mismatch(product_name, mcat_categories):
    if not product_name or not mcat_categories:
        return {"result": "Mismatch"}

    system_instruction = f"""You are a product category expert. Your task is to determine if a specific "Product" is a subset of, or a relevant match for, a list of "MCAT Categories".

LOGIC:
- A "No Mismatch" occurs if the Product is a type of item, a specific model, a synonym, or a subset that logically falls under any of the provided MCAT Categories.
- A "Mismatch" occurs if the Product is completely unrelated to all the provided MCAT Categories.

INPUT:
- Product: {product_name}
- MCAT Categories: {", ".join(mcat_categories)}

OUTPUT:
Return a JSON object with a single key "result" which must be either "No Mismatch" or "Mismatch".
Return ONLY the JSON object."""

    prompt = f"Compare Product '{product_name}' with Categories: {', '.join(mcat_categories)}"
    text = call_gateway(system_instruction, prompt, is_json=True)
    return json.loads(text)

def scan_documents_with_gemini(files):
    system_instruction = """You are a specialized document auditor. Your task is to perform OCR on the provided documents (invoices, screenshots, WhatsApp chats) and extract specific contact and payment details.

EXTRACT THESE FIELDS:
1. Names: List all person or company names found.
2. Phone Numbers: List all mobile or landline numbers.
3. Emails: List all email addresses.
4. UPI ID of receiver: Specifically look for UPI IDs (e.g., name@bank, number@upi) that appear to be the payment receiver.
5. Address: List any physical addresses found.

RULES:
- If a field is not found, return an empty array for that field.
- Remove duplicates.
- Return ONLY the JSON object with keys: names, phoneNumbers, emails, upiIds, addresses."""

    parts = [{"inlineData": {"data": f["data"].split(",")[1], "mimeType": f["mimeType"]}} for f in files]
    parts.append({"text": "Scan these documents and extract Names, Phone Numbers, Emails, UPI IDs, and Addresses."})

    text = call_gateway(system_instruction, parts, is_json=True)
    return json.loads(text)

def search_online_presence(company_name, address, gst, contact):
    system_instruction = f"""You are a business intelligence researcher. Your task is to find the online presence, ratings, and reviews for a specific seller across various platforms (Google, Justdial, Indiamart, Facebook, etc.).
  
  SELLER DETAILS:
  - Name: {company_name}
  - Address: {address}
  - GST: {gst}
  - Contact: {contact}
  
  TASK:
  1. Find the seller's profiles and ratings on major platforms.
  2. Specifically look for Google Reviews/Rating.
  3. Look for other platforms like Trustpilot, Facebook, Justdial, etc.
  4. Extract the platform name, the rating (out of 5), and the direct link to the profile/reviews page.
  
  OUTPUT FORMAT:
  Return a JSON object with an array called "presence".
  Each item in the array should have:
  - platform: Name of the platform (e.g., "Google", "Facebook", "Justdial")
  - rating: The numeric rating (e.g., 4.1) or "N/A" if not found.
  - link: The direct URL to the profile or reviews page.
  
  Return ONLY the JSON object."""

    prompt = f"Find online presence and ratings for: {company_name}, {address}, {contact}"
    text = call_gateway(system_instruction, prompt, is_json=True)
    parsed = json.loads(text)
    return parsed.get("presence", [])
