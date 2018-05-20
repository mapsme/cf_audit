from .db import Feature, Task
from peewee import fn
import json
import hashlib


def update_features(project, features, audit):
    curfeats = Feature.select(Feature).where(Feature.project == project)
    ref2feat = {f.ref: f for f in curfeats}
    if features:
        deleted = set(ref2feat.keys())
    else:
        deleted = set()
    updated = set()
    minlat = minlon = 180.0
    maxlat = maxlon = -180.0
    for f in features:
        data = json.dumps(f, ensure_ascii=False, sort_keys=True)
        md5 = hashlib.md5()
        md5.update(data.encode('utf-8'))
        md5_hex = md5.hexdigest()

        coord = f['geometry']['coordinates']
        if coord[0] < minlon:
            minlon = coord[0]
        if coord[0] > maxlon:
            maxlon = coord[0]
        if coord[1] < minlat:
            minlat = coord[1]
        if coord[1] > maxlat:
            maxlat = coord[1]

        if 'ref_id' in f['properties']:
            ref = f['properties']['ref_id']
        else:
            ref = '{}{}'.format(f['properties']['osm_type'], f['properties']['osm_id'])

        update = False
        if ref in ref2feat:
            deleted.remove(ref)
            feat = ref2feat[ref]
            if feat.feature_md5 != md5_hex:
                update = True
        else:
            feat = Feature(project=project, ref=ref)
            feat.validates_count = 0
            update = True

        f_audit = audit.get(ref)
        if f_audit:
            f_audit = json.dumps(f_audit, ensure_ascii=False, sort_keys=True)
            if f_audit != feat.audit:
                feat.audit = f_audit
                update = True

        if update:
            feat.feature = data
            feat.feature_md5 = md5_hex
            feat.lon = round(coord[0] * 1e7)
            feat.lat = round(coord[1] * 1e7)
            feat.action = f['properties']['action'][0]
            if feat.validates_count > 0:
                feat.validates_count = 0 if not feat.audit else 1
                Task.delete().where(Task.feature == feat).execute()
            feat.save()
            updated.add(ref)

    if deleted:
        q = Feature.delete().where(Feature.ref << list(deleted))
        q.execute()

    for ref, f_audit in audit.items():
        if ref in ref2feat and ref not in updated:
            if not f_audit:
                f_audit = None
            else:
                f_audit = json.dumps(f_audit, ensure_ascii=False, sort_keys=True)
            feat = ref2feat[ref]
            if f_audit != feat.audit:
                feat.audit = f_audit
                if feat.validates_count == 0 and f_audit:
                    feat.validates_count = 1
                feat.save()

    project.bbox = ','.join([str(x) for x in (minlon, minlat, maxlon, maxlat)])
    project.feature_count = Feature.select().where(Feature.project == project).count()
    project.features_js = None
    if Feature.select(fn.Count(fn.Distinct(Feature.region))).where(
            Feature.project == project).scalar() <= 1:
        project.regional = False
    project.save()


def update_audit(project):
    old_audit = json.loads(project.audit or '{}')
    query = Feature.select(Feature.ref, Feature.audit).where(
        Feature.project == project, Feature.audit.is_null(False)).tuples()
    audit = {}
    for feat in query:
        if feat[1]:
            audit[feat[0]] = json.loads(feat[1])
    data = json.dumps(audit, ensure_ascii=False)
    if audit != old_audit:
        project.audit = data
    return data


def update_features_cache(project):
    query = Feature.select(Feature.ref, Feature.lat, Feature.lon, Feature.action).where(
            Feature.project == project).tuples()
    features = []
    for ref, lat, lon, action in query:
        features.append([ref, [lat/1e7, lon/1e7], action])
    project.features_js = json.dumps(features, ensure_ascii=False).encode('utf-8')
