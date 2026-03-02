from enum import Enum

from pydantic import BaseModel, field_validator


class OrderStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    processing = "processing"
    completed = "completed"
    cancelled = "cancelled"


# Valid status transitions: current -> allowed next statuses
VALID_STATUS_TRANSITIONS: dict[OrderStatus, list[OrderStatus]] = {
    OrderStatus.pending: [OrderStatus.confirmed, OrderStatus.cancelled],
    OrderStatus.confirmed: [OrderStatus.processing, OrderStatus.cancelled],
    OrderStatus.processing: [OrderStatus.completed, OrderStatus.cancelled],
    OrderStatus.completed: [],
    OrderStatus.cancelled: [],
}


class OrderItemCreate(BaseModel):
    product_id: str
    quantity: int

    @field_validator("quantity")
    @classmethod
    def quantity_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return v


class OrderCreate(BaseModel):
    store_id: str | None = None
    notes: str | None = None
    items: list[OrderItemCreate]

    @field_validator("items")
    @classmethod
    def items_must_not_be_empty(cls, v: list[OrderItemCreate]) -> list[OrderItemCreate]:
        if not v:
            raise ValueError("Order must contain at least one item")
        return v


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderResponse(BaseModel):
    id: str
    order_number: str
    collector_id: str
    store_id: str
    status: str
    subtotal: float
    tax_amount: float
    total_amount: float
    notes: str | None
    created_at: str
    updated_at: str
    items: list[dict] | None = None
    collector: dict | None = None
    store: dict | None = None
