# CivicEye AI — YOLO Detection Service

Separate Python/FastAPI inference service for the **Snap & Report** photo detection feature.

## Architecture

```
React Frontend (Vite)
    |
    v
Express.js Backend (port 4000)
    |
    v  (POST /api/ai/detect, forwards image)
Python YOLO Service / FastAPI (port 8000)
    |
    v
YOLO model (Ultralytics) -> detection results (category, confidence, bbox)
    |
    v
Express returns result to frontend; frontend submits via existing /api/issues
```

The Python service is **only** responsible for image inference. Complaint registration, duplicate detection, priority scoring, SQLite persistence, evidence tracking, and dashboards all remain in the existing Express backend.

## Supported civic issue categories

* Pothole (`pothole`)
* Road Damage (`damaged_road`)
* Garbage Overflow (`garbage`)
* Waterlogging (`water_leakage`)
* Damaged Streetlight (`streetlight`)
* Damaged Infrastructure (`other`)

## Prerequisites

* Python 3.9+ (tested with Python 3.14)
* `pip`

A trained civic-issue YOLO model (`.pt` file from Ultralytics) is **required** for real detections. No pretrained generic model is bundled, and the service will not return fake predictions. See "Configure a trained model" below.

## Install

From `hmmu/server/ai-service`:

```bash
pip install -r requirements.txt
```

## Configure a trained model

1. Obtain or train a YOLO model weights file (`best.pt`) from Ultralytics.
   * Training instructions are in the section below.
2. Place `best.pt` in `hmmu/server/ai-service/models/` (or set `YOLO_MODEL_PATH` to your file).
3. Copy `.env.example` to `.env` and update:

```
YOLO_MODEL_PATH=./models/best.pt
```

If no model file is found at startup, the service still starts but every detection request returns a clear `model_not_configured` error. The Express backend and manual complaint registration continue to work normally.

## Run the service

```bash
# From hmmu/server/ai-service
python app.py
```

Service listens on `http://0.0.0.0:8000` by default.

Endpoints:

* `GET /health` — service status + model loaded state
* `POST /detect` — multipart `image` file -> `{ category, confidence, bounding_box, detections }`

## Train a custom civic-issue model (Ultralytics)

1. Prepare a dataset in YOLO format:

```
dataset/
  data.yaml
  train/images/  train/labels/
  val/images/    val/labels/
```

`data.yaml` example:

```yaml
path: ./dataset
train: train/images
val: val/images
nc: 6
names: ['pothole', 'damaged_road', 'garbage', 'water_leakage', 'streetlight', 'other']
```

2. Train:

```bash
pip install ultralytics
yolo detect train data=dataset/data.yaml model=yolov8n.pt epochs=50 imgsz=640
```

3. Copy `runs/detect/train/weights/best.pt` to `hmmu/server/ai-service/models/best.pt`.

## Class mapping

The service maps detected YOLO class names to CivicEye categories:

| YOLO class (example) | CivicEye category |
|---|---|
| pothole | pothole |
| road_damage / damaged_road | damaged_road |
| garbage / trash / litter | garbage |
| waterlogging / flood / water | water_leakage |
| streetlight / broken_streetlight | streetlight |
| damaged_infrastructure / other | other |

Update `CLASS_MAP` in `app.py` to match your trained model's class names.

## Security notes

* Only JPEG/PNG/WebP accepted (validated by the Express gateway as well).
* Max upload size enforced by Express (5 MB).
* No internal file paths are returned to the frontend.
* The AI service is not exposed directly to the browser; Express proxies it.
