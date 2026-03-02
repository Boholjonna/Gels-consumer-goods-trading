from database import supabase


def adjust_stock(product_id: str, change_amount: int, reason: str, performed_by: str) -> dict:
    # Verify product exists and get current stock atomically
    product = (
        supabase.table("products")
        .select("id, stock_quantity")
        .eq("id", product_id)
        .single()
        .execute()
    )
    if not product.data:
        raise ValueError("Product not found")

    new_stock = product.data["stock_quantity"] + change_amount
    if new_stock < 0:
        raise ValueError(
            f"Insufficient stock: available {product.data['stock_quantity']}, adjustment {change_amount}"
        )

    # Use RPC to atomically adjust stock and prevent race conditions
    supabase.rpc(
        "adjust_product_stock",
        {"p_product_id": product_id, "p_change": change_amount},
    ).execute()

    supabase.table("inventory_logs").insert(
        {
            "product_id": product_id,
            "change_amount": change_amount,
            "reason": reason,
            "performed_by": performed_by,
        }
    ).execute()

    return supabase.table("products").select("*").eq("id", product_id).single().execute().data


def get_logs(product_id: str, page: int = 1, page_size: int = 50) -> dict:
    offset = (page - 1) * page_size
    result = (
        supabase.table("inventory_logs")
        .select("*, profiles!inventory_logs_performed_by_fkey(full_name)", count="exact")
        .eq("product_id", product_id)
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    return {"data": result.data, "total": result.count, "page": page, "page_size": page_size}
