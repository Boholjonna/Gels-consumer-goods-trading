from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: dict


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
