from pydantic import BaseModel, field_validator


class InventoryAdjustment(BaseModel):
    change_amount: int
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Reason must not be empty")
        return v.strip()
