# from app.core.security.hashHelper import HashHelper
# print(HashHelper.get_password_hash("biologixaccess"))


import secrets
print(secrets.token_urlsafe())