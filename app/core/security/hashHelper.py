from bcrypt import hashpw, gensalt, checkpw

class HashHelper(object):
  @staticmethod
  def verify_password(plain_password: str, hashed_password: str):
    if checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8')): # This confirms the plain_password, matches with the hashpassword.
      return True
    else:
      return False
    
  @staticmethod  
  def get_password_hash(plain_password: str):
    return hashpw(plain_password.encode('utf-8'), gensalt()).decode('utf-8') # Generating a salt is generating a random string that is added to the password before hashing it. This makes it more difficult for attackers to crack the password using precomputed hash tables (rainbow tables).
    
