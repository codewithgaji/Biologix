from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.security.authHandler import AuthHandler

security = HTTPBearer()

def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Security(security)
):
    token = credentials.credentials

    decoded = AuthHandler.decode_jwt(token)

    if not decoded:
        raise HTTPException(
            status_code=403,
            detail="Invalid or expired token"
        )

    return decoded