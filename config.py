import os
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

DEBUG = True

DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, 'audit.db')
# DATABASE_URI = 'postgresql://localhost/cf_audit'
MAX_CONTENT_LENGTH = 16*1024*1024

ADMINS = set([290271])  # Zverik

# Override these (and anything else) in config_local.py
OAUTH_KEY = ''
OAUTH_SECRET = ''
SECRET_KEY = 'sdkjfhsfljhsadf'
MAPILLARY_CLIENT_ID = ''

try:
    from config_local import *
except ImportError:
    pass
