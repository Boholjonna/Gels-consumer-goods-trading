import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from database import supabase
from dependencies import get_current_user, require_admin
from schemas.product import ProductCreate, ProductUpdate
from services import product_service

router = APIRouter()

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@router.get("")
async def list_products(
    user: Annotated[dict, Depends(get_current_user)],
    search: str | None = None,
    category_id: str | None = None,
    is_active: bool | None = True,
    page: int = 1,
    page_size: int = 50,
):
    page_size = min(page_size, 200)
    return product_service.list_products(
        search=search,
        category_id=category_id,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )


@router.get("/{product_id}")
async def get_product(product_id: str, user: Annotated[dict, Depends(get_current_user)]):
    result = product_service.get_product(product_id)
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    return result


@router.post("")
async def create_product(body: ProductCreate, admin: Annotated[dict, Depends(require_admin)]):
    return product_service.create_product(body.model_dump())


@router.put("/{product_id}")
async def update_product(
    product_id: str,
    body: ProductUpdate,
    admin: Annotated[dict, Depends(require_admin)],
):
    return product_service.update_product(product_id, body.model_dump())


@router.delete("/{product_id}")
async def delete_product(product_id: str, admin: Annotated[dict, Depends(require_admin)]):
    return product_service.delete_product(product_id)


@router.post("/upload-image")
async def upload_product_image(
    admin: Annotated[dict, Depends(require_admin)],
    file: UploadFile = File(...),
):
    """Upload a product image to Supabase Storage and return the public URL."""
    # Validate file type
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 5MB.")

    # Ensure bucket exists
    bucket_name = "product-images"
    try:
        supabase.storage.get_bucket(bucket_name)
    except Exception:
        supabase.storage.create_bucket(
            bucket_name, options={"public": True}
        )

    # Upload with unique filename
    file_path = f"{uuid.uuid4()}.{ext}"
    supabase.storage.from_(bucket_name).upload(
        file_path,
        content,
        file_options={"content-type": file.content_type or "image/jpeg"},
    )

    # Get public URL
    public_url = supabase.storage.from_(bucket_name).get_public_url(file_path)

    return {"image_url": public_url}
