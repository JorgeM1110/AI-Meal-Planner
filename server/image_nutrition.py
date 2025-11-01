# server/image_nutrition.py
import os, re, tempfile, traceback
from typing import Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from google import genai
from google.genai import types
from usda_fdc import FdcClient
from dotenv import load_dotenv

# Load .env so GEMINI_API_KEY / USDA_FDC_KEY are available
load_dotenv()

router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
USDA_FDC_KEY  = os.getenv("USDA_FDC_KEY")
if not GEMINI_API_KEY or not USDA_FDC_KEY:
    raise RuntimeError("Missing GEMINI_API_KEY or USDA_FDC_KEY in environment")

# Be consistent: use `client` everywhere
client = genai.Client(api_key=GEMINI_API_KEY)
fdc    = FdcClient(USDA_FDC_KEY)

PRI_NUTRS = {
    "Energy": "kcal",
    "Protein": "g",
    "Total lipid (fat)": "g",
    "Carbohydrate, by difference": "g",
    "Sugars, total including NLEA": "g",
    "Fiber, total dietary": "g",
    "Sodium, Na": "mg",
}

def pick_nutrients(nlist):
    out = []
    for n in (nlist or []):
        name = getattr(n, "name", None)
        if not name:
            continue
        if (name in PRI_NUTRS) or len(out) < 12:
            out.append({
                "name": name,
                "amount": getattr(n, "amount", None),
                "unit": getattr(n, "unit_name", None),
            })
    return out

@router.post("/image-nutrition")
async def image_nutrition(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image/* file.")

    tmp_path = None
    try:
        # --- Save upload to a temp file (SDK supports path-based upload) ---
        suffix = ".jpg" if "jpeg" in (file.content_type or "") else ".png"
        image_bytes = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        # --- 1) Upload the file to Gemini Files API ---
        uploaded = client.files.upload(file=tmp_path)

        # --- 2) Ask Gemini for ONE concise food label (brand if visible) ---
        prompt1 = (
            "Describe the main food you see using as few words as possible. "
            "Choose ONE specific item only (include brand if visible). "
            "Do NOT include sizes, counts, or preparation descriptors."
        )
        resp1 = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[uploaded, prompt1],
            config=types.GenerateContentConfig(temperature=0.2, top_p=0.9, top_k=40),
        )
        food_query = (resp1.text or "").strip()
        if not food_query:
            raise HTTPException(status_code=422, detail="Model could not identify a food from the image.")

        # --- 3) Search USDA for candidates ---
        results = fdc.search(food_query, page_size=200)
        if results.total_hits == 0 or not results.foods:
            raise HTTPException(status_code=404, detail=f"No USDA matches for '{food_query}'")

        options, indexes = [], []
        for food in results.foods[:50]:
            indexes.append(food.fdc_id)
            brand = getattr(food, "brand_owner", None)
            options.append(f"{food.description}{' | Brand: '+brand if brand else ''}")

        # --- 4) Ask Gemini to choose ONE index from the list ---
        numbered = [f"{i}: {opt}" for i, opt in enumerate(options)]
        prompt2 = (
            "From the numbered list, pick the ONE index that best matches the image. "
            "Return ONLY the number. Consider brand text if any."
        )
        resp2 = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[uploaded, "\n".join(numbered), prompt2],
            config=types.GenerateContentConfig(temperature=0.2, top_p=0.9, top_k=40),
        )
        raw = (resp2.text or "").strip()
        m = re.search(r"\d+", raw or "")
        if not m:
            raise HTTPException(status_code=422, detail=f"Invalid index from model: '{raw}'")
        idx = int(m.group(0))
        if idx < 0 or idx >= len(indexes):
            raise HTTPException(status_code=422, detail=f"Index out of range: {idx}")

        # --- 5) Fetch USDA food and return trimmed nutrients list ---
        food = fdc.get_food(indexes[idx])
        return {
            "detected_label": food_query,
            "fdc_id": food.fdc_id,
            "description": food.description,
            "brand_owner": getattr(food, "brand_owner", None),
            "brand_name": getattr(food, "brand_name", None),
            "category": getattr(food, "food_category", None),
            "class": getattr(food, "food_class", None),
            "serving_size": getattr(food, "serving_size", None),
            "serving_unit": getattr(food, "serving_size_unit", None),
            "ingredients": getattr(food, "ingredients", None),
            "nutrients": pick_nutrients(getattr(food, "nutrients", [])),
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": f"Unhandled error: {e}"})
    finally:
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
