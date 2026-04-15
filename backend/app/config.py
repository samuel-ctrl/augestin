from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://edutrack:edutrack123@postgres:5432/edutrack_db"
    JWT_SECRET: str = "change_me"
    JWT_EXPIRY_HOURS: int = 24
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    ADMIN_BASIC_USER: str = ""
    ADMIN_BASIC_PASS: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
