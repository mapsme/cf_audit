#!/usr/bin/env python
import os
import sys
import codecs
from www.util import *

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, BASE_DIR)
PYTHON = 'python2.7'
VENV_DIR = os.path.join(BASE_DIR, 'venv', 'lib', PYTHON, 'site-packages')
if os.path.exists(VENV_DIR):
    sys.path.insert(1, VENV_DIR)

if len(sys.argv) < 3:
    print "Usage: {} <project_id> <features.json> [<audit.json>]".format(sys.argv[0])
    sys.exit(1)

with codecs.open(sys.argv[2], 'r', 'utf-8') as f:
    features = json.load(f)['features']
if not features:
    print "No features read"
    sys.exit(2)

audit = None
if len(sys.argv) > 3:
    with codecs.open(sys.argv[3], 'r', 'utf-8') as f:
        audit = json.load(f)

try:
    project = Project.get(Project.name == sys.argv[1])
except Project.DoesNotExist:
    print "No such project: {}".format(sys.argv[1])
    sys.exit(2)

proj_audit = json.loads(project.audit or '{}')
if audit:
    proj_audit.update(audit)
    project.audit = json.dumps(proj_audit, ensure_ascii=False)
project.updated = datetime.datetime.utcnow().date()

with database.atomic():
    update_features(project, features, proj_audit)

update_audit(project)
update_features_cache(project)
project.save()
