from pydantic import BaseModel, field_validator


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    sku: str | None = None
    category_id: str | None = None
    price: float
    stock_quantity: int = 0
    unit: str = "unit"
    image_url: str | None = None

    @field_validator("price")
    @classmethod
    def price_must_be_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Price must not be negative")
        return v

    @field_validator("stock_quantity")
    @classmethod
    def stock_must_be_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Stock quantity must not be negative")
        return v


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    sku: str | None = None
    category_id: str | None = None
    price: float | None = None
    stock_quantity: int | None = None
    unit: str | None = None
    image_url: str | None = None
    is_active: bool | None = None

    @field_validator("price")
    @classmethod
    def price_must_be_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Price must not be negative")
        return v

    @field_validator("stock_quantity")
    @classmethod
    def stock_must_be_non_negative(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("Stock quantity must not be negative")
        return v


class ProductResponse(BaseModel):
    id: str
    name: str
    description: str | None
    sku: str | None
    category_id: str | None
    price: float
    stock_quantity: int
    unit: str
    image_url: str | None
    is_active: bool
    created_at: str
    updated_at: str
