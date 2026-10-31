"""CivicEye AI — YOLO civic-issue detection service (FastAPI).

This service is ONLY responsible for image inference. Complaint registration,
duplicate detection, priority scoring, SQLite persistence, evidence tracking,
and dashboards all remain in the existing Express.js backend.

No fake predictions are returned. If no trained model is configured, every
detection request returns a clear model_not_configured error.
"""

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image
from ultralytics import YOLO

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

load_dotenv()

MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "./models/best.pt")
CONF_THRESHOLD = float(os.getenv("YOLO_CONF_THRESHOLD", "0.25"))
IOU_THRESHOLD = float(os.getenv("YOLO_IOU_THRESHOLD", "0.45"))
HOST = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
PORT = int(os.getenv("AI_SERVICE_PORT", "8000"))

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION = 1600  # resize larger images for inference speed

# Map YOLO class names -> CivicEye categories. Update to match your trained model.
CLASS_MAP = {
    "pothole": "pothole",
    "road_damage": "damaged_road",
    "damaged_road": "damaged_road",
    "damagedroad": "damaged_road",
    "garbage": "garbage",
    "trash": "garbage",
    "litter": "garbage",
    "garbage_overflow": "garbage",
    "waterlogging": "water_leakage",
    "flood": "water_leakage",
    "water_leakage": "water_leakage",
    "water": "water_leakage",
    "damaged_infrastructure": "other",
    "other": "other",
    "infrastructure_damage": "other",
    "streetlight": "streetlight",
    "broken_streetlight": "streetlight",
    "drainage": "water_leakage",
    "drain_problem": "water_leakage",
}

CIVIC_CATEGORIES = {"pothole", "damaged_road", "garbage", "water_leakage", "streetlight", "other"}

app = FastAPI(title="CivicEye YOLO Detection Service", version="1.0.0")

model: Optional[YOLO] = None
model_loaded = False
model_error: Optional[str] = None


def _load_model() -> None:
    global model, model_loaded, model_error
    model_path = Path(MODEL_PATH)
    if not model_path.exists():
        model_error = (
            "Trained YOLO model not found. Place a trained best.pt in the AI service "
            "models/ directory or set YOLO_MODEL_PATH. Manual complaint registration "
            "still works."
        )
        model_loaded = False
        return
    try:
        model = YOLO(str(model_path))
        model_loaded = True
        model_error = None
    except Exception as exc:  # noqa: BLE001
        print(f"[ai-service] Failed to load YOLO model: {exc}", flush=True)
        model_loaded = False
        model_error = (
            "Failed to load the configured YOLO model. Check the weights file and "
            "AI service logs. Manual complaint registration still works."
        )


@app.on_event("startup")
def _startup() -> None:
    _load_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _civic_category(class_name: str) -> str:
    key = class_name.strip().lower()
    return CLASS_MAP.get(key, "other")


def _prepare_image(upload: UploadFile) -> Image.Image:
    if upload.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=415,
            detail="Only JPEG, PNG or WebP images are accepted.",
        )
    try:
        image = Image.open(upload.file).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid image file: {exc}") from exc

    # Resize large images for faster inference while keeping aspect ratio.
    image.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
    return image


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model_loaded,
        "model_path": str(Path(MODEL_PATH).resolve()),
        "model_error": model_error,
        "supported_categories": sorted(CIVIC_CATEGORIES),
    }


@app.post("/detect")
async def detect(image: UploadFile = File(...)):
    if not model_loaded or model is None:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "model_not_configured",
                "message": model_error
                or "No trained YOLO model is configured. AI detection is unavailable.",
            },
        )

    pil_image = _prepare_image(image)

    try:
        results = model(pil_image, conf=CONF_THRESHOLD, iou=IOU_THRESHOLD, verbose=False)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}") from exc

    result = results[0]
    detections = []
    best = None

    if result.boxes is not None and len(result.boxes) > 0:
        names = result.names
        for box in result.boxes:
            cls_id = int(box.cls[0])
            class_name = names[cls_id]
            confidence = float(box.conf[0])
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
            category = _civic_category(class_name)

            detections.append(
                {
                    "category": category,
                    "class": class_name,
                    "confidence": round(confidence, 4),
                    "bounding_box": {
                        "x1": round(x1, 1),
                        "y1": round(y1, 1),
                        "x2": round(x2, 1),
                        "y2": round(y2, 1),
                    },
                }
            )

        # Pick the highest-confidence detection as the primary suggestion.
        best = max(detections, key=lambda d: d["confidence"])

    if best is None:
        return JSONResponse(
            status_code=200,
            content={
                "detected": False,
                "category": None,
                "title": None,
                "description": None,
                "confidence": 0.0,
                "detections": [],
                "message": "No civic issue detected with sufficient confidence.",
            },
        )

    category = best["category"]
    confidence = best["confidence"]
    title, description = _suggest_text(category, confidence)

    return {
        "detected": True,
        "category": category,
        "title": title,
        "description": description,
        "confidence": round(confidence, 4),
        "bounding_box": best["bounding_box"],
        "detections": detections,
        "message": f"Detected {category.replace('_', ' ')} with {round(confidence * 100)}% confidence.",
    }


def _suggest_text(category: str, confidence: float):
    suggestions = {
        "pothole": (
            "Road Pothole Detected",
            "A possible pothole has been detected in the uploaded photograph. "
            "Please review the location and details before submitting.",
        ),
        "damaged_road": (
            "Road Damage Detected",
            "Road surface damage has been detected in the uploaded photograph. "
            "Please review the location and details before submitting.",
        ),
        "garbage": (
            "Garbage Overflow Detected",
            "Garbage overflow or waste accumulation has been detected in the uploaded photograph. "
            "Please review the location and details before submitting.",
        ),
        "water_leakage": (
            "Waterlogging Detected",
            "Waterlogging or water accumulation has been detected in the uploaded photograph. "
            "Please review the location and details before submitting.",
        ),
        "streetlight": (
            "Damaged Streetlight Detected",
            "A damaged or broken streetlight has been detected in the uploaded photograph. "
            "Please review the location and details before submitting.",
        ),
        "other": (
            "Damaged Infrastructure Detected",
            "Possible damaged infrastructure has been detected in the uploaded photograph. "
            "Please review the location and details before submitting.",
        ),
    }
    return suggestions.get(category, suggestions["other"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
