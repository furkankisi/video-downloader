from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Modüllerimizi içe aktarıyoruz (api_youtube yerine api_x)
from api_instagram import router as insta_router
from api_tiktok import router as tiktok_router
from api_x import router as x_router  # YouTube yerine X modülü

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router'ları ekliyoruz
app.include_router(insta_router)
app.include_router(tiktok_router)
app.include_router(x_router)  # YouTube router'ı yerine X router'ı

@app.get("/")
def root():
    return {"status": "VideoSaver PRO API aktif ve çalışıyor!"}