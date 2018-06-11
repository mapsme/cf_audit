#!/usr/bin/env python
import os
import sys

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, BASE_DIR)
PYTHON = 'python2.7'
VENV_DIR = os.path.join(BASE_DIR, 'venv', 'lib', PYTHON, 'site-packages')
if os.path.exists(VENV_DIR):
    sys.path.insert(1, VENV_DIR)

import codecs
import datetime
import logging
import json
from www.db import Project, database
from www.util import update_features, update_features_cache

if len(sys.argv) < 3:
    print "Usage: {} <project_id> <features.json> [<audit.json>]".format(sys.argv[0])
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s', datefmt='%H:%M:%S')
logging.info('Reading JSON files')

if sys.argv[2] == '-':
    features = []
else:
    with codecs.open(sys.argv[2], 'r', 'utf-8') as f:
        features = json.load(f)['features']

audit = None
if len(sys.argv) > 3:
    with codecs.open(sys.argv[3], 'r', 'utf-8') as f:
        audit = json.load(f)

if not features and not audit:
    logging.error("No features read")
    sys.exit(2)

try:
    project = Project.get(Project.name == sys.argv[1])
except Project.DoesNotExist:
    logging.error("No such project: %s", sys.argv[1])
    sys.exit(2)

logging.info('Updating features')

proj_audit = json.loads(project.audit or '{}')
if audit:
    proj_audit.update(audit)
    project.audit = json.dumps(proj_audit, ensure_ascii=False)
project.updated = datetime.datetime.utcnow().date()

with database.atomic():
    update_features(project, features, proj_audit)

logging.info('Updating the feature cache')
update_features_cache(project)
project.save()
