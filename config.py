import os
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

DEBUG = os.environ.get('DEBUG', True)

DATABASE_URI = os.environ.get('DATABASE_URI', 'sqlite:///' + os.path.join(BASE_DIR, 'audit.db'))
MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 16*1024*1024))

ADMINS = os.environ.get('ADMINS')
if ADMINS:
    ADMINS = set([int(adm_id) for adm_id in ADMINS.split(',')])

# Override these (and anything else) in config_local.py or 
# set environment variable accordingly.
OAUTH_KEY = os.environ.get('OAUTH_KEY')
OAUTH_SECRET = os.environ.get('OAUTH_SECRET')
SECRET_KEY = os.environ.get('SECRET_KEY')

try:
    from config_local import *
except ImportError:
    pass

assert OAUTH_KEY
assert OAUTH_SECRET
assert SECRET_KEY
assert ADMINS
