import os
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

DEBUG = os.environ.get('DEBUG', True)

DATABASE_URI = os.environ.get('DATABASE_URI', 'sqlite:///' + os.path.join(BASE_DIR, 'audit.db'))
# DATABASE_URI = 'postgresql://localhost/cf_audit'
MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 16*2014*1024))

ADMINS = set(os.environ.get('ADMINS', '').split(','))
if not ADMINS:
    ADMINS = set([290271])  # Zverik

# Override these (and anything else) in config_local.py or 
# set environment variable accordingly.
OAUTH_KEY = os.environ.get('OAUTH_KEY', '')
OAUTH_SECRET = os.environ.get('OAUTH_SECRET', '')
SECRET_KEY = os.environ.get('SECRET_KEY', 'sdkjfhsfljhsadf')

try:
    from config_local import *
except ImportError:
    pass
