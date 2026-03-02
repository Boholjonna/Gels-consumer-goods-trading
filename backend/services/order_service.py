from database import supabase
from schemas.order import OrderStatus, VALID_STATUS_TRANSITIONS


def resolve_store_from_branch(branch_id: str | None) -> str | None:
    """Find or create a store entry for a branch. Returns store_id."""
    if not branch_id:
        return None

    # Get branch details
    branch_result = (
        supabase.table("branches").select("name, location").eq("id", branch_id).execute()
    )
    if not branch_result.data:
        return None

    branch = branch_result.data[0]
    branch_name = branch["name"]

    # Check if a store already exists for this branch (match by name)
    existing = (
        supabase.table("stores")
        .select("id")
        .eq("name", branch_name)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]["id"]

    # Create a store entry for this branch
    store_result = supabase.table("stores").insert({
        "name": branch_name,
        "address": branch.get("location"),
    }).execute()
    return store_result.data[0]["id"]


def create_order(collector_id: str, store_id: str, notes: str | None, items: list[dict]) -> dict:
    items_jsonb = [{"product_id": item["product_id"], "quantity": item["quantity"]} for item in items]
    result = supabase.rpc(
        "create_order",
        {
            "p_collector_id": collector_id,
            "p_store_id": store_id,
            "p_notes": notes,
            "p_items": items_jsonb,
        },
    ).execute()
    return result.data


def list_orders(
    collector_id: str | None = None,
    store_id: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    query = supabase.table("orders").select(
        "*, order_items(*), profiles!orders_collector_id_fkey(full_name, email), stores(name)",
        count="exact",
    )

    if collector_id:
        query = query.eq("collector_id", collector_id)
    if store_id:
        query = query.eq("store_id", store_id)
    if status:
        query = query.eq("status", status)

    offset = (page - 1) * page_size
    query = query.order("created_at", desc=True).range(offset, offset + page_size - 1)

    result = query.execute()
    return {"data": result.data, "total": result.count, "page": page, "page_size": page_size}


def get_order(order_id: str) -> dict | None:
    result = (
        supabase.table("orders")
        .select(
            "*, order_items(*), profiles!orders_collector_id_fkey(full_name, email), stores(name, address)"
        )
        .eq("id", order_id)
        .execute()
    )
    return result.data[0] if result.data else None


def update_order_status(order_id: str, new_status: OrderStatus) -> dict:
    # Fetch current order to validate transition
    current = (
        supabase.table("orders")
        .select("id, status")
        .eq("id", order_id)
        .execute()
    )
    if not current.data:
        raise ValueError("Order not found")

    current_status = OrderStatus(current.data[0]["status"])
    allowed = VALID_STATUS_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise ValueError(
            f"Cannot transition from '{current_status.value}' to '{new_status.value}'"
        )

    result = (
        supabase.table("orders")
        .update({"status": new_status.value})
        .eq("id", order_id)
        .execute()
    )
    return result.data[0]
