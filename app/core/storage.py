import os
import shutil
from datetime import datetime, timezone
from decouple import config

# Switch between "local" and "supabase" via .env, no code changes needed
# when you're ready to move to Supabase Storage.
STORAGE_BACKEND = config("STORAGE_BACKEND", default="local")
LOCAL_STORAGE_DIR = config("LOCAL_STORAGE_DIR", default="./uploads/imports")

# Supabase — only needed once STORAGE_BACKEND=supabase
SUPABASE_URL         = config("SUPABASE_URL", default="")
SUPABASE_KEY         = config("SUPABASE_KEY", default="")
SUPABASE_BUCKET      = config("SUPABASE_BUCKET", default="biologix-imports")


def save_import_file(file_bytes: bytes, original_filename: str, import_type: str) -> str:
    """
    Saves a raw import file and returns a storage_path that get_import_file()
    can use later to retrieve it. Filename is timestamped so files never
    collide and so IT can identify an import by date without opening it.
    """
    ts       = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    ext      = os.path.splitext(original_filename)[1] or ".dat"
    filename = f"{import_type}_{ts}{ext}"

    if STORAGE_BACKEND == "local":
        return _save_local(file_bytes, filename)
    elif STORAGE_BACKEND == "supabase":
        return _save_supabase(file_bytes, filename)
    else:
        raise RuntimeError(f"Unknown STORAGE_BACKEND: {STORAGE_BACKEND}")


def get_import_file(storage_path: str) -> bytes:
    """Retrieves raw bytes for a previously saved import file."""
    if STORAGE_BACKEND == "local":
        return _get_local(storage_path)
    elif STORAGE_BACKEND == "supabase":
        return _get_supabase(storage_path)
    else:
        raise RuntimeError(f"Unknown STORAGE_BACKEND: {STORAGE_BACKEND}")


def import_file_exists(storage_path: str) -> bool:
    if STORAGE_BACKEND == "local":
        return os.path.isfile(storage_path)
    elif STORAGE_BACKEND == "supabase":
        # Supabase list/exists check — implement alongside _get_supabase below.
        raise NotImplementedError("import_file_exists not yet wired for Supabase")
    return False


# ─── Local disk backend ───────────────────────────────────────────────────────
def _save_local(file_bytes: bytes, filename: str) -> str:
    os.makedirs(LOCAL_STORAGE_DIR, exist_ok=True)
    path = os.path.join(LOCAL_STORAGE_DIR, filename)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return path


def _get_local(storage_path: str) -> bytes:
    if not os.path.isfile(storage_path):
        raise FileNotFoundError(f"Import file not found on disk: {storage_path}")
    with open(storage_path, "rb") as f:
        return f.read()


# ─── Supabase Storage backend — stubbed, wire in once you have a project ─────
def _save_supabase(file_bytes: bytes, filename: str) -> str:
    raise NotImplementedError(
        "Supabase Storage not yet configured. Set SUPABASE_URL, SUPABASE_KEY, "
        "SUPABASE_BUCKET in .env, install the `supabase` package, and implement "
        "this using supabase.storage.from_(SUPABASE_BUCKET).upload(...)"
    )


def _get_supabase(storage_path: str) -> bytes:
    raise NotImplementedError(
        "Supabase Storage not yet configured. Implement using "
        "supabase.storage.from_(SUPABASE_BUCKET).download(storage_path)"
    )