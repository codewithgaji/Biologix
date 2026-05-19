import jwt
from decouple import config
import time

JWT_SECRET    = config("JWT_SECRET")
JWT_ALGORITHM = config("JWT_ALGORITHM")

SESSION_DURATION = 60 * 60 * 2  # 2 hours in seconds

class AuthHandler(object):
    @staticmethod
    def sign_jwt(user_id: int) -> str:
        payload = {
            "user_id": user_id,
            "expires": time.time() + SESSION_DURATION
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        # PyJWT 2.x returns string, older returns bytes
        return token if isinstance(token, str) else token.decode("utf-8")

    @staticmethod
    def decode_jwt(token: str) -> dict:
        try:
            decoded_token = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM]
            )
            return decoded_token if decoded_token["expires"] >= time.time() else None
        except jwt.ExpiredSignatureError:
            print("Token has expired")
            return {}
        except jwt.InvalidTokenError as e:
            print(f"Invalid token: {e}")
            return {}