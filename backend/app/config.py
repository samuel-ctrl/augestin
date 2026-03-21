from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://edutrack:edutrack123@postgres:5432/edutrack_db"
    JWT_SECRET: str = "change_me"
    JWT_EXPIRY_HOURS: int = 24
    UPLOAD_DIR: str = "/app/uploads"
    MAX_VIDEO_SIZE_MB: int = 500
    MAX_THUMBNAIL_SIZE_MB: int = 5

    class Config:
        env_file = ".env"


settings = Settings()
