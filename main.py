import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ayrı ayrı yazdığımız dosyaları içeri alıyoruz (Modüler Sistem)
from api_instagram import router as ig_router
from api_youtube import router as yt_router
from api_tiktok import router as tt_router

app = FastAPI(title="VideoSaver PRO Yönlendirici")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotaları ana sisteme bağlıyoruz
app.include_router(ig_router)
app.include_router(yt_router)
app.include_router(tt_router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)